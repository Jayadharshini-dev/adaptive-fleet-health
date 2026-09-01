"""
Unified Health & Risk Engine for Phase 3.
Coordinates feature extraction, anomaly detection, evidence strength scoring,
primary anomaly resolution, severity/confidence calculation, and HealthResult generation.
"""

import math
from dataclasses import dataclass
from typing import Dict, Any, Optional, List
from intelligence.baseline.baseline_config import BaselineConfig, CANONICAL_METRICS
from intelligence.baseline.adaptive_baseline import DeviceBaseline
from intelligence.baseline.baseline_manager import BaselineManager
from intelligence.features.feature_extractor import FeatureExtractor, DeviceFeatures
from intelligence.detection import (
    DetectorEvidence,
    DriftDetector,
    SpikeDetector,
    FlatlineDetector,
    OscillationDetector,
    SensorSwapDetector,
)
from intelligence.models.health_result import HealthResult


@dataclass
class HealthEngineConfig:
    """
    Centralized configuration parameters for Phase 3 HealthEngine classification and scoring.
    """
    warning_severity_threshold: float = 0.35
    critical_severity_threshold: float = 0.70
    min_confidence_threshold: float = 0.40

    def validate(self) -> None:
        """Validates configuration parameters."""
        if not (0.0 < self.warning_severity_threshold < self.critical_severity_threshold <= 1.0):
            raise ValueError("Invalid severity thresholds: warning must be < critical and <= 1.0")


ANOMALY_PRECEDENCE_RANK: Dict[str, int] = {
    "sensor_swap": 5,
    "spike": 4,
    "drift": 3,
    "oscillation": 2,
    "flatline": 1,
    "none": 0,
}


class HealthEngine:
    """
    Unified Intelligence Health & Risk Engine.
    Processes telemetry, executes feature extraction and anomaly detectors,
    resolves primary anomalies, computes normalized severity/confidence, and generates
    structured HealthResult outputs.
    """

    def __init__(
        self,
        config: Optional[HealthEngineConfig] = None,
        baseline_config: Optional[BaselineConfig] = None,
    ):
        self.config = config or HealthEngineConfig()
        self.config.validate()

        self.drift_detector = DriftDetector()
        self.spike_detector = SpikeDetector()
        self.flatline_detector = FlatlineDetector()
        self.oscillation_detector = OscillationDetector()
        self.sensor_swap_detector = SensorSwapDetector()

    def process_telemetry(
        self,
        telemetry: Dict[str, Any],
        baseline_manager: BaselineManager,
        fleet_baselines: Optional[Dict[str, Dict[str, Any]]] = None,
    ) -> HealthResult:
        """
        Processes a telemetry packet in STRICT PIPELINE ORDER:
        1. Resolve device identity.
        2. Get existing pre-observation DeviceBaseline state.
        3. Extract features of current observation against pre-observation baseline/history.
        4. Execute all 5 anomaly detectors.
        5. Aggregate DetectorEvidence into HealthResult (Status, Primary Anomaly, Severity, Confidence, Explanation).
        6. AFTER evaluation, update adaptive baseline with current observation.
        """
        if not isinstance(telemetry, dict):
            raise ValueError("Telemetry packet must be a dictionary")

        device_key = baseline_manager.resolve_device_key(telemetry)
        device_baseline = baseline_manager.get_or_create(device_key)

        # Retrieve fleet baselines before updating current device if not provided
        if fleet_baselines is None:
            fleet_baselines = baseline_manager.get_all_baselines()

        # STEP 1: Feature Extraction against existing pre-observation baseline state
        device_features = FeatureExtractor.extract_device_features(telemetry, device_baseline)

        # STEP 2: Execute all 5 anomaly detectors independently
        evidences: List[DetectorEvidence] = []

        # Single-metric detectors across canonical metrics
        for m_name, mf in device_features.metrics.items():
            evidences.append(self.drift_detector.detect(mf))
            evidences.append(self.spike_detector.detect(mf))
            evidences.append(self.flatline_detector.detect(mf))
            evidences.append(self.oscillation_detector.detect(mf))

        # Multi-metric cross-device SensorSwap detector
        ev_swap = self.sensor_swap_detector.detect_device(device_features, fleet_baselines)
        evidences.append(ev_swap)

        # STEP 3: Aggregate Detector Evidence into HealthResult
        health_result = self.evaluate_health_result(
            device_key=device_key,
            telemetry=telemetry,
            device_baseline=device_baseline,
            device_features=device_features,
            evidences=evidences,
        )

        # STEP 4: Adapt baseline AFTER detection completes (preserving pre-observation evaluation)
        baseline_manager.process_telemetry(telemetry)

        return health_result

    def evaluate_health_result(
        self,
        device_key: str,
        telemetry: Dict[str, Any],
        device_baseline: DeviceBaseline,
        device_features: DeviceFeatures,
        evidences: List[DetectorEvidence],
    ) -> HealthResult:
        """
        Combines detector evidences into unified HealthResult contract.
        """
        device_id = telemetry.get("device_id", device_key) if isinstance(telemetry, dict) else device_key
        instance_id = telemetry.get("device_instance_id") if isinstance(telemetry, dict) else None
        region = telemetry.get("region") if isinstance(telemetry, dict) else None
        timestamp = telemetry.get("timestamp") if isinstance(telemetry, dict) else None
        is_mature = device_baseline.is_mature

        raw_metrics = device_features.raw_metrics
        baseline_summary = device_baseline.to_dict().get("metrics", {})

        # Filter triggered evidences
        triggered = [ev for ev in evidences if ev.detected]

        if not triggered:
            # NO ANOMALY CASE
            status = "healthy"
            primary_anomaly = "none"
            severity = 0.0
            confidence = 0.95 if is_mature else 0.50
            explanation = f"Device [{device_key}] is operating normally within learned adaptive baseline parameters."
            detector_dicts = [ev.to_dict() for ev in evidences if ev.score > 0.0]
        else:
            # Helper to calculate precedence rank for sorting
            def _ev_rank(ev: DetectorEvidence) -> float:
                strength = ev.score * ev.confidence
                # Give multi-metric sensor_swap structural precedence when triggered
                if ev.anomaly_type == "sensor_swap" and ev.score >= 0.60:
                    return strength + 0.50
                return strength

            # Sort triggered detectors by evidence strength and structural rank descending
            sorted_triggered = sorted(triggered, key=_ev_rank, reverse=True)

            primary_ev = sorted_triggered[0]
            primary_anomaly = primary_ev.anomaly_type

            # Base severity from primary evidence strength
            base_severity = primary_ev.score * primary_ev.confidence

            # Multi-detector agreement booster: +0.05 for each additional distinct strong detector
            distinct_types = set(ev.anomaly_type for ev in triggered if ev.score >= 0.5 and ev.confidence >= 0.5)
            agreement_bonus = 0.05 * max(0, len(distinct_types) - 1)

            severity = min(1.0, base_severity + agreement_bonus)

            # Confidence calculation derived from primary evidence and baseline maturity
            maturity_factor = 1.0 if is_mature else 0.60
            confidence = min(1.0, primary_ev.confidence * maturity_factor)

            # Health Status Classification
            if severity < self.config.warning_severity_threshold:
                status = "healthy"
            elif severity < self.config.critical_severity_threshold:
                status = "warning"
            else:
                # Cap at warning if baseline is warming up
                status = "critical" if is_mature else "warning"

            # Generate Human-Readable Explanation
            explanation = self.generate_explanation(primary_ev, device_key, raw_metrics, baseline_summary)
            detector_dicts = [ev.to_dict() for ev in triggered]

        return HealthResult(
            device_id=device_id,
            device_instance_id=instance_id,
            region=region,
            status=status,
            anomaly_type=primary_anomaly,
            severity=round(severity, 4),
            confidence=round(confidence, 4),
            current_metrics=raw_metrics,
            baseline_metrics=baseline_summary,
            detectors=detector_dicts,
            explanation=explanation,
            timestamp=timestamp,
            is_mature=is_mature,
        )

    def generate_explanation(
        self,
        ev: DetectorEvidence,
        device_key: str,
        raw_metrics: Dict[str, Any],
        baseline_summary: Dict[str, Any],
    ) -> str:
        """
        Generates explainable human-readable description derived from actual evidence.
        """
        a_type = ev.anomaly_type
        m_name = ev.metric
        evidence_dict = ev.evidence

        cur_val = raw_metrics.get(m_name)
        b_info = baseline_summary.get(m_name, {})
        b_mean = b_info.get("mean")
        b_std = b_info.get("std_dev")

        if a_type == "drift":
            dir_str = evidence_dict.get("direction", "directional").replace("_drift", "")
            return (
                f"{m_name.capitalize()} ({cur_val}) shows sustained {dir_str} movement and is "
                f"{evidence_dict.get('abs_z_score', 0):.1f} standard deviations from {device_key}'s learned baseline of {b_mean}."
            )
        elif a_type == "spike":
            dir_str = "upward" if ev.evidence.get("direction") == "positive_spike" else "downward"
            return (
                f"{m_name.capitalize()} ({cur_val}) spiked sharply {dir_str}, reaching "
                f"{evidence_dict.get('abs_z_score', 0):.1f} standard deviations above {device_key}'s learned baseline of {b_mean}."
            )
        elif a_type == "flatline":
            return (
                f"{m_name.capitalize()} ({cur_val}) has remained unnaturally constant across recent observations "
                f"despite {device_key}'s learned historical variability."
            )
        elif a_type == "oscillation":
            return (
                f"{m_name.capitalize()} ({cur_val}) exhibits repeated alternating fluctuations with peak-to-peak range "
                f"({evidence_dict.get('recent_range', 0):.1f}) beyond {device_key}'s learned noise variability."
            )
        elif a_type == "sensor_swap":
            cand = evidence_dict.get("candidate_swapped_device", "another device")
            return (
                f"Multiple telemetry metrics for {device_key} have shifted toward candidate device {cand}'s learned operating profile "
                f"while becoming strongly inconsistent with {device_key}'s own learned baseline."
            )
        else:
            return f"Device [{device_key}] is operating normally within learned adaptive baseline parameters."

"""
Sensor Swap Detector.
Detects when a device's measurement pattern matches another fleet device's learned normal operating profile
while being severely anomalous for its own learned profile.
"""

import math
from typing import Dict, Any, Optional, List
from intelligence.baseline.baseline_config import CANONICAL_METRICS
from intelligence.features.feature_extractor import DeviceFeatures
from intelligence.detection.base import DetectorEvidence


class SensorSwapDetector:
    """
    Detects conservative sensor swap anomalies using multi-metric cross-device profile matching.
    Compares target device features against fleet baselines.
    """

    anomaly_type: str = "sensor_swap"

    def __init__(
        self,
        min_self_z_threshold: float = 4.0,
        max_other_z_threshold: float = 1.5,
        min_matching_metrics: int = 3,
        min_samples: int = 10,
    ):
        self.min_self_z_threshold = min_self_z_threshold
        self.max_other_z_threshold = max_other_z_threshold
        self.min_matching_metrics = min_matching_metrics
        self.min_samples = min_samples

    def detect_device(
        self,
        device_features: DeviceFeatures,
        fleet_baselines: Optional[Dict[str, Dict[str, Any]]] = None,
    ) -> DetectorEvidence:
        """
        Evaluates device features against fleet baselines to detect sensor swap evidence.
        """
        device_key = device_features.device_key

        if not device_features.is_mature:
            return DetectorEvidence(
                anomaly_type=self.anomaly_type,
                detected=False,
                score=0.0,
                confidence=0.0,
                metric="cross_metric",
                evidence={"reason": "insufficient_device_maturity", "device_key": device_key},
            )

        if not fleet_baselines or len(fleet_baselines) < 2:
            return DetectorEvidence(
                anomaly_type=self.anomaly_type,
                detected=False,
                score=0.0,
                confidence=0.0,
                metric="cross_metric",
                evidence={"reason": "fleet_baselines_unavailable_or_single_device"},
            )

        raw_metrics = device_features.raw_metrics
        if not raw_metrics or not isinstance(raw_metrics, dict):
            return DetectorEvidence(
                anomaly_type=self.anomaly_type,
                detected=False,
                score=0.0,
                confidence=0.0,
                metric="cross_metric",
                evidence={"reason": "missing_raw_metrics"},
            )

        # 1. Evaluate self-anomaly: Calculate Z-scores relative to target device's OWN learned baseline
        self_z_scores: Dict[str, float] = {}
        high_self_z_count = 0

        for m_name, mf in device_features.metrics.items():
            val = mf.current_value
            if val is not None and mf.baseline_mean is not None:
                std_b = max(mf.baseline_std, 1e-4)
                z_self = abs(val - mf.baseline_mean) / std_b
                self_z_scores[m_name] = round(z_self, 4)
                if z_self >= self.min_self_z_threshold:
                    high_self_z_count += 1

        # Must be significantly anomalous relative to own baseline across multiple metrics
        if high_self_z_count < self.min_matching_metrics:
            return DetectorEvidence(
                anomaly_type=self.anomaly_type,
                detected=False,
                score=0.0,
                confidence=0.5,
                metric="cross_metric",
                evidence={
                    "reason": "insufficient_self_anomaly",
                    "high_self_z_count": high_self_z_count,
                    "self_z_scores": self_z_scores,
                },
            )

        # 2. Cross-Device Match: Search fleet baselines for another mature device whose profile closely matches raw_metrics
        best_candidate: Optional[str] = None
        best_candidate_match_count = 0
        best_candidate_z_scores: Dict[str, float] = {}
        min_avg_other_z = float("inf")

        for other_key, other_baseline_summary in fleet_baselines.items():
            if other_key == device_key:
                continue

            if not other_baseline_summary.get("is_mature", False):
                continue

            other_metrics = other_baseline_summary.get("metrics", {})
            other_z_scores: Dict[str, float] = {}
            matching_metric_count = 0
            other_z_sum = 0.0

            for m_name in CANONICAL_METRICS:
                if m_name in raw_metrics and m_name in other_metrics:
                    val = raw_metrics[m_name]
                    if val is not None and isinstance(val, (int, float)):
                        o_mean = other_metrics[m_name].get("mean")
                        o_std = other_metrics[m_name].get("std_dev")
                        if o_mean is not None and o_std is not None:
                            std_o = max(float(o_std), 1.0)
                            z_other = abs(float(val) - float(o_mean)) / std_o
                            other_z_scores[m_name] = round(z_other, 4)
                            other_z_sum += z_other
                            if z_other <= self.max_other_z_threshold:
                                matching_metric_count += 1

            if matching_metric_count >= self.min_matching_metrics:
                avg_z = other_z_sum / max(1, len(other_z_scores))
                if avg_z < min_avg_other_z:
                    min_avg_other_z = avg_z
                    best_candidate = other_key
                    best_candidate_match_count = matching_metric_count
                    best_candidate_z_scores = other_z_scores

        detected = (best_candidate is not None) and (best_candidate_match_count >= self.min_matching_metrics)

        if detected:
            score = min(1.0, 0.7 + 0.3 * (1.0 - min_avg_other_z / self.max_other_z_threshold))
            confidence = min(1.0, 0.75 + 0.25 * (best_candidate_match_count / len(CANONICAL_METRICS)))
        else:
            score = 0.0
            confidence = 0.5

        return DetectorEvidence(
            anomaly_type=self.anomaly_type,
            detected=detected,
            score=score,
            confidence=confidence,
            metric="cross_metric",
            evidence={
                "candidate_swapped_device": best_candidate if detected else "none",
                "matching_metric_count": best_candidate_match_count,
                "self_z_scores": self_z_scores,
                "candidate_device_z_scores": best_candidate_z_scores if detected else {},
                "device_key": device_key,
            },
        )

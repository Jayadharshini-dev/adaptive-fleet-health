"""
Oscillation Detector.
Detects abnormal, structured alternating periodic fluctuations. Primary for vibration metric.
"""

from typing import Dict, Any, Optional
from intelligence.features.feature_extractor import MetricFeatures
from intelligence.detection.base import BaseDetector, DetectorEvidence


class OscillationDetector(BaseDetector):
    """
    Detects abnormal oscillation using device-relative features:
    Alternating sign flips of first differences, sign change counts,
    first-difference step jump ratio, and peak-to-peak amplitude relative to baseline noise (std_dev).
    """

    anomaly_type: str = "oscillation"

    def __init__(
        self,
        min_alternating_ratio: float = 0.70,
        min_sign_changes: int = 3,
        min_amplitude_ratio: float = 3.5,
        min_first_diff_ratio: float = 3.5,
        min_absolute_range: float = 1.0,
        min_z_peak: float = 2.0,
        min_samples: int = 6,
    ):
        self.min_alternating_ratio = min_alternating_ratio
        self.min_sign_changes = min_sign_changes
        self.min_amplitude_ratio = min_amplitude_ratio
        self.min_first_diff_ratio = min_first_diff_ratio
        self.min_absolute_range = min_absolute_range
        self.min_z_peak = min_z_peak
        self.min_samples = min_samples

    def detect(self, features: MetricFeatures) -> DetectorEvidence:
        """
        Evaluates metric features for oscillation evidence.
        """
        if not features.is_mature or features.sample_count < self.min_samples:
            return DetectorEvidence(
                anomaly_type=self.anomaly_type,
                detected=False,
                score=0.0,
                confidence=0.0,
                metric=features.metric_name,
                evidence={"reason": "insufficient_samples", "sample_count": features.sample_count},
            )

        if features.current_value is None:
            return DetectorEvidence(
                anomaly_type=self.anomaly_type,
                detected=False,
                score=0.0,
                confidence=0.0,
                metric=features.metric_name,
                evidence={"reason": "missing_value"},
            )

        # Constant repeat values indicate flatline, not oscillation
        if features.repeat_count >= 4 or features.recent_range < self.min_absolute_range:
            return DetectorEvidence(
                anomaly_type=self.anomaly_type,
                detected=False,
                score=0.0,
                confidence=0.5,
                metric=features.metric_name,
                evidence={"reason": "constant_or_insufficient_range"},
            )

        std_b = max(features.baseline_std, 1e-4)

        # Peak-to-peak amplitude ratio and step jump ratio relative to learned baseline noise
        amplitude_ratio = features.recent_range / std_b
        first_diff_ratio = abs(features.first_difference) / std_b
        abs_z = abs(features.z_score)

        sign_satisfied = features.sign_changes >= self.min_sign_changes
        alternating_satisfied = features.alternating_ratio >= self.min_alternating_ratio
        amplitude_satisfied = amplitude_ratio >= self.min_amplitude_ratio and features.recent_range >= self.min_absolute_range
        diff_satisfied = first_diff_ratio >= self.min_first_diff_ratio
        z_satisfied = abs_z >= self.min_z_peak

        # Oscillation requires structured alternations, significant amplitude, peak deviation, AND large peak-to-trough step jumps
        detected = sign_satisfied and alternating_satisfied and amplitude_satisfied and diff_satisfied and z_satisfied

        if detected:
            score_raw = 0.6 + 0.25 * features.alternating_ratio + 0.15 * min(1.0, amplitude_ratio / 6.0)
            score = min(1.0, max(0.0, score_raw))
            confidence = min(1.0, 0.7 + 0.3 * min(1.0, features.sign_changes / 8.0))
        else:
            if sign_satisfied and alternating_satisfied:
                score = min(0.35, 0.2 * features.alternating_ratio)
            else:
                score = 0.0
            confidence = 0.5

        return DetectorEvidence(
            anomaly_type=self.anomaly_type,
            detected=detected,
            score=score,
            confidence=confidence,
            metric=features.metric_name,
            evidence={
                "sign_changes": features.sign_changes,
                "alternating_ratio": round(features.alternating_ratio, 4),
                "recent_range": round(features.recent_range, 4),
                "amplitude_ratio": round(amplitude_ratio, 4),
                "first_diff_ratio": round(first_diff_ratio, 4),
                "baseline_std": round(features.baseline_std, 4),
                "current_value": round(features.current_value, 4),
            },
        )

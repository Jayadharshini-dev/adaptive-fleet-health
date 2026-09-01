"""
Flatline Detector.
Detects unnaturally constant sensor values relative to historical learned variability.
"""

from typing import Dict, Any, Optional
from intelligence.features.feature_extractor import MetricFeatures
from intelligence.detection.base import BaseDetector, DetectorEvidence


class FlatlineDetector(BaseDetector):
    """
    Detects flatline anomalies using device-relative variability features:
    Compares recent rolling variance against learned baseline variance and checks repeat counts.
    Protects naturally low-variance devices from false positives.
    """

    anomaly_type: str = "flatline"

    def __init__(
        self,
        max_variance_ratio: float = 0.05,
        min_repeat_count: int = 5,
        min_baseline_std: float = 0.05,
        min_samples: int = 10,
    ):
        self.max_variance_ratio = max_variance_ratio
        self.min_repeat_count = min_repeat_count
        self.min_baseline_std = min_baseline_std
        self.min_samples = min_samples

    def detect(self, features: MetricFeatures) -> DetectorEvidence:
        """
        Evaluates metric features for flatline evidence.
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

        # Baseline variability check: If device naturally operates with near-zero std, it's not a flatline anomaly
        if features.baseline_std < self.min_baseline_std:
            return DetectorEvidence(
                anomaly_type=self.anomaly_type,
                detected=False,
                score=0.0,
                confidence=0.8,
                metric=features.metric_name,
                evidence={
                    "reason": "naturally_low_variance_device",
                    "baseline_std": round(features.baseline_std, 4),
                },
            )

        # Compare recent window variance against learned baseline variance
        var_baseline = max(features.baseline_variance, 1e-6)
        variance_ratio = features.recent_variance / var_baseline

        repeat_satisfied = features.repeat_count >= self.min_repeat_count
        variance_satisfied = variance_ratio <= self.max_variance_ratio

        detected = repeat_satisfied or (variance_satisfied and len(features.window_values) >= self.min_repeat_count)

        if detected:
            score_raw = 0.7 + 0.3 * min(1.0, features.repeat_count / 10.0)
            score = min(1.0, max(0.0, score_raw))
            confidence = min(1.0, 0.75 + 0.25 * min(1.0, features.repeat_count / 8.0))
        else:
            score = 0.0
            confidence = 0.6

        return DetectorEvidence(
            anomaly_type=self.anomaly_type,
            detected=detected,
            score=score,
            confidence=confidence,
            metric=features.metric_name,
            evidence={
                "repeat_count": features.repeat_count,
                "recent_variance": round(features.recent_variance, 4),
                "baseline_variance": round(features.baseline_variance, 4),
                "variance_ratio": round(variance_ratio, 4),
                "recent_range": round(features.recent_range, 4),
                "current_value": round(features.current_value, 4),
            },
        )

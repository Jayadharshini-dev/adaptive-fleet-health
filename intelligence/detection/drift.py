"""
Drift Detector.
Detects gradual, sustained directional movement away from a device's learned baseline.
"""

import math
from typing import Dict, Any, Optional
from intelligence.features.feature_extractor import MetricFeatures
from intelligence.detection.base import BaseDetector, DetectorEvidence


class DriftDetector(BaseDetector):
    """
    Detects sustained directional drift (positive or negative) using device-relative features:
    Z-score distance, directional consistency, and slope relative to device baseline standard deviation.
    """

    anomaly_type: str = "drift"

    def __init__(
        self,
        min_z_threshold: float = 2.2,
        min_direction_consistency: float = 0.65,
        min_trend_ratio: float = 0.15,
        min_active_steps: int = 3,
        min_samples: int = 10,
    ):
        self.min_z_threshold = min_z_threshold
        self.min_direction_consistency = min_direction_consistency
        self.min_trend_ratio = min_trend_ratio
        self.min_active_steps = min_active_steps
        self.min_samples = min_samples

    def detect(self, features: MetricFeatures) -> DetectorEvidence:
        """
        Evaluates metric features for drift evidence.
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

        # Drift requires multiple active steps moving in a consistent direction
        window = features.window_values
        if len(window) >= 2:
            diffs = [window[i] - window[i - 1] for i in range(1, len(window))]
            active_diffs = [d for d in diffs if abs(d) > 0.001]
        else:
            active_diffs = []

        if len(active_diffs) < self.min_active_steps:
            return DetectorEvidence(
                anomaly_type=self.anomaly_type,
                detected=False,
                score=0.0,
                confidence=0.5,
                metric=features.metric_name,
                evidence={"reason": "insufficient_active_steps", "active_steps": len(active_diffs)},
            )

        abs_z = abs(features.z_score)
        dir_consistency = features.direction_consistency
        std_b = max(features.baseline_std, 1e-4)

        # Trend magnitude normalized by baseline standard deviation
        trend_ratio = abs(features.recent_trend) / std_b

        # Check for sustained directional movement
        z_satisfied = abs_z >= self.min_z_threshold
        dir_satisfied = dir_consistency >= self.min_direction_consistency
        trend_satisfied = trend_ratio >= self.min_trend_ratio

        # Determine drift detection status
        detected = z_satisfied and dir_satisfied and trend_satisfied

        if detected:
            score_raw = 0.5 + 0.3 * (abs_z / 5.0) + 0.2 * dir_consistency
            score = min(1.0, max(0.0, score_raw))
            confidence = min(1.0, 0.6 + 0.4 * dir_consistency)
        else:
            if z_satisfied or dir_satisfied:
                score = min(0.4, 0.2 * (abs_z / 4.0) + 0.2 * dir_consistency)
            else:
                score = 0.0
            confidence = 0.5

        direction_str = "positive_drift" if features.recent_trend > 0 else "negative_drift"

        return DetectorEvidence(
            anomaly_type=self.anomaly_type,
            detected=detected,
            score=score,
            confidence=confidence,
            metric=features.metric_name,
            evidence={
                "direction": direction_str if detected else "none",
                "abs_z_score": round(abs_z, 4),
                "direction_consistency": round(dir_consistency, 4),
                "trend_ratio": round(trend_ratio, 4),
                "recent_trend": round(features.recent_trend, 4),
                "distance_from_baseline": round(features.distance_from_baseline, 4),
                "baseline_mean": round(features.baseline_mean, 4) if features.baseline_mean is not None else None,
                "current_value": round(features.current_value, 4),
                "active_steps": len(active_diffs),
            },
        )

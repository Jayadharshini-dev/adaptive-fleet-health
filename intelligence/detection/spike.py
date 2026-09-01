"""
Spike Detector.
Detects sudden, short-lived extreme excursions relative to learned per-device baselines.
"""

import math
from typing import Dict, Any, Optional
from intelligence.features.feature_extractor import MetricFeatures
from intelligence.detection.base import BaseDetector, DetectorEvidence


class SpikeDetector(BaseDetector):
    """
    Detects sudden abnormal spikes (positive or negative) using device-relative features:
    Z-score distance and first-difference step jump relative to learned standard deviation.
    """

    anomaly_type: str = "spike"

    def __init__(
        self,
        min_z_threshold: float = 3.0,
        min_first_diff_ratio: float = 2.0,
        min_samples: int = 5,
    ):
        self.min_z_threshold = min_z_threshold
        self.min_first_diff_ratio = min_first_diff_ratio
        self.min_samples = min_samples

    def detect(self, features: MetricFeatures) -> DetectorEvidence:
        """
        Evaluates metric features for spike evidence.
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

        # Baseline std floor to avoid dividing by near-zero synthetic warmup variance
        std_b = max(features.baseline_std, 0.1)
        abs_z = abs(features.current_value - (features.baseline_mean or features.current_value)) / std_b

        # Step jump magnitude relative to baseline standard deviation floor
        first_diff_ratio = abs(features.first_difference) / std_b

        # A spike strictly requires high Z-score AND a sudden step jump (first difference)
        z_satisfied = abs_z >= self.min_z_threshold
        diff_satisfied = first_diff_ratio >= self.min_first_diff_ratio

        # Distinguish gradual multi-step slope or ongoing high-amplitude oscillation from a single sudden spike:
        is_gradual_slope = (
            features.direction_consistency >= 0.80
            and abs(features.first_difference) <= (0.65 * features.distance_from_baseline)
        )
        is_active_oscillation = (
            features.sign_changes >= 4
            and features.alternating_ratio >= 0.75
            and (features.recent_range / std_b) >= 3.5
        )

        detected = z_satisfied and diff_satisfied and (not is_gradual_slope) and (not is_active_oscillation)

        if detected:
            score_raw = 0.6 + 0.4 * min(1.0, (abs_z - self.min_z_threshold) / 4.0)
            score = min(1.0, max(0.0, score_raw))
            confidence = min(1.0, 0.7 + 0.3 * min(1.0, first_diff_ratio / 5.0))
        else:
            if z_satisfied:
                score = min(0.4, 0.1 * abs_z)
            else:
                score = 0.0
            confidence = 0.5

        spike_direction = "positive_spike" if features.z_score > 0 else "negative_spike"

        return DetectorEvidence(
            anomaly_type=self.anomaly_type,
            detected=detected,
            score=score,
            confidence=confidence,
            metric=features.metric_name,
            evidence={
                "direction": spike_direction if detected else "none",
                "abs_z_score": round(abs_z, 4),
                "first_difference": round(features.first_difference, 4),
                "first_diff_ratio": round(first_diff_ratio, 4),
                "distance_from_baseline": round(features.distance_from_baseline, 4),
                "is_gradual_slope": is_gradual_slope,
                "is_active_oscillation": is_active_oscillation,
                "current_value": round(features.current_value, 4),
                "baseline_mean": round(features.baseline_mean, 4) if features.baseline_mean is not None else None,
            },
        )

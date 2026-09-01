"""
Feature Extractor for deriving statistical and time-series signals
from incoming telemetry and per-device adaptive baselines.
"""

import math
from dataclasses import dataclass, field
from typing import Dict, Any, Optional, List
from intelligence.baseline.baseline_config import CANONICAL_METRICS
from intelligence.baseline.adaptive_baseline import MetricBaseline, DeviceBaseline


@dataclass
class MetricFeatures:
    """
    Derived statistical features for a single metric on a specific device instance.
    All properties are pure calculations; this object never mutates baseline state.
    """
    metric_name: str
    current_value: Optional[float]
    baseline_mean: Optional[float]
    baseline_std: float
    baseline_variance: float
    z_score: float
    distance_from_baseline: float
    recent_mean: float
    recent_std: float
    recent_variance: float
    recent_trend: float
    direction_consistency: float
    first_difference: float
    sign_changes: int
    alternating_ratio: float
    repeat_count: int
    recent_range: float
    is_mature: bool
    sample_count: int
    window_values: List[float] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        """Returns features as a serializable dictionary."""
        return {
            "metric_name": self.metric_name,
            "current_value": round(self.current_value, 4) if self.current_value is not None else None,
            "baseline_mean": round(self.baseline_mean, 4) if self.baseline_mean is not None else None,
            "baseline_std": round(self.baseline_std, 4),
            "baseline_variance": round(self.baseline_variance, 4),
            "z_score": round(self.z_score, 4),
            "distance_from_baseline": round(self.distance_from_baseline, 4),
            "recent_mean": round(self.recent_mean, 4),
            "recent_std": round(self.recent_std, 4),
            "recent_variance": round(self.recent_variance, 4),
            "recent_trend": round(self.recent_trend, 4),
            "direction_consistency": round(self.direction_consistency, 4),
            "first_difference": round(self.first_difference, 4),
            "sign_changes": self.sign_changes,
            "alternating_ratio": round(self.alternating_ratio, 4),
            "repeat_count": self.repeat_count,
            "recent_range": round(self.recent_range, 4),
            "is_mature": self.is_mature,
            "sample_count": self.sample_count,
            "window_count": len(self.window_values),
        }


@dataclass
class DeviceFeatures:
    """
    Aggregated feature set across all canonical metrics for a device.
    """
    device_key: str
    timestamp: Optional[str]
    metrics: Dict[str, MetricFeatures]
    is_mature: bool
    raw_metrics: Dict[str, Any]

    def to_dict(self) -> Dict[str, Any]:
        """Returns aggregated device features as a dictionary."""
        return {
            "device_key": self.device_key,
            "timestamp": self.timestamp,
            "is_mature": self.is_mature,
            "metrics": {name: mf.to_dict() for name, mf in self.metrics.items()},
            "raw_metrics": self.raw_metrics,
        }


class FeatureExtractor:
    """
    Pure read-only feature extraction engine.
    Calculates time-series and statistical features without mutating Phase 1 baselines.
    """

    @staticmethod
    def extract_metric_features(
        metric_name: str,
        current_value: Optional[float],
        metric_baseline: MetricBaseline,
    ) -> MetricFeatures:
        """
        Extracts features for a single metric from its baseline and recent window history.
        Handles both pre-observation evaluation and post-update feature snapshot gracefully.
        """
        val_clean: Optional[float] = None
        if current_value is not None and isinstance(current_value, (int, float)) and not math.isnan(current_value) and not math.isinf(current_value):
            val_clean = float(current_value)

        # Baseline stats snapshot
        mean_b = metric_baseline.mean if metric_baseline.sample_count > 0 else None
        std_b = metric_baseline.std_dev
        var_b = metric_baseline.variance
        sample_c = metric_baseline.sample_count
        is_mat = metric_baseline.is_mature

        # Calculate Z-score and scalar distance
        if val_clean is not None and mean_b is not None:
            z_val = metric_baseline.z_score(val_clean)
            dist_val = abs(val_clean - mean_b)
        else:
            z_val = 0.0
            dist_val = 0.0

        # Snapshot of recent rolling window values
        window = list(metric_baseline.recent_history)

        # Construct eval_window: if val_clean is not yet the last element of window, append it
        if val_clean is not None:
            if window and abs(val_clean - window[-1]) <= 1e-9:
                eval_window = list(window)
            else:
                eval_window = window + [val_clean]
        else:
            eval_window = list(window)

        eval_len = len(eval_window)

        if eval_len > 0:
            rec_mean = sum(eval_window) / float(eval_len)
            if eval_len > 1:
                rec_var = sum((x - rec_mean) ** 2 for x in eval_window) / (eval_len - 1)
            else:
                rec_var = 0.0
            rec_std = math.sqrt(max(rec_var, 1e-6))
            rec_range = max(eval_window) - min(eval_window)
        else:
            rec_mean = val_clean if val_clean is not None else 0.0
            rec_var = 0.0
            rec_std = 0.0
            rec_range = 0.0

        # Calculate first difference
        if eval_len >= 2:
            first_diff = float(eval_window[-1] - eval_window[-2])
        else:
            first_diff = 0.0

        # Calculate trend (slope over recent window)
        rec_trend = metric_baseline.get_recent_trend()

        # Calculate direction consistency, sign changes, and alternating ratio over eval_window
        dir_consistency = 0.0
        sign_changes = 0
        alternating_ratio = 0.0

        if eval_len >= 2:
            diffs = [eval_window[i] - eval_window[i - 1] for i in range(1, eval_len)]
            active_diffs = [d for d in diffs if abs(d) > 0.001]

            if active_diffs:
                pos_steps = sum(1 for d in active_diffs if d > 0)
                neg_steps = sum(1 for d in active_diffs if d < 0)
                dir_consistency = max(pos_steps, neg_steps) / float(len(active_diffs))

                for i in range(1, len(active_diffs)):
                    if (active_diffs[i] * active_diffs[i - 1]) < 0:
                        sign_changes += 1

                max_alt = len(active_diffs) - 1
                if max_alt > 0:
                    alternating_ratio = float(sign_changes) / float(max_alt)

        # Calculate repeat count
        repeat_count = 1
        if eval_len >= 2:
            last_val = eval_window[-1]
            for val in reversed(eval_window[:-1]):
                if abs(val - last_val) <= 0.001:
                    repeat_count += 1
                else:
                    break

        return MetricFeatures(
            metric_name=metric_name,
            current_value=val_clean,
            baseline_mean=mean_b,
            baseline_std=std_b,
            baseline_variance=var_b,
            z_score=z_val,
            distance_from_baseline=dist_val,
            recent_mean=rec_mean,
            recent_std=rec_std,
            recent_variance=rec_var,
            recent_trend=rec_trend,
            direction_consistency=dir_consistency,
            first_difference=first_diff,
            sign_changes=sign_changes,
            alternating_ratio=alternating_ratio,
            repeat_count=repeat_count,
            recent_range=rec_range,
            is_mature=is_mat,
            sample_count=sample_c,
            window_values=eval_window,
        )

    @classmethod
    def extract_device_features(
        cls,
        telemetry: Dict[str, Any],
        device_baseline: DeviceBaseline,
    ) -> DeviceFeatures:
        """
        Extracts features across all canonical metrics for a given telemetry packet and device baseline.
        """
        device_key = device_baseline.device_key
        timestamp = telemetry.get("timestamp") if isinstance(telemetry, dict) else None
        metrics_raw = telemetry.get("metrics", {}) if isinstance(telemetry, dict) else {}

        metric_features: Dict[str, MetricFeatures] = {}
        for m_name in CANONICAL_METRICS:
            val = metrics_raw.get(m_name) if isinstance(metrics_raw, dict) else None
            m_baseline = device_baseline.get_metric_baseline(m_name)
            if m_baseline:
                metric_features[m_name] = cls.extract_metric_features(
                    metric_name=m_name,
                    current_value=val,
                    metric_baseline=m_baseline,
                )

        return DeviceFeatures(
            device_key=device_key,
            timestamp=timestamp,
            metrics=metric_features,
            is_mature=device_baseline.is_mature,
            raw_metrics=metrics_raw if isinstance(metrics_raw, dict) else {},
        )

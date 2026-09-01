"""
Adaptive Per-Device Baseline Engine.
Maintains independent streaming statistics for individual metrics and device instances.
"""

import math
from collections import deque
from typing import Dict, Any, Optional, List
from intelligence.baseline.baseline_config import BaselineConfig, CANONICAL_METRICS


class MetricBaseline:
    """
    Learns and maintains an adaptive statistical baseline for a single metric.
    Uses EWMA (Exponentially Weighted Moving Average) and EWMV (Exponentially
    Weighted Moving Variance) with bounded rolling memory and outlier protection.
    """

    def __init__(self, metric_name: str, config: Optional[BaselineConfig] = None):
        self.metric_name = metric_name
        self.config = config or BaselineConfig()
        self.config.validate()

        self.sample_count: int = 0
        self.mean: float = 0.0
        self.variance: float = 0.0
        self.min_value: float = float("inf")
        self.max_value: float = float("-inf")
        self.recent_history: deque = deque(maxlen=self.config.rolling_window_size)

    @property
    def is_mature(self) -> bool:
        """Returns True if minimum warm-up observations have been recorded."""
        return self.sample_count >= self.config.warmup_observations

    @property
    def std_dev(self) -> float:
        """Returns the current standard deviation with variance floor protection."""
        return math.sqrt(max(self.variance, self.config.min_variance))

    def z_score(self, value: float) -> float:
        """
        Calculates the Z-score distance of a value relative to the current learned baseline.
        Returns 0.0 if no observations have been recorded yet.
        """
        if self.sample_count == 0 or value is None:
            return 0.0
        return (value - self.mean) / self.std_dev

    def distance_from_baseline(self, value: float) -> float:
        """Calculates absolute scalar distance from the current baseline mean."""
        if self.sample_count == 0 or value is None:
            return 0.0
        return abs(value - self.mean)

    def update(self, value: Optional[float]) -> Dict[str, Any]:
        """
        Updates the adaptive metric baseline with a new observation.
        Includes outlier protection to prevent single extreme anomalies from corrupting baseline.

        Returns updated metric baseline statistics.
        """
        if value is None or not isinstance(value, (int, float)) or math.isnan(value) or math.isinf(value):
            return self.to_dict()

        value = float(value)
        self.sample_count += 1
        self.min_value = min(self.min_value, value)
        self.max_value = max(self.max_value, value)
        self.recent_history.append(value)

        # Initial observation setup
        if self.sample_count == 1:
            self.mean = value
            self.variance = self.config.min_variance
            return self.to_dict()

        # Check for outlier status relative to existing learned baseline
        current_z = abs((value - self.mean) / self.std_dev)
        is_outlier = self.is_mature and (current_z > self.config.outlier_z_threshold)

        # Down-weight update step if observation is a severe outlier
        if is_outlier:
            effective_alpha = self.config.alpha * self.config.outlier_alpha_multiplier
            effective_alpha_var = self.config.alpha_var * self.config.outlier_alpha_multiplier
        else:
            effective_alpha = self.config.alpha
            effective_alpha_var = self.config.alpha_var

        # EWMA Mean update
        delta = value - self.mean
        self.mean += effective_alpha * delta

        # EWMA Variance update
        delta_after = value - self.mean
        sample_var = delta * delta_after
        self.variance = (1.0 - effective_alpha_var) * self.variance + effective_alpha_var * sample_var
        self.variance = max(self.variance, self.config.min_variance)

        return self.to_dict()

    def get_recent_trend(self) -> float:
        """
        Calculates simple first-difference trend over bounded rolling history.
        Returns 0.0 if history has fewer than 2 samples.
        """
        if len(self.recent_history) < 2:
            return 0.0
        return float(self.recent_history[-1] - self.recent_history[0]) / len(self.recent_history)

    def to_dict(self) -> Dict[str, Any]:
        """Returns baseline statistics as a serializable dictionary."""
        has_samples = self.sample_count > 0
        return {
            "metric": self.metric_name,
            "mean": round(self.mean, 4) if has_samples else None,
            "std_dev": round(self.std_dev, 4) if has_samples else None,
            "variance": round(self.variance, 4) if has_samples else None,
            "min": round(self.min_value, 4) if has_samples and not math.isinf(self.min_value) else None,
            "max": round(self.max_value, 4) if has_samples and not math.isinf(self.max_value) else None,
            "samples": self.sample_count,
            "is_mature": self.is_mature,
            "recent_window_count": len(self.recent_history),
        }


class DeviceBaseline:
    """
    Manages baseline state for all canonical telemetry metrics of a specific device instance.
    Guarantees that a device's baselines remain completely isolated from other devices.
    """

    def __init__(self, device_key: str, config: Optional[BaselineConfig] = None):
        self.device_key = device_key
        self.config = config or BaselineConfig()
        self.metrics_baselines: Dict[str, MetricBaseline] = {
            metric: MetricBaseline(metric_name=metric, config=self.config)
            for metric in CANONICAL_METRICS
        }

    @property
    def is_mature(self) -> bool:
        """Returns True if all canonical metric baselines have reached maturity."""
        return all(m.is_mature for m in self.metrics_baselines.values())

    def get_metric_baseline(self, metric_name: str) -> Optional[MetricBaseline]:
        """Retrieves MetricBaseline instance for a specific metric."""
        return self.metrics_baselines.get(metric_name)

    def process_telemetry(self, metrics: Dict[str, Any]) -> Dict[str, Any]:
        """
        Updates baselines for all canonical metrics present in the telemetry dictionary.
        Ignores missing or unexpected metric keys safely.
        """
        if not isinstance(metrics, dict):
            return self.to_dict()

        for metric_name in CANONICAL_METRICS:
            if metric_name in metrics:
                val = metrics[metric_name]
                self.metrics_baselines[metric_name].update(val)

        return self.to_dict()

    def to_dict(self) -> Dict[str, Any]:
        """Returns full device baseline state dictionary."""
        return {
            "device_key": self.device_key,
            "is_mature": self.is_mature,
            "metrics": {
                name: m.to_dict() for name, m in self.metrics_baselines.items()
            },
        }

    def summary_text(self) -> str:
        """Generates explainable natural-language baseline summary for logging and UI display."""
        parts = []
        for name in CANONICAL_METRICS:
            mb = self.metrics_baselines[name]
            if mb.sample_count > 0:
                parts.append(f"{name}={mb.mean:.1f} (±{mb.std_dev:.1f})")
            else:
                parts.append(f"{name}=unlearned")
        maturity_str = "mature" if self.is_mature else "warming up"
        return f"Device [{self.device_key}] ({maturity_str}): " + ", ".join(parts)

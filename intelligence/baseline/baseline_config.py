"""
Centralized Configuration for Adaptive Per-Device Baseline Engine.
"""

from dataclasses import dataclass
from typing import Tuple

CANONICAL_METRICS: Tuple[str, ...] = ("temperature", "vibration", "current", "rpm")


@dataclass
class BaselineConfig:
    """
    Configuration parameters for per-device adaptive baseline calculations.
    Centralized to avoid scattering magic numbers across the intelligence layer.
    """
    warmup_observations: int = 15
    alpha: float = 0.1
    alpha_var: float = 0.05
    rolling_window_size: int = 30
    outlier_z_threshold: float = 3.0
    outlier_alpha_multiplier: float = 0.05
    min_variance: float = 1e-4

    def validate(self) -> None:
        """Validates configuration parameters."""
        if self.warmup_observations < 1:
            raise ValueError("warmup_observations must be at least 1")
        if not (0.0 < self.alpha <= 1.0):
            raise ValueError("alpha must be in range (0.0, 1.0]")
        if not (0.0 < self.alpha_var <= 1.0):
            raise ValueError("alpha_var must be in range (0.0, 1.0]")
        if self.rolling_window_size < 2:
            raise ValueError("rolling_window_size must be at least 2")
        if self.outlier_z_threshold <= 0.0:
            raise ValueError("outlier_z_threshold must be positive")
        if not (0.0 <= self.outlier_alpha_multiplier <= 1.0):
            raise ValueError("outlier_alpha_multiplier must be in range [0.0, 1.0]")
        if self.min_variance <= 0.0:
            raise ValueError("min_variance must be positive")

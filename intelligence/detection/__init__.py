"""
Detection package for Adaptive Fleet Health Monitoring.
Exposes DetectorEvidence, BaseDetector, and all five anomaly detectors:
DriftDetector, SpikeDetector, FlatlineDetector, OscillationDetector, SensorSwapDetector.
"""

from intelligence.detection.base import DetectorEvidence, BaseDetector
from intelligence.detection.drift import DriftDetector
from intelligence.detection.spike import SpikeDetector
from intelligence.detection.flatline import FlatlineDetector
from intelligence.detection.oscillation import OscillationDetector
from intelligence.detection.sensor_swap import SensorSwapDetector

__all__ = [
    "DetectorEvidence",
    "BaseDetector",
    "DriftDetector",
    "SpikeDetector",
    "FlatlineDetector",
    "OscillationDetector",
    "SensorSwapDetector",
]

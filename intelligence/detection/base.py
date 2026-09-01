"""
Base Detector Contract and Data Structure.
Defines DetectorEvidence and abstract BaseDetector interface.
"""

from dataclasses import dataclass, field
from typing import Dict, Any, Optional
from intelligence.features.feature_extractor import MetricFeatures, DeviceFeatures


@dataclass
class DetectorEvidence:
    """
    Structured result produced independently by an anomaly detector.
    """
    anomaly_type: str
    detected: bool
    score: float
    confidence: float
    metric: str
    evidence: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Returns DetectorEvidence as a serializable dictionary."""
        return {
            "anomaly_type": self.anomaly_type,
            "detected": self.detected,
            "score": round(self.score, 4),
            "confidence": round(self.confidence, 4),
            "metric": self.metric,
            "evidence": self.evidence,
        }


class BaseDetector:
    """
    Abstract base class for all single-metric and multi-metric anomaly detectors.
    """
    anomaly_type: str = "none"

    def detect(self, features: MetricFeatures) -> DetectorEvidence:
        """Evaluates features for a single metric and returns DetectorEvidence."""
        raise NotImplementedError("Subclasses must implement detect()")

"""
HealthResult Contract.
Unified output schema produced by Phase 3 HealthEngine for backend and frontend consumption.
"""

from dataclasses import dataclass, field
from typing import Dict, Any, Optional, List


@dataclass
class HealthResult:
    """
    Unified intelligence output contract for a single device telemetry processing run.
    Contains identity, status, primary anomaly type, severity, confidence, baseline context,
    raw detector evidence, and explainable human-readable description.
    """
    device_id: str
    device_instance_id: Optional[str]
    region: Optional[str]
    status: str                              # "healthy", "warning", "critical"
    anomaly_type: str                         # "none", "drift", "spike", "flatline", "oscillation", "sensor_swap"
    severity: float                          # [0.0, 1.0]
    confidence: float                        # [0.0, 1.0]
    current_metrics: Dict[str, Any]
    baseline_metrics: Dict[str, Any]
    detectors: List[Dict[str, Any]] = field(default_factory=list)
    explanation: str = ""
    timestamp: Optional[str] = None
    is_mature: bool = True

    def to_dict(self) -> Dict[str, Any]:
        """Returns JSON-serializable dictionary representation."""
        return {
            "device_id": self.device_id,
            "device_instance_id": self.device_instance_id,
            "region": self.region,
            "status": self.status,
            "anomaly_type": self.anomaly_type,
            "severity": round(self.severity, 4),
            "confidence": round(self.confidence, 4),
            "current_metrics": self.current_metrics,
            "baseline_metrics": self.baseline_metrics,
            "detectors": self.detectors,
            "explanation": self.explanation,
            "timestamp": self.timestamp,
            "is_mature": self.is_mature,
        }

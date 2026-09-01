"""
Data models for Telemetry Simulator, Device Profiles, and Failure Injections.
"""

from dataclasses import dataclass, field
from typing import Dict, Any, Optional


@dataclass
class TelemetryPacket:
    """
    Canonical telemetry packet structure used across simulator, backend, intelligence, and frontend.
    Contains NO diagnosis labels or injected failure fields.
    """
    device_id: str
    device_instance_id: str
    region: str
    timestamp: str
    metrics: Dict[str, float]

    def to_dict(self) -> Dict[str, Any]:
        """Returns JSON-serializable dictionary representation."""
        return {
            "device_id": self.device_id,
            "device_instance_id": self.device_instance_id,
            "region": self.region,
            "timestamp": self.timestamp,
            "metrics": {k: round(v, 4) for k, v in self.metrics.items()},
        }


@dataclass
class DeviceProfile:
    """
    Normal operating baseline profile for a single simulated physical asset.
    Contains expected means, standard deviations, and identity metadata.
    """
    device_id: str
    device_instance_id: str
    region: str
    base_temperature: float
    base_vibration: float
    base_current: float
    base_rpm: float
    std_temperature: float = 0.5
    std_vibration: float = 0.1
    std_current: float = 0.2
    std_rpm: float = 5.0

    def to_dict(self) -> Dict[str, Any]:
        """Returns JSON-serializable dictionary representation."""
        return {
            "device_id": self.device_id,
            "device_instance_id": self.device_instance_id,
            "region": self.region,
            "metrics": {
                "temperature": {"mean": round(self.base_temperature, 2), "std_dev": self.std_temperature},
                "vibration": {"mean": round(self.base_vibration, 2), "std_dev": self.std_vibration},
                "current": {"mean": round(self.base_current, 2), "std_dev": self.std_current},
                "rpm": {"mean": round(self.base_rpm, 2), "std_dev": self.std_rpm},
            },
        }


@dataclass
class ActiveFailure:
    """
    Internal scenario controller model for active failure injection.
    Used exclusively inside the simulator to modify telemetry values.
    NEVER exposed to intelligence layer or HealthResult.
    """
    failure_id: str
    device_id: str
    failure_type: str                         # "drift", "spike", "flatline", "oscillation", "sensor_swap"
    target_metric: Optional[str] = None
    start_step: int = 0
    duration_steps: int = 50
    target_device_id: Optional[str] = None      # Used for sensor_swap profile substitution
    parameters: Dict[str, Any] = field(default_factory=dict)
    active: bool = True

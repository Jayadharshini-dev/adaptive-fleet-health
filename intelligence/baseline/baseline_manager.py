"""
Baseline Manager for multi-device adaptive baseline coordination.
Maintains state isolation across all 50 fleet devices.
"""

from typing import Dict, Any, Optional
from intelligence.baseline.baseline_config import BaselineConfig
from intelligence.baseline.adaptive_baseline import DeviceBaseline


class BaselineManager:
    """
    Registry and manager for per-device adaptive baselines across the fleet.
    Extracts identity (preferring device_instance_id over device_id), routes telemetry
    to isolated DeviceBaseline objects, and manages lifecycle/resets.
    """

    def __init__(self, config: Optional[BaselineConfig] = None):
        self.config = config or BaselineConfig()
        self._devices: Dict[str, DeviceBaseline] = {}

    @property
    def active_device_count(self) -> int:
        """Returns the number of active device baselines currently stored."""
        return len(self._devices)

    def resolve_device_key(self, telemetry: Dict[str, Any]) -> str:
        """
        Resolves device key from telemetry packet.
        Prefers device_instance_id over device_id to support duplicate ID history preservation.
        """
        if not isinstance(telemetry, dict):
            raise ValueError("Telemetry packet must be a dictionary")

        instance_id = telemetry.get("device_instance_id")
        if instance_id and isinstance(instance_id, str) and instance_id.strip():
            return instance_id.strip()

        device_id = telemetry.get("device_id")
        if device_id and isinstance(device_id, str) and device_id.strip():
            return device_id.strip()

        raise ValueError("Telemetry packet missing both 'device_instance_id' and 'device_id'")

    def get_or_create(self, device_key: str) -> DeviceBaseline:
        """Retrieves existing DeviceBaseline or initializes a new one for device_key."""
        if device_key not in self._devices:
            self._devices[device_key] = DeviceBaseline(device_key=device_key, config=self.config)
        return self._devices[device_key]

    def process_telemetry(self, telemetry: Dict[str, Any]) -> Dict[str, Any]:
        """
        Processes a telemetry packet, updates the device's independent adaptive baseline,
        and returns the updated baseline summary.
        """
        device_key = self.resolve_device_key(telemetry)
        device_baseline = self.get_or_create(device_key)
        metrics = telemetry.get("metrics", {})
        return device_baseline.process_telemetry(metrics)

    def get_baseline(self, device_key: str) -> Optional[Dict[str, Any]]:
        """Retrieves baseline summary dictionary for specified device key."""
        if device_key in self._devices:
            return self._devices[device_key].to_dict()
        return None

    def reset_device(self, device_key: str) -> bool:
        """Resets and deletes baseline state for a specific device. Returns True if deleted."""
        if device_key in self._devices:
            del self._devices[device_key]
            return True
        return False

    def reset_all(self) -> None:
        """Clears baseline state for all devices in memory."""
        self._devices.clear()

    def get_all_baselines(self) -> Dict[str, Dict[str, Any]]:
        """Returns baseline summaries for all registered devices."""
        return {key: db.to_dict() for key, db in self._devices.items()}

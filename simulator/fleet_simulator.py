"""
Fleet Simulator Core Engine.
Coordinates 50-device realistic telemetry generation, time-advancement,
bounded telemetry history, failure injections, and manual telemetry lab ingestion.
"""

import datetime
import random
from collections import deque
from typing import Dict, List, Any, Optional
from simulator.models import TelemetryPacket, DeviceProfile, ActiveFailure
from simulator.device_profiles import DeviceProfileGenerator
from simulator.failure_injection import FailureInjector
from intelligence.models.health_engine import HealthEngine, HealthResult
from intelligence.baseline.baseline_manager import BaselineManager


class FleetSimulator:
    """
    Simulates a fleet of 50 industrial IoT devices.
    Generates realistic telemetry with natural noise, injects controlled failure behaviors,
    advances simulation time, maintains bounded history, and supports manual telemetry lab ingestion.
    """

    def __init__(
        self,
        seed: int = 42,
        sampling_interval_seconds: int = 1,
        history_limit_per_device: int = 100,
        start_time_iso: Optional[str] = None,
    ):
        self.seed = seed
        self.sampling_interval_seconds = sampling_interval_seconds
        self.history_limit = history_limit_per_device

        self.rng = random.Random(self.seed)
        self.profiles: Dict[str, DeviceProfile] = DeviceProfileGenerator.generate_fleet_profiles(seed=self.seed)
        self.active_failures: Dict[str, ActiveFailure] = {}
        self.history: Dict[str, deque] = {dev_id: deque(maxlen=self.history_limit) for dev_id in self.profiles}

        self.current_step = 0
        if start_time_iso:
            self.base_time = datetime.datetime.fromisoformat(start_time_iso)
        else:
            self.base_time = datetime.datetime(2026, 9, 1, 12, 0, 0, tzinfo=datetime.timezone.utc)

    def current_timestamp_str(self) -> str:
        """Calculates current simulation ISO 8601 timestamp string based on current_step."""
        delta = datetime.timedelta(seconds=self.current_step * self.sampling_interval_seconds)
        curr_dt = self.base_time + delta
        return curr_dt.isoformat()

    def generate_device_telemetry(self, device_id: str) -> TelemetryPacket:
        """
        Generates a canonical telemetry packet for a single device at current_step.
        """
        if device_id not in self.profiles:
            raise ValueError(f"Unknown device_id: {device_id}")

        profile = self.profiles[device_id]

        # Generate realistic normal telemetry with natural noise
        temp_val = self.rng.gauss(profile.base_temperature, profile.std_temperature)
        vib_val = max(0.1, self.rng.gauss(profile.base_vibration, profile.std_vibration))
        curr_val = max(0.5, self.rng.gauss(profile.base_current, profile.std_current))
        rpm_val = max(100.0, self.rng.gauss(profile.base_rpm, profile.std_rpm))

        # Mild correlation: RPM load slight impact on current and temperature
        load_jitter = (rpm_val - profile.base_rpm) * 0.005
        curr_val += load_jitter * 0.1
        temp_val += load_jitter * 0.05

        raw_metrics = {
            "temperature": round(temp_val, 2),
            "vibration": round(vib_val, 2),
            "current": round(curr_val, 2),
            "rpm": round(rpm_val, 1),
        }

        # Apply failure injection modifications if active for this device
        final_metrics = FailureInjector.apply_failures(
            profile=profile,
            normal_metrics=raw_metrics,
            current_step=self.current_step,
            active_failures=self.active_failures,
            all_profiles=self.profiles,
            rng=self.rng,
        )

        packet = TelemetryPacket(
            device_id=profile.device_id,
            device_instance_id=profile.device_instance_id,
            region=profile.region,
            timestamp=self.current_timestamp_str(),
            metrics=final_metrics,
        )

        self.history[device_id].append(packet)
        return packet

    def step(self) -> List[TelemetryPacket]:
        """
        Advances simulation step by 1 and generates canonical telemetry packets for all 50 devices.
        """
        self.current_step += 1
        packets = []
        for dev_id in sorted(self.profiles.keys()):
            packets.append(self.generate_device_telemetry(dev_id))
        return packets

    def inject_failure(
        self,
        device_id: str,
        failure_type: str,
        target_metric: Optional[str] = None,
        target_device_id: Optional[str] = None,
        duration_steps: int = 50,
        **kwargs,
    ) -> ActiveFailure:
        """
        Injects a failure behavior scenario for device_id.
        """
        if device_id not in self.profiles:
            raise ValueError(f"Unknown device_id: {device_id}")

        f_id = f"FAIL-{device_id}-{failure_type}-{self.current_step}"
        failure = ActiveFailure(
            failure_id=f_id,
            device_id=device_id,
            failure_type=failure_type,
            target_metric=target_metric,
            start_step=self.current_step + 1,
            duration_steps=duration_steps,
            target_device_id=target_device_id,
            parameters=kwargs,
            active=True,
        )
        self.active_failures[device_id] = failure
        return failure

    def clear_failure(self, device_id: str) -> bool:
        """Clears active failure for device_id, returning device to normal generation."""
        if device_id in self.active_failures:
            del self.active_failures[device_id]
            return True
        return False

    def clear_all_failures(self) -> None:
        """Clears all active failure injections across the fleet."""
        self.active_failures.clear()

    def get_history(self, device_id: Optional[str] = None, limit: int = 100) -> List[TelemetryPacket]:
        """Retrieves bounded historical telemetry packets."""
        if device_id:
            if device_id in self.history:
                return list(self.history[device_id])[-limit:]
            return []

        all_packets = []
        for dev_id in sorted(self.history.keys()):
            all_packets.extend(list(self.history[dev_id])[-limit:])
        return all_packets

    def process_manual_telemetry(
        self,
        telemetry_dict: Dict[str, Any],
        health_engine: HealthEngine,
        baseline_manager: BaselineManager,
    ) -> HealthResult:
        """
        Manual Telemetry Lab Ingestion Interface:
        Validates manual telemetry packet, feeds packet into actual HealthEngine pipeline,
        and returns serializable HealthResult.
        """
        if not isinstance(telemetry_dict, dict):
            raise ValueError("Manual telemetry input must be a dictionary")

        dev_id = telemetry_dict.get("device_id")
        if not dev_id or not isinstance(dev_id, str):
            raise ValueError("Manual telemetry packet missing required string field 'device_id'")

        metrics = telemetry_dict.get("metrics")
        if not metrics or not isinstance(metrics, dict):
            raise ValueError("Manual telemetry packet missing required dictionary field 'metrics'")

        # Ensure canonical metrics are present and numeric
        for m_name in ["temperature", "vibration", "current", "rpm"]:
            if m_name in metrics:
                val = metrics[m_name]
                if val is not None and not isinstance(val, (int, float)):
                    raise ValueError(f"Metric '{m_name}' must be numeric, got {type(val)}")

        # Match instance_id and region with profile if available
        profile = self.profiles.get(dev_id)
        if "device_instance_id" not in telemetry_dict or not telemetry_dict["device_instance_id"]:
            telemetry_dict["device_instance_id"] = profile.device_instance_id if profile else f"INST-{dev_id.replace('DEV-', '')}"
        if "region" not in telemetry_dict or not telemetry_dict["region"]:
            telemetry_dict["region"] = profile.region if profile else "North"
        if "timestamp" not in telemetry_dict or not telemetry_dict["timestamp"]:
            telemetry_dict["timestamp"] = self.current_timestamp_str()

        # Feed manual telemetry into actual HealthEngine
        return health_engine.process_telemetry(
            telemetry=telemetry_dict,
            baseline_manager=baseline_manager,
            fleet_baselines=baseline_manager.get_all_baselines(),
        )

"""
Failure Injection Engine.
Modifies sensor telemetry values to simulate industrial IoT failure behaviors
(Drift, Spike, Flatline, Oscillation, Sensor Swap) without adding diagnosis tags to telemetry.
"""

import math
import random
from typing import Dict, Any, Optional
from simulator.models import DeviceProfile, ActiveFailure


class FailureInjector:
    """
    Applies failure behaviors to generated telemetry metrics.
    Operates strictly on sensor values, preserving canonical telemetry structure.
    """

    @staticmethod
    def apply_failures(
        profile: DeviceProfile,
        normal_metrics: Dict[str, float],
        current_step: int,
        active_failures: Dict[str, ActiveFailure],
        all_profiles: Dict[str, DeviceProfile],
        rng: random.Random,
    ) -> Dict[str, float]:
        """
        Modifies raw normal metrics if an active failure exists for profile.device_id.
        Returns modified metric values dictionary.
        """
        device_id = profile.device_id
        if device_id not in active_failures or not active_failures[device_id].active:
            return dict(normal_metrics)

        failure = active_failures[device_id]
        f_type = failure.failure_type
        params = failure.parameters
        step_diff = max(0, current_step - failure.start_step + 1)

        modified = dict(normal_metrics)

        if f_type == "drift":
            t_metric = failure.target_metric or "temperature"
            rate = params.get("rate", 1.5)
            max_dev = params.get("max_dev", 22.0)
            direction = params.get("direction", 1.0)
            added_dev = direction * min(max_dev, rate * step_diff)
            modified[t_metric] = round(modified[t_metric] + added_dev, 2)

        elif f_type == "spike":
            t_metric = failure.target_metric or "current"
            magnitude = params.get("magnitude", 25.0)
            spike_duration = params.get("spike_duration_steps", 2)
            if step_diff <= spike_duration:
                modified[t_metric] = round(modified[t_metric] + magnitude, 2)

        elif f_type == "flatline":
            t_metric = failure.target_metric or "vibration"
            const_val = params.get("constant_value", profile.base_vibration if t_metric == "vibration" else normal_metrics.get(t_metric, 60.0))
            modified[t_metric] = round(float(const_val), 2)

        elif f_type == "oscillation":
            t_metric = failure.target_metric or "vibration"
            amp = params.get("amplitude", 4.5)
            sign = 1.0 if (step_diff % 2 == 0) else -1.0
            modified[t_metric] = round(modified[t_metric] + sign * amp, 2)

        elif f_type == "sensor_swap":
            target_id = failure.target_device_id or "DEV-024"
            if target_id in all_profiles:
                t_profile = all_profiles[target_id]
                # Replace profile values with candidate device's normal operating values
                modified["temperature"] = round(rng.gauss(t_profile.base_temperature, t_profile.std_temperature), 2)
                modified["vibration"] = round(rng.gauss(t_profile.base_vibration, t_profile.std_vibration), 2)
                modified["current"] = round(rng.gauss(t_profile.base_current, t_profile.std_current), 2)
                modified["rpm"] = round(rng.gauss(t_profile.base_rpm, t_profile.std_rpm), 1)

        return modified

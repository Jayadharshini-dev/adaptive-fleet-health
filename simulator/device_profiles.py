"""
Device Profile Generator for 50-device Fleet.
Generates diverse, deterministic, device-specific operating profiles using seed 42.
"""

import random
from typing import Dict, List
from simulator.models import DeviceProfile

REGIONS = ["North", "South", "East", "West"]


class DeviceProfileGenerator:
    """
    Generates persistent normal operating profiles for 50 fleet devices.
    Guarantees deterministic output when using the same seed.
    """

    @staticmethod
    def generate_fleet_profiles(seed: int = 42, count: int = 50) -> Dict[str, DeviceProfile]:
        """
        Generates exactly 50 device profiles with stable IDs, regions, and diverse operating baselines.
        """
        rng = random.Random(seed)
        profiles: Dict[str, DeviceProfile] = {}

        for i in range(1, count + 1):
            dev_id = f"DEV-{i:03d}"
            inst_id = f"INST-{i:03d}"
            region = REGIONS[(i - 1) % len(REGIONS)]

            # Generate diverse operating baselines per device
            base_temp = round(rng.uniform(48.0, 88.0), 2)
            base_vib = round(rng.uniform(1.8, 5.2), 2)
            base_curr = round(rng.uniform(5.5, 15.5), 2)
            base_rpm = round(rng.uniform(1250.0, 1780.0), 1)

            profiles[dev_id] = DeviceProfile(
                device_id=dev_id,
                device_instance_id=inst_id,
                region=region,
                base_temperature=base_temp,
                base_vibration=base_vib,
                base_current=base_curr,
                base_rpm=base_rpm,
                std_temperature=0.5,
                std_vibration=0.1,
                std_current=0.2,
                std_rpm=5.0,
            )

        return profiles

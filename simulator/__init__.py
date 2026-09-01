"""
Simulator package for 50-device realistic telemetry generation and controlled failure scenarios.
"""

from simulator.models import TelemetryPacket, DeviceProfile, ActiveFailure
from simulator.device_profiles import DeviceProfileGenerator
from simulator.failure_injection import FailureInjector
from simulator.fleet_simulator import FleetSimulator
from simulator.scenarios import DemoScenarioController

__all__ = [
    "TelemetryPacket",
    "DeviceProfile",
    "ActiveFailure",
    "DeviceProfileGenerator",
    "FailureInjector",
    "FleetSimulator",
    "DemoScenarioController",
]

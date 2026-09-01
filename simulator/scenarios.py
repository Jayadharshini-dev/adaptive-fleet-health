"""
Demo Scenario Controller.
Orchestrates the 4-phase deterministic hackathon demonstration scenario across 50 devices.
"""

from typing import Dict, List, Any, Tuple, Optional
from simulator.fleet_simulator import FleetSimulator
from intelligence.models.health_engine import HealthEngine, HealthResult
from intelligence.baseline.baseline_manager import BaselineManager


class DemoScenarioController:
    """
    Orchestrates the deterministic 4-phase demonstration scenario:
    Phase A: Warmup (30 normal observations)
    Phase B: Incident Activation (5 simultaneous failures)
    Phase C: Incident Monitoring & HealthEngine Detection
    Phase D: Incident Clearing & System Recovery
    """

    def __init__(self, simulator: Optional[FleetSimulator] = None, health_engine: Optional[HealthEngine] = None):
        self.simulator = simulator or FleetSimulator(seed=42)
        self.baseline_manager = BaselineManager()
        self.health_engine = health_engine or HealthEngine()

    def run_warmup_phase(self, warmup_steps: int = 30) -> List[Dict[str, HealthResult]]:
        """
        Phase A: Generates warmup_steps of normal telemetry for all 50 devices to learn baselines.
        """
        warmup_results = []
        for _ in range(warmup_steps):
            packets = self.simulator.step()
            fleet_baselines = self.baseline_manager.get_all_baselines()
            step_results = {}
            for p in packets:
                res = self.health_engine.process_telemetry(p.to_dict(), self.baseline_manager, fleet_baselines)
                step_results[p.device_id] = res
            warmup_results.append(step_results)
        return warmup_results

    def activate_demo_failures(self) -> Dict[str, Any]:
        """
        Phase B: Injects 5 simultaneous failure scenarios across 5 target devices.
        """
        inj_007 = self.simulator.inject_failure("DEV-007", "drift", target_metric="temperature", rate=1.8)
        inj_014 = self.simulator.inject_failure("DEV-014", "spike", target_metric="current", magnitude=28.0)
        inj_021 = self.simulator.inject_failure("DEV-021", "flatline", target_metric="vibration")
        inj_032 = self.simulator.inject_failure("DEV-032", "oscillation", target_metric="vibration", amplitude=5.2)
        inj_045 = self.simulator.inject_failure("DEV-045", "sensor_swap", target_device_id="DEV-024")

        return {
            "DEV-007": inj_007,
            "DEV-014": inj_014,
            "DEV-021": inj_021,
            "DEV-032": inj_032,
            "DEV-045": inj_045,
        }

    def run_incident_phase(self, incident_steps: int = 10) -> List[Dict[str, HealthResult]]:
        """
        Phase C: Continues simulation while failures are active and collects HealthResults.
        """
        incident_results = []
        for _ in range(incident_steps):
            packets = self.simulator.step()
            fleet_baselines = self.baseline_manager.get_all_baselines()
            step_results = {}
            for p in packets:
                res = self.health_engine.process_telemetry(p.to_dict(), self.baseline_manager, fleet_baselines)
                step_results[p.device_id] = res
            incident_results.append(step_results)
        return incident_results

    def clear_failures_phase(self, recovery_steps: int = 5) -> List[Dict[str, HealthResult]]:
        """
        Phase D: Clears all active failures and verifies system recovery to normal telemetry.
        """
        self.simulator.clear_all_failures()
        recovery_results = []
        for _ in range(recovery_steps):
            packets = self.simulator.step()
            fleet_baselines = self.baseline_manager.get_all_baselines()
            step_results = {}
            for p in packets:
                res = self.health_engine.process_telemetry(p.to_dict(), self.baseline_manager, fleet_baselines)
                step_results[p.device_id] = res
            recovery_results.append(step_results)
        return recovery_results

    def run_full_demo(self) -> Tuple[List[Dict[str, HealthResult]], List[Dict[str, HealthResult]], List[Dict[str, HealthResult]]]:
        """
        Executes complete 4-phase demonstration scenario.
        Returns (warmup_results, incident_results, recovery_results).
        """
        warmup_res = self.run_warmup_phase(warmup_steps=30)
        self.activate_demo_failures()
        incident_res = self.run_incident_phase(incident_steps=10)
        recovery_res = self.clear_failures_phase(recovery_steps=5)
        return warmup_res, incident_res, recovery_res

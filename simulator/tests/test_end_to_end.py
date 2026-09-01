"""
End-to-End Integration Tests for FleetSimulator + Phase 1-3 HealthEngine.
Verifies that injected telemetry failure behaviors are independently detected as intended anomalies
by the HealthEngine across 50 simulated devices.
"""

import unittest
from simulator.fleet_simulator import FleetSimulator
from simulator.scenarios import DemoScenarioController
from intelligence.models.health_engine import HealthEngine
from intelligence.baseline.baseline_manager import BaselineManager


class TestEndToEndSimulatorIntegration(unittest.TestCase):
    def setUp(self):
        self.controller = DemoScenarioController()

    def test_full_end_to_end_demo_scenario_detection(self):
        """
        End-to-End Integration Test:
        1. Runs Phase A 30-sample warmup across 50 devices.
        2. Injects 5 simultaneous failure behaviors.
        3. Verifies actual HealthEngine independently detects all 5 failure modes:
           - DEV-007 -> DRIFT
           - DEV-014 -> SPIKE
           - DEV-021 -> FLATLINE
           - DEV-032 -> OSCILLATION
           - DEV-045 -> SENSOR_SWAP
        4. Verifies clearing failures restores devices to HEALTHY.
        """
        # Phase A: Warmup (30 observations)
        warmup_results = self.controller.run_warmup_phase(warmup_steps=30)
        self.assertEqual(len(warmup_results), 30)

        # Verify all devices healthy after warmup
        last_warmup = warmup_results[-1]
        for dev_id, res in last_warmup.items():
            self.assertEqual(res.status, "healthy", f"Device {dev_id} should be healthy after warmup")

        # Phase B: Inject Failures
        self.controller.activate_demo_failures()

        # Phase C: Incident Monitoring
        incident_results = self.controller.run_incident_phase(incident_steps=10)

        # Extract primary detected anomaly types during incident phase for target devices
        detected_anomalies = {
            "DEV-007": set(step_map["DEV-007"].anomaly_type for step_map in incident_results),
            "DEV-014": set(step_map["DEV-014"].anomaly_type for step_map in incident_results),
            "DEV-021": set(step_map["DEV-021"].anomaly_type for step_map in incident_results),
            "DEV-032": set(step_map["DEV-032"].anomaly_type for step_map in incident_results),
            "DEV-045": set(step_map["DEV-045"].anomaly_type for step_map in incident_results),
        }

        self.assertIn("drift", detected_anomalies["DEV-007"], f"DEV-007 drift detection failed, detected: {detected_anomalies['DEV-007']}")
        self.assertIn("spike", detected_anomalies["DEV-014"], f"DEV-014 spike detection failed, detected: {detected_anomalies['DEV-014']}")
        self.assertIn("flatline", detected_anomalies["DEV-021"], f"DEV-021 flatline detection failed, detected: {detected_anomalies['DEV-021']}")
        self.assertIn("oscillation", detected_anomalies["DEV-032"], f"DEV-032 oscillation detection failed, detected: {detected_anomalies['DEV-032']}")
        self.assertIn("sensor_swap", detected_anomalies["DEV-045"], f"DEV-045 sensor swap detection failed, detected: {detected_anomalies['DEV-045']}")

        # Phase D: Clear Failures and verify recovery
        recovery_results = self.controller.clear_failures_phase(recovery_steps=5)
        latest_recovery = recovery_results[-1]

        for dev_id in ["DEV-007", "DEV-014", "DEV-021", "DEV-032", "DEV-045"]:
            self.assertEqual(latest_recovery[dev_id].status, "healthy", f"Device {dev_id} should recover to healthy")


if __name__ == "__main__":
    unittest.main()

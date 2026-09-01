"""
Unit Tests for FleetSimulator Engine.
Validates 50-device setup, profile generation, seed determinism, time advancement,
bounded history, failure injection behaviors, clearing, and manual telemetry ingestion.
"""

import unittest
from simulator.fleet_simulator import FleetSimulator
from simulator.device_profiles import DeviceProfileGenerator
from intelligence.models.health_engine import HealthEngine
from intelligence.baseline.baseline_manager import BaselineManager


class TestFleetSimulator(unittest.TestCase):
    def setUp(self):
        self.sim = FleetSimulator(seed=42)
        self.health_engine = HealthEngine()
        self.baseline_manager = BaselineManager()

    def test_1_2_3_4_50_devices_identity_and_canonical_metrics(self):
        """1, 2, 3, 4, 5. Tests 50 devices exist with stable IDs, regions, diverse profiles, and canonical metrics."""
        self.assertEqual(len(self.sim.profiles), 50)

        for i in range(1, 51):
            dev_id = f"DEV-{i:03d}"
            inst_id = f"INST-{i:03d}"
            self.assertIn(dev_id, self.sim.profiles)
            p = self.sim.profiles[dev_id]
            self.assertEqual(p.device_id, dev_id)
            self.assertEqual(p.device_instance_id, inst_id)
            self.assertIn(p.region, ["North", "South", "East", "West"])

        # Verify canonical metrics in generated telemetry
        packet = self.sim.generate_device_telemetry("DEV-007")
        self.assertIn("temperature", packet.metrics)
        self.assertIn("vibration", packet.metrics)
        self.assertIn("current", packet.metrics)
        self.assertIn("rpm", packet.metrics)

        # Verify DEV-007 and DEV-024 have different operating profiles
        p007 = self.sim.profiles["DEV-007"]
        p024 = self.sim.profiles["DEV-024"]
        self.assertNotEqual(p007.base_temperature, p024.base_temperature)

    def test_6_7_8_seed_determinism_and_time_advancement(self):
        """6, 7, 8, 9. Tests seed determinism and timestamp advancement."""
        sim1 = FleetSimulator(seed=42)
        sim2 = FleetSimulator(seed=42)

        packets1 = sim1.step()
        packets2 = sim2.step()

        self.assertEqual(packets1[0].metrics, packets2[0].metrics)
        self.assertIn("2026-09-01", packets1[0].timestamp)

        # Advance timestamps
        sim1.step()
        self.assertEqual(sim1.current_step, 2)
        self.assertNotEqual(packets1[0].timestamp, sim1.get_history("DEV-001")[-1].timestamp)

    def test_10_11_bounded_telemetry_history(self):
        """10, 11. Tests bounded telemetry history deque limit."""
        sim_bounded = FleetSimulator(seed=42, history_limit_per_device=10)
        for _ in range(25):
            sim_bounded.step()

        hist = sim_bounded.get_history("DEV-001")
        self.assertEqual(len(hist), 10)

    def test_12_drift_failure_behavior(self):
        """12. Tests drift failure gradually increases sensor values."""
        self.sim.inject_failure("DEV-007", "drift", target_metric="temperature", rate=2.0)
        self.sim.step()
        p1 = self.sim.generate_device_telemetry("DEV-007")
        self.sim.step()
        p2 = self.sim.generate_device_telemetry("DEV-007")

        self.assertGreater(p2.metrics["temperature"], p1.metrics["temperature"])

    def test_13_spike_failure_behavior(self):
        """13. Tests spike failure produces short-lived jump."""
        normal_packet = self.sim.generate_device_telemetry("DEV-014")
        self.sim.inject_failure("DEV-014", "spike", target_metric="current", magnitude=25.0, duration_steps=1)
        self.sim.step()
        spike_packet = self.sim.generate_device_telemetry("DEV-014")

        self.assertGreater(spike_packet.metrics["current"], normal_packet.metrics["current"] + 15.0)

    def test_14_flatline_failure_behavior(self):
        """14. Tests flatline failure produces constant repeated values."""
        self.sim.inject_failure("DEV-021", "flatline", target_metric="vibration", constant_value=2.2)
        vals = []
        for _ in range(5):
            self.sim.step()
            p = self.sim.generate_device_telemetry("DEV-021")
            vals.append(p.metrics["vibration"])

        self.assertEqual(len(set(vals)), 1)
        self.assertEqual(vals[0], 2.2)

    def test_15_oscillation_failure_behavior(self):
        """15. Tests oscillation failure produces alternating sign pattern."""
        self.sim.inject_failure("DEV-032", "oscillation", target_metric="vibration", amplitude=5.0)
        vals = []
        for _ in range(4):
            self.sim.step()
            p = self.sim.generate_device_telemetry("DEV-032")
            vals.append(p.metrics["vibration"])

        # Check alternating pattern
        diff1 = vals[1] - vals[0]
        diff2 = vals[2] - vals[1]
        self.assertLess(diff1 * diff2, 0.0, "Oscillation should flip direction between steps")

    def test_16_sensor_swap_failure_behavior(self):
        """16. Tests sensor swap failure substitutes candidate device profile values."""
        p045_orig = self.sim.profiles["DEV-045"]
        p024_target = self.sim.profiles["DEV-024"]

        self.sim.inject_failure("DEV-045", "sensor_swap", target_device_id="DEV-024")
        self.sim.step()
        swapped_p = self.sim.generate_device_telemetry("DEV-045")

        # Telemetry should be close to DEV-024's baseline temp (around 84°C), not DEV-045 (around 61°C)
        self.assertAlmostEqual(swapped_p.metrics["temperature"], p024_target.base_temperature, delta=3.0)

    def test_17_clearing_failure_restores_normal_telemetry(self):
        """17. Tests clearing failure restores normal generation."""
        self.sim.inject_failure("DEV-007", "drift", target_metric="temperature", rate=5.0)
        self.sim.step()
        res = self.sim.clear_failure("DEV-007")
        self.assertTrue(res)

        self.sim.step()
        p = self.sim.generate_device_telemetry("DEV-007")
        self.assertAlmostEqual(p.metrics["temperature"], self.sim.profiles["DEV-007"].base_temperature, delta=2.0)

    def test_18_manual_telemetry_ingestion(self):
        """18, 28, 29. Tests Manual Telemetry Lab ingestion interface."""
        p007 = self.sim.profiles["DEV-007"]
        manual_pkt = {
            "device_id": "DEV-007",
            "device_instance_id": "INST-007",
            "region": p007.region,
            "metrics": {
                "temperature": p007.base_temperature,
                "vibration": p007.base_vibration,
                "current": p007.base_current,
                "rpm": p007.base_rpm,
            },
        }

        # Warmup device baseline first
        for _ in range(15):
            packets = self.sim.step()
            p_pkt = next(p for p in packets if p.device_id == "DEV-007")
            self.health_engine.process_telemetry(p_pkt.to_dict(), self.baseline_manager)

        res = self.sim.process_manual_telemetry(manual_pkt, self.health_engine, self.baseline_manager)

        self.assertIsNotNone(res)
        self.assertEqual(res.device_id, "DEV-007")
        self.assertEqual(res.status, "healthy")

        # Test invalid manual payload
        with self.assertRaises(ValueError):
            self.sim.process_manual_telemetry({"metrics": {}}, self.health_engine, self.baseline_manager)


if __name__ == "__main__":
    unittest.main()

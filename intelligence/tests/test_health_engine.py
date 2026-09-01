"""
Unit Tests for Phase 3 Unified Health & Risk Engine.
Validates HealthResult schema, primary anomaly resolution, multi-detector agreement,
severity/confidence normalization, operating range separation, warm-up handling, and 50-device scaling.
"""

import unittest
from intelligence.baseline.baseline_config import BaselineConfig
from intelligence.baseline.baseline_manager import BaselineManager
from intelligence.models.health_engine import HealthEngine, HealthEngineConfig
from intelligence.models.health_result import HealthResult


class TestHealthEngine(unittest.TestCase):
    def setUp(self):
        self.config = BaselineConfig(warmup_observations=12, alpha=0.1, alpha_var=0.05, rolling_window_size=25)
        self.manager = BaselineManager(config=self.config)
        self.engine = HealthEngine()

    def _generate_telemetry(self, device_id: str, temp: float = 60.0, vib: float = 2.0, curr: float = 8.0, rpm: float = 1500, instance_id: str = None) -> dict:
        telemetry = {
            "device_id": device_id,
            "region": "North",
            "timestamp": "2026-09-01T12:00:00Z",
            "metrics": {
                "temperature": float(temp),
                "vibration": float(vib),
                "current": float(curr),
                "rpm": float(rpm),
            },
        }
        if instance_id:
            telemetry["device_instance_id"] = instance_id
        return telemetry

    def test_1_normal_device_healthy(self):
        """1 & 8. Tests that a normal device yields status HEALTHY, anomaly NONE, severity 0.0."""
        for _ in range(15):
            res = self.engine.process_telemetry(self._generate_telemetry("DEV-001", temp=60.0), self.manager)

        self.assertIsInstance(res, HealthResult)
        self.assertEqual(res.status, "healthy")
        self.assertEqual(res.anomaly_type, "none")
        self.assertEqual(res.severity, 0.0)
        self.assertGreaterEqual(res.confidence, 0.90)

    def test_2_strong_drift_detection(self):
        """2. Tests strong drift detection resulting in drift primary anomaly and appropriate status."""
        for _ in range(12):
            self.engine.process_telemetry(self._generate_telemetry("DEV-002", temp=60.0), self.manager)

        res = None
        for val in [61.0, 62.0, 63.0, 65.0, 67.0, 69.0, 72.0, 75.0, 78.0, 81.0]:
            res = self.engine.process_telemetry(self._generate_telemetry("DEV-002", temp=val), self.manager)

        self.assertIn(res.status, ["warning", "critical"])
        self.assertEqual(res.anomaly_type, "drift")
        self.assertGreater(res.severity, 0.35)
        self.assertGreater(res.confidence, 0.5)

    def test_3_strong_spike_detection(self):
        """3. Tests strong spike primary anomaly resolution."""
        for _ in range(15):
            self.engine.process_telemetry(self._generate_telemetry("DEV-003", curr=8.0), self.manager)

        res = self.engine.process_telemetry(self._generate_telemetry("DEV-003", curr=35.0), self.manager)

        self.assertIn(res.status, ["warning", "critical"])
        self.assertEqual(res.anomaly_type, "spike")

    def test_4_flatline_detection(self):
        """4. Tests flatline primary anomaly resolution."""
        for i in range(15):
            self.engine.process_telemetry(self._generate_telemetry("DEV-004", rpm=1500.0 + (10 if i % 2 == 0 else -10)), self.manager)

        res = None
        for _ in range(8):
            res = self.engine.process_telemetry(self._generate_telemetry("DEV-004", rpm=1500.0), self.manager)

        self.assertIn(res.status, ["warning", "critical"])
        self.assertEqual(res.anomaly_type, "flatline")

    def test_5_oscillation_detection(self):
        """5. Tests oscillation primary anomaly resolution."""
        for _ in range(15):
            self.engine.process_telemetry(self._generate_telemetry("DEV-005", vib=2.0), self.manager)

        seq = [2.0, 7.0, 1.8, 7.2, 2.0, 6.9, 1.9, 7.1]
        res = None
        for val in seq:
            res = self.engine.process_telemetry(self._generate_telemetry("DEV-005", vib=val), self.manager)

        self.assertIn(res.status, ["warning", "critical"])
        self.assertEqual(res.anomaly_type, "oscillation")

    def test_6_sensor_swap_detection(self):
        """6. Tests sensor swap primary anomaly resolution."""
        for _ in range(15):
            self.engine.process_telemetry(self._generate_telemetry("DEV-007", temp=60.0, vib=2.0, curr=8.0, rpm=1480), self.manager)
            self.engine.process_telemetry(self._generate_telemetry("DEV-024", temp=85.0, vib=5.0, curr=14.0, rpm=1750), self.manager)

        swapped_t = self._generate_telemetry("DEV-007", temp=85.2, vib=5.1, curr=14.1, rpm=1748)
        res = self.engine.process_telemetry(swapped_t, self.manager)

        self.assertIn(res.status, ["warning", "critical"])
        self.assertEqual(res.anomaly_type, "sensor_swap")

    def test_7_multiple_detectors_preserves_secondary_evidence(self):
        """7. Tests that multiple detector evidence preserves raw detector list."""
        for _ in range(15):
            self.engine.process_telemetry(self._generate_telemetry("DEV-008", temp=60.0), self.manager)

        res = self.engine.process_telemetry(self._generate_telemetry("DEV-008", temp=120.0), self.manager)

        self.assertIsInstance(res.detectors, list)
        self.assertGreater(len(res.detectors), 0)

    def test_9_10_severity_confidence_normalization(self):
        """9 & 10. Verifies severity and confidence are bounded strictly to [0.0, 1.0]."""
        for _ in range(15):
            self.engine.process_telemetry(self._generate_telemetry("DEV-009", temp=60.0), self.manager)

        res = self.engine.process_telemetry(self._generate_telemetry("DEV-009", temp=250.0), self.manager)

        self.assertGreaterEqual(res.severity, 0.0)
        self.assertLessEqual(res.severity, 1.0)
        self.assertGreaterEqual(res.confidence, 0.0)
        self.assertLessEqual(res.confidence, 1.0)

    def test_11_operating_range_separation(self):
        """11. CORE TEST: DEV-A at 60°C and DEV-B at 90°C produce different outcomes for 90°C telemetry."""
        for _ in range(15):
            self.engine.process_telemetry(self._generate_telemetry("DEV-A", temp=60.0), self.manager)
            self.engine.process_telemetry(self._generate_telemetry("DEV-B", temp=90.0), self.manager)

        res_a = self.engine.process_telemetry(self._generate_telemetry("DEV-A", temp=90.0), self.manager)
        res_b = self.engine.process_telemetry(self._generate_telemetry("DEV-B", temp=90.0), self.manager)

        self.assertNotEqual(res_a.status, "healthy", "DEV-A (baseline 60) receiving 90°C should NOT be healthy")
        self.assertEqual(res_b.status, "healthy", "DEV-B (baseline 90) receiving 90°C MUST remain HEALTHY")

    def test_12_warmup_handling(self):
        """12. Tests that an immature baseline (during warmup) does not produce unjustified CRITICAL results."""
        res_warmup = self.engine.process_telemetry(self._generate_telemetry("DEV-NEW", temp=75.0), self.manager)
        self.assertFalse(res_warmup.is_mature)
        self.assertNotEqual(res_warmup.status, "critical", "Warming up device should not immediately output CRITICAL")

    def test_13_determinism(self):
        """13. Tests that processing identical telemetry twice yields identical HealthResults."""
        for _ in range(15):
            self.engine.process_telemetry(self._generate_telemetry("DEV-DET1", temp=50.0), self.manager)
            self.engine.process_telemetry(self._generate_telemetry("DEV-DET2", temp=50.0), self.manager)

        res1 = self.engine.process_telemetry(self._generate_telemetry("DEV-DET1", temp=95.0), self.manager)
        res2 = self.engine.process_telemetry(self._generate_telemetry("DEV-DET2", temp=95.0), self.manager)

        self.assertEqual(res1.status, res2.status)
        self.assertEqual(res1.anomaly_type, res2.anomaly_type)
        self.assertAlmostEqual(res1.severity, res2.severity, places=4)

    def test_14_missing_and_partial_metrics(self):
        """14. Tests handling of missing or partial metric payloads."""
        res = self.engine.process_telemetry({"device_id": "DEV-PARTIAL"}, self.manager)
        self.assertIsNotNone(res)
        self.assertEqual(res.status, "healthy")

    def test_15_explainability(self):
        """15. Tests that detected anomalies produce non-empty, evidence-based explanations."""
        for _ in range(15):
            self.engine.process_telemetry(self._generate_telemetry("DEV-EXP", curr=8.0), self.manager)

        res = self.engine.process_telemetry(self._generate_telemetry("DEV-EXP", curr=35.0), self.manager)
        self.assertTrue(len(res.explanation) > 10)
        self.assertIn("Current", res.explanation)

    def test_16_50_device_scale(self):
        """16. Tests independent processing across 50 simulated devices."""
        for i in range(1, 51):
            dev_id = f"DEV-{i:03d}"
            norm_temp = 40.0 + i
            for _ in range(15):
                res = self.engine.process_telemetry(self._generate_telemetry(dev_id, temp=norm_temp), self.manager)
                self.assertEqual(res.status, "healthy")

        self.assertEqual(self.manager.active_device_count, 50)


if __name__ == "__main__":
    unittest.main()

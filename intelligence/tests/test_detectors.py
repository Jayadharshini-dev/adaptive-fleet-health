"""
Comprehensive Unit Tests for Phase 2 Anomaly Detectors.
Validates Drift, Spike, Flatline, Oscillation, Sensor Swap detectors,
normal sequence negative tests, and multi-device scaling.
"""

import unittest
from intelligence.baseline.baseline_config import BaselineConfig
from intelligence.baseline.adaptive_baseline import MetricBaseline, DeviceBaseline
from intelligence.baseline.baseline_manager import BaselineManager
from intelligence.features.feature_extractor import FeatureExtractor
from intelligence.detection import (
    DriftDetector,
    SpikeDetector,
    FlatlineDetector,
    OscillationDetector,
    SensorSwapDetector,
)


class TestAnomalyDetectors(unittest.TestCase):
    def setUp(self):
        self.config = BaselineConfig(warmup_observations=12, alpha=0.1, alpha_var=0.05, rolling_window_size=25)
        self.manager = BaselineManager(config=self.config)

        self.drift_detector = DriftDetector(min_z_threshold=2.2, min_direction_consistency=0.65, min_samples=10)
        self.spike_detector = SpikeDetector(min_z_threshold=3.0, min_first_diff_ratio=2.5, min_samples=5)
        self.flatline_detector = FlatlineDetector(max_variance_ratio=0.05, min_repeat_count=5, min_baseline_std=0.05, min_samples=10)
        self.oscillation_detector = OscillationDetector(min_alternating_ratio=0.65, min_sign_changes=4, min_amplitude_ratio=2.5, min_samples=8)
        self.sensor_swap_detector = SensorSwapDetector(min_self_z_threshold=3.0, max_other_z_threshold=1.5, min_matching_metrics=2, min_samples=10)

    def _generate_telemetry(self, device_id: str, temp: float, vib: float = 2.0, curr: float = 8.0, rpm: float = 1500, instance_id: str = None) -> dict:
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

    # -------------------------------------------------------------------------
    # 1. DRIFT DETECTOR TESTS
    # -------------------------------------------------------------------------
    def test_drift_detector_positive_and_negative(self):
        """Tests detection of positive drift, negative drift, and non-drift cases."""
        mb = MetricBaseline("temperature", config=self.config)

        # Warm up baseline at 60.0°C
        for _ in range(15):
            mb.update(60.0)

        # Apply sustained upward drift: 61, 62, 63, 64, 66, 68, 70, 72, 74, 76
        ev = None
        for val in [61.0, 62.0, 63.0, 64.0, 66.0, 68.0, 70.0, 72.0, 74.0, 76.0]:
            mb.update(val)
            feats = FeatureExtractor.extract_metric_features("temperature", val, mb)
            ev = self.drift_detector.detect(feats)

        self.assertTrue(ev.detected, "Positive drift should be detected")
        self.assertEqual(ev.anomaly_type, "drift")
        self.assertGreater(ev.score, 0.5)

        # Negative drift test
        mb_neg = MetricBaseline("temperature", config=self.config)
        for _ in range(15):
            mb_neg.update(80.0)

        for val in [79.0, 78.0, 77.0, 75.0, 73.0, 71.0, 69.0, 67.0, 65.0]:
            mb_neg.update(val)
            feats = FeatureExtractor.extract_metric_features("temperature", val, mb_neg)
            ev_neg = self.drift_detector.detect(feats)

        self.assertTrue(ev_neg.detected, "Negative drift should be detected")

    def test_drift_negative_cases(self):
        """Tests that isolated spike or noisy random data does not trigger drift."""
        mb = MetricBaseline("temperature", config=self.config)
        for _ in range(15):
            mb.update(60.0)

        # Isolated single spike
        mb.update(120.0)
        feats_spike = FeatureExtractor.extract_metric_features("temperature", 120.0, mb)
        ev_spike = self.drift_detector.detect(feats_spike)
        self.assertFalse(ev_spike.detected, "Isolated single spike should NOT trigger drift")

        # Random noise without sustained direction
        mb_noise = MetricBaseline("temperature", config=self.config)
        for _ in range(15):
            mb_noise.update(60.0)

        for val in [61.0, 59.5, 60.5, 59.0, 61.2, 59.8, 60.3]:
            mb_noise.update(val)

        feats_noise = FeatureExtractor.extract_metric_features("temperature", 60.3, mb_noise)
        ev_noise = self.drift_detector.detect(feats_noise)
        self.assertFalse(ev_noise.detected, "Random non-directional noise should NOT trigger drift")

    # -------------------------------------------------------------------------
    # 2. SPIKE DETECTOR TESTS
    # -------------------------------------------------------------------------
    def test_spike_detector_positive_and_negative(self):
        """Tests positive and negative spike detection."""
        mb = MetricBaseline("current", config=self.config)
        for _ in range(15):
            mb.update(8.0)

        # Inject sudden positive spike: 8.0 -> 35.0
        mb.update(35.0)
        feats = FeatureExtractor.extract_metric_features("current", 35.0, mb)
        ev = self.spike_detector.detect(feats)

        self.assertTrue(ev.detected, "Sudden positive spike should be detected")
        self.assertEqual(ev.anomaly_type, "spike")
        self.assertGreater(ev.score, 0.6)

    def test_spike_negative_cases(self):
        """Tests that gradual slope or normal noise does not trigger spike."""
        mb = MetricBaseline("current", config=self.config)
        for _ in range(15):
            mb.update(8.0)

        # Gradual slow movement
        for val in [8.2, 8.4, 8.6, 8.8, 9.0]:
            mb.update(val)
            feats = FeatureExtractor.extract_metric_features("current", val, mb)
            ev = self.spike_detector.detect(feats)
            self.assertFalse(ev.detected, "Gradual slope should NOT be classified as spike")

    # -------------------------------------------------------------------------
    # 3. FLATLINE DETECTOR TESTS
    # -------------------------------------------------------------------------
    def test_flatline_detector(self):
        """Tests flatline detection on a device with historical variability."""
        mb = MetricBaseline("rpm", config=self.config)

        # Warm up with natural variation: 1480, 1520, 1475, 1510, 1490...
        for i in range(15):
            val = 1500.0 + (10 if i % 2 == 0 else -10)
            mb.update(val)

        self.assertGreater(mb.std_dev, 1.0, "Device has natural baseline variability")

        # Flatline sequence: 1500.0 repeated 8 times
        ev = None
        for _ in range(8):
            mb.update(1500.0)
            feats = FeatureExtractor.extract_metric_features("rpm", 1500.0, mb)
            ev = self.flatline_detector.detect(feats)

        self.assertTrue(ev.detected, "Sustained flatline on variable device should be detected")
        self.assertEqual(ev.anomaly_type, "flatline")

    def test_flatline_naturally_low_variance_protection(self):
        """Tests that a device naturally operating with near-zero std is NOT falsely flagged."""
        mb_steady = MetricBaseline("current", config=self.config)
        for _ in range(20):
            mb_steady.update(5.000)

        feats = FeatureExtractor.extract_metric_features("current", 5.000, mb_steady)
        ev = self.flatline_detector.detect(feats)

        self.assertFalse(ev.detected, "Naturally low-variance device should NOT be falsely flagged as flatline")

    # -------------------------------------------------------------------------
    # 4. OSCILLATION DETECTOR TESTS
    # -------------------------------------------------------------------------
    def test_oscillation_detector(self):
        """Tests oscillation detection on vibration metric."""
        mb = MetricBaseline("vibration", config=self.config)

        # Warm up baseline at ~2.0 mm/s
        for _ in range(15):
            mb.update(2.0)

        # High-amplitude alternating oscillation: 2.0, 7.0, 1.8, 7.2, 2.0, 6.9, 1.9, 7.1
        seq = [2.0, 7.0, 1.8, 7.2, 2.0, 6.9, 1.9, 7.1]
        ev = None
        for val in seq:
            mb.update(val)
            feats = FeatureExtractor.extract_metric_features("vibration", val, mb)
            ev = self.oscillation_detector.detect(feats)

        self.assertTrue(ev.detected, "Structured alternating oscillation should be detected")
        self.assertEqual(ev.anomaly_type, "oscillation")

    def test_oscillation_negative_cases(self):
        """Tests that low-amplitude noise or 1-2 direction changes do not trigger oscillation."""
        mb = MetricBaseline("vibration", config=self.config)
        for _ in range(15):
            mb.update(2.0)

        # Low amplitude noise (within baseline noise range)
        for val in [2.01, 2.03, 1.99, 2.02, 1.98, 2.01]:
            mb.update(val)
            feats = FeatureExtractor.extract_metric_features("vibration", val, mb)
            ev = self.oscillation_detector.detect(feats)
            self.assertFalse(ev.detected, "Low-amplitude noise should NOT trigger oscillation")

    # -------------------------------------------------------------------------
    # 5. SENSOR SWAP DETECTOR TESTS
    # -------------------------------------------------------------------------
    def test_sensor_swap_detector_deterministic_scenario(self):
        """
        Tests conservative sensor swap detection:
        DEV-007 normally operates at temp~60, rpm~1480, curr~8, vib~2
        DEV-024 normally operates at temp~85, rpm~1750, curr~14, vib~5
        DEV-007 suddenly receives telemetry matching DEV-024's profile across metrics.
        """
        # Warm up DEV-007 and DEV-024
        for _ in range(15):
            self.manager.process_telemetry(self._generate_telemetry("DEV-007", temp=60.0, vib=2.0, curr=8.0, rpm=1480))
            self.manager.process_telemetry(self._generate_telemetry("DEV-024", temp=85.0, vib=5.0, curr=14.0, rpm=1750))

        fleet_baselines = self.manager.get_all_baselines()

        # Telemetry packet for DEV-007 carrying DEV-024's profile
        swapped_telemetry = self._generate_telemetry("DEV-007", temp=85.2, vib=5.1, curr=14.1, rpm=1748)
        db_007 = self.manager.get_or_create("DEV-007")
        dev_feats = FeatureExtractor.extract_device_features(swapped_telemetry, db_007)

        ev = self.sensor_swap_detector.detect_device(dev_feats, fleet_baselines)

        self.assertTrue(ev.detected, "Sensor swap should be detected when DEV-007 receives DEV-024's profile")
        self.assertEqual(ev.anomaly_type, "sensor_swap")
        self.assertEqual(ev.evidence["candidate_swapped_device"], "DEV-024")

    def test_sensor_swap_distinct_normal_operating_ranges(self):
        """
        CORE TEST FOR OPERATING RANGES:
        Proves DEV-A at 60°C and DEV-B at 90°C both remain HEALTHY during normal operation.
        """
        for _ in range(15):
            self.manager.process_telemetry(self._generate_telemetry("DEV-A", temp=60.0, vib=2.0, curr=8.0, rpm=1480))
            self.manager.process_telemetry(self._generate_telemetry("DEV-B", temp=90.0, vib=4.0, curr=12.0, rpm=1650))

        fleet_baselines = self.manager.get_all_baselines()

        # Normal telemetry for DEV-B at 90°C
        t_b_normal = self._generate_telemetry("DEV-B", temp=90.2, vib=4.1, curr=12.0, rpm=1648)
        db_b = self.manager.get_or_create("DEV-B")
        feats_b = FeatureExtractor.extract_device_features(t_b_normal, db_b)

        ev_b = self.sensor_swap_detector.detect_device(feats_b, fleet_baselines)
        self.assertFalse(ev_b.detected, "DEV-B operating normally at 90°C must NOT trigger sensor swap")

    # -------------------------------------------------------------------------
    # 6. NEGATIVE TESTS & NORMAL TELEMETRY
    # -------------------------------------------------------------------------
    def test_normal_telemetry_zero_false_positives(self):
        """Tests that normal telemetry with small natural noise triggers ZERO false positive anomalies across detectors."""
        for i in range(25):
            # Normal telemetry with small noise jitter
            t_temp = 60.0 + (i % 3 - 1) * 0.2
            t_vib = 2.0 + (i % 2) * 0.05
            t_curr = 8.0 + (i % 3 - 1) * 0.1
            t_rpm = 1500.0 + (i % 2) * 2.0

            telemetry = self._generate_telemetry("DEV-100", temp=t_temp, vib=t_vib, curr=t_curr, rpm=t_rpm)
            self.manager.process_telemetry(telemetry)

            db = self.manager.get_or_create("DEV-100")
            dev_feats = FeatureExtractor.extract_device_features(telemetry, db)

            if i >= 15:  # Evaluate after warm-up
                for m_name, mf in dev_feats.metrics.items():
                    ev_drift = self.drift_detector.detect(mf)
                    ev_spike = self.spike_detector.detect(mf)
                    ev_flat = self.flatline_detector.detect(mf)
                    ev_osc = self.oscillation_detector.detect(mf)

                    self.assertFalse(ev_drift.detected, f"False drift on {m_name}")
                    self.assertFalse(ev_spike.detected, f"False spike on {m_name}")
                    self.assertFalse(ev_flat.detected, f"False flatline on {m_name}")
                    self.assertFalse(ev_osc.detected, f"False oscillation on {m_name}")

    # -------------------------------------------------------------------------
    # 7. 50-DEVICE SCALING
    # -------------------------------------------------------------------------
    def test_50_device_detector_scale(self):
        """Tests independent feature extraction and detector evaluation across 50 devices."""
        for i in range(1, 51):
            dev_id = f"DEV-{i:03d}"
            norm_temp = 40.0 + i
            for _ in range(15):
                self.manager.process_telemetry(self._generate_telemetry(dev_id, temp=norm_temp))

        fleet_baselines = self.manager.get_all_baselines()
        self.assertEqual(len(fleet_baselines), 50)

        # Evaluate DEV-001 and DEV-050
        for dev_id in ["DEV-001", "DEV-050"]:
            db = self.manager.get_or_create(dev_id)
            normal_val = 41.0 if dev_id == "DEV-001" else 90.0
            t_norm = self._generate_telemetry(dev_id, temp=normal_val)
            feats = FeatureExtractor.extract_device_features(t_norm, db)

            ev_swap = self.sensor_swap_detector.detect_device(feats, fleet_baselines)
            self.assertFalse(ev_swap.detected, f"Device {dev_id} operating normally should not be flagged")


if __name__ == "__main__":
    unittest.main()

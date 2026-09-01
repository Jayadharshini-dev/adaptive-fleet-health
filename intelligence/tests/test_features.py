"""
Unit Tests for Feature Extractor Layer.
Validates statistical and time-series feature calculations and read-only non-mutation property.
"""

import unittest
from intelligence.baseline.baseline_config import BaselineConfig
from intelligence.baseline.adaptive_baseline import MetricBaseline, DeviceBaseline
from intelligence.features.feature_extractor import FeatureExtractor, MetricFeatures, DeviceFeatures


class TestFeatureExtractor(unittest.TestCase):
    def setUp(self):
        self.config = BaselineConfig(warmup_observations=10, alpha=0.1, alpha_var=0.05, rolling_window_size=20)
        self.metric_baseline = MetricBaseline("temperature", config=self.config)
        self.device_baseline = DeviceBaseline("DEV-001", config=self.config)

    def test_feature_extraction_accuracy(self):
        """Tests calculation of Z-scores, trend, first differences, sign changes, and range."""
        # Warm up baseline at 60.0
        for _ in range(10):
            self.metric_baseline.update(60.0)

        # Feed sequence: 61, 62, 63, 64, 65
        for v in [61.0, 62.0, 63.0, 64.0, 65.0]:
            self.metric_baseline.update(v)

        features = FeatureExtractor.extract_metric_features("temperature", 65.0, self.metric_baseline)

        self.assertIsInstance(features, MetricFeatures)
        self.assertEqual(features.metric_name, "temperature")
        self.assertAlmostEqual(features.current_value, 65.0)
        self.assertTrue(features.is_mature)
        self.assertGreater(features.z_score, 1.0)
        self.assertAlmostEqual(features.first_difference, 1.0)
        self.assertGreater(features.recent_trend, 0.0)
        self.assertGreaterEqual(features.direction_consistency, 0.8)
        self.assertEqual(features.recent_range, 5.0)

    def test_feature_extractor_read_only_non_mutation(self):
        """Tests that FeatureExtractor is pure and does not mutate baseline state."""
        for _ in range(15):
            self.device_baseline.process_telemetry({"temperature": 50.0, "vibration": 2.0})

        sample_counts_before = {
            m_name: self.device_baseline.get_metric_baseline(m_name).sample_count
            for m_name in ["temperature", "vibration", "current", "rpm"]
        }

        telemetry = {"device_id": "DEV-001", "metrics": {"temperature": 55.0, "vibration": 2.5}}
        dev_features = FeatureExtractor.extract_device_features(telemetry, self.device_baseline)

        self.assertIsInstance(dev_features, DeviceFeatures)

        sample_counts_after = {
            m_name: self.device_baseline.get_metric_baseline(m_name).sample_count
            for m_name in ["temperature", "vibration", "current", "rpm"]
        }

        self.assertEqual(sample_counts_before, sample_counts_after, "FeatureExtractor mutated baseline sample count!")

    def test_missing_and_none_values(self):
        """Tests graceful handling of missing or None values."""
        features = FeatureExtractor.extract_metric_features("vibration", None, self.metric_baseline)
        self.assertIsNone(features.current_value)
        self.assertEqual(features.z_score, 0.0)
        self.assertEqual(features.distance_from_baseline, 0.0)


if __name__ == "__main__":
    unittest.main()

import threading
from typing import Dict, Any, Optional
from intelligence.models.health_engine import HealthEngine
from intelligence.baseline.baseline_manager import BaselineManager
from intelligence.models.health_result import HealthResult

class IntelligencePipeline:
    """
    Thread-safe backend service wrapping Member 1's actual HealthEngine and BaselineManager.
    Preserves per-device adaptive learning state across sequential HTTP requests.
    """

    def __init__(self):
        self.health_engine = HealthEngine()
        self.baseline_manager = BaselineManager()
        self._lock = threading.Lock()

    def process_telemetry(self, telemetry: Dict[str, Any]) -> HealthResult:
        """
        Passes raw telemetry dictionary to the actual Member 1 HealthEngine.
        Returns the authoritative HealthResult.
        """
        with self._lock:
            return self.health_engine.process_telemetry(telemetry, self.baseline_manager)

    def get_baseline(self, device_key: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            return self.baseline_manager.get_baseline(device_key)

    def reset_all(self):
        with self._lock:
            self.baseline_manager.reset_all()

# Global singleton intelligence pipeline
pipeline = IntelligencePipeline()

def process_reading(
    db: Any,
    device_id: str,
    device_instance_id: str,
    region: str,
    metrics: Dict[str, Any],
    timestamp: Any
) -> Dict[str, Any]:
    """Processes reading through global pipeline and syncs baseline to DB."""
    ts_str = timestamp.isoformat() if hasattr(timestamp, "isoformat") else str(timestamp)
    m_dict = {
        "temperature": float(metrics.get("temperature", 0.0)),
        "vibration": float(metrics.get("vibration", 0.0)),
        "current": float(metrics.get("current", 0.0)),
        "rpm": float(metrics.get("rpm", 0.0))
    }
    packet = {
        "device_id": device_id,
        "device_instance_id": device_instance_id,
        "region": region,
        "timestamp": ts_str,
        "metrics": m_dict,
        "temperature": m_dict["temperature"],
        "vibration": m_dict["vibration"],
        "current": m_dict["current"],
        "rpm": m_dict["rpm"]
    }
    result = pipeline.process_telemetry(packet)
    res_dict = result.to_dict() if hasattr(result, "to_dict") else dict(result)
    if not res_dict.get("current_metrics"):
        res_dict["current_metrics"] = m_dict

    # Sync baseline metrics if available
    try:
        from app import models
        bl = pipeline.get_baseline(device_instance_id) or pipeline.get_baseline(device_id)
        if bl and db and "metrics" in bl:
            metrics_obj = bl["metrics"]
            t_m = metrics_obj.get("temperature", {}).get("mean")
            t_s = metrics_obj.get("temperature", {}).get("std_dev")
            v_m = metrics_obj.get("vibration", {}).get("mean")
            v_s = metrics_obj.get("vibration", {}).get("std_dev")
            c_m = metrics_obj.get("current", {}).get("mean")
            c_s = metrics_obj.get("current", {}).get("std_dev")
            r_m = metrics_obj.get("rpm", {}).get("mean")
            r_s = metrics_obj.get("rpm", {}).get("std_dev")

            if t_m is not None:
                db_bl = db.query(models.Baseline).filter(
                    models.Baseline.device_id == device_id,
                    models.Baseline.device_instance_id == device_instance_id
                ).first()
                if not db_bl:
                    db_bl = models.Baseline(
                        device_id=device_id,
                        device_instance_id=device_instance_id,
                        temperature_mean=round(float(t_m), 2),
                        temperature_std=round(float(t_s or 0.1), 2),
                        vibration_mean=round(float(v_m or 0.0), 2),
                        vibration_std=round(float(v_s or 0.1), 2),
                        current_mean=round(float(c_m or 0.0), 2),
                        current_std=round(float(c_s or 0.1), 2),
                        rpm_mean=round(float(r_m or 0.0), 2),
                        rpm_std=round(float(r_s or 1.0), 2)
                    )
                    db.add(db_bl)
                else:
                    db_bl.temperature_mean = round(float(t_m), 2)
                    if t_s: db_bl.temperature_std = round(float(t_s), 2)
                    if v_m: db_bl.vibration_mean = round(float(v_m), 2)
                    if v_s: db_bl.vibration_std = round(float(v_s), 2)
                    if c_m: db_bl.current_mean = round(float(c_m), 2)
                    if c_s: db_bl.current_std = round(float(c_s), 2)
                    if r_m: db_bl.rpm_mean = round(float(r_m), 2)
                    if r_s: db_bl.rpm_std = round(float(r_s), 2)
    except Exception:
        pass

    return res_dict

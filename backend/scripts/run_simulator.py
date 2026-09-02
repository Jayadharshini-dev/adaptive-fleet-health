import sys
import os
import time
import requests
import random
from datetime import datetime, timezone

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
from simulator.fleet_simulator import FleetSimulator

API_URL = os.getenv("API_URL", "http://localhost:8000")

def run_continuous_simulator():
    print("=" * 75)
    print("STARTING CONTINUOUS FLEET TELEMETRY SIMULATOR")
    print(f"Target API Endpoint: {API_URL}/readings")
    print("=" * 75)

    sim = FleetSimulator(seed=42, sampling_interval_seconds=2)
    # Inject failure behaviors
    sim.inject_failure("DEV-007", "drift", target_metric="temperature", rate=1.2)
    sim.inject_failure("DEV-014", "spike", target_metric="current", magnitude=25.0)
    sim.inject_failure("DEV-021", "flatline", target_metric="vibration")
    sim.inject_failure("DEV-032", "oscillation", target_metric="vibration", amplitude=4.8)
    sim.inject_failure("DEV-045", "sensor_swap", target_device_id="DEV-024")

    step = 0
    while True:
        step += 1
        packets = sim.step()
        now_iso = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

        # Pick a batch of 3-5 devices each cycle
        batch = random.sample(packets, min(4, len(packets)))
        anom_candidates = [p for p in packets if p.device_id in ["DEV-007", "DEV-014", "DEV-021", "DEV-032", "DEV-045"]]
        if anom_candidates and random.random() < 0.6:
            batch.append(random.choice(anom_candidates))

        for p in batch:
            payload = {
                "device_id": p.device_id,
                "device_instance_id": p.device_instance_id,
                "region": p.region,
                "timestamp": now_iso,
                "metrics": {
                    "temperature": float(p.metrics["temperature"]),
                    "vibration": float(p.metrics["vibration"]),
                    "current": float(p.metrics["current"]),
                    "rpm": float(p.metrics["rpm"])
                }
            }
            try:
                res = requests.post(f"{API_URL}/readings", json=payload, timeout=2.0)
                if res.status_code in [200, 201]:
                    data = res.json()
                    st = data.get("status", "HEALTHY").upper()
                    anom = data.get("anomaly_type", "none")
                    if anom != "none":
                        print(f"[{now_iso}]  ANOMALY DETECTED on {p.device_id}: {anom} (Status: {st}, Severity: {data.get('severity', 0):.2f})")
            except Exception as e:
                print(f"⚠️ Failed to send reading to {API_URL}: {e}")
                time.sleep(1.0)
                break

        time.sleep(2.0)

if __name__ == "__main__":
    run_continuous_simulator()

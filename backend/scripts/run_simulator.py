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
    print("=" * 80)
    print("ADAPTIVE FLEET HEALTH MONITORING - CONTINUOUS TELEMETRY SIMULATOR")
    print(f"Target API Ingestion Endpoint: {API_URL}/readings")
    print("=" * 80)

    sim = FleetSimulator(seed=42, sampling_interval_seconds=2)
    
    # Check server availability
    try:
        ping = requests.get(f"{API_URL}/health", timeout=3.0)
        print(f"-> Backend server detected: HTTP {ping.status_code} ({API_URL})")
    except Exception as e:
        print(f"Warning: Could not reach backend at {API_URL} ({e}). Starting loop anyway...")

    # Phase 1: Rapid 12-step Warmup to establish statistical baseline envelope
    print()
    print("[PHASE 1] Rapid Fleet Warmup (12 steps across all 50 devices)...")
    for w in range(12):
        packets = sim.step()
        now_iso = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        for p in packets:
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
                requests.post(f"{API_URL}/readings", json=payload, timeout=2.0)
            except Exception:
                pass
        print(f"   -> Warmup step {w+1}/12 completed.", end="\r")
    print()
    print("-> Fleet baseline learning mature. All 50 devices operational.")

    # Phase 2: Inject 5 Canonical Failure Modes
    print()
    print("[PHASE 2] Activating 5 Distinct Sensor Failure Behaviors:")
    print("   - DEV-007: Temperature Drift (Gradual +2.5°C departure)")
    print("   - DEV-014: Current Surge Spike (+35.0 A excursion)")
    print("   - DEV-021: Vibration Flatline (Zero sensor variation 0.02 mm/s)")
    print("   - DEV-032: Vibration Oscillation (Sinusoidal +/-5.5 mm/s wave)")
    print("   - DEV-045: Sensor Swap (Discontinuous profile substitution with DEV-024)")
    print("=" * 80)

    sim.inject_failure("DEV-007", "drift", target_metric="temperature", rate=2.5)
    sim.inject_failure("DEV-014", "spike", target_metric="current", magnitude=35.0)
    sim.inject_failure("DEV-021", "flatline", target_metric="vibration")
    sim.inject_failure("DEV-032", "oscillation", target_metric="vibration", amplitude=5.5)
    sim.inject_failure("DEV-045", "sensor_swap", target_device_id="DEV-024")

    # Phase 3: Continuous Ingestion Loop
    print()
    print("[PHASE 3] Streaming Live Fleet Telemetry to Backend (Ctrl+C to stop)...")
    step = 0
    while True:
        step += 1
        packets = sim.step()
        now_iso = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

        # Pick a balanced batch: 4 normal devices + target failure devices
        batch = random.sample(packets, min(4, len(packets)))
        target_devs = [p for p in packets if p.device_id in ["DEV-007", "DEV-014", "DEV-021", "DEV-032", "DEV-045"]]
        for td in target_devs:
            if random.random() < 0.7:
                batch.append(td)

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
                        sev = float(data.get("severity", 0.0))
                        conf = float(data.get("confidence", 0.0))
                        print(f"[{now_iso}] ALERT: {p.device_id:<8} | ANOMALY: {anom.upper():<12} | Status: {st:<8} | Sev: {sev:.2f} | Conf: {conf:.2f}")
            except Exception as e:
                print(f"Transmission error to {API_URL}: {e}")
                time.sleep(1.0)
                break

        time.sleep(2.0)

if __name__ == "__main__":
    run_continuous_simulator()

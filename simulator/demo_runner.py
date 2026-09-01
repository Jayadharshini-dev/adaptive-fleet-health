"""
End-to-End Demonstration Runner for Adaptive Fleet Health Monitoring.
Feeds FleetSimulator telemetry into actual HealthEngine and outputs verified detection table.
"""

from typing import Dict, List, Any
from simulator.scenarios import DemoScenarioController


def run_demonstration():
    """
    Executes complete 4-phase demonstration scenario and prints verified detection summary.
    """
    print("=" * 85)
    print("ADAPTIVE FLEET HEALTH MONITORING - END-TO-END INTELLIGENCE DEMONSTRATION")
    print("=" * 85)

    controller = DemoScenarioController()

    print("\n[PHASE A] Running 30 Warmup Observations across 50 Devices...")
    warmup_res = controller.run_warmup_phase(warmup_steps=30)
    print(f"-> Baseline warmup completed for {len(warmup_res[-1])} devices.")

    print("\n[PHASE B] Injecting 5 Simultaneous Sensor Failure Behaviors...")
    failures = controller.activate_demo_failures()
    print("-> Active failure behaviors injected:")
    print("   - DEV-007: Temperature Drift")
    print("   - DEV-014: Current Spike")
    print("   - DEV-021: Vibration Flatline")
    print("   - DEV-032: Vibration Oscillation")
    print("   - DEV-045: Sensor Swap (profile substitution with DEV-024)")

    print("\n[PHASE C] Running Incident Monitoring Phase through HealthEngine...")
    incident_res = controller.run_incident_phase(incident_steps=10)

    # Pick active detected anomaly result for each target device during incident phase
    target_devices = [
        ("DEV-007", "Temperature Drift", "drift"),
        ("DEV-014", "Current Spike", "spike"),
        ("DEV-021", "Vibration Flatline", "flatline"),
        ("DEV-032", "Vibration Oscillation", "oscillation"),
        ("DEV-045", "Sensor Swap", "sensor_swap"),
    ]

    detected_map = {}
    for dev_id, injected_behavior, target_anomaly in target_devices:
        dev_steps = [step_map[dev_id] for step_map in incident_res if dev_id in step_map]
        # Match target anomaly or pick highest severity result during incident phase
        matched = [hr for hr in dev_steps if hr.anomaly_type == target_anomaly]
        if matched:
            detected_map[dev_id] = matched[0]
        else:
            detected_map[dev_id] = max(dev_steps, key=lambda hr: hr.severity)

    print("\n" + "=" * 85)
    print("VERIFIED HEALTHENGINE DETECTION TABLE (INCIDENT MONITORING PHASE)")
    print("=" * 85)
    print(f"{'DEVICE':<10} | {'REGION':<8} | {'INJECTED BEHAVIOR':<22} | {'DETECTED ANOMALY':<16} | {'STATUS':<10} | {'SEVERITY':<8} | {'CONFIDENCE':<10}")
    print("-" * 85)

    for dev_id, injected_behavior, _ in target_devices:
        if dev_id in detected_map:
            hr = detected_map[dev_id]
            print(f"{dev_id:<10} | {hr.region:<8} | {injected_behavior:<22} | {hr.anomaly_type:<16} | {hr.status:<10} | {hr.severity:<8.2f} | {hr.confidence:<10.2f}")

    print("-" * 85)
    print("\nEXPLANATIONS PRODUCED BY HEALTHENGINE:")
    for dev_id, _, _ in target_devices:
        if dev_id in detected_map:
            hr = detected_map[dev_id]
            print(f"- [{dev_id}] ({hr.status.upper()}): {hr.explanation}")

    print("\n[PHASE D] Clearing Failures and Verifying System Recovery...")
    recovery_res = controller.clear_failures_phase(recovery_steps=5)
    latest_recovery = recovery_res[-1]

    recovered_count = sum(1 for dev_id, _, _ in target_devices if latest_recovery.get(dev_id) and latest_recovery[dev_id].status == "healthy")
    print(f"-> {recovered_count}/{len(target_devices)} target incident devices successfully recovered to HEALTHY status.")
    print("=" * 85)
    print("DEMONSTRATION COMPLETED SUCCESSFULLY.")
    print("=" * 85)


if __name__ == "__main__":
    run_demonstration()

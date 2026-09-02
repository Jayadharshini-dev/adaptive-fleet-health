import sys
import os
import random
import math
from datetime import datetime, timezone, timedelta

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import SessionLocal, engine, Base
from app import models

REGIONS = ["North", "South", "East", "West"]
NUM_DEVICES = 50
READINGS_PER_DEVICE = 20

def seed_database():
    print("=" * 60)
    print("Seeding Adaptive Fleet Database (Canonical Telemetry & Incidents)...")
    print("=" * 60)
    
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # Seed users if not existing
        u1 = db.query(models.User).filter(models.User.username == "operator1").first()
        if not u1:
            db.add(models.User(
                username="operator1",
                full_name="Operator 01",
                role="Control Room A",
                password_hash="demo123"
            ))
        u2 = db.query(models.User).filter(models.User.username == "operator2").first()
        if not u2:
            db.add(models.User(
                username="operator2",
                full_name="Operator 02",
                role="Control Room B",
                password_hash="demo123"
            ))

        random.seed(42)

        now = datetime.now(timezone.utc)
        start_time = now - timedelta(hours=5)

        for i in range(1, NUM_DEVICES + 1):
            device_id = f"DEV-{i:03d}"
            instance_id = f"INST-{i:03d}-A"
            region = REGIONS[(i - 1) % len(REGIONS)]

            # Check if device already exists
            existing_dev = db.query(models.Device).filter(models.Device.device_id == device_id).first()
            if not existing_dev:
                device = models.Device(
                    device_id=device_id,
                    device_instance_id=instance_id,
                    region=region,
                    status="HEALTHY",
                    created_at=start_time
                )
                db.add(device)
                db.flush()

                # Define unique canonical baseline profiles
                base_temp = round(random.uniform(50.0, 75.0), 1)
                base_vib = round(random.uniform(2.5, 6.5), 1)
                base_curr = round(random.uniform(8.0, 15.0), 1)
                base_rpm = round(random.uniform(1400.0, 1800.0), 1)

                temp_noise_scale = round(random.uniform(1.0, 2.5), 2)
                vib_noise_scale = round(random.uniform(0.3, 0.9), 2)
                curr_noise_scale = round(random.uniform(0.2, 0.5), 2)
                rpm_noise_scale = round(random.uniform(5.0, 15.0), 2)

                temps, vibs, currs, rpms = [], [], [], []

                for j in range(READINGS_PER_DEVICE):
                    reading_time = start_time + timedelta(minutes=15 * j)
                    t_val = round(base_temp + random.gauss(0, temp_noise_scale), 2)
                    v_val = max(0.1, round(base_vib + random.gauss(0, vib_noise_scale), 2))
                    c_val = max(0.1, round(base_curr + random.gauss(0, curr_noise_scale), 2))
                    r_val = max(100.0, round(base_rpm + random.gauss(0, rpm_noise_scale), 2))

                    temps.append(t_val)
                    vibs.append(v_val)
                    currs.append(c_val)
                    rpms.append(r_val)

                    reading = models.SensorReading(
                        device_id=device_id,
                        device_instance_id=instance_id,
                        region=region,
                        timestamp=reading_time,
                        temperature=t_val,
                        vibration=v_val,
                        current=c_val,
                        rpm=r_val,
                        received_at=reading_time
                    )
                    db.add(reading)

                temp_mean = sum(temps) / len(temps)
                temp_std = max(0.1, math.sqrt(sum((x - temp_mean) ** 2 for x in temps) / len(temps)))
                vib_mean = sum(vibs) / len(vibs)
                vib_std = max(0.05, math.sqrt(sum((x - vib_mean) ** 2 for x in vibs) / len(vibs)))
                curr_mean = sum(currs) / len(currs)
                curr_std = max(0.05, math.sqrt(sum((x - curr_mean) ** 2 for x in currs) / len(currs)))
                rpm_mean = sum(rpms) / len(rpms)
                rpm_std = max(1.0, math.sqrt(sum((x - rpm_mean) ** 2 for x in rpms) / len(rpms)))

                baseline = models.Baseline(
                    device_id=device_id,
                    device_instance_id=instance_id,
                    temperature_mean=round(temp_mean, 2),
                    temperature_std=round(temp_std, 2),
                    vibration_mean=round(vib_mean, 2),
                    vibration_std=round(vib_std, 2),
                    current_mean=round(curr_mean, 2),
                    current_std=round(curr_std, 2),
                    rpm_mean=round(rpm_mean, 2),
                    rpm_std=round(rpm_std, 2),
                    updated_at=start_time + timedelta(minutes=15 * READINGS_PER_DEVICE)
                )
                db.add(baseline)

        # Seed 3 historical pre-login incidents (~4-5 mins before current startup)
        hist_incidents_count = db.query(models.Incident).count()
        if hist_incidents_count == 0:
            hist_t1 = now - timedelta(minutes=5)
            hist_t2 = now - timedelta(minutes=4)
            hist_t3 = now - timedelta(minutes=3)

            inc1 = models.Incident(
                incident_id="INC-HIST-001",
                device_id="DEV-007",
                device_instance_id="INST-007-A",
                region="South",
                anomaly_type="drift",
                severity=0.88,
                confidence=0.92,
                status="RESOLVED",
                first_detected_at=hist_t1 - timedelta(minutes=2),
                last_detected_at=hist_t1,
                resolved_at=hist_t1,
                resolved_by="Operator 01",
                resolution_reason="Re-calibrated thermal sensor assembly",
                occurrence_count=4,
                peak_severity=0.88,
                peak_confidence=0.92,
                latest_explanation="Gradual positive thermal drift observed across 4 consecutive sample cycles.",
                created_at=hist_t1,
                updated_at=hist_t1
            )
            db.add(inc1)

            inc2 = models.Incident(
                incident_id="INC-HIST-002",
                device_id="DEV-014",
                device_instance_id="INST-014-A",
                region="North",
                anomaly_type="spike",
                severity=0.95,
                confidence=0.98,
                status="ACKNOWLEDGED",
                first_detected_at=hist_t2,
                last_detected_at=hist_t2,
                acknowledged_at=hist_t2 + timedelta(seconds=30),
                acknowledged_by="Operator 02",
                occurrence_count=3,
                peak_severity=0.95,
                peak_confidence=0.98,
                latest_explanation="Sudden current spike surge +15.0A exceeding 3.5x standard deviation.",
                created_at=hist_t2,
                updated_at=hist_t2
            )
            db.add(inc2)

            inc3 = models.Incident(
                incident_id="INC-HIST-003",
                device_id="DEV-021",
                device_instance_id="INST-021-A",
                region="East",
                anomaly_type="flatline",
                severity=0.82,
                confidence=0.91,
                status="ACTIVE",
                first_detected_at=hist_t3,
                last_detected_at=hist_t3,
                occurrence_count=5,
                peak_severity=0.82,
                peak_confidence=0.91,
                latest_explanation="Zero-variance flatline condition detected on vibration accelerometer.",
                created_at=hist_t3,
                updated_at=hist_t3
            )
            db.add(inc3)

        db.commit()
        print("Database successfully seeded with 50 devices and historical operational archive.")

    except Exception as e:
        db.rollback()
        print(f"Error during seed: {e}", file=sys.stderr)
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()

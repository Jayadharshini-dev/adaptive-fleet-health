import pytest
import math
from datetime import datetime, timezone, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.database import Base, get_db
from app.main import app
from app import models
from app.intelligence_service import pipeline

# In-memory SQLite for isolated, deterministic tests
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="session", autouse=True)
def setup_test_database():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    
    regions = ["Chennai", "Bangalore", "Hyderabad", "Mumbai", "Delhi"]
    start_time = datetime.now(timezone.utc) - timedelta(hours=5)

    for i in range(1, 51):
        dev_id = f"D{i:02d}"
        inst_id = f"INST-{dev_id}-A"
        device = models.Device(
            device_id=dev_id,
            device_instance_id=inst_id,
            region=regions[(i - 1) % len(regions)],
            status="HEALTHY",
            created_at=start_time
        )
        db.add(device)
        db.flush()

        temps, vibs, currs, rpms = [], [], [], []

        for j in range(20):
            t_val = 60.0 + (i % 10) + (j * 0.1)
            v_val = 4.0 + (i % 3) + (j * 0.02)
            c_val = 10.0 + (i % 4) + (j * 0.05)
            r_val = 1500.0 + (i % 20) + (j * 1.0)
            
            temps.append(t_val)
            vibs.append(v_val)
            currs.append(c_val)
            rpms.append(r_val)

            reading = models.SensorReading(
                device_id=dev_id,
                device_instance_id=inst_id,
                region=device.region,
                timestamp=start_time + timedelta(minutes=j),
                temperature=t_val,
                vibration=v_val,
                current=c_val,
                rpm=r_val,
                received_at=start_time + timedelta(minutes=j)
            )
            db.add(reading)

        t_mean = sum(temps) / len(temps)
        t_std = math.sqrt(sum((x - t_mean) ** 2 for x in temps) / len(temps))
        v_mean = sum(vibs) / len(vibs)
        v_std = math.sqrt(sum((x - v_mean) ** 2 for x in vibs) / len(vibs))
        c_mean = sum(currs) / len(currs)
        c_std = math.sqrt(sum((x - c_mean) ** 2 for x in currs) / len(currs))
        r_mean = sum(rpms) / len(rpms)
        r_std = math.sqrt(sum((x - r_mean) ** 2 for x in rpms) / len(rpms))

        baseline = models.Baseline(
            device_id=dev_id,
            device_instance_id=inst_id,
            temperature_mean=round(t_mean, 2),
            temperature_std=round(t_std, 2),
            vibration_mean=round(v_mean, 2),
            vibration_std=round(v_std, 2),
            current_mean=round(c_mean, 2),
            current_std=round(c_std, 2),
            rpm_mean=round(r_mean, 2),
            rpm_std=round(r_std, 2),
            updated_at=start_time
        )
        db.add(baseline)

    db.commit()
    db.close()
    yield
    Base.metadata.drop_all(bind=engine)

@pytest.fixture()
def client():
    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()

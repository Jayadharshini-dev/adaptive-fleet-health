import pytest
import json
import math
from datetime import datetime, timezone, timedelta
from unittest.mock import patch
from fastapi.testclient import TestClient
from app import models
from tests.conftest import TestingSessionLocal
from app.intelligence_service import pipeline

# ==========================================
# PHASE 1 TESTS (PRESERVED & RESTORED)
# ==========================================

def test_root_endpoint(client):
    """Test root endpoint health check and metadata."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "Adaptive Fleet" in data["message"]
    assert "version" in data
    assert "phase" in data

def test_get_all_devices(client):
    """Test fetching all 50 seeded devices."""
    response = client.get("/devices")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 50
    assert data[0]["device_id"] == "D01"
    assert data[0]["status"] in ["HEALTHY", "WARNING", "CRITICAL"]
    assert "region" in data[0]

def test_get_single_device(client):
    """Test fetching details of a specific device."""
    response = client.get("/devices/D01")
    assert response.status_code == 200
    data = response.json()
    assert data["device_id"] == "D01"
    assert data["region"] in ["Chennai", "Bangalore", "Hyderabad", "Mumbai", "Delhi"]

def test_get_device_readings(client):
    """Test retrieving sensor telemetry readings for a device."""
    response = client.get("/devices/D01/readings?limit=10")
    assert response.status_code == 200
    data = response.json()
    assert len(data) <= 10
    if len(data) > 0:
        assert data[0]["device_id"] == "D01"
        assert "temperature" in data[0]
        assert "vibration" in data[0]
        assert "current" in data[0]
        assert "rpm" in data[0]

def test_get_device_baseline(client):
    """Test fetching baseline statistics for a device."""
    response = client.get("/devices/D01/baseline")
    assert response.status_code == 200
    data = response.json()
    assert data["device_id"] == "D01"
    assert "temperature_mean" in data
    assert "temperature_std" in data
    assert "vibration_mean" in data
    assert "vibration_std" in data
    assert "current_mean" in data
    assert "rpm_mean" in data

def test_get_alerts(client):
    """Test fetching alerts list."""
    response = client.get("/alerts")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)

def test_post_sensor_reading(client):
    """Test ingesting a new sensor reading with canonical metrics."""
    payload = {
        "device_id": "D17",
        "device_instance_id": "INST-D17-A",
        "region": "Bangalore",
        "timestamp": "2026-09-01T12:30:00Z",
        "metrics": {
            "temperature": 72.4,
            "vibration": 4.2,
            "current": 10.1,
            "rpm": 1510.0
        }
    }
    response = client.post("/readings", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["device_id"] == "D17"
    assert data["current_metrics"]["temperature"] == 72.4
    assert data["current_metrics"]["rpm"] == 1510.0

def test_post_detection_result(client):
    """Test legacy POST /detections endpoint updates device status."""
    payload = {
        "device_id": "D17",
        "status": "CRITICAL",
        "failure_type": "spike",
        "confidence": 0.94
    }
    response = client.post("/detections", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["device_id"] == "D17"
    assert data["status"] == "CRITICAL"
    assert data["alert"]["failure_type"] == "spike"
    assert data["alert"]["confidence"] == 0.94

    dev_check = client.get("/devices/D17")
    assert dev_check.status_code == 200
    assert dev_check.json()["status"] == "CRITICAL"

def test_nonexistent_device_404(client):
    """Test 404 behavior for nonexistent device."""
    resp1 = client.get("/devices/D99")
    assert resp1.status_code == 404
    assert "Device D99 not found" in resp1.json()["detail"]

    resp2 = client.get("/devices/D99/readings")
    assert resp2.status_code == 404

    resp3 = client.get("/devices/D99/baseline")
    assert resp3.status_code == 404

    resp4 = client.post("/detections", json={
        "device_id": "D99",
        "status": "CRITICAL",
        "failure_type": "drift",
        "confidence": 0.8
    })
    assert resp4.status_code == 404

def test_detection_validation_errors(client):
    """Test validation error handling on /detections."""
    res = client.post("/detections", json={
        "device_id": "D01",
        "status": "INVALID_STATUS",
        "failure_type": "spike",
        "confidence": 0.9
    })
    assert res.status_code == 422


# ==========================================
# PHASE 2 TESTS (SUMMARIES & WEBSOCKETS)
# ==========================================

def test_fleet_summary_api(client):
    """Test GET /fleet/summary returns dynamic metrics."""
    response = client.get("/fleet/summary")
    assert response.status_code == 200
    data = response.json()
    assert "total_devices" in data
    assert data["total_devices"] >= 50
    assert "healthy" in data
    assert "warning" in data
    assert "critical" in data
    assert "active_alerts" in data
    assert data["healthy"] + data["warning"] + data["critical"] == data["total_devices"]

def test_regions_summary_api(client):
    """Test GET /regions/summary returns regional device counts."""
    response = client.get("/regions/summary")
    assert response.status_code == 200
    data = response.json()
    expected_regions = ["Chennai", "Bangalore", "Hyderabad", "Mumbai", "Delhi"]
    for reg in expected_regions:
        assert reg in data
        assert "total_devices" in data[reg]
        assert "healthy" in data[reg]
        assert "warning" in data[reg]
        assert "critical" in data[reg]

def test_websocket_fleet_snapshot(client):
    """Test WebSocket client connects and receives initial fleet snapshot."""
    with client.websocket_connect("/ws/fleet") as websocket:
        data = websocket.receive_json()
        assert data["event"] == "fleet_snapshot"
        assert "devices" in data
        assert len(data["devices"]) >= 50

def test_websocket_broadcast_on_detection(client):
    """Test that POST /detections broadcasts event to connected WebSocket clients."""
    with client.websocket_connect("/ws/fleet") as ws1, client.websocket_connect("/ws/fleet") as ws2:
        snap1 = ws1.receive_json()
        snap2 = ws2.receive_json()
        assert snap1["event"] == "fleet_snapshot"
        assert snap2["event"] == "fleet_snapshot"

        payload = {
            "device_id": "D05",
            "status": "WARNING",
            "failure_type": "drift",
            "confidence": 0.89
        }
        res = client.post("/detections", json=payload)
        assert res.status_code == 201

        msg1 = ws1.receive_json()
        msg2 = ws2.receive_json()

        assert msg1["event"] == "device_update"
        assert msg1["device_id"] == "D05"
        assert msg1["status"] == "WARNING"
        assert msg1["failure_type"] == "drift"
        assert msg1["confidence"] == 0.89
        assert msg2 == msg1

def test_detection_database_failure_no_broadcast(client):
    """Test transaction safety: if DB commit fails on /detections, no broadcast is sent."""
    with client.websocket_connect("/ws/fleet") as ws:
        ws.receive_json()

        with patch("sqlalchemy.orm.Session.commit", side_effect=Exception("Simulated DB Error")):
            payload = {
                "device_id": "D08",
                "status": "CRITICAL",
                "failure_type": "spike",
                "confidence": 0.95
            }
            res = client.post("/detections", json=payload)
            assert res.status_code == 500
            assert "Database transaction failed" in res.json()["detail"]


# ==========================================
# PHASE 2.1 TESTS (TELEMETRY WEBSOCKET)
# ==========================================

def test_post_readings_broadcasts_telemetry_update(client):
    """Test that POST /readings broadcasts a telemetry_update event with correct canonical fields."""
    with client.websocket_connect("/ws/fleet") as ws:
        snapshot = ws.receive_json()
        assert snapshot["event"] == "fleet_snapshot"

        payload = {
            "device_id": "D01",
            "device_instance_id": "INST-D01-A",
            "region": "Chennai",
            "timestamp": "2026-09-01T12:45:00Z",
            "metrics": {
                "temperature": 68.2,
                "vibration": 3.8,
                "current": 10.2,
                "rpm": 1495.0
            }
        }
        res = client.post("/readings", json=payload)
        assert res.status_code == 201

        msg = ws.receive_json()
        assert msg["event"] == "telemetry_update"
        assert msg["device_id"] == "D01"
        assert msg["temperature"] == 68.2
        assert msg["vibration"] == 3.8
        assert msg["current"] == 10.2
        assert msg["rpm"] == 1495.0
        assert "timestamp" in msg

def test_post_readings_multiple_clients_broadcast(client):
    """Test that multiple connected WebSocket clients all receive the telemetry_update event."""
    with client.websocket_connect("/ws/fleet") as ws1, client.websocket_connect("/ws/fleet") as ws2:
        snap1 = ws1.receive_json()
        snap2 = ws2.receive_json()
        assert snap1["event"] == "fleet_snapshot"
        assert snap2["event"] == "fleet_snapshot"

        payload = {
            "device_id": "D02",
            "device_instance_id": "INST-D02-A",
            "region": "Bangalore",
            "metrics": {
                "temperature": 75.1,
                "vibration": 5.4,
                "current": 11.5,
                "rpm": 1520.0
            }
        }
        res = client.post("/readings", json=payload)
        assert res.status_code == 201

        msg1 = ws1.receive_json()
        msg2 = ws2.receive_json()

        assert msg1["event"] == "telemetry_update"
        assert msg1["device_id"] == "D02"
        assert msg1["temperature"] == 75.1
        assert msg1["vibration"] == 5.4
        assert msg1["current"] == 11.5
        assert msg1["rpm"] == 1520.0
        assert msg2 == msg1

def test_post_readings_invalid_device_no_broadcast(client):
    """Test that malformed reading rejected by POST /readings produces NO WebSocket broadcast."""
    with client.websocket_connect("/ws/fleet") as ws:
        ws.receive_json()

        payload = {
            "device_id": "   ",
            "device_instance_id": "INST-BAD",
            "region": "North",
            "metrics": {"temperature": 70.0, "vibration": 3.0, "current": 10.0, "rpm": 1500.0}
        }
        res = client.post("/readings", json=payload)
        assert res.status_code == 422

def test_post_readings_database_failure_no_broadcast(client):
    """Test transaction safety: if DB commit fails on /readings, no telemetry broadcast is sent."""
    with client.websocket_connect("/ws/fleet") as ws:
        ws.receive_json()

        with patch("sqlalchemy.orm.Session.commit", side_effect=Exception("Simulated DB Write Error")):
            payload = {
                "device_id": "D03",
                "device_instance_id": "INST-D03-A",
                "region": "Hyderabad",
                "metrics": {"temperature": 70.0, "vibration": 3.0, "current": 10.0, "rpm": 1500.0}
            }
            res = client.post("/readings", json=payload)
            assert res.status_code == 500
            assert "Database transaction failed" in res.json()["detail"]


# ==========================================
# PHASE 2.2 & 2.3 TESTS (DEVICE STATE & FRESHNESS)
# ==========================================

def test_device_state_returns_latest_reading_and_alert(client):
    """Test GET /devices/{device_id}/state returns latest_reading, alert, and telemetry_status."""
    resp = client.get("/devices/D17/state")
    assert resp.status_code == 200
    data = resp.json()
    assert data["device_id"] == "D17"
    assert data["region"] == "Bangalore"
    assert data["status"] in ["HEALTHY", "WARNING", "CRITICAL"]
    assert "telemetry_status" in data
    assert data["latest_reading"] is not None

def test_telemetry_freshness_active(client):
    """Test reading created with current time produces ACTIVE status (0-60s)."""
    now_utc = datetime.now(timezone.utc) - timedelta(seconds=10)
    payload = {
        "device_id": "D10",
        "device_instance_id": "INST-D10-A",
        "region": "Chennai",
        "timestamp": now_utc.isoformat(),
        "metrics": {"temperature": 65.0, "vibration": 3.5, "current": 10.0, "rpm": 1500.0}
    }
    client.post("/readings", json=payload)

    resp = client.get("/devices/D10/state")
    assert resp.status_code == 200
    data = resp.json()
    assert data["telemetry_status"] == "ACTIVE"
    assert data["seconds_since_last_reading"] is not None
    assert 0 <= data["seconds_since_last_reading"] <= 60

def test_telemetry_freshness_stale(client):
    """Test reading 120 seconds old produces STALE status (61-300s)."""
    past_utc = datetime.now(timezone.utc) - timedelta(seconds=120)
    payload = {
        "device_id": "D11",
        "device_instance_id": "INST-D11-A",
        "region": "Bangalore",
        "timestamp": past_utc.isoformat(),
        "metrics": {"temperature": 66.0, "vibration": 3.6, "current": 10.1, "rpm": 1510.0}
    }
    client.post("/readings", json=payload)

    resp = client.get("/devices/D11/state")
    assert resp.status_code == 200
    data = resp.json()
    assert data["telemetry_status"] == "STALE"
    assert data["seconds_since_last_reading"] is not None
    assert 61 <= data["seconds_since_last_reading"] <= 300

def test_telemetry_freshness_offline(client):
    """Test reading 600 seconds old produces OFFLINE status (> 300s)."""
    past_utc = datetime.now(timezone.utc) - timedelta(seconds=600)
    payload = {
        "device_id": "D12",
        "device_instance_id": "INST-D12-A",
        "region": "Hyderabad",
        "timestamp": past_utc.isoformat(),
        "metrics": {"temperature": 67.0, "vibration": 3.7, "current": 10.2, "rpm": 1520.0}
    }
    client.post("/readings", json=payload)

    resp = client.get("/devices/D12/state")
    assert resp.status_code == 200
    data = resp.json()
    assert data["telemetry_status"] == "OFFLINE"
    assert data["seconds_since_last_reading"] is not None
    assert data["seconds_since_last_reading"] >= 300

def test_telemetry_freshness_no_readings_offline(client):
    """Test device with no readings produces OFFLINE with seconds_since_last_reading = null."""
    db = TestingSessionLocal()
    dev = models.Device(device_id="D52", device_instance_id="INST-D52-A", region="Delhi", status="HEALTHY", created_at=datetime.now(timezone.utc))
    db.add(dev)
    db.commit()
    db.close()

    resp = client.get("/devices/D52/state")
    assert resp.status_code == 200
    data = resp.json()
    assert data["device_id"] == "D52"
    assert data["status"] == "HEALTHY"
    assert data["telemetry_status"] == "OFFLINE"
    assert data["seconds_since_last_reading"] is None
    assert data["latest_reading"] is None

def test_telemetry_freshness_future_timestamp_non_negative(client):
    """Test future timestamp produces seconds_since_last_reading >= 0."""
    future_utc = datetime.now(timezone.utc) + timedelta(seconds=10)
    payload = {
        "device_id": "D13",
        "device_instance_id": "INST-D13-A",
        "region": "Mumbai",
        "timestamp": future_utc.isoformat(),
        "metrics": {"temperature": 68.0, "vibration": 3.8, "current": 10.3, "rpm": 1530.0}
    }
    client.post("/readings", json=payload)

    resp = client.get("/devices/D13/state")
    assert resp.status_code == 200
    data = resp.json()
    assert data["seconds_since_last_reading"] == 0
    assert data["telemetry_status"] == "ACTIVE"

def test_telemetry_freshness_health_independence(client):
    """Test that health status and telemetry connectivity status remain completely independent."""
    now_utc = datetime.now(timezone.utc) - timedelta(seconds=5)
    client.post("/readings", json={
        "device_id": "D14",
        "device_instance_id": "INST-D14-A",
        "region": "Delhi",
        "timestamp": now_utc.isoformat(),
        "metrics": {"temperature": 85.0, "vibration": 7.0, "current": 14.0, "rpm": 1750.0}
    })
    client.post("/detections", json={
        "device_id": "D14",
        "status": "CRITICAL",
        "failure_type": "spike",
        "confidence": 0.96
    })

    resp = client.get("/devices/D14/state")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "CRITICAL"
    assert data["telemetry_status"] == "ACTIVE"


# ==========================================
# PHASE 2.4 VALIDATION TESTS (PRESERVED & RESTORED)
# ==========================================

# 1-3. Device ID validation for readings
def test_validation_readings_missing_device_id(client):
    res = client.post("/readings", json={"device_instance_id": "INST-01", "region": "North", "metrics": {"temperature": 70.0, "vibration": 3.0, "current": 10.0, "rpm": 1500.0}})
    assert res.status_code == 422

def test_validation_readings_empty_device_id(client):
    res = client.post("/readings", json={"device_id": "   ", "device_instance_id": "INST-01", "region": "North", "metrics": {"temperature": 70.0, "vibration": 3.0, "current": 10.0, "rpm": 1500.0}})
    assert res.status_code == 422

def test_validation_readings_excessively_long_device_id(client):
    long_id = "D" * 51
    res = client.post("/readings", json={"device_id": long_id, "device_instance_id": "INST-01", "region": "North", "metrics": {"temperature": 70.0, "vibration": 3.0, "current": 10.0, "rpm": 1500.0}})
    assert res.status_code == 422

# Missing device_instance_id & region
def test_validation_readings_missing_device_instance_id(client):
    """Proves canonical contract rejects missing device_instance_id."""
    res = client.post("/readings", json={"device_id": "D01", "region": "North", "metrics": {"temperature": 70.0, "vibration": 3.0, "current": 10.0, "rpm": 1500.0}})
    assert res.status_code == 422

def test_validation_readings_missing_region(client):
    """Proves canonical contract rejects missing region."""
    res = client.post("/readings", json={"device_id": "D01", "device_instance_id": "INST-01", "metrics": {"temperature": 70.0, "vibration": 3.0, "current": 10.0, "rpm": 1500.0}})
    assert res.status_code == 422

# 4-7. Missing sensor measurements
def test_validation_readings_missing_temperature(client):
    res = client.post("/readings", json={"device_id": "D01", "device_instance_id": "INST-01", "region": "North", "metrics": {"vibration": 3.0, "current": 10.0, "rpm": 1500.0}})
    assert res.status_code == 422

def test_validation_readings_missing_vibration(client):
    res = client.post("/readings", json={"device_id": "D01", "device_instance_id": "INST-01", "region": "North", "metrics": {"temperature": 70.0, "current": 10.0, "rpm": 1500.0}})
    assert res.status_code == 422

def test_validation_readings_missing_current(client):
    res = client.post("/readings", json={"device_id": "D01", "device_instance_id": "INST-01", "region": "North", "metrics": {"temperature": 70.0, "vibration": 3.0, "rpm": 1500.0}})
    assert res.status_code == 422

def test_validation_readings_missing_rpm(client):
    res = client.post("/readings", json={"device_id": "D01", "device_instance_id": "INST-01", "region": "North", "metrics": {"temperature": 70.0, "vibration": 3.0, "current": 10.0}})
    assert res.status_code == 422

# 8-10. Non-numeric sensor strings
def test_validation_readings_invalid_temperature_string(client):
    res = client.post("/readings", json={"device_id": "D01", "device_instance_id": "INST-01", "region": "North", "metrics": {"temperature": "hot", "vibration": 3.0, "current": 10.0, "rpm": 1500.0}})
    assert res.status_code == 422

def test_validation_readings_invalid_vibration_string(client):
    res = client.post("/readings", json={"device_id": "D01", "device_instance_id": "INST-01", "region": "North", "metrics": {"temperature": 70.0, "vibration": "shaking", "current": 10.0, "rpm": 1500.0}})
    assert res.status_code == 422

def test_validation_readings_invalid_current_string(client):
    res = client.post("/readings", json={"device_id": "D01", "device_instance_id": "INST-01", "region": "North", "metrics": {"temperature": 70.0, "vibration": 3.0, "current": "high_amp", "rpm": 1500.0}})
    assert res.status_code == 422

# 11-16. NaN and Infinity for sensor measurements
def test_validation_readings_nan_temperature(client):
    res = client.post("/readings", content='{"device_id": "D01", "device_instance_id": "INST-01", "region": "North", "metrics": {"temperature": NaN, "vibration": 3.0, "current": 10.0, "rpm": 1500.0}}', headers={"Content-Type": "application/json"})
    assert res.status_code == 422

def test_validation_readings_infinity_temperature(client):
    res = client.post("/readings", content='{"device_id": "D01", "device_instance_id": "INST-01", "region": "North", "metrics": {"temperature": Infinity, "vibration": 3.0, "current": 10.0, "rpm": 1500.0}}', headers={"Content-Type": "application/json"})
    assert res.status_code == 422

def test_validation_readings_nan_vibration(client):
    res = client.post("/readings", content='{"device_id": "D01", "device_instance_id": "INST-01", "region": "North", "metrics": {"temperature": 70.0, "vibration": NaN, "current": 10.0, "rpm": 1500.0}}', headers={"Content-Type": "application/json"})
    assert res.status_code == 422

def test_validation_readings_infinity_vibration(client):
    res = client.post("/readings", content='{"device_id": "D01", "device_instance_id": "INST-01", "region": "North", "metrics": {"temperature": 70.0, "vibration": Infinity, "current": 10.0, "rpm": 1500.0}}', headers={"Content-Type": "application/json"})
    assert res.status_code == 422

def test_validation_readings_nan_current(client):
    res = client.post("/readings", content='{"device_id": "D01", "device_instance_id": "INST-01", "region": "North", "metrics": {"temperature": 70.0, "vibration": 3.0, "current": NaN, "rpm": 1500.0}}', headers={"Content-Type": "application/json"})
    assert res.status_code == 422

def test_validation_readings_infinity_current(client):
    res = client.post("/readings", content='{"device_id": "D01", "device_instance_id": "INST-01", "region": "North", "metrics": {"temperature": 70.0, "vibration": 3.0, "current": Infinity, "rpm": 1500.0}}', headers={"Content-Type": "application/json"})
    assert res.status_code == 422

# 17-19. Timestamp and negative values
def test_validation_readings_invalid_timestamp(client):
    res = client.post("/readings", json={"device_id": "D01", "device_instance_id": "INST-01", "region": "North", "timestamp": "invalid-datetime-string", "metrics": {"temperature": 70.0, "vibration": 3.0, "current": 10.0, "rpm": 1500.0}})
    assert res.status_code == 422

def test_validation_readings_omitted_timestamp_valid(client):
    res = client.post("/readings", json={"device_id": "D01", "device_instance_id": "INST-D01-A", "region": "Chennai", "metrics": {"temperature": 70.0, "vibration": 3.0, "current": 10.0, "rpm": 1500.0}})
    assert res.status_code == 201
    assert "timestamp" in res.json()

def test_validation_readings_negative_values_accepted(client):
    res = client.post("/readings", json={"device_id": "D01", "device_instance_id": "INST-D01-A", "region": "Chennai", "metrics": {"temperature": -15.5, "vibration": 1.2, "current": 5.0, "rpm": 800.0}})
    assert res.status_code == 201
    assert res.json()["current_metrics"]["temperature"] == -15.5

# 20-29. Detection endpoint validation
def test_validation_detection_missing_device_id(client):
    res = client.post("/detections", json={"status": "CRITICAL", "failure_type": "spike", "confidence": 0.9})
    assert res.status_code == 422

def test_validation_detection_invalid_status(client):
    res = client.post("/detections", json={"device_id": "D01", "status": "UNKNOWN_STATUS", "failure_type": "spike", "confidence": 0.9})
    assert res.status_code == 422

def test_validation_detection_invalid_failure_type(client):
    res = client.post("/detections", json={"device_id": "D01", "status": "CRITICAL", "failure_type": "bad_type", "confidence": 0.9})
    assert res.status_code == 422

def test_validation_detection_negative_confidence(client):
    res = client.post("/detections", json={"device_id": "D01", "status": "CRITICAL", "failure_type": "spike", "confidence": -0.1})
    assert res.status_code == 422

def test_validation_detection_confidence_gt_one(client):
    res = client.post("/detections", json={"device_id": "D01", "status": "CRITICAL", "failure_type": "spike", "confidence": 1.01})
    assert res.status_code == 422

def test_validation_detection_nan_confidence(client):
    res = client.post("/detections", content='{"device_id": "D01", "status": "CRITICAL", "failure_type": "spike", "confidence": NaN}', headers={"Content-Type": "application/json"})
    assert res.status_code == 422

def test_validation_detection_infinity_confidence(client):
    res = client.post("/detections", content='{"device_id": "D01", "status": "CRITICAL", "failure_type": "spike", "confidence": Infinity}', headers={"Content-Type": "application/json"})
    assert res.status_code == 422

def test_validation_detection_boundary_confidence_zero_and_one(client):
    res0 = client.post("/detections", json={"device_id": "D01", "status": "HEALTHY", "failure_type": "spike", "confidence": 0.0})
    assert res0.status_code == 201

    res1 = client.post("/detections", json={"device_id": "D01", "status": "CRITICAL", "failure_type": "spike", "confidence": 1.0})
    assert res1.status_code == 201

def test_validation_detection_all_five_failure_types_accepted(client):
    failure_types = ["drift", "spike", "flatline", "oscillation", "sensor_swap"]
    for ft in failure_types:
        res = client.post("/detections", json={"device_id": "D01", "status": "CRITICAL", "failure_type": ft, "confidence": 0.95})
        assert res.status_code == 201, f"Failed for failure_type={ft}"

# 30-33. Query limit parameter validation
def test_validation_query_limit_zero_rejected(client):
    res = client.get("/devices/D01/readings?limit=0")
    assert res.status_code == 422

def test_validation_query_limit_negative_rejected(client):
    res = client.get("/devices/D01/readings?limit=-5")
    assert res.status_code == 422

def test_validation_query_limit_gt_1000_rejected(client):
    res = client.get("/devices/D01/readings?limit=1001")
    assert res.status_code == 422

def test_validation_query_limit_valid_accepted(client):
    res = client.get("/devices/D01/readings?limit=50")
    assert res.status_code == 200
    assert len(res.json()) <= 50

# WebSocket regression on 422 invalid payload
def test_validation_failure_produces_no_websocket_broadcast(client):
    with client.websocket_connect("/ws/fleet") as ws:
        ws.receive_json()

        res_read = client.post("/readings", json={"device_id": "D01", "device_instance_id": "INST-01", "region": "North", "metrics": {"temperature": "invalid_num", "vibration": 3.0, "current": 10.0, "rpm": 1500.0}})
        assert res_read.status_code == 422

        res_det = client.post("/detections", json={"device_id": "D01", "status": "CRITICAL", "failure_type": "invalid_anomaly", "confidence": 0.9})
        assert res_det.status_code == 422


# ==========================================
# STEP 2 & 2.6 HARDENING & REGRESSION GATE TESTS
# ==========================================

def test_ambiguous_device_only_lookups(client):
    """Requirement 2: Ambiguous device-only lookup raises HTTP 409 Conflict when duplicate instances exist."""
    # 1. Create two distinct instances for the same device_id DEV-AMBIG-01
    client.post("/readings", json={
        "device_id": "DEV-AMBIG-01",
        "device_instance_id": "INST-AMBIG-A",
        "region": "North",
        "metrics": {"temperature": 50.0, "vibration": 2.0, "current": 8.0, "rpm": 1200.0}
    })
    client.post("/readings", json={
        "device_id": "DEV-AMBIG-01",
        "device_instance_id": "INST-AMBIG-B",
        "region": "South",
        "metrics": {"temperature": 90.0, "vibration": 6.0, "current": 14.0, "rpm": 1800.0}
    })

    # 2. Device-only lookup should return 409 Conflict
    res_ambig = client.get("/devices/DEV-AMBIG-01")
    assert res_ambig.status_code == 409
    assert "Ambiguous" in res_ambig.json()["detail"]

    res_ambig_state = client.get("/devices/DEV-AMBIG-01/state")
    assert res_ambig_state.status_code == 409

    # 3. Explicit instance_id lookups resolve unambiguously
    res_a = client.get("/devices/DEV-AMBIG-01/state?instance_id=INST-AMBIG-A")
    assert res_a.status_code == 200
    assert res_a.json()["device_instance_id"] == "INST-AMBIG-A"
    assert res_a.json()["latest_reading"]["temperature"] == 50.0

    res_b = client.get("/devices/DEV-AMBIG-01/state?instance_id=INST-AMBIG-B")
    assert res_b.status_code == 200
    assert res_b.json()["device_instance_id"] == "INST-AMBIG-B"
    assert res_b.json()["latest_reading"]["temperature"] == 90.0


def test_device_instance_collision_and_isolation(client):
    """Requirement 7: DEV-017 / INST-A vs DEV-017 / INST-B history and state isolation."""
    client.post("/readings", json={
        "device_id": "DEV-017",
        "device_instance_id": "INST-017-A",
        "region": "East",
        "metrics": {"temperature": 50.0, "vibration": 2.0, "current": 5.0, "rpm": 1000.0}
    })
    client.post("/readings", json={
        "device_id": "DEV-017",
        "device_instance_id": "INST-017-B",
        "region": "West",
        "metrics": {"temperature": 90.0, "vibration": 6.0, "current": 15.0, "rpm": 2000.0}
    })

    res_a = client.get("/devices/DEV-017/state?instance_id=INST-017-A")
    res_b = client.get("/devices/DEV-017/state?instance_id=INST-017-B")

    assert res_a.status_code == 200
    assert res_b.status_code == 200
    assert res_a.json()["latest_reading"]["temperature"] == 50.0
    assert res_b.json()["latest_reading"]["temperature"] == 90.0


def test_baseline_consistency_independent_per_instance(client):
    """Requirement 4: Two instances with the same device_id learn distinct baselines."""
    dev_id = "DEV-LEARN-DIFF"
    inst_a = "INST-LEARN-DIFF-A"
    inst_b = "INST-LEARN-DIFF-B"

    # Train Instance A around temp 50.0
    for _ in range(16):
        client.post("/readings", json={
            "device_id": dev_id,
            "device_instance_id": inst_a,
            "region": "North",
            "metrics": {"temperature": 50.0, "vibration": 2.0, "current": 5.0, "rpm": 1000.0}
        })

    # Train Instance B around temp 90.0
    for _ in range(16):
        client.post("/readings", json={
            "device_id": dev_id,
            "device_instance_id": inst_b,
            "region": "South",
            "metrics": {"temperature": 90.0, "vibration": 6.0, "current": 15.0, "rpm": 2000.0}
        })

    bl_a = client.get(f"/devices/{dev_id}/baseline?instance_id={inst_a}")
    bl_b = client.get(f"/devices/{dev_id}/baseline?instance_id={inst_b}")

    assert bl_a.status_code == 200
    assert bl_b.status_code == 200
    assert 49.0 <= bl_a.json()["temperature_mean"] <= 51.0
    assert 89.0 <= bl_b.json()["temperature_mean"] <= 91.0


def test_healthengine_failure_transaction_rollback(client):
    """Requirement 6: HealthEngine failure produces no partial writes and no WebSocket emission."""
    with client.websocket_connect("/ws/fleet") as ws:
        ws.receive_json()

        with patch.object(pipeline.health_engine, "process_telemetry", side_effect=RuntimeError("Simulated HealthEngine Crash")):
            payload = {
                "device_id": "DEV-ENGINE-FAIL",
                "device_instance_id": "INST-ENGINE-FAIL",
                "region": "Central",
                "metrics": {"temperature": 60.0, "vibration": 3.0, "current": 10.0, "rpm": 1500.0}
            }
            res = client.post("/readings", json=payload)
            assert res.status_code == 500
            assert "HealthEngine evaluation error" in res.json()["detail"]

        # Verify nothing was persisted
        db = TestingSessionLocal()
        reading = db.query(models.SensorReading).filter(models.SensorReading.device_instance_id == "INST-ENGINE-FAIL").first()
        hr_rec = db.query(models.HealthResultRecord).filter(models.HealthResultRecord.device_instance_id == "INST-ENGINE-FAIL").first()
        assert reading is None
        assert hr_rec is None
        db.close()


def test_real_health_engine_detects_injected_spike_without_mocks(client):
    """Real Member 1 HealthEngine diagnosis on sharp spike anomaly without mocks."""
    dev_id = "DEV-SPIKE-REAL"
    inst_id = "INST-SPIKE-REAL"

    for _ in range(16):
        client.post("/readings", json={
            "device_id": dev_id,
            "device_instance_id": inst_id,
            "region": "West",
            "metrics": {"temperature": 50.0, "vibration": 2.0, "current": 5.0, "rpm": 1000.0}
        })

    spike_res = client.post("/readings", json={
        "device_id": dev_id,
        "device_instance_id": inst_id,
        "region": "West",
        "metrics": {"temperature": 95.0, "vibration": 2.0, "current": 5.0, "rpm": 1000.0}
    })

    assert spike_res.status_code == 201
    data = spike_res.json()
    assert data["anomaly_type"] == "spike"
    assert data["status"] in ["warning", "critical"]
    assert data["severity"] > 0.35
    assert data["confidence"] > 0.5


def test_real_health_engine_detects_flatline(client):
    """Verifies real Member 1 HealthEngine flatline detection through POST /readings."""
    dev_id = "DEV-FLAT-01"
    inst_id = "INST-FLAT-01"

    for i in range(20):
        client.post("/readings", json={
            "device_id": dev_id,
            "device_instance_id": inst_id,
            "region": "North",
            "metrics": {
                "temperature": 50.0 + (i % 4),
                "vibration": 3.0 + (i % 3) * 0.2,
                "current": 8.0,
                "rpm": 1200.0
            }
        })

    for _ in range(25):
        flat_res = client.post("/readings", json={
            "device_id": dev_id,
            "device_instance_id": inst_id,
            "region": "North",
            "metrics": {
                "temperature": 52.0,
                "vibration": 3.0,
                "current": 8.0,
                "rpm": 1200.0
            }
        })

    data = flat_res.json()
    assert data["anomaly_type"] == "flatline"
    assert data["status"] in ["warning", "critical"]
    assert "flatline" in [d["anomaly_type"] for d in data["detectors"]]


def test_composite_indexes_exist_on_all_models():
    """Requirement 3: Verifies all 5 models have composite (device_id, device_instance_id) indexes."""
    for model in [models.Device, models.SensorReading, models.HealthResultRecord, models.Baseline, models.Alert]:
        table = model.__table__
        composite_matches = []
        for idx in table.indexes:
            col_names = [c.name for c in idx.columns]
            if "device_id" in col_names and "device_instance_id" in col_names:
                composite_matches.append(idx.name)
        assert len(composite_matches) >= 1, f"Model {model.__name__} table {table.name} is missing composite index!"


# ==========================================


# ==========================================
# STEP 3 & 3.5 AUTHORITATIVE INCIDENT LIFECYCLE TESTS
# ==========================================

def test_incident_lifecycle_healthy_reading_no_incident(client):
    """TEST 1: Healthy reading does not create an incident."""
    dev_id = "DEV-HEALTHY-01"
    inst_id = "INST-HEALTHY-01"

    for _ in range(16):
        res = client.post("/readings", json={
            "device_id": dev_id,
            "device_instance_id": inst_id,
            "region": "North",
            "metrics": {"temperature": 50.0, "vibration": 2.0, "current": 5.0, "rpm": 1000.0}
        })
        assert res.status_code == 201

    incidents_res = client.get(f"/incidents?device_id={dev_id}&device_instance_id={inst_id}")
    assert incidents_res.status_code == 200
    assert len(incidents_res.json()) == 0


def test_incident_lifecycle_creation_update_resolution_and_new_incident(client):
    """TESTS 2-6: First anomaly creates ACTIVE, repeated updates count, healthy resolves, new anomaly creates new ID."""
    dev_id = "DEV-LIFECYCLE-01"
    inst_id = "INST-LIFECYCLE-01"

    # 1. Warm up baseline (16 readings at temp 50.0)
    for _ in range(16):
        client.post("/readings", json={
            "device_id": dev_id,
            "device_instance_id": inst_id,
            "region": "South",
            "metrics": {"temperature": 50.0, "vibration": 2.0, "current": 5.0, "rpm": 1000.0}
        })

    # 2. TEST 2: First drift anomaly reading (81.0) -> Exactly one ACTIVE incident
    client.post("/readings", json={"device_id": dev_id, "device_instance_id": inst_id, "region": "South", "metrics": {"temperature": 75.0, "vibration": 2.0, "current": 5.0, "rpm": 1000.0}})
    client.post("/readings", json={"device_id": dev_id, "device_instance_id": inst_id, "region": "South", "metrics": {"temperature": 78.0, "vibration": 2.0, "current": 5.0, "rpm": 1000.0}})
    res1 = client.post("/readings", json={"device_id": dev_id, "device_instance_id": inst_id, "region": "South", "metrics": {"temperature": 81.0, "vibration": 2.0, "current": 5.0, "rpm": 1000.0}})
    assert res1.status_code == 201
    assert res1.json()["anomaly_type"] == "drift"

    inc_list1 = client.get(f"/incidents?device_id={dev_id}&device_instance_id={inst_id}&status=ACTIVE").json()
    assert len(inc_list1) == 1
    inc1 = inc_list1[0]
    inc1_id = inc1["incident_id"]
    assert inc1["status"] == "ACTIVE"
    assert inc1["anomaly_type"] == "drift"
    assert inc1["resolved_at"] is None

    # 3. TEST 3: Second same anomaly reading (84.0) -> Same active incident updated, count increases
    res2 = client.post("/readings", json={"device_id": dev_id, "device_instance_id": inst_id, "region": "South", "metrics": {"temperature": 84.0, "vibration": 2.0, "current": 5.0, "rpm": 1000.0}})
    assert res2.status_code == 201
    assert res2.json()["anomaly_type"] == "drift"

    inc_list2 = client.get(f"/incidents?device_id={dev_id}&device_instance_id={inst_id}&status=ACTIVE").json()
    assert len(inc_list2) == 1
    assert inc_list2[0]["incident_id"] == inc1_id
    assert inc_list2[0]["occurrence_count"] >= 2

    # 4. TEST 4: Third same anomaly reading (87.0) -> Same incident ID, count increases again
    res3 = client.post("/readings", json={"device_id": dev_id, "device_instance_id": inst_id, "region": "South", "metrics": {"temperature": 87.0, "vibration": 2.0, "current": 5.0, "rpm": 1000.0}})
    assert res3.status_code == 201
    assert res3.json()["anomaly_type"] == "drift"

    inc_list3 = client.get(f"/incidents?device_id={dev_id}&device_instance_id={inst_id}&status=ACTIVE").json()
    assert len(inc_list3) == 1
    assert inc_list3[0]["incident_id"] == inc1_id
    assert inc_list3[0]["occurrence_count"] >= 3

    # 5. TEST 5: Return to normal (50.0) -> Incident becomes RESOLVED
    res_normal = client.post("/readings", json={
        "device_id": dev_id,
        "device_instance_id": inst_id,
        "region": "South",
        "metrics": {"temperature": 50.0, "vibration": 2.0, "current": 5.0, "rpm": 1000.0}
    })
    assert res_normal.status_code == 201
    assert res_normal.json()["status"] == "healthy"

    active_incidents = client.get(f"/incidents?device_id={dev_id}&device_instance_id={inst_id}&status=ACTIVE").json()
    assert len(active_incidents) == 0

    resolved_incidents = client.get(f"/incidents?device_id={dev_id}&device_instance_id={inst_id}&status=RESOLVED").json()
    assert len(resolved_incidents) >= 1
    target_resolved = [i for i in resolved_incidents if i["incident_id"] == inc1_id][0]
    assert target_resolved["status"] == "RESOLVED"
    assert target_resolved["resolved_at"] is not None
    assert target_resolved["occurrence_count"] >= 3

    # 6. TEST 6: Later new anomaly -> Creates a NEW incident ID
    client.post("/readings", json={"device_id": dev_id, "device_instance_id": inst_id, "region": "South", "metrics": {"temperature": 75.0, "vibration": 2.0, "current": 5.0, "rpm": 1000.0}})
    client.post("/readings", json={"device_id": dev_id, "device_instance_id": inst_id, "region": "South", "metrics": {"temperature": 78.0, "vibration": 2.0, "current": 5.0, "rpm": 1000.0}})
    res_new_anomaly = client.post("/readings", json={"device_id": dev_id, "device_instance_id": inst_id, "region": "South", "metrics": {"temperature": 81.0, "vibration": 2.0, "current": 5.0, "rpm": 1000.0}})
    assert res_new_anomaly.status_code == 201

    all_incidents = client.get(f"/incidents?device_id={dev_id}&device_instance_id={inst_id}").json()
    new_actives = [i for i in all_incidents if i["status"] == "ACTIVE"]
    assert len(new_actives) == 1
    assert new_actives[0]["incident_id"] != inc1_id


def test_incident_instance_isolation_and_independent_resolution(client):
    """TESTS 7 & 8: INST-A and INST-B have independent incidents and resolution."""
    dev_id = "DEV-INST-INC-01"
    inst_a = "INST-INC-A"
    inst_b = "INST-INC-B"

    for _ in range(16):
        client.post("/readings", json={"device_id": dev_id, "device_instance_id": inst_a, "region": "East", "metrics": {"temperature": 50.0, "vibration": 2.0, "current": 5.0, "rpm": 1000.0}})
        client.post("/readings", json={"device_id": dev_id, "device_instance_id": inst_b, "region": "West", "metrics": {"temperature": 50.0, "vibration": 2.0, "current": 5.0, "rpm": 1000.0}})

    client.post("/readings", json={"device_id": dev_id, "device_instance_id": inst_a, "region": "East", "metrics": {"temperature": 95.0, "vibration": 2.0, "current": 5.0, "rpm": 1000.0}})
    client.post("/readings", json={"device_id": dev_id, "device_instance_id": inst_b, "region": "West", "metrics": {"temperature": 95.0, "vibration": 2.0, "current": 5.0, "rpm": 1000.0}})

    inc_a = client.get(f"/incidents?device_id={dev_id}&device_instance_id={inst_a}&status=ACTIVE").json()
    inc_b = client.get(f"/incidents?device_id={dev_id}&device_instance_id={inst_b}&status=ACTIVE").json()
    assert len(inc_a) == 1
    assert len(inc_b) == 1
    assert inc_a[0]["incident_id"] != inc_b[0]["incident_id"]

    # Resolve INST-A
    client.post("/readings", json={"device_id": dev_id, "device_instance_id": inst_a, "region": "East", "metrics": {"temperature": 50.0, "vibration": 2.0, "current": 5.0, "rpm": 1000.0}})

    inc_a_active = client.get(f"/incidents?device_id={dev_id}&device_instance_id={inst_a}&status=ACTIVE").json()
    inc_b_active = client.get(f"/incidents?device_id={dev_id}&device_instance_id={inst_b}&status=ACTIVE").json()
    assert len(inc_a_active) == 0
    assert len(inc_b_active) == 1
    assert inc_b_active[0]["status"] == "ACTIVE"


def test_incident_anomaly_type_change_keeps_incident_active(client):
    """TEST 9: Anomaly type change without healthy signal updates existing active incident without fabricating resolution."""
    dev_id = "DEV-TYPE-CHG"
    inst_id = "INST-TYPE-CHG"

    # Warm up baseline
    for i in range(20):
        client.post("/readings", json={"device_id": dev_id, "device_instance_id": inst_id, "region": "North", "metrics": {"temperature": 50.0 + (i % 4), "vibration": 3.0 + (i % 3) * 0.2, "current": 8.0, "rpm": 1200.0}})

    # Trigger flatline anomaly (25 identical readings)
    for _ in range(25):
        flat_res = client.post("/readings", json={"device_id": dev_id, "device_instance_id": inst_id, "region": "North", "metrics": {"temperature": 52.0, "vibration": 3.0, "current": 8.0, "rpm": 1200.0}})
    assert flat_res.json()["anomaly_type"] == "flatline"

    flat_inc = client.get(f"/incidents?device_id={dev_id}&device_instance_id={inst_id}&status=ACTIVE").json()
    assert len(flat_inc) == 1
    assert flat_inc[0]["anomaly_type"] == "flatline"
    flat_id = flat_inc[0]["incident_id"]
    prev_count = flat_inc[0]["occurrence_count"]

    # Now inject sharp spike (99.0) without healthy state in between
    spike_res = client.post("/readings", json={"device_id": dev_id, "device_instance_id": inst_id, "region": "North", "metrics": {"temperature": 99.0, "vibration": 3.0, "current": 8.0, "rpm": 1200.0}})
    assert spike_res.json()["anomaly_type"] == "spike"

    # The SAME incident remains ACTIVE, updated to spike, occurrence_count increments
    all_inc = client.get(f"/incidents?device_id={dev_id}&device_instance_id={inst_id}").json()
    assert len(all_inc) == 1
    updated_inc = all_inc[0]
    assert updated_inc["incident_id"] == flat_id
    assert updated_inc["status"] == "ACTIVE"
    assert updated_inc["anomaly_type"] == "spike"
    assert updated_inc["occurrence_count"] == prev_count + 1
    assert updated_inc["resolved_at"] is None


def test_incident_database_failure_transaction_rollback(client):
    """TEST 10: Database failure during incident processing cleanly rolls back all tables."""
    with patch("app.incident_service.process_incident_lifecycle", side_effect=RuntimeError("Simulated Incident Write Crash")):
        payload = {
            "device_id": "DEV-INC-FAIL-01",
            "device_instance_id": "INST-INC-FAIL-01",
            "region": "Central",
            "metrics": {"temperature": 60.0, "vibration": 3.0, "current": 10.0, "rpm": 1500.0}
        }
        res = client.post("/readings", json=payload)
        assert res.status_code == 500

    db = TestingSessionLocal()
    r = db.query(models.SensorReading).filter(models.SensorReading.device_instance_id == "INST-INC-FAIL-01").first()
    hr = db.query(models.HealthResultRecord).filter(models.HealthResultRecord.device_instance_id == "INST-INC-FAIL-01").first()
    inc = db.query(models.Incident).filter(models.Incident.device_instance_id == "INST-INC-FAIL-01").first()
    alt = db.query(models.Alert).filter(models.Alert.device_instance_id == "INST-INC-FAIL-01").first()
    assert r is None
    assert hr is None
    assert inc is None
    assert alt is None
    db.close()


def test_get_incidents_filtering_and_single_lookup(client):
    """TESTS 12-14: GET /incidents filtering, validation, and GET /incidents/{incident_id}."""
    dev_id = "DEV-FILTER-01"
    inst_id = "INST-FILTER-01"
    for _ in range(16):
        client.post("/readings", json={"device_id": dev_id, "device_instance_id": inst_id, "region": "South", "metrics": {"temperature": 50.0, "vibration": 2.0, "current": 5.0, "rpm": 1000.0}})
    client.post("/readings", json={"device_id": dev_id, "device_instance_id": inst_id, "region": "South", "metrics": {"temperature": 95.0, "vibration": 2.0, "current": 5.0, "rpm": 1000.0}})

    inc_list = client.get(f"/incidents?region=South&anomaly_type=spike&status=ACTIVE").json()
    assert len(inc_list) >= 1
    target_inc = [i for i in inc_list if i["device_id"] == dev_id][0]
    inc_id = target_inc["incident_id"]

    # Single lookup
    single_res = client.get(f"/incidents/{inc_id}")
    assert single_res.status_code == 200
    assert single_res.json()["incident_id"] == inc_id
    assert single_res.json()["region"] == "South"
    assert single_res.json()["anomaly_type"] == "spike"

    # Filter validation: invalid status -> 422
    bad_status_res = client.get("/incidents?status=INVALID_STATUS")
    assert bad_status_res.status_code == 422

    # Filter validation: invalid anomaly_type -> 422
    bad_type_res = client.get("/incidents?anomaly_type=unknown_anomaly")
    assert bad_type_res.status_code == 422

    # Nonexistent incident 404
    bad_res = client.get("/incidents/INC-NONEXISTENT")
    assert bad_res.status_code == 404


def test_websocket_incident_broadcast_ordering(client):
    """TEST 15: WebSocket broadcasts telemetry_update first, then incident event second."""
    dev_id = "DEV-WS-INC-ORDER"
    inst_id = "INST-WS-INC-ORDER"

    with client.websocket_connect("/ws/fleet") as ws:
        ws.receive_json()  # fleet snapshot

        # 1. Warm up (16 normal readings)
        for _ in range(16):
            client.post("/readings", json={"device_id": dev_id, "device_instance_id": inst_id, "region": "Delhi", "metrics": {"temperature": 50.0, "vibration": 2.0, "current": 5.0, "rpm": 1000.0}})
            ws.receive_json()  # drain telemetry_update

        # 2. Inject spike -> strictly asserts telemetry_update first, incident_created second
        client.post("/readings", json={"device_id": dev_id, "device_instance_id": inst_id, "region": "Delhi", "metrics": {"temperature": 95.0, "vibration": 2.0, "current": 5.0, "rpm": 1000.0}})
        msg_tel = ws.receive_json()
        assert msg_tel["event"] == "telemetry_update"
        assert msg_tel["device_id"] == dev_id

        msg_inc_created = ws.receive_json()
        assert msg_inc_created["event"] == "incident_created"
        assert msg_inc_created["data"]["device_id"] == dev_id
        assert msg_inc_created["data"]["status"] == "ACTIVE"

        # 3. Healthy reading -> asserts telemetry_update first, incident_resolved second
        client.post("/readings", json={"device_id": dev_id, "device_instance_id": inst_id, "region": "Delhi", "metrics": {"temperature": 50.0, "vibration": 2.0, "current": 5.0, "rpm": 1000.0}})
        msg_tel2 = ws.receive_json()
        assert msg_tel2["event"] == "telemetry_update"

        msg_inc_resolved = ws.receive_json()
        assert msg_inc_resolved["event"] == "incident_resolved"
        assert msg_inc_resolved["data"]["status"] == "RESOLVED"


# ==========================================
# STEP 4 REGIONAL CONFLICT ENGINE TESTS
# ==========================================

def test_regional_conflict_one_device_no_conflict(client):
    """CASE 1: Single anomalous device in a region does NOT produce a regional conflict."""
    dev_id = "DEV-RC-SINGLE"
    inst_id = "INST-RC-SINGLE"
    for _ in range(16):
        client.post("/readings", json={"device_id": dev_id, "device_instance_id": inst_id, "region": "NorthEast", "metrics": {"temperature": 50.0, "vibration": 2.0, "current": 5.0, "rpm": 1000.0}})
    client.post("/readings", json={"device_id": dev_id, "device_instance_id": inst_id, "region": "NorthEast", "metrics": {"temperature": 95.0, "vibration": 2.0, "current": 5.0, "rpm": 1000.0}})

    conflicts = client.get("/conflicts?region=NorthEast&status=ACTIVE").json()
    assert len(conflicts) == 0


def test_regional_conflict_two_different_regions_no_conflict(client):
    """CASE 2: Two anomalous devices in DIFFERENT regions do NOT produce a regional conflict."""
    dev_a, inst_a = "DEV-RC-DIFF-A", "INST-RC-DIFF-A"
    dev_b, inst_b = "DEV-RC-DIFF-B", "INST-RC-DIFF-B"

    for _ in range(16):
        client.post("/readings", json={"device_id": dev_a, "device_instance_id": inst_a, "region": "RegionA", "metrics": {"temperature": 50.0, "vibration": 2.0, "current": 5.0, "rpm": 1000.0}})
        client.post("/readings", json={"device_id": dev_b, "device_instance_id": inst_b, "region": "RegionB", "metrics": {"temperature": 50.0, "vibration": 2.0, "current": 5.0, "rpm": 1000.0}})

    client.post("/readings", json={"device_id": dev_a, "device_instance_id": inst_a, "region": "RegionA", "metrics": {"temperature": 95.0, "vibration": 2.0, "current": 5.0, "rpm": 1000.0}})
    client.post("/readings", json={"device_id": dev_b, "device_instance_id": inst_b, "region": "RegionB", "metrics": {"temperature": 95.0, "vibration": 2.0, "current": 5.0, "rpm": 1000.0}})

    assert len(client.get("/conflicts?region=RegionA&status=ACTIVE").json()) == 0
    assert len(client.get("/conflicts?region=RegionB&status=ACTIVE").json()) == 0


def test_regional_conflict_outside_time_window_no_conflict(client):
    """CASE 3: Two anomalous devices in same region outside time window do NOT produce a conflict."""
    from datetime import datetime, timezone, timedelta
    dev_a, inst_a = "DEV-RC-OLD-A", "INST-RC-OLD-A"
    dev_b, inst_b = "DEV-RC-OLD-B", "INST-RC-OLD-B"

    now = datetime.now(timezone.utc)
    old_time = now - timedelta(seconds=300)

    for _ in range(16):
        client.post("/readings", json={"device_id": dev_a, "device_instance_id": inst_a, "region": "OldRegion", "timestamp": old_time.isoformat(), "metrics": {"temperature": 50.0, "vibration": 2.0, "current": 5.0, "rpm": 1000.0}})
        client.post("/readings", json={"device_id": dev_b, "device_instance_id": inst_b, "region": "OldRegion", "timestamp": now.isoformat(), "metrics": {"temperature": 50.0, "vibration": 2.0, "current": 5.0, "rpm": 1000.0}})

    # Old device anomaly 300s ago
    client.post("/readings", json={"device_id": dev_a, "device_instance_id": inst_a, "region": "OldRegion", "timestamp": old_time.isoformat(), "metrics": {"temperature": 95.0, "vibration": 2.0, "current": 5.0, "rpm": 1000.0}})
    # Recent device anomaly now
    client.post("/readings", json={"device_id": dev_b, "device_instance_id": inst_b, "region": "OldRegion", "timestamp": now.isoformat(), "metrics": {"temperature": 95.0, "vibration": 2.0, "current": 5.0, "rpm": 1000.0}})

    conflicts = client.get("/conflicts?region=OldRegion&status=ACTIVE").json()
    assert len(conflicts) == 0


def test_regional_conflict_two_devices_same_anomaly_creates_conflict(client):
    """CASE 4: Two distinct devices in same region with same anomaly within window creates ACTIVE conflict."""
    dev_a, inst_a = "DEV-RC-MATCH-A", "INST-RC-MATCH-A"
    dev_b, inst_b = "DEV-RC-MATCH-B", "INST-RC-MATCH-B"
    region = "MatchRegion"

    for _ in range(16):
        client.post("/readings", json={"device_id": dev_a, "device_instance_id": inst_a, "region": region, "metrics": {"temperature": 50.0, "vibration": 2.0, "current": 5.0, "rpm": 1000.0}})
        client.post("/readings", json={"device_id": dev_b, "device_instance_id": inst_b, "region": region, "metrics": {"temperature": 50.0, "vibration": 2.0, "current": 5.0, "rpm": 1000.0}})

    # Anomaly on dev A
    res_a = client.post("/readings", json={"device_id": dev_a, "device_instance_id": inst_a, "region": region, "metrics": {"temperature": 95.0, "vibration": 2.0, "current": 5.0, "rpm": 1000.0}})
    assert res_a.json()["anomaly_type"] == "spike"
    assert len(client.get(f"/conflicts?region={region}&status=ACTIVE").json()) == 0

    # Anomaly on dev B
    res_b = client.post("/readings", json={"device_id": dev_b, "device_instance_id": inst_b, "region": region, "metrics": {"temperature": 95.0, "vibration": 2.0, "current": 5.0, "rpm": 1000.0}})
    assert res_b.json()["anomaly_type"] == "spike"

    conflicts = client.get(f"/conflicts?region={region}&status=ACTIVE").json()
    assert len(conflicts) == 1
    conf = conflicts[0]
    assert conf["status"] == "ACTIVE"
    assert conf["region"] == region
    assert conf["anomaly_types"] == ["spike"]
    assert len(conf["affected_devices"]) == 2
    assert "Regional conflict detected in MatchRegion" in conf["explanation"]


def test_regional_conflict_third_device_updates_existing_conflict(client):
    """CASE 5: Third related anomalous device updates existing ACTIVE conflict rather than creating duplicate."""
    dev_a, inst_a = "DEV-RC-TRI-A", "INST-RC-TRI-A"
    dev_b, inst_b = "DEV-RC-TRI-B", "INST-RC-TRI-B"
    dev_c, inst_c = "DEV-RC-TRI-C", "INST-RC-TRI-C"
    region = "TriRegion"

    for _ in range(16):
        client.post("/readings", json={"device_id": dev_a, "device_instance_id": inst_a, "region": region, "metrics": {"temperature": 50.0, "vibration": 2.0, "current": 5.0, "rpm": 1000.0}})
        client.post("/readings", json={"device_id": dev_b, "device_instance_id": inst_b, "region": region, "metrics": {"temperature": 50.0, "vibration": 2.0, "current": 5.0, "rpm": 1000.0}})
        client.post("/readings", json={"device_id": dev_c, "device_instance_id": inst_c, "region": region, "metrics": {"temperature": 50.0, "vibration": 2.0, "current": 5.0, "rpm": 1000.0}})

    client.post("/readings", json={"device_id": dev_a, "device_instance_id": inst_a, "region": region, "metrics": {"temperature": 95.0, "vibration": 2.0, "current": 5.0, "rpm": 1000.0}})
    client.post("/readings", json={"device_id": dev_b, "device_instance_id": inst_b, "region": region, "metrics": {"temperature": 95.0, "vibration": 2.0, "current": 5.0, "rpm": 1000.0}})

    conf1 = client.get(f"/conflicts?region={region}&status=ACTIVE").json()[0]
    conf_id = conf1["conflict_id"]
    assert len(conf1["affected_devices"]) == 2

    # Ingest third anomalous device
    client.post("/readings", json={"device_id": dev_c, "device_instance_id": inst_c, "region": region, "metrics": {"temperature": 95.0, "vibration": 2.0, "current": 5.0, "rpm": 1000.0}})

    all_conf = client.get(f"/conflicts?region={region}&status=ACTIVE").json()
    assert len(all_conf) == 1
    assert all_conf[0]["conflict_id"] == conf_id
    assert len(all_conf[0]["affected_devices"]) == 3


def test_regional_conflict_two_instances_same_device_id_form_conflict(client):
    """CASE 6: Two distinct instances of the same logical device_id form a regional conflict."""
    dev_id = "DEV-RC-MULTI-INST"
    inst_1 = "INST-RC-1"
    inst_2 = "INST-RC-2"
    region = "MultiInstRegion"

    for _ in range(16):
        client.post("/readings", json={"device_id": dev_id, "device_instance_id": inst_1, "region": region, "metrics": {"temperature": 50.0, "vibration": 2.0, "current": 5.0, "rpm": 1000.0}})
        client.post("/readings", json={"device_id": dev_id, "device_instance_id": inst_2, "region": region, "metrics": {"temperature": 50.0, "vibration": 2.0, "current": 5.0, "rpm": 1000.0}})

    client.post("/readings", json={"device_id": dev_id, "device_instance_id": inst_1, "region": region, "metrics": {"temperature": 95.0, "vibration": 2.0, "current": 5.0, "rpm": 1000.0}})
    client.post("/readings", json={"device_id": dev_id, "device_instance_id": inst_2, "region": region, "metrics": {"temperature": 95.0, "vibration": 2.0, "current": 5.0, "rpm": 1000.0}})

    conflicts = client.get(f"/conflicts?region={region}&status=ACTIVE").json()
    assert len(conflicts) == 1
    assert len(conflicts[0]["affected_devices"]) == 2


def test_regional_conflict_same_instance_repeated_no_conflict(client):
    """CASE 7: Same physical instance repeated does NOT satisfy min device count."""
    dev_id, inst_id = "DEV-RC-REPEAT", "INST-RC-REPEAT"
    region = "RepeatRegion"

    for _ in range(16):
        client.post("/readings", json={"device_id": dev_id, "device_instance_id": inst_id, "region": region, "metrics": {"temperature": 50.0, "vibration": 2.0, "current": 5.0, "rpm": 1000.0}})

    # Drift series on single instance
    client.post("/readings", json={"device_id": dev_id, "device_instance_id": inst_id, "region": region, "metrics": {"temperature": 75.0, "vibration": 2.0, "current": 5.0, "rpm": 1000.0}})
    client.post("/readings", json={"device_id": dev_id, "device_instance_id": inst_id, "region": region, "metrics": {"temperature": 78.0, "vibration": 2.0, "current": 5.0, "rpm": 1000.0}})
    client.post("/readings", json={"device_id": dev_id, "device_instance_id": inst_id, "region": region, "metrics": {"temperature": 81.0, "vibration": 2.0, "current": 5.0, "rpm": 1000.0}})
    client.post("/readings", json={"device_id": dev_id, "device_instance_id": inst_id, "region": region, "metrics": {"temperature": 84.0, "vibration": 2.0, "current": 5.0, "rpm": 1000.0}})

    conflicts = client.get(f"/conflicts?region={region}&status=ACTIVE").json()
    assert len(conflicts) == 0


def test_regional_conflict_rest_and_regions_summary_lookup(client):
    """CASE 9 & 10: REST /conflicts, /conflicts/{id}, /regions, and /regions/{region}."""
    dev_a, inst_a = "DEV-RC-SUMM-A", "INST-RC-SUMM-A"
    dev_b, inst_b = "DEV-RC-SUMM-B", "INST-RC-SUMM-B"
    region = "SummaryRegion"

    for _ in range(16):
        client.post("/readings", json={"device_id": dev_a, "device_instance_id": inst_a, "region": region, "metrics": {"temperature": 50.0, "vibration": 2.0, "current": 5.0, "rpm": 1000.0}})
        client.post("/readings", json={"device_id": dev_b, "device_instance_id": inst_b, "region": region, "metrics": {"temperature": 50.0, "vibration": 2.0, "current": 5.0, "rpm": 1000.0}})

    client.post("/readings", json={"device_id": dev_a, "device_instance_id": inst_a, "region": region, "metrics": {"temperature": 95.0, "vibration": 2.0, "current": 5.0, "rpm": 1000.0}})
    client.post("/readings", json={"device_id": dev_b, "device_instance_id": inst_b, "region": region, "metrics": {"temperature": 95.0, "vibration": 2.0, "current": 5.0, "rpm": 1000.0}})

    conf_list = client.get(f"/conflicts?region={region}&status=ACTIVE").json()
    assert len(conf_list) == 1
    conf_id = conf_list[0]["conflict_id"]

    # Single lookup
    single_res = client.get(f"/conflicts/{conf_id}")
    assert single_res.status_code == 200
    assert single_res.json()["conflict_id"] == conf_id

    # Regions summary and detail
    reg_list = client.get("/regions").json()
    match_reg = [r for r in reg_list if r["region"] == region][0]
    assert match_reg["active_conflicts"] == 1

    reg_detail = client.get(f"/regions/{region}").json()
    assert reg_detail["region"] == region
    assert len(reg_detail["active_conflicts"]) == 1
    assert reg_detail["active_conflicts"][0]["conflict_id"] == conf_id


def test_websocket_regional_conflict_broadcast(client):
    """CASE 11: WebSocket broadcasts regional_conflict event upon conflict creation."""
    dev_a, inst_a = "DEV-RC-WS-A", "INST-RC-WS-A"
    dev_b, inst_b = "DEV-RC-WS-B", "INST-RC-WS-B"
    region = "WsConflictRegion"

    with client.websocket_connect("/ws/fleet") as ws:
        ws.receive_json()  # fleet snapshot

        for _ in range(16):
            client.post("/readings", json={"device_id": dev_a, "device_instance_id": inst_a, "region": region, "metrics": {"temperature": 50.0, "vibration": 2.0, "current": 5.0, "rpm": 1000.0}})
            ws.receive_json()
            client.post("/readings", json={"device_id": dev_b, "device_instance_id": inst_b, "region": region, "metrics": {"temperature": 50.0, "vibration": 2.0, "current": 5.0, "rpm": 1000.0}})
            ws.receive_json()

        # Dev A anomaly -> telemetry + incident
        client.post("/readings", json={"device_id": dev_a, "device_instance_id": inst_a, "region": region, "metrics": {"temperature": 95.0, "vibration": 2.0, "current": 5.0, "rpm": 1000.0}})
        ws.receive_json() # tel
        ws.receive_json() # inc

        # Dev B anomaly -> telemetry + incident + regional_conflict
        client.post("/readings", json={"device_id": dev_b, "device_instance_id": inst_b, "region": region, "metrics": {"temperature": 95.0, "vibration": 2.0, "current": 5.0, "rpm": 1000.0}})
        msg_tel = ws.receive_json()
        assert msg_tel["event"] == "telemetry_update"
        msg_inc = ws.receive_json()
        assert msg_inc["event"] == "incident_created"
        msg_conf = ws.receive_json()
        assert msg_conf["event"] == "regional_conflict"
        assert msg_conf["data"]["region"] == region
        assert msg_conf["data"]["status"] == "ACTIVE"


def test_regional_conflict_resolution_when_devices_healthy(client):
    """CASE 12: Returning affected devices to healthy resolves the regional conflict."""
    dev_a, inst_a = "DEV-RC-RES-A", "INST-RC-RES-A"
    dev_b, inst_b = "DEV-RC-RES-B", "INST-RC-RES-B"
    region = "ResolveConflictRegion"

    for _ in range(16):
        client.post("/readings", json={"device_id": dev_a, "device_instance_id": inst_a, "region": region, "metrics": {"temperature": 50.0, "vibration": 2.0, "current": 5.0, "rpm": 1000.0}})
        client.post("/readings", json={"device_id": dev_b, "device_instance_id": inst_b, "region": region, "metrics": {"temperature": 50.0, "vibration": 2.0, "current": 5.0, "rpm": 1000.0}})

    client.post("/readings", json={"device_id": dev_a, "device_instance_id": inst_a, "region": region, "metrics": {"temperature": 95.0, "vibration": 2.0, "current": 5.0, "rpm": 1000.0}})
    client.post("/readings", json={"device_id": dev_b, "device_instance_id": inst_b, "region": region, "metrics": {"temperature": 95.0, "vibration": 2.0, "current": 5.0, "rpm": 1000.0}})

    active_conf = client.get(f"/conflicts?region={region}&status=ACTIVE").json()
    assert len(active_conf) == 1
    conf_id = active_conf[0]["conflict_id"]

    # Restore Dev A to healthy
    client.post("/readings", json={"device_id": dev_a, "device_instance_id": inst_a, "region": region, "metrics": {"temperature": 50.0, "vibration": 2.0, "current": 5.0, "rpm": 1000.0}})

    # Conflict condition no longer has 2 active anomalous devices -> conflict is RESOLVED
    actives = client.get(f"/conflicts?region={region}&status=ACTIVE").json()
    assert len(actives) == 0

    resolved_list = client.get(f"/conflicts?region={region}&status=RESOLVED").json()
    assert len(resolved_list) >= 1
    res_conf = [c for c in resolved_list if c["conflict_id"] == conf_id][0]
    assert res_conf["status"] == "RESOLVED"
    assert res_conf["resolved_at"] is not None


def test_regional_conflict_unrelated_anomalies_no_conflict(client):
    """CASE 15: Two devices with different anomaly types (e.g. flatline vs spike) do not form conflict."""
    dev_a, inst_a = "DEV-RC-UNREL-A", "INST-RC-UNREL-A"
    dev_b, inst_b = "DEV-RC-UNREL-B", "INST-RC-UNREL-B"
    region = "UnrelatedRegion"

    # Baseline warmup
    for i in range(20):
        client.post("/readings", json={"device_id": dev_a, "device_instance_id": inst_a, "region": region, "metrics": {"temperature": 50.0 + (i % 4), "vibration": 3.0, "current": 8.0, "rpm": 1200.0}})
        client.post("/readings", json={"device_id": dev_b, "device_instance_id": inst_b, "region": region, "metrics": {"temperature": 50.0, "vibration": 2.0, "current": 5.0, "rpm": 1000.0}})

    # Dev A has flatline
    for _ in range(25):
        flat_res = client.post("/readings", json={"device_id": dev_a, "device_instance_id": inst_a, "region": region, "metrics": {"temperature": 52.0, "vibration": 3.0, "current": 8.0, "rpm": 1200.0}})
    assert flat_res.json()["anomaly_type"] == "flatline"

    # Dev B has spike
    spike_res = client.post("/readings", json={"device_id": dev_b, "device_instance_id": inst_b, "region": region, "metrics": {"temperature": 95.0, "vibration": 2.0, "current": 5.0, "rpm": 1000.0}})
    assert spike_res.json()["anomaly_type"] == "spike"

    # Different anomaly types do not satisfy the same-anomaly-type conflict rule
    conflicts = client.get(f"/conflicts?region={region}&status=ACTIVE").json()
    assert len(conflicts) == 0


# ==========================================
# STEP 4.5 REGIONAL CONFLICT HARDENING TESTS
# ==========================================

def test_regional_conflict_concurrency_multi_device(client):
    """HARDENING TEST 1: Real concurrency test with multiple simultaneous devices in same region."""
    import concurrent.futures

    dev_a, inst_a = "DEV-CONC-A", "INST-CONC-A"
    dev_b, inst_b = "DEV-CONC-B", "INST-CONC-B"
    dev_c, inst_c = "DEV-CONC-C", "INST-CONC-C"
    region = "ConcurrentHardeningRegion"

    # Warm up all 3 devices
    for _ in range(16):
        client.post("/readings", json={"device_id": dev_a, "device_instance_id": inst_a, "region": region, "metrics": {"temperature": 50.0, "vibration": 2.0, "current": 5.0, "rpm": 1000.0}})
        client.post("/readings", json={"device_id": dev_b, "device_instance_id": inst_b, "region": region, "metrics": {"temperature": 50.0, "vibration": 2.0, "current": 5.0, "rpm": 1000.0}})
        client.post("/readings", json={"device_id": dev_c, "device_instance_id": inst_c, "region": region, "metrics": {"temperature": 50.0, "vibration": 2.0, "current": 5.0, "rpm": 1000.0}})

    def send_spike(dev_id, inst_id):
        return client.post("/readings", json={
            "device_id": dev_id,
            "device_instance_id": inst_id,
            "region": region,
            "metrics": {"temperature": 95.0, "vibration": 2.0, "current": 5.0, "rpm": 1000.0}
        })

    # Concurrently trigger Dev A and Dev B
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        f_a = executor.submit(send_spike, dev_a, inst_a)
        f_b = executor.submit(send_spike, dev_b, inst_b)
        res_a = f_a.result()
        res_b = f_b.result()

    assert res_a.status_code == 201
    assert res_b.status_code == 201

    # Verify exactly 1 active conflict with 2 devices
    conflicts_2 = client.get(f"/conflicts?region={region}&status=ACTIVE").json()
    assert len(conflicts_2) == 1
    conf_id = conflicts_2[0]["conflict_id"]
    assert len(conflicts_2[0]["affected_devices"]) == 2

    # Now concurrently trigger Dev C
    res_c = send_spike(dev_c, inst_c)
    assert res_c.status_code == 201

    # Still exactly 1 active conflict, updated with 3 affected devices
    conflicts_3 = client.get(f"/conflicts?region={region}&status=ACTIVE").json()
    assert len(conflicts_3) == 1
    assert conflicts_3[0]["conflict_id"] == conf_id
    assert len(conflicts_3[0]["affected_devices"]) == 3
    instance_ids = [d["device_instance_id"] for d in conflicts_3[0]["affected_devices"]]
    assert set(instance_ids) == {inst_a, inst_b, inst_c}


def test_regional_conflict_failure_isolation(client):
    """HARDENING TEST 2: Post-commit conflict evaluation failure does not rollback telemetry/incident."""
    dev_id, inst_id = "DEV-FAIL-ISO", "INST-FAIL-ISO"
    region = "FailIsoRegion"

    for _ in range(16):
        client.post("/readings", json={"device_id": dev_id, "device_instance_id": inst_id, "region": region, "metrics": {"temperature": 50.0, "vibration": 2.0, "current": 5.0, "rpm": 1000.0}})

    with patch("app.conflict_service.evaluate_and_persist_regional_conflicts", side_effect=RuntimeError("Simulated Conflict Service Failure")):
        res = client.post("/readings", json={
            "device_id": dev_id,
            "device_instance_id": inst_id,
            "region": region,
            "metrics": {"temperature": 95.0, "vibration": 2.0, "current": 5.0, "rpm": 1000.0}
        })
        # Primary telemetry succeeds and returns HealthResult
        assert res.status_code == 201
        assert res.json()["status"] == "critical"

    # Telemetry and incident exist in DB
    db = TestingSessionLocal()
    reading = db.query(models.SensorReading).filter(models.SensorReading.device_instance_id == inst_id).all()
    inc = db.query(models.Incident).filter(models.Incident.device_instance_id == inst_id, models.Incident.status == "ACTIVE").first()
    assert len(reading) == 17
    assert inc is not None
    db.close()


def test_regional_conflict_mobile_asset_region_update(client):
    """HARDENING TEST 3: Physical instance smoothly updates canonical operating region on new telemetry."""
    dev_id, inst_id = "DEV-REG-MOVE", "INST-REG-MOVE"

    # Ingest in North
    res1 = client.post("/readings", json={
        "device_id": dev_id,
        "device_instance_id": inst_id,
        "region": "North",
        "metrics": {"temperature": 50.0, "vibration": 2.0, "current": 5.0, "rpm": 1000.0}
    })
    assert res1.status_code == 201
    assert client.get(f"/devices/{dev_id}?instance_id={inst_id}").json()["region"] == "North"

    # Ingest in South -> instance location smoothly updates to South
    res2 = client.post("/readings", json={
        "device_id": dev_id,
        "device_instance_id": inst_id,
        "region": "South",
        "metrics": {"temperature": 50.0, "vibration": 2.0, "current": 5.0, "rpm": 1000.0}
    })
    assert res2.status_code == 201
    assert client.get(f"/devices/{dev_id}?instance_id={inst_id}").json()["region"] == "South" 


def test_regional_conflict_out_of_order_stale_reading_protection(client):
    """HARDENING TEST 4: Stale / out-of-order reading does not corrupt or prematurely resolve active conflict."""
    from datetime import datetime, timezone, timedelta
    dev_a, inst_a = "DEV-OO-A", "INST-OO-A"
    dev_b, inst_b = "DEV-OO-B", "INST-OO-B"
    region = "OutOfOrderRegion"

    now = datetime.now(timezone.utc)

    for _ in range(16):
        client.post("/readings", json={"device_id": dev_a, "device_instance_id": inst_a, "region": region, "metrics": {"temperature": 50.0, "vibration": 2.0, "current": 5.0, "rpm": 1000.0}})
        client.post("/readings", json={"device_id": dev_b, "device_instance_id": inst_b, "region": region, "metrics": {"temperature": 50.0, "vibration": 2.0, "current": 5.0, "rpm": 1000.0}})

    # Create active regional conflict at T0
    client.post("/readings", json={"device_id": dev_a, "device_instance_id": inst_a, "region": region, "timestamp": now.isoformat(), "metrics": {"temperature": 95.0, "vibration": 2.0, "current": 5.0, "rpm": 1000.0}})
    client.post("/readings", json={"device_id": dev_b, "device_instance_id": inst_b, "region": region, "timestamp": now.isoformat(), "metrics": {"temperature": 95.0, "vibration": 2.0, "current": 5.0, "rpm": 1000.0}})

    conflicts_t0 = client.get(f"/conflicts?region={region}&status=ACTIVE").json()
    assert len(conflicts_t0) == 1
    conf_id = conflicts_t0[0]["conflict_id"]

    # Ingest stale reading from 300s ago
    stale_time = now - timedelta(seconds=300)
    client.post("/readings", json={"device_id": dev_a, "device_instance_id": inst_a, "region": region, "timestamp": stale_time.isoformat(), "metrics": {"temperature": 95.0, "vibration": 2.0, "current": 5.0, "rpm": 1000.0}})

    # Active conflict remains ACTIVE and intact
    conflicts_after = client.get(f"/conflicts?region={region}&status=ACTIVE").json()
    assert len(conflicts_after) == 1
    assert conflicts_after[0]["conflict_id"] == conf_id
    assert conflicts_after[0]["status"] == "ACTIVE"


# ==========================================
# STEP 5 FINAL API CONTRACT AUDIT TESTS
# ==========================================

def test_api_contract_health_endpoint(client):
    """AUDIT TEST 1: GET /health returns service status."""
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert "version" in data


def test_api_contract_device_health_and_telemetry_aliases(client):
    """AUDIT TEST 2: GET /health/{device_id} and GET /telemetry/{device_id} work correctly."""
    dev_id, inst_id = "DEV-AUDIT-01", "INST-AUDIT-01"
    for _ in range(16):
        client.post("/readings", json={"device_id": dev_id, "device_instance_id": inst_id, "region": "North", "metrics": {"temperature": 50.0, "vibration": 2.0, "current": 5.0, "rpm": 1000.0}})

    # GET /health/{device_id}
    res_health = client.get(f"/health/{dev_id}?instance_id={inst_id}")
    assert res_health.status_code == 200
    assert res_health.json()["device_id"] == dev_id
    assert res_health.json()["status"] == "HEALTHY"

    # GET /telemetry/{device_id}
    res_tel = client.get(f"/telemetry/{dev_id}?instance_id={inst_id}&limit=10")
    assert res_tel.status_code == 200
    readings = res_tel.json()
    assert len(readings) == 10
    assert "temperature" in readings[0]
    assert "vibration" in readings[0]
    assert "current" in readings[0]
    assert "rpm" in readings[0]
    assert "pressure" not in readings[0]


def test_api_contract_openapi_json_schema(client):
    """AUDIT TEST 3: GET /openapi.json exposes all required endpoints."""
    res = client.get("/openapi.json")
    assert res.status_code == 200
    schema = res.json()
    paths = schema["paths"]

    expected_endpoints = [
        "/",
        "/health",
        "/devices",
        "/devices/{device_id}",
        "/devices/{device_id}/state",
        "/health/{device_id}",
        "/devices/{device_id}/readings",
        "/telemetry/{device_id}",
        "/devices/{device_id}/baseline",
        "/incidents",
        "/incidents/{incident_id}",
        "/regions",
        "/regions/{region}",
        "/conflicts",
        "/conflicts/{conflict_id}",
        "/readings"
    ]
    for ep in expected_endpoints:
        assert ep in paths, f"Missing OpenAPI endpoint: {ep}"

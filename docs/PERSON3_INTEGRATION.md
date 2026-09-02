# Person 3 Integration Guide: Detection Engine & Telemetry Simulator

**Role:** Detection Engine & Telemetry Generator  
**Backend Base URL:** `http://127.0.0.1:8000`

---

## 1. System Integration Flow

```text
       [ Device Simulator ]                     [ Anomaly Detection Engine ]
                │                                             │
                │ 1. Telemetry Stream                         │ 2. Classify Anomaly
                │    POST /readings                           │    POST /detections
                ▼                                             ▼
  +─────────────────────────────────────────────────────────────────────────────+
  |                              FastAPI Backend                                |
  |  * Validate Device & Payload               * Atomic Database Transaction    |
  |  * Persist to PostgreSQL / SQLite          * Update Status in `devices`     |
  |  * Broadcast `telemetry_update` (WS)       * Insert Alert in `alerts`       |
  |                                            * Broadcast `device_update` (WS) |
  +─────────────────────────────────────────────────────────────────────────────+
                                       │
                                       ▼
                       [ Person 1 Frontend Dashboard ]
```

---

## 2. Ingesting Telemetry Data (`POST /readings`)

When your simulator generates telemetry readings, submit them to `POST /readings`:

```http
POST /readings
Host: 127.0.0.1:8000
Content-Type: application/json

{
  "device_id": "D17",
  "timestamp": "2026-09-01T12:30:00Z",
  "temperature": 72.4,
  "pressure": 101.3,
  "vibration": 4.2
}
```

### Python Example:
```python
import requests

def send_telemetry(device_id: str, temperature: float, pressure: float, vibration: float):
    url = "http://127.0.0.1:8000/readings"
    payload = {
        "device_id": device_id,
        "temperature": temperature,
        "pressure": pressure,
        "vibration": vibration
    }
    response = requests.post(url, json=payload)
    return response.json()
```

---

## 3. Submitting Detection Results (`POST /detections`)

When your detection algorithm identifies an anomaly, submit the classification to `POST /detections`:

```http
POST /detections
Host: 127.0.0.1:8000
Content-Type: application/json

{
  "device_id": "D17",
  "status": "CRITICAL",
  "failure_type": "spike",
  "confidence": 0.94
}
```

### Allowed Values:
* **`status`**: `"HEALTHY"`, `"WARNING"`, `"CRITICAL"`
* **`failure_type`**: `"drift"`, `"spike"`, `"flatline"`, `"oscillation"`, `"sensor_swap"`
* **`confidence`**: `float` between `0.0` and `1.0` inclusive

### Python Example:
```python
import requests

def submit_detection(device_id: str, status: str, failure_type: str, confidence: float):
    url = "http://127.0.0.1:8000/detections"
    payload = {
        "device_id": device_id,
        "status": status,
        "failure_type": failure_type,
        "confidence": confidence
    }
    response = requests.post(url, json=payload)
    if response.status_code == 201:
        print(f"Detection accepted: {response.json()['message']}")
    else:
        print(f"Error {response.status_code}: {response.text}")
```

---

## 4. Querying Historical Telemetry & Baselines

* **Get Historical Telemetry:**
  ```http
  GET /devices/D17/readings?limit=100
  ```
  Returns time-series sensor readings ordered newest first.

* **Get Baseline Operating Parameters:**
  ```http
  GET /devices/D17/baseline
  ```
  Returns `temperature_mean`, `temperature_std`, `pressure_mean`, `pressure_std`, `vibration_mean`, `vibration_std`.

---

## 5. Important Rules
1. **Backend Responsibility:** The backend persists state and handles real-time synchronization. It does **not** evaluate anomalies.
2. **Detector Responsibility:** Your detector determines when to escalate a device's status to `WARNING` or `CRITICAL` and specifies the `failure_type`.

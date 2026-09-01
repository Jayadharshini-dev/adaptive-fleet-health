# Frontend-Backend Integration Contract
## Adaptive Fleet Health Monitoring with Concurrent Session Coordination

> **Target Backend**: FastAPI (Python) / WebSocket ASGI  
> **Target Intelligence Pipeline**: Member 1 Adaptive Baseline & 5-Detector Health Engine  
> **Target Client**: React 19 / TypeScript Presentation Console  

---

## 1. Core Principles & Conceptual Model

1. **"Normal is learned per device."**
   - No single global threshold across the 50 devices.
   - Example: `DEV-007` baseline temperature $\approx 62.1^\circ\text{C}$, `DEV-024` baseline temperature $\approx 84.2^\circ\text{C}$. Both are completely healthy inside their learned envelopes.
2. **Canonical Four Metrics**:
   - `temperature` $\rightarrow$ $^\circ\text{C}$
   - `vibration` $\rightarrow$ $\text{mm/s}$
   - `current` $\rightarrow$ $\text{A}$
   - `rpm` $\rightarrow$ $\text{revolutions/minute}$
   *(Pressure is strictly excluded from core telemetry).*
3. **Five Failure Modes**:
   - `drift` (gradual slope away from learned baseline)
   - `spike` (sharp excursion beyond learned variance)
   - `flatline` (frozen signal / sudden variance collapse)
   - `oscillation` (alternating cyclic waveform)
   - `sensor_swap` (abrupt multi-channel profile jump matching another machine)
4. **Authoritative Server State**:
   - The frontend never runs detection algorithms.
   - All state mutations emit via WebSocket to maintain multi-operator concurrent session synchronization.

---

## 2. REST API Endpoints

### 2.1 Fleet Summary
- **Method**: `GET`
- **Path**: `/fleet/summary`
- **Response `200 OK`**:
```json
{
  "total_devices": 50,
  "healthy": 44,
  "warning": 3,
  "critical": 3,
  "active_alerts": 6,
  "regions_affected": 2
}
```

---

### 2.2 Device Registry
- **Method**: `GET`
- **Path**: `/fleet/devices`
- **Query Params**:
  - `region` (optional): `'North' | 'South' | 'East' | 'West'`
  - `status` (optional): `'HEALTHY' | 'WARNING' | 'CRITICAL'`
- **Response `200 OK`**: Array of `Device` objects:
```json
[
  {
    "device_id": "DEV-007",
    "device_instance_id": "INST-007",
    "region": "North",
    "status": "WARNING",
    "telemetry_status": "ACTIVE",
    "anomaly_type": "drift",
    "severity": 82,
    "confidence": 89,
    "explanation": "Temperature shows sustained upward movement and is significantly above the learned baseline.",
    "latest_reading": {
      "temperature": 71.2,
      "vibration": 2.3,
      "current": 8.7,
      "rpm": 1482,
      "timestamp": "2026-09-01T15:44:32Z",
      "is_anomaly": true,
      "anomaly_label": "Drift Detected"
    },
    "baseline": {
      "device_id": "DEV-007",
      "temperature_mean": 62.1,
      "temperature_std": 1.6,
      "vibration_mean": 2.1,
      "vibration_std": 0.3,
      "current_mean": 8.3,
      "current_std": 0.5,
      "rpm_mean": 1482,
      "rpm_std": 22,
      "is_mature": true,
      "observations": 50,
      "max_observations": 15
    },
    "last_updated": "2026-09-01T15:44:32Z"
  }
]
```

---

### 2.3 Device Historical Telemetry
- **Method**: `GET`
- **Path**: `/fleet/devices/{id}/readings`
- **Query Params**: `limit` (default: 50)
- **Response `200 OK`**:
```json
[
  {
    "temperature": 62.0,
    "vibration": 2.1,
    "current": 8.2,
    "rpm": 1480,
    "timestamp": "2026-09-01T15:42:00Z",
    "is_anomaly": false
  },
  {
    "temperature": 71.2,
    "vibration": 2.3,
    "current": 8.7,
    "rpm": 1482,
    "timestamp": "2026-09-01T15:44:32Z",
    "is_anomaly": true,
    "anomaly_label": "Drift Detected"
  }
]
```

---

### 2.4 Manual Telemetry Lab: Single Packet Analysis
- **Method**: `POST`
- **Path**: `/telemetry/analyze`
- **Request Body**:
```json
{
  "device_id": "DEV-007",
  "device_instance_id": "INST-007",
  "region": "North",
  "temperature": 72.4,
  "vibration": 2.3,
  "current": 8.7,
  "rpm": 1482,
  "timestamp": "2026-09-01T15:45:00Z"
}
```
*(User is strictly forbidden from sending anomaly or severity).*

- **Response `200 OK` (`HealthResult`)**:
```json
{
  "device_id": "DEV-007",
  "device_instance_id": "INST-007",
  "region": "North",
  "status": "WARNING",
  "anomaly_type": "drift",
  "severity": 82,
  "confidence": 89,
  "current_metrics": {
    "temperature": 72.4,
    "vibration": 2.3,
    "current": 8.7,
    "rpm": 1482
  },
  "baseline_metrics": {
    "temperature_mean": 62.1,
    "temperature_std": 1.6,
    "vibration_mean": 2.1,
    "vibration_std": 0.3,
    "current_mean": 8.3,
    "current_std": 0.5,
    "rpm_mean": 1482,
    "rpm_std": 22
  },
  "detectors": {
    "z_score": 6.4,
    "trend": 0.18,
    "direction_consistency": 91,
    "persistence": 14,
    "variance": 2.1
  },
  "explanation": "Temperature shows sustained upward movement and is significantly above the learned baseline.",
  "timestamp": "2026-09-01T15:45:00Z",
  "is_mature": true,
  "observation_count": 52,
  "max_maturity_observations": 15,
  "source": "MANUAL"
}
```

---

### 2.5 Manual Telemetry Lab: Batch Ingestion Feed
- **Method**: `POST`
- **Path**: `/telemetry/feed`
- **Request Body**:
```json
{
  "packets": [
    {
      "device_id": "DEV-007",
      "device_instance_id": "INST-007",
      "region": "North",
      "temperature": 72.4,
      "vibration": 2.3,
      "current": 8.7,
      "rpm": 1482,
      "timestamp": "2026-09-01T15:45:00Z"
    }
  ]
}
```
- **Response `200 OK`**: Array of `HealthResult` objects.

---

### 2.6 Incident Log & Resolution
- **Method**: `GET`
- **Path**: `/alerts`
- **Response `200 OK`**: Array of `Alert` objects:
```json
[
  {
    "id": "ALT-DEV-007-DRIFT",
    "device_id": "DEV-007",
    "device_instance_id": "INST-007",
    "region": "North",
    "anomaly_type": "drift",
    "status": "WARNING",
    "severity": 82,
    "confidence": 89,
    "timestamp": "15:44:32",
    "lifecycle_status": "ACTIVE",
    "source": "LIVE",
    "explanation": "Temperature shows sustained upward movement and is significantly above the learned baseline.",
    "current_metrics": {
      "temperature": 71.2,
      "vibration": 2.3,
      "current": 8.7,
      "rpm": 1482
    },
    "baseline_metrics": {
      "temperature": 62.1,
      "vibration": 2.1,
      "current": 8.3,
      "rpm": 1482
    },
    "detectors": {
      "z_score": 3.8,
      "trend": 0.18,
      "direction_consistency": 91,
      "persistence": 14
    }
  }
]
```

- **Method**: `POST`
- **Path**: `/alerts/{id}/resolve`
- **Response `200 OK`**: `{ "success": true, "resolved_at": "2026-09-01T15:50:00Z" }`

---

## 3. WebSocket Realtime Protocol

- **Endpoint**: `ws://127.0.0.1:8000/ws/fleet`
- **Keep-alive**: Client pings `{ "type": "ping" }` every 15s.

### Event 1: `telemetry_update`
Emitted as live telemetry flows in:
```json
{
  "event": "telemetry_update",
  "device_id": "DEV-007",
  "device_instance_id": "INST-007",
  "region": "North",
  "reading": {
    "temperature": 71.2,
    "vibration": 2.3,
    "current": 8.7,
    "rpm": 1482,
    "timestamp": "2026-09-01T15:44:32Z",
    "is_anomaly": true
  }
}
```

### Event 2: `device_update`
Emitted when health engine updates device status:
```json
{
  "event": "device_update",
  "device_id": "DEV-007",
  "status": "WARNING",
  "anomaly_type": "drift",
  "severity": 82,
  "confidence": 89,
  "explanation": "Temperature shows sustained upward movement and is significantly above the learned baseline.",
  "timestamp": "2026-09-01T15:44:32Z"
}
```

### Event 3: `alert_new`
Emitted when a new incident is flagged:
```json
{
  "event": "alert_new",
  "alert": {
    "id": "ALT-DEV-007-DRIFT",
    "device_id": "DEV-007",
    "device_instance_id": "INST-007",
    "region": "North",
    "anomaly_type": "drift",
    "status": "WARNING",
    "severity": 82,
    "confidence": 89,
    "timestamp": "15:44:32",
    "lifecycle_status": "ACTIVE",
    "source": "LIVE",
    "explanation": "Temperature shows sustained upward movement and is significantly above the learned baseline."
  }
}
```

### Event 4: `conflict_update`
Emitted for regional cross-device correlation:
```json
{
  "event": "conflict_update",
  "conflict": {
    "id": "RC-NORTH-01",
    "region": "North",
    "severity": "WARNING",
    "affected_devices": ["DEV-007", "DEV-010"],
    "conflict_type": "Correlated Thermal & Speed Deviation",
    "reason": "2 devices in North show synchronized departure from individual baselines following grid step.",
    "detected_at": "2026-09-01T15:44:32Z"
  }
}
```

# Adaptive Fleet Health Monitoring — Frontend Integration Contract (v3.2.0)

This document is the authoritative API and WebSocket integration specification for the frontend dashboard.

---

## 1. Environment Configuration

The backend supports configurable hosts, ports, CORS origins, and WebSocket paths:

| Environment Variable | Default | Purpose |
|---|---|---|
| `PORT` | `8000` | Backend HTTP & WebSocket server port |
| `HOST` | `0.0.0.0` | Server binding address |
| `DATABASE_URL` | `sqlite:///./adaptive_fleet.db` | Persistence layer (SQLite / PostgreSQL) |
| `CORS_ORIGINS` | `*` | Allowed CORS origins (e.g. `http://localhost:3000,http://localhost:5173`) |
| `REGIONAL_CONFLICT_WINDOW_SECONDS` | `60` | Sliding window for regional cross-device anomaly correlation |
| `REGIONAL_CONFLICT_MIN_DEVICES` | `2` | Minimum distinct physical instances to form a regional conflict |

---

## 2. Canonical Device Identity

Physical assets are strictly identified by **`(device_id + device_instance_id)`**:
- **`device_id`** (e.g. `DEV-017`): Logical device asset name.
- **`device_instance_id`** (e.g. `INST-017-A`): Physical hardware session instance.
- **`region`** (e.g. `North`, `South`, `East`, `West`, `Central`): Geographic operating region.

> [!NOTE]
> If multiple physical instances exist for a single `device_id`, single-device queries must specify `?instance_id=INST-...`. Omitting `instance_id` on multi-instance devices returns `HTTP 409 Conflict`.

---

## 3. Telemetry Ingestion Contract

### `POST /readings`
Ingests time-series sensor metrics, executes Member 1's `HealthEngine`, persists baselines, manages incident lifecycles, and triggers regional conflict evaluation.

**Request Body (`application/json`):**
```json
{
  "device_id": "DEV-017",
  "device_instance_id": "INST-017-A",
  "region": "South",
  "timestamp": "2026-09-02T00:52:00Z",
  "metrics": {
    "temperature": 95.0,
    "vibration": 2.1,
    "current": 5.0,
    "rpm": 1000.0
  }
}
```

* **Canonical Metrics (All 4 required):** `temperature`, `vibration`, `current`, `rpm`.
* **Zero Pressure:** There is NO `pressure` metric.

**Response (`201 Created` — Authoritative Rich HealthResult):**
```json
{
  "device_id": "DEV-017",
  "device_instance_id": "INST-017-A",
  "region": "South",
  "status": "critical",
  "anomaly_type": "spike",
  "severity": 1.0,
  "confidence": 1.0,
  "current_metrics": {
    "temperature": 95.0,
    "vibration": 2.1,
    "current": 5.0,
    "rpm": 1000.0
  },
  "baseline_metrics": {
    "temperature_mean": 50.0,
    "temperature_std": 1.2,
    "vibration_mean": 2.0,
    "vibration_std": 0.1,
    "current_mean": 5.0,
    "current_std": 0.2,
    "rpm_mean": 1000.0,
    "rpm_std": 10.0
  },
  "detectors": [
    {
      "anomaly_type": "spike",
      "detected": true,
      "score": 1.0,
      "confidence": 1.0,
      "metric": "temperature",
      "evidence": {
        "direction": "positive_spike",
        "first_difference": 45.0,
        "abs_z_score": 37.5
      }
    }
  ],
  "explanation": "Temperature exhibited a sudden surge of +45.0°C exceeding dynamic threshold.",
  "timestamp": "2026-09-02T00:52:00Z",
  "is_mature": true
}
```

---

## 4. REST API Endpoints

### Health & Metadata
* `GET /`: Root metadata and API version.
* `GET /health`: System liveness and health status (`{"status": "healthy", "service": "...", "version": "3.2.0"}`).

### Fleet & Devices
* `GET /devices`: List all registered devices with instance IDs, regions, and current status.
* `GET /devices/{device_id}?instance_id={opt}`: Fetch device metadata.
* `GET /devices/{device_id}/state?instance_id={opt}` (or `GET /health/{device_id}`): Get authoritative device state including `status`, `telemetry_status` (`ACTIVE`/`STALE`/`OFFLINE`), `seconds_since_last_reading`, `latest_reading`, and `latest_alert`.
* `GET /devices/{device_id}/readings?instance_id={opt}&limit=100` (or `GET /telemetry/{device_id}`): Time-series historical telemetry readings (ordered newest first).
* `GET /devices/{device_id}/baseline?instance_id={opt}`: Learned baseline mean and standard deviation per metric.
* `GET /fleet/summary`: Fleet overview metrics (`total_devices`, `healthy`, `warning`, `critical`, `active_alerts`).

### Regions & Regional Conflict
* `GET /regions`: Summary of all regions with device breakdowns and `active_conflicts` count.
* `GET /regions/{region}`: Detailed regional view with status breakdown and list of `active_conflicts`.
* `GET /conflicts?status=ACTIVE&region=South&skip=0&limit=100`: List of authoritative regional conflicts.
* `GET /conflicts/{conflict_id}`: Fetch single conflict details by public ID.

**Regional Conflict Object Example:**
```json
{
  "id": 1,
  "conflict_id": "RC-5B43CEE6",
  "region": "South",
  "status": "ACTIVE",
  "anomaly_types": ["spike"],
  "affected_devices": [
    {
      "device_id": "DEV-017",
      "device_instance_id": "INST-017-A",
      "anomaly_type": "spike",
      "severity": 1.0,
      "confidence": 1.0,
      "detected_at": "2026-09-02T00:52:00Z"
    },
    {
      "device_id": "DEV-018",
      "device_instance_id": "INST-018-A",
      "anomaly_type": "spike",
      "severity": 1.0,
      "confidence": 1.0,
      "detected_at": "2026-09-02T00:52:15Z"
    }
  ],
  "severity": 1.0,
  "confidence": 1.0,
  "explanation": "Regional conflict detected in South: 2 physical device instances (DEV-017/INST-017-A, DEV-018/INST-018-A) reported spike anomalies within 15 seconds.",
  "detected_at": "2026-09-02T00:52:00Z",
  "last_updated_at": "2026-09-02T00:52:15Z",
  "resolved_at": null
}
```

### Incidents
* `GET /incidents?status=ACTIVE&region=South&anomaly_type=spike&device_id=DEV-017&device_instance_id=INST-017-A`: Filtered incident query.
* `GET /incidents/{incident_id}`: Single incident lookup.

**Incident Object Example:**
```json
{
  "id": 1,
  "incident_id": "INC-8A9F1B2C",
  "device_id": "DEV-017",
  "device_instance_id": "INST-017-A",
  "region": "South",
  "anomaly_type": "spike",
  "severity": 1.0,
  "confidence": 1.0,
  "status": "ACTIVE",
  "occurrence_count": 3,
  "peak_severity": 1.0,
  "peak_confidence": 1.0,
  "latest_explanation": "Temperature exhibited a sudden surge of +45.0°C exceeding dynamic threshold.",
  "first_detected_at": "2026-09-02T00:52:00Z",
  "last_detected_at": "2026-09-02T00:52:30Z",
  "resolved_at": null
}
```

---

## 5. WebSocket Real-Time Gateway (`WS /ws/fleet`)

Connect to `/ws/fleet` for real-time streaming updates.

### Deterministic Event Dispatch Sequence on Telemetry Ingestion:
1. **`fleet_snapshot`**: Sent immediately to newly connected clients.
2. **`telemetry_update`**: Dispatched on every committed telemetry reading.
3. **`incident_created` / `incident_updated` / `incident_resolved`**: Dispatched if an incident lifecycle transition occurred.
4. **`regional_conflict`**: Dispatched if a regional cross-device conflict was created, updated, or resolved (`action`: `conflict_created`, `conflict_updated`, `conflict_resolved`).

### WebSocket Event Envelope Schema:
```typescript
interface WebSocketMessage<T = any> {
  event: 'fleet_snapshot' | 'telemetry_update' | 'incident_created' | 'incident_updated' | 'incident_resolved' | 'regional_conflict';
  type: string;
  action?: 'conflict_created' | 'conflict_updated' | 'conflict_resolved';
  timestamp: string; // ISO-8601 UTC
  data?: T;
}
```

---

## 6. Error Handling

All error responses use standard RFC-7807 formatted JSON:
```json
{
  "detail": "Descriptive error message"
}
```

| HTTP Status | Trigger Condition |
|---|---|
| `400 Bad Request` | Missing or invalid canonical fields in payload |
| `404 Not Found` | Nonexistent device, incident, conflict, or region |
| `409 Conflict` | Ambiguous device lookup (multiple instances exist without `instance_id`) |
| `422 Unprocessable` | Malformed types, NaN/Infinity metrics, invalid status/anomaly filter |
| `500 Internal Error` | Database or processing error (automatically rolled back) |

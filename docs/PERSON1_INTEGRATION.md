# Person 1 Integration Guide: Frontend Dashboard

**Role:** Frontend Dashboard & UI Engineer  
**Backend Base URL:** `http://127.0.0.1:8000`  
**WebSocket Gateway:** `ws://127.0.0.1:8000/ws/fleet`  
**CORS:** Enabled for all origins (`*`)

---

## 1. Recommended Startup & Initialization Flow

```text
                     [ Application Mount ]
                               │
               ┌───────────────┴───────────────┐
               ▼                               ▼
     [ 1. Fetch REST Data ]          [ 2. Open WebSocket ]
     - GET /fleet/summary            - Connect to WS /ws/fleet
     - GET /regions/summary          - Receive `fleet_snapshot`
     - GET /devices                  - Stream `telemetry_update`
                                     - Stream `device_update`
```

---

## 2. Initial Data Loading (REST APIs)

1. **Top Summary Cards:**
   `GET /fleet/summary` -> Returns total devices, healthy, warning, critical counts, and active alerts.
2. **Regional Map / Breakdown:**
   `GET /regions/summary` -> Returns device distribution and statuses per region (`Chennai`, `Bangalore`, `Hyderabad`, `Mumbai`, `Delhi`).
3. **Fleet Device List:**
   `GET /devices` -> Returns array of all 50 devices with `device_id`, `region`, and `status`.
4. **Device Details / Drawer Modal:**
   `GET /devices/{device_id}/state` -> Returns full device snapshot including:
   - `status`: Machine health (`HEALTHY`, `WARNING`, `CRITICAL`)
   - `telemetry_status`: Transmission freshness (`ACTIVE`, `STALE`, `OFFLINE`)
   - `seconds_since_last_reading`: Elapsed seconds since last telemetry reading
   - `latest_reading`: `{ temperature, pressure, vibration, timestamp }`
   - `latest_alert`: `{ failure_type, severity, confidence, timestamp }` or `null`
5. **Telemetry History Chart:**
   `GET /devices/{device_id}/readings?limit=50` -> Returns historical time-series telemetry (newest first).

---

## 3. Real-Time WebSocket Integration (`/ws/fleet`)

### Client Setup (JavaScript Example):
```javascript
const ws = new WebSocket("ws://127.0.0.1:8000/ws/fleet");

ws.onopen = () => {
  console.log("Connected to Fleet WebSocket Gateway");
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  switch (data.event) {
    case "fleet_snapshot":
      // Initialize full fleet registry
      initializeFleet(data.devices);
      break;

    case "telemetry_update":
      // Update live chart & card telemetry for data.device_id
      updateDeviceTelemetry(data.device_id, {
        temperature: data.temperature,
        pressure: data.pressure,
        vibration: data.vibration,
        timestamp: data.timestamp
      });
      break;

    case "device_update":
      // Update badge, card border color, and alert banner for data.device_id
      updateDeviceStatus(data.device_id, {
        status: data.status,
        failure_type: data.failure_type,
        confidence: data.confidence,
        timestamp: data.timestamp
      });
      break;
  }
};
```

---

## 4. Suggested Client-Side State Model

Store devices in a normalized hash map:
```typescript
interface DeviceState {
  device_id: string;
  region: string;
  status: "HEALTHY" | "WARNING" | "CRITICAL";
  telemetry_status: "ACTIVE" | "STALE" | "OFFLINE";
  seconds_since_last_reading?: number;
  temperature?: number;
  pressure?: number;
  vibration?: number;
  latest_alert?: {
    failure_type: "drift" | "spike" | "flatline" | "oscillation" | "sensor_swap";
    severity: string;
    confidence: number;
    timestamp: string;
  } | null;
}

const devicesById: Record<string, DeviceState> = {};
```

---

## 5. Visual Status Indicators
* **Machine Health (`status`):**
  * `HEALTHY` -> Green
  * `WARNING` -> Yellow / Amber
  * `CRITICAL` -> Red
* **Telemetry Freshness (`telemetry_status`):**
  * `ACTIVE` (0–60s) -> Solid Green pulse / "Live"
  * `STALE` (61–300s) -> Orange / "Delayed"
  * `OFFLINE` (> 300s) -> Gray / "Offline"

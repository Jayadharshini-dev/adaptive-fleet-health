# ADAPTIVE FLEET HEALTH MONITORING WITH CONCURRENT SESSION COORDINATION
## Complete Project Context & System Architecture Specification

> **Source of Truth Document**  
> This file serves as the permanent, authoritative context for the project. Any developer working on this repository MUST read this document first to understand requirements, architecture, member boundaries, and constraints.

---

## 1. PROJECT OVERVIEW

- **Project Name:** Adaptive Fleet Health Monitoring with Concurrent Session Coordination
- **Context:** 24-Hour Hackathon Project
- **Target Fleet:** Exactly 50 simulated IoT devices
- **Team Size:** 3 Members

### Purpose & Problem Statement
Industrial IoT fleets consist of devices operating under varying baseline conditions (e.g., location, load, component age). Globally static threshold rules (e.g., `temperature > 80 = CRITICAL`) cause high false-positive and false-negative rates because a temperature of 85°C may be normal for one device but critical for another.

This project solves that problem by implementing **adaptive per-device baselines**. The system independently learns normal behavior for each of the 50 devices, detects five distinct failure modes, calculates explainable risk scores, handles regional conflicts and duplicate device IDs, and synchronizes live updates across simultaneous dashboard sessions.

---

## 2. CORE DIFFERENTIATOR: ADAPTIVE PER-DEVICE BASELINES

The system **MUST NOT** rely on a globally fixed static threshold as its primary anomaly detection mechanism.

### Key Rules:
1. **Device Isolation:** Each device maintains its own learned baseline.
   - Example: `DEV-01` operates normally around 55°C. `DEV-02` operates normally around 85°C. An observation of 85°C for `DEV-01` is **CRITICAL**, while 85°C for `DEV-02` is **HEALTHY**.
2. **Dynamic Adaptation:** The baseline gradually adapts as valid normal observations arrive over time.
3. **Anomaly Resistance:** Outliers and detected anomalies must **NOT** pollute or corrupt the normal baseline.
4. **Maturity / Warm-Up:** The baseline tracks update counts and confidence, requiring a warm-up period before asserting high-confidence anomaly classifications.

---

## 3. COMPLETE SYSTEM ARCHITECTURE & DATA FLOW

```
[ 50 Simulated IoT Devices ]
             ↓
  Telemetry Generation
             ↓
   Failure Injection
             ↓
[ Adaptive Intelligence Layer ]  <-- (Member 1)
             ↓  (HealthResult Contract)
[  FastAPI Backend Server    ]  <-- (Member 2)
             ↓
[ PostgreSQL / Supabase DB   ]  <-- (Member 2)
             ↓
    Realtime Event Bus
             ↓
[  React Dashboard (Web)     ]  <-- (Member 3)  (Multi-tab session sync)
```

### Detailed Processing Pipeline (Intelligence Layer)
```
Raw Telemetry Input
    ↓
Validation & Schema Check
    ↓
Feature Extraction (Rolling stats, differences, EWM)
    ↓
Per-Device Baseline Update / Evaluation
    ↓
Individual Anomaly Detectors (Drift, Spike, Flatline, Oscillation, Sensor Swap)
    ↓
Unified Classifier & Precedence Engine
    ↓
Risk Scoring (Health Status, Severity [0.0-1.0], Confidence [0.0-1.0])
    ↓
Structured HealthResult Output
```

---

## 4. TEAM STRUCTURE & MODULE OWNERSHIP

| Team Member | Core Focus | Owned Directories & Files | Key Responsibilities |
|---|---|---|---|
| **Member 1** | Adaptive Intelligence & Simulator Scenarios | `intelligence/`<br>`simulator/scenarios/`<br>`intelligence/tests/` | Baseline learning, 5 failure detectors, classifier, severity & confidence scoring, failure scenarios, deterministic unit tests. **Zero DB/Web/API dependencies.** |
| **Member 2** | Backend, Persistence, Realtime & Edge Logic | `backend/`<br>Database Schemas | FastAPI server, PostgreSQL/Supabase persistence, telemetry APIs, regional conflict detection, duplicate device ID history preservation, WebSocket/realtime broadcasting. |
| **Member 3** | Frontend & Realtime Dashboard | `frontend/` | React dashboard, fleet overview, device details, anomaly visualization, regional conflict displays, multi-session live sync across browser tabs. |

---

## 5. MEMBER 1 DETAILED INTELLIGENCE SPECIFICATION

### Engine Interface Contract
The intelligence engine MUST expose a standalone, stateless-API / stateful-instance interface conceptually matching:

```python
# Process a single telemetry packet and return a structured HealthResult
health_result = engine.process_telemetry(telemetry_data)

# Reset device baseline/history for deterministic testing or re-commissioning
engine.reset_device(device_id)
```

### Telemetry Input Schema (Conceptual Contract)
```json
{
  "device_id": "DEV-023",
  "region": "North",
  "timestamp": "2026-09-01T12:20:00Z",
  "metrics": {
    "temperature": 63.2,
    "pressure": 101.4,
    "vibration": 0.21
  }
}
```

### HealthResult Output Schema (Conceptual Contract)
```json
{
  "device_id": "DEV-023",
  "region": "North",
  "status": "critical",
  "anomaly_type": "drift",
  "severity": 0.91,
  "confidence": 0.94,
  "current_value": 87.4,
  "baseline_value": 63.2,
  "timestamp": "2026-09-01T12:20:00Z",
  "details": {
    "message": "DEV-023 normally operates around 63.2. Current value is 87.4 and sustained upward deviation indicates drift."
  }
}
```
- **Allowed Statuses:** `healthy`, `warning`, `critical`
- **Allowed Anomaly Types:** `none`, `drift`, `spike`, `flatline`, `oscillation`, `sensor_swap`
- **Normalized Ranges:** `severity` $\in [0.0, 1.0]$, `confidence` $\in [0.0, 1.0]$

---

## 6. THE FIVE REQUIRED FAILURE MODES & DETECTION LOGIC

### 1. DRIFT
- **Definition:** Gradual, sustained directional movement away from the device's learned normal baseline.
- **Example Sequence:** `60, 61, 62, 64, 65, 67, 69, 71...`
- **Detection Strategy:** Trend slope analysis over window $W$, sustained directional slope, cumulative deviation distance from adaptive mean. Must NOT trigger on a single isolated jump.

### 2. SPIKE
- **Definition:** Sudden, extreme single-sample or short-duration excursion relative to learned mean and variance.
- **Example Sequence:** `60, 61, 60, 62, 95, 61, 60...`
- **Detection Strategy:** $Z$-score or modified IQR distance relative to per-device rolling standard deviation ($\sigma$).

### 3. FLATLINE
- **Definition:** A sensor output that becomes unnaturally constant or loses normal operational noise variance.
- **Example Sequence:** `60, 61, 59, 60, 60.0, 60.0, 60.0, 60.0, 60.0...`
- **Detection Strategy:** Rolling sample variance $\sigma^2 \approx 0$ or zero consecutive first-differences ($\Delta x = 0$) sustained over duration threshold $T$.

### 4. OSCILLATION
- **Definition:** Abnormal repeating, periodic, or alternating value fluctuations beyond normal jitter.
- **Example Sequence:** `60, 70, 60, 71, 59, 70, 60, 71...`
- **Detection Strategy:** Zero-crossing counts of detrended series, alternating sign pattern of first-differences ($\Delta x_t \cdot \Delta x_{t-1} < 0$), autocorrelation analysis.

### 5. SENSOR SWAP
- **Definition:** Channel mapping mismatch or cross-sensor identity swap (e.g., temperature reading swapped with pressure channel, or physical sensor values swapped between two devices).
- **Detection Strategy:** Invariant relationship violation between multi-metric channels (e.g., joint covariance or ratio expected between temperature and pressure for a specific device), or sudden shift matching another channel's distribution. Must match actual simulator injection mechanism.

---

## 7. SPECIAL SCENARIO & SYSTEM REQUIREMENTS

### 1. Regional Conflict Detection (Member 2 Primary Focus)
- When multiple devices within the **same region** simultaneously exhibit correlated abnormal health states (e.g., `DEV-01`, `DEV-02`, and `DEV-03` in `North` region all showing temperature spikes), the system must flag a **Regional Conflict** indicating an environmental or zonal issue rather than isolated component failure.

### 2. Duplicate Device IDs & History Preservation (Member 2 Primary Focus)
- If two physical telemetry streams present with identical `device_id`s, the system MUST NOT overwrite historical telemetry or baseline state.
- Member 2 will manage logical identity resolution (e.g., combining `device_id` with session/hardware key or database primary key) so that both historical series remain distinct and preserved.

### 3. Realtime Concurrent Sessions (Member 2 & Member 3 Focus)
- Health status changes emitted by the backend must instantly broadcast via WebSockets/SSE to all open dashboard tabs simultaneously without requiring manual refresh.

---

## 8. NON-FUNCTIONAL REQUIREMENTS & NO-GO RULES

1. **No Hardcoded Global Thresholds:** Anomaly classification must strictly depend on per-device adaptive statistics.
2. **No Deep Learning Overkill:** No PyTorch, TensorFlow, LSTMs, or Transformers. Lightweight, explainable statistical time-series algorithms (rolling mean/std, EWM, trend fitting) are required.
3. **No Database Dependencies in Intelligence Layer:** `intelligence/` must remain pure Python and execute independently without PostgreSQL, Supabase, FastAPI, or React.
4. **Bounded Memory & Incremental Compute:** Use $O(1)$ streaming updates (Welford's algorithm, exponential moving averages) or fixed-size deque windows. Never store unbounded telemetry lists in RAM.
5. **Deterministic Testing:** All detectors must pass unit tests using synthetic input vectors with fixed seeds or known numeric sequences.
6. **Workspace Boundaries:** ALL files MUST remain inside `adaptive-fleet-health/`. Never create files directly on the Desktop or outside this workspace root.

---

## 9. DEFINITION OF DONE (MEMBER 1)

- [ ] Adaptive per-device baseline implementation complete (`intelligence/baseline/`).
- [ ] Baseline updates dynamically while preventing anomaly pollution.
- [ ] Warm-up / baseline maturity handled.
- [ ] Feature extraction layer implemented (`intelligence/features/`).
- [ ] Drift detector implemented and tested (`intelligence/detection/`).
- [ ] Spike detector implemented and tested.
- [ ] Flatline detector implemented and tested.
- [ ] Oscillation detector implemented and tested.
- [ ] Sensor-swap detector implemented and tested.
- [ ] Unified classifier combines detector outputs with deterministic precedence rules.
- [ ] Risk scoring outputs `healthy`, `warning`, `critical` with explainable severity $[0.0, 1.0]$ and confidence $[0.0, 1.0]$.
- [ ] Structured `HealthResult` contract validated.
- [ ] Deterministic failure injection scenarios built (`simulator/scenarios/`).
- [ ] Automated tests in `intelligence/tests/` pass 100%.
- [ ] 50 simulated devices validated running concurrently through the intelligence engine.
- [ ] Clean integration documentation provided for Member 2.

---

## 10. DEFINITION OF DONE (COMPLETE TEAM PROJECT)

- [ ] 50 devices monitored simultaneously.
- [ ] Per-device adaptive baselines verified (different devices operating normally at different ranges).
- [ ] All 5 failure modes successfully injected and detected live.
- [ ] Cross-device regional conflicts identified and displayed in UI.
- [ ] Duplicate device ID handling verified without data loss.
- [ ] Telemetry & health results persisted to PostgreSQL/Supabase.
- [ ] FastAPI endpoints operational and delivering realtime updates.
- [ ] React frontend rendering fleet overview, device detail, anomaly timeline, and regional conflict alert banner.
- [ ] Multi-tab browser synchronization working seamlessly in real time.
- [ ] Stable, repeatable demo script ready for hackathon judging.

---

## 11. DEVELOPMENT PHASES (MEMBER 1 STEP-BY-STEP)

1. **Phase 1:** Adaptive per-device baseline (`intelligence/baseline/`)
2. **Phase 2:** Feature extraction (`intelligence/features/`)
3. **Phase 3:** Drift detector (`intelligence/detection/`)
4. **Phase 4:** Spike detector (`intelligence/detection/`)
5. **Phase 5:** Flatline detector (`intelligence/detection/`)
6. **Phase 6:** Oscillation detector (`intelligence/detection/`)
7. **Phase 7:** Sensor-swap detector (`intelligence/detection/`)
8. **Phase 8:** Unified classifier (`intelligence/models/`)
9. **Phase 9:** Risk / Severity / Confidence scoring logic
10. **Phase 10:** Failure injection scenarios in `simulator/scenarios/`
11. **Phase 11:** Deterministic unit testing in `intelligence/tests/`
12. **Phase 12:** 50-device scale & multi-baseline validation
13. **Phase 13:** Integration contract definition (`docs/INTEGRATION_CONTRACT.md`)
14. **Phase 14:** Backend integration assistance with Member 2
15. **Phase 15:** End-to-end system testing & live demo prep

---

## 12. GIT COMMIT CONVENTIONS

Focus commits by area:
- `feat(intelligence): add adaptive per-device baseline`
- `feat(intelligence): implement drift and spike detectors`
- `feat(simulator): add scenario generator for flatline and oscillation`
- `test(intelligence): add unit tests for sensor swap detector`
- `docs: update integration contract for Member 2`

*Never commit `.env` files, passwords, database URLs, or Supabase credentials.*

---

## 13. INSTRUCTIONS FOR AI CODING TOOLS

Any AI coding assistant opening this codebase must follow these steps before writing code:
1. **Read `PROJECT_CONTEXT.md`** completely to understand boundaries and architecture.
2. **Inspect the existing repository structure** without creating duplicate project root folders.
3. **Respect Team Member Boundaries:**
   - Member 1 work goes in `intelligence/`, `simulator/scenarios/`, `intelligence/tests/`.
   - Member 2 work goes in `backend/`.
   - Member 3 work goes in `frontend/`.
4. **Maintain Pure Python Constraints** for the intelligence layer (no web frameworks or DB drivers inside `intelligence/`).
5. **Execute Incremental Changes** and run automated unit tests (`pytest intelligence/tests/`) to verify work.

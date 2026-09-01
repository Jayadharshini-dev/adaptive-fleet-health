# Adaptive Fleet Health Monitoring with Concurrent Session Coordination

> **Presentation-Ready Industrial Fleet Operations Console**  
> Built with React 19, Vite, TypeScript, Tailwind CSS v4, and Recharts.

---

## ⚡ Overview

This dashboard communicates the complete product story of an industrial IoT fleet operations center monitoring **exactly 50 physical assets** (`DEV-001` through `DEV-050`) across 4 canonical operational sectors (**North**, **South**, **East**, **West**).

### Core Product Principle
> **"Normal is learned per device."**  
> The system does *not* use arbitrary global thresholds.  
> Example: `DEV-007` learned temperature baseline is $\approx 62.1^\circ\text{C}$, while `DEV-024` learned baseline is $\approx 84.2^\circ\text{C}$. Both machines are completely healthy inside their individual learned envelopes. The system detects when a machine stops behaving like itself.

### Canonical Four Telemetry Metrics
- **Temperature** $\rightarrow$ $^\circ\text{C}$
- **Vibration** $\rightarrow$ $\text{mm/s}$
- **Current** $\rightarrow$ $\text{A}$
- **RPM** $\rightarrow$ $\text{revolutions/minute}$

### Five Detected Failure Modes
1. **Drift** (gradual baseline deviation)
2. **Spike** (sudden sharp excursion)
3. **Flatline** (frozen signal / variance collapses)
4. **Oscillation** (cyclic harmonic waveform)
5. **Sensor Swap** (multi-channel profile mismatch)

---

## 🧭 Application Structure & Routes

- `/` or `/dashboard` — **Command Overview**: 6 top-level summary KPIs (Total Devices, Healthy, Warning, Critical, Active Alerts, Regions Affected), live risk donut, regional breakdown bars, real-time incident ticker, and fleet matrix preview.
- `/fleet` — **50-Device Operations Matrix**: Compact table or grid views with search, multi-facet filtering (Health Status, Region, Anomaly Type, Telemetry Status), and sorting (Severity, Recent Alert, Device ID, Region).
- `/alerts` — **Persistent Incident Log**: Chronological alert stream with ACTIVE vs RESOLVED lifecycle indicators, LIVE vs MANUAL source tags, and click-to-open contextual popover.
- `/regions` — **Regional Operations Grid**: Sector-level breakdown cards for North, South, East, and West with active alert badges and drill-down filtering.
- `/manual-lab` — **Manual Telemetry Lab (Judge Testing)**: Dedicated judge-facing portal with single-packet form (anti-cheat locked) and multi-packet batch JSON feed ingestion with instant HealthResult diagnostic feedback.
- `/conflicts` — **Regional Conflicts**: Visualization architecture for correlated cross-device abnormal behavior within common geographic sectors.
- `/settings` — **System & Demo Scenarios**: REST & WebSocket endpoint configuration and controlled scenario controllers.

---

## 🔬 Judge Evaluation & Demonstration Script

1. **Fleet Normal Baseline Showcase**:
   - Open `/fleet` to display all 50 distinct physical assets across North, South, East, and West.
   - Click **`DEV-007`** (North) $\rightarrow$ observe learned baseline ($62.1^\circ\text{C}$, $2.1\text{ mm/s}$, $8.3\text{ A}$, $1482\text{ rpm}$).
   - Click **`DEV-024`** (South) $\rightarrow$ observe its completely different learned baseline ($84.2^\circ\text{C}$, $3.5\text{ mm/s}$, $14.5\text{ A}$, $2850\text{ rpm}$).
   - Highlight: *"Both machines are healthy at their own distinct operating ranges."*

2. **Incident & Alert Popover Triage**:
   - Navigate to `/` or `/alerts`.
   - Click an active alert (e.g. `DEV-007` Drift or `DEV-045` Sensor Swap).
   - Notice the **contextual detail popover** opens without navigating away.
   - Inspect **"WHY WAS THIS FLAGGED?"** (actual backend explanation).
   - Inspect **Key Evidence** (Temperature, Vibration, Current, RPM current vs baseline).
   - Inspect distinct **Severity** vs **Confidence** gauges.

3. **Full Time-Series Graph Investigation**:
   - Click **"VIEW FULL ANALYSIS"** in the popover.
   - The device drawer opens showing:
     - 4 canonical metric cards with exact deviation (+9.1°C).
     - Baseline Learning indicator (`Observations: 8/15` or `Mature`).
     - Time-series chart with **Actual telemetry curve**, **Learned baseline line**, **Anomaly onset marker**, and **Detection point marker**.
     - Technical Detector Evidence table (Z-score, Trend, Direction consistency, Persistence).

4. **Judge Adversarial Testing in Manual Telemetry Lab**:
   - Navigate to `/manual-lab`.
   - Select **Single Packet Form** or click a quick-load preset (e.g. *"Drift on DEV-007"* or *"Sensor Swap on DEV-045"*).
   - Point out that **the user cannot select anomaly type or severity** — these are generated server-side.
   - Click **"ANALYZE TELEMETRY"**.
   - Result card immediately renders the server-generated `HealthResult` with WHY explanation and detector metrics.
   - Switch to **Batch JSON Feed** and click **"INGEST FEED"** to demonstrate multi-packet ingestion.

5. **Concurrent Multi-Session Coordination**:
   - Open two browser windows side-by-side.
   - When new telemetry or incidents arrive, both browser instances synchronize in real time via WebSocket without page refreshes.

---

## 🚀 Quick Start

### 1. Installation
```bash
npm install
```

### 2. Configuration (`.env`)
```env
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_WS_BASE_URL=ws://127.0.0.1:8000/ws/fleet
```

### 3. Run Development Server
```bash
npm run dev
```

### 4. Build for Production
```bash
npm run build
```

---

## 📄 Backend Integration Contract

Comprehensive API and WebSocket specifications for Member 1 (intelligence pipeline) and Member 2 (FastAPI backend) are documented in [`src/docs/BACKEND_CONTRACT.md`](file:///src/docs/BACKEND_CONTRACT.md).

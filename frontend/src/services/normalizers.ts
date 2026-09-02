import type {
  Device,
  FleetSummary,
  RegionSummary,
  Alert,
  AdaptiveBaseline,
  TelemetryReading,
  HealthStatus,
  TelemetryStatus,
  FailureMode,
  RegionName,
  HealthResult,
} from '../types/fleet';

/**
 * Safely parse and normalize raw device payload from GET /devices or WebSocket
 */
export function normalizeDevice(raw: any): Device {
  if (!raw || typeof raw !== 'object') {
    return {
      device_id: 'DEV-000',
      device_instance_id: 'INST-000',
      region: 'North',
      status: 'HEALTHY',
      telemetry_status: 'OFFLINE',
      latest_reading: {
        temperature: 0,
        vibration: 0,
        current: 0,
        rpm: 0,
        timestamp: new Date().toISOString(),
      },
      baseline: {
        device_id: 'DEV-000',
        temperature_mean: 60,
        temperature_std: 1.5,
        vibration_mean: 2.0,
        vibration_std: 0.3,
        current_mean: 8.0,
        current_std: 0.5,
        rpm_mean: 1500,
        rpm_std: 20,
        is_mature: true,
        observations: 20,
        max_observations: 15,
      },
      severity: 0,
      confidence: 0,
      anomaly_type: 'none',
      history: [],
      last_updated: new Date().toISOString(),
    };
  }

  const device_id = String(raw.device_id || raw.id || raw.deviceId || 'DEV-001');
  const device_instance_id = String(raw.device_instance_id || raw.instanceId || `INST-${device_id.replace('DEV-', '')}`);
  
  let region: RegionName = 'North';
  const rawReg = String(raw.region || '').toLowerCase();
  if (rawReg.includes('south')) region = 'South';
  else if (rawReg.includes('east')) region = 'East';
  else if (rawReg.includes('west')) region = 'West';
  else region = 'North';

  // Normalize Health Status
  let status: HealthStatus = 'HEALTHY';
  const rawStatus = String(raw.status || '').toUpperCase();
  if (rawStatus === 'CRITICAL' || rawStatus === 'CRIT') status = 'CRITICAL';
  else if (rawStatus === 'WARNING' || rawStatus === 'WARN') status = 'WARNING';
  else if (rawStatus === 'HEALTHY' || rawStatus === 'OK') status = 'HEALTHY';

  // Normalize Telemetry Status
  let telemetry_status: TelemetryStatus = 'ACTIVE';
  const rawTelemetry = String(raw.telemetry_status || raw.telemetryStatus || raw.connectivity || '').toUpperCase();
  if (rawTelemetry === 'OFFLINE' || rawTelemetry === 'DISCONNECTED') telemetry_status = 'OFFLINE';
  else if (rawTelemetry === 'STALE' || rawTelemetry === 'INACTIVE') telemetry_status = 'STALE';
  else telemetry_status = 'ACTIVE';

  // Extract canonical reading: temperature, vibration, current, rpm
  const r = raw.latest_reading || raw.current_metrics || raw;
  const latest_reading: TelemetryReading = {
    temperature: Number(Number(r.temperature ?? 60).toFixed(1)),
    vibration: Number(Number(r.vibration ?? 2.0).toFixed(2)),
    current: Number(Number(r.current ?? 8.0).toFixed(1)),
    rpm: Math.round(Number(r.rpm ?? 1500)),
    timestamp: String(r.timestamp || raw.timestamp || new Date().toISOString()),
    is_anomaly: Boolean(raw.is_anomaly || raw.isAnomaly),
  };

  // Severity and Confidence
  let severity = Number(raw.severity ?? 0);
  if (severity <= 1 && severity > 0) severity = Math.round(severity * 100);
  let confidence = Number(raw.confidence ?? 0);
  if (confidence <= 1 && confidence > 0) confidence = Math.round(confidence * 100);

  // Failure mode / Anomaly Type
  let anomaly_type: FailureMode = 'none';
  const rawAnom = String(raw.anomaly_type || raw.failure_type || raw.anomaly || 'none').toLowerCase();
  if (['drift', 'spike', 'flatline', 'oscillation', 'sensor_swap'].includes(rawAnom)) {
    anomaly_type = rawAnom as FailureMode;
  }

  // Baseline
  const b = raw.baseline || raw.baseline_metrics || {};
  const baseline: AdaptiveBaseline = {
    device_id,
    temperature_mean: Number(b.temperature_mean ?? b.temp_mean ?? 62.1),
    temperature_std: Number(b.temperature_std ?? b.temp_std ?? 1.6),
    vibration_mean: Number(b.vibration_mean ?? b.vib_mean ?? 2.1),
    vibration_std: Number(b.vibration_std ?? b.vib_std ?? 0.3),
    current_mean: Number(b.current_mean ?? b.curr_mean ?? 8.3),
    current_std: Number(b.current_std ?? b.curr_std ?? 0.5),
    rpm_mean: Math.round(Number(b.rpm_mean ?? 1482)),
    rpm_std: Math.round(Number(b.rpm_std ?? 22)),
    is_mature: typeof b.is_mature === 'boolean' ? b.is_mature : (b.observations ?? 50) >= 15,
    observations: Number(b.observations ?? 50),
    max_observations: Number(b.max_observations ?? 15),
    confidence_interval: 2,
    last_updated: b.last_updated,
  };

  // Explanation and detectors
  const explanation = raw.explanation;
  const detectors = raw.detectors;

  // Latest Alert
  let latest_alert: Alert | null = null;
  if (raw.latest_alert && typeof raw.latest_alert === 'object') {
    latest_alert = normalizeAlert(raw.latest_alert);
  } else if (anomaly_type !== 'none' && status !== 'HEALTHY') {
    latest_alert = {
      id: `ALT-${device_id}-${anomaly_type.toUpperCase()}`,
      device_id,
      device_instance_id,
      region,
      anomaly_type,
      status,
      severity: severity || 75,
      confidence: confidence || 88,
      timestamp: latest_reading.timestamp,
      lifecycle_status: 'ACTIVE',
      source: 'LIVE',
      explanation: explanation || `Detected ${anomaly_type} excursion exceeding baseline envelope.`,
      current_metrics: { ...latest_reading },
      baseline_metrics: {
        temperature: baseline.temperature_mean,
        vibration: baseline.vibration_mean,
        current: baseline.current_mean,
        rpm: baseline.rpm_mean,
      },
      detectors,
    };
  }

  // History
  const history: TelemetryReading[] = Array.isArray(raw.history)
    ? raw.history.map((h: any) => ({
        temperature: Number(Number(h.temperature ?? 0).toFixed(1)),
        vibration: Number(Number(h.vibration ?? 0).toFixed(2)),
        current: Number(Number(h.current ?? 0).toFixed(1)),
        rpm: Math.round(Number(h.rpm ?? 0)),
        timestamp: String(h.timestamp || new Date().toISOString()),
        is_anomaly: Boolean(h.is_anomaly),
        anomaly_label: h.anomaly_label,
      }))
    : [];

  return {
    device_id,
    device_instance_id,
    region,
    status,
    telemetry_status,
    latest_reading,
    baseline,
    latest_alert,
    severity,
    confidence,
    anomaly_type,
    explanation,
    detectors,
    seconds_since_last_reading: raw.seconds_since_last_reading ?? 2,
    history,
    anomaly_onset_index: raw.anomaly_onset_index ?? null,
    detection_point_index: raw.detection_point_index ?? null,
    last_updated: raw.last_updated || latest_reading.timestamp,
  };
}

/**
 * Normalize Alert
 */
export function normalizeAlert(raw: any): Alert {
  const device_id = String(raw.device_id || raw.deviceId || 'DEV-001');
  const device_instance_id = String(raw.device_instance_id || raw.instanceId || `INST-${device_id.replace('DEV-', '')}`);
  
  let region: RegionName = 'North';
  const rawReg = String(raw.region || '').toLowerCase();
  if (rawReg.includes('south')) region = 'South';
  else if (rawReg.includes('east')) region = 'East';
  else if (rawReg.includes('west')) region = 'West';
  else region = 'North';

  let anomaly_type: FailureMode = 'drift';
  const rawAnom = String(raw.anomaly_type || raw.failure_type || raw.type || 'drift').toLowerCase();
  if (['drift', 'spike', 'flatline', 'oscillation', 'sensor_swap'].includes(rawAnom)) {
    anomaly_type = rawAnom as FailureMode;
  }

  let status: HealthStatus = 'WARNING';
  const rawStat = String(raw.status || raw.severity || '').toUpperCase();
  if (rawStat.includes('CRIT')) status = 'CRITICAL';
  else if (rawStat.includes('WARN')) status = 'WARNING';

  let severity = Number(raw.severity ?? 75);
  if (severity <= 1 && severity > 0) severity = Math.round(severity * 100);
  let confidence = Number(raw.confidence ?? 85);
  if (confidence <= 1 && confidence > 0) confidence = Math.round(confidence * 100);

  const cm = raw.current_metrics || {};
  const bm = raw.baseline_metrics || {};

  let lifecycle_status: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED' = 'ACTIVE';
  const rawLife = String(raw.lifecycle_status || raw.status || '').toUpperCase();
  if (rawLife === 'RESOLVED') lifecycle_status = 'RESOLVED';
  else if (rawLife === 'ACKNOWLEDGED') lifecycle_status = 'ACKNOWLEDGED';
  else lifecycle_status = 'ACTIVE';

  return {
    id: String(raw.incident_id || raw.id || raw.alert_id || `INC-${device_id}-${Date.now()}`),
    device_id,
    device_instance_id,
    region,
    anomaly_type,
    status,
    severity,
    confidence,
    timestamp: String(raw.timestamp || raw.last_detected_at || raw.created_at || new Date().toISOString()),
    lifecycle_status,
    acknowledged_at: raw.acknowledged_at,
    acknowledged_by: raw.acknowledged_by,
    resolved_at: raw.resolved_at,
    resolved_by: raw.resolved_by,
    resolution_reason: raw.resolution_reason,
    source: raw.source === 'MANUAL' ? 'MANUAL' : 'LIVE',
    explanation: String(raw.latest_explanation || raw.explanation || 'Abnormal telemetry behavior detected by intelligence engine.'),
    current_metrics: {
      temperature: Number(cm.temperature ?? 0),
      vibration: Number(cm.vibration ?? 0),
      current: Number(cm.current ?? 0),
      rpm: Number(cm.rpm ?? 0),
    },
    baseline_metrics: {
      temperature: Number(bm.temperature ?? bm.temperature_mean ?? 0),
      vibration: Number(bm.vibration ?? bm.vibration_mean ?? 0),
      current: Number(bm.current ?? bm.current_mean ?? 0),
      rpm: Number(bm.rpm ?? bm.rpm_mean ?? 0),
    },
    detectors: raw.detectors,
    acknowledged: lifecycle_status !== 'ACTIVE',
  };
}

/**
 * Normalize HealthResult
 */
export function normalizeHealthResult(raw: any): HealthResult {
  const device_id = String(raw.device_id || 'DEV-001');
  let region: RegionName = 'North';
  const rawReg = String(raw.region || '').toLowerCase();
  if (rawReg.includes('south')) region = 'South';
  else if (rawReg.includes('east')) region = 'East';
  else if (rawReg.includes('west')) region = 'West';
  else region = 'North';

  let status: HealthStatus = 'HEALTHY';
  const rawStat = String(raw.status || '').toUpperCase();
  if (rawStat.includes('CRIT')) status = 'CRITICAL';
  else if (rawStat.includes('WARN')) status = 'WARNING';

  let anomaly_type: FailureMode = 'none';
  const rawAnom = String(raw.anomaly_type || raw.failure_type || 'none').toLowerCase();
  if (['drift', 'spike', 'flatline', 'oscillation', 'sensor_swap'].includes(rawAnom)) {
    anomaly_type = rawAnom as FailureMode;
  }

  let severity = Number(raw.severity ?? 0);
  if (severity <= 1 && severity > 0) severity = Math.round(severity * 100);
  let confidence = Number(raw.confidence ?? 0);
  if (confidence <= 1 && confidence > 0) confidence = Math.round(confidence * 100);

  const cm = raw.current_metrics || {};
  const bm = raw.baseline_metrics || {};

  return {
    device_id,
    device_instance_id: String(raw.device_instance_id || `INST-${device_id.replace('DEV-', '')}`),
    region,
    status,
    anomaly_type,
    severity,
    confidence,
    current_metrics: {
      temperature: Number(cm.temperature ?? 0),
      vibration: Number(cm.vibration ?? 0),
      current: Number(cm.current ?? 0),
      rpm: Number(cm.rpm ?? 0),
    },
    baseline_metrics: {
      temperature_mean: Number(bm.temperature_mean ?? 60),
      temperature_std: Number(bm.temperature_std ?? 1.5),
      vibration_mean: Number(bm.vibration_mean ?? 2.0),
      vibration_std: Number(bm.vibration_std ?? 0.3),
      current_mean: Number(bm.current_mean ?? 8.0),
      current_std: Number(bm.current_std ?? 0.5),
      rpm_mean: Number(bm.rpm_mean ?? 1500),
      rpm_std: Number(bm.rpm_std ?? 20),
    },
    detectors: raw.detectors,
    explanation: String(raw.explanation || 'Evaluation completed.'),
    timestamp: String(raw.timestamp || new Date().toISOString()),
    is_mature: Boolean(raw.is_mature ?? true),
    observation_count: raw.observation_count ?? 50,
    max_maturity_observations: raw.max_maturity_observations ?? 15,
    source: raw.source === 'MANUAL' ? 'MANUAL' : 'LIVE',
  };
}

/**
 * Normalize fleet summary
 */
export function normalizeFleetSummary(raw: any, totalDevicesCount = 50): FleetSummary {
  if (!raw || typeof raw !== 'object') {
    return {
      total_devices: totalDevicesCount,
      healthy: 44,
      warning: 3,
      critical: 3,
      active_alerts: 6,
      regions_affected: 2,
    };
  }

  return {
    total_devices: Number(raw.total_devices ?? raw.totalDevices ?? totalDevicesCount),
    healthy: Number(raw.healthy ?? 0),
    warning: Number(raw.warning ?? 0),
    critical: Number(raw.critical ?? 0),
    active_alerts: Number(raw.active_alerts ?? raw.activeAlerts ?? 0),
    regions_affected: Number(raw.regions_affected ?? raw.regionsAffected ?? 0),
  };
}

/**
 * Normalize region summary
 */
export function normalizeRegionSummary(raw: any): Record<RegionName, RegionSummary> {
  const regions: Record<RegionName, RegionSummary> = {
    North: { total_devices: 13, healthy: 13, warning: 0, critical: 0, active_alerts: 0 },
    South: { total_devices: 12, healthy: 12, warning: 0, critical: 0, active_alerts: 0 },
    East: { total_devices: 12, healthy: 12, warning: 0, critical: 0, active_alerts: 0 },
    West: { total_devices: 13, healthy: 13, warning: 0, critical: 0, active_alerts: 0 },
  };

  if (!raw || typeof raw !== 'object') return regions;

  for (const reg of ['North', 'South', 'East', 'West'] as RegionName[]) {
    if (raw[reg]) {
      regions[reg] = {
        total_devices: Number(raw[reg].total_devices ?? raw[reg].count ?? 0),
        healthy: Number(raw[reg].healthy ?? 0),
        warning: Number(raw[reg].warning ?? 0),
        critical: Number(raw[reg].critical ?? 0),
        active_alerts: Number(raw[reg].active_alerts ?? 0),
      };
    }
  }

  return regions;
}

export function normalizeReadings(raw: any): TelemetryReading[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((r: any) => ({
    temperature: Number(Number(r.temperature ?? 0).toFixed(1)),
    vibration: Number(Number(r.vibration ?? 0).toFixed(2)),
    current: Number(Number(r.current ?? 0).toFixed(1)),
    rpm: Math.round(Number(r.rpm ?? 0)),
    timestamp: String(r.timestamp || new Date().toISOString()),
    is_anomaly: Boolean(r.is_anomaly),
    anomaly_label: r.anomaly_label,
  }));
}

export function normalizeBaseline(raw: any, deviceId: string): AdaptiveBaseline {
  return {
    device_id: deviceId,
    temperature_mean: Number(raw?.temperature_mean ?? 62.1),
    temperature_std: Number(raw?.temperature_std ?? 1.6),
    vibration_mean: Number(raw?.vibration_mean ?? 2.1),
    vibration_std: Number(raw?.vibration_std ?? 0.3),
    current_mean: Number(raw?.current_mean ?? 8.3),
    current_std: Number(raw?.current_std ?? 0.5),
    rpm_mean: Number(raw?.rpm_mean ?? 1482),
    rpm_std: Number(raw?.rpm_std ?? 22),
    is_mature: Boolean(raw?.is_mature ?? true),
    observations: Number(raw?.observations ?? 50),
    max_observations: Number(raw?.max_observations ?? 15),
    confidence_interval: 2,
    last_updated: raw?.last_updated,
  };
}

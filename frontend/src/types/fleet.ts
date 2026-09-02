// Core data types for Adaptive Fleet Health Monitoring with Concurrent Session Coordination

export type HealthStatus = 'HEALTHY' | 'WARNING' | 'CRITICAL';

export type TelemetryStatus = 'ACTIVE' | 'STALE' | 'OFFLINE';

export type FailureMode = 'drift' | 'spike' | 'flatline' | 'oscillation' | 'sensor_swap' | 'none';

export type ConnectionStatus = 'LIVE' | 'RECONNECTING' | 'OFFLINE' | 'SIMULATED';

export type RegionName = 'North' | 'South' | 'East' | 'West';

export const REGIONS: RegionName[] = ['North', 'South', 'East', 'West'];

/**
 * Canonical four metrics:
 * - temperature (°C)
 * - vibration (mm/s)
 * - current (A)
 * - rpm (revolutions/minute)
 */
export interface TelemetryReading {
  temperature: number; // in °C
  vibration: number;   // in mm/s
  current: number;     // in A
  rpm: number;         // in revolutions/minute
  timestamp: string;   // ISO 8601 string
  is_anomaly?: boolean; // Flagged by detection engine
  anomaly_label?: string;
}

/**
 * Adaptive Learned Baseline per device.
 * "Normal is learned per device." No global thresholds.
 */
export interface AdaptiveBaseline {
  device_id: string;
  temperature_mean: number;
  temperature_std: number;
  vibration_mean: number;
  vibration_std: number;
  current_mean: number;
  current_std: number;
  rpm_mean: number;
  rpm_std: number;
  is_mature: boolean;
  observations: number;
  max_observations: number; // e.g. 15 for baseline maturity
  confidence_interval?: number; // default 2 sigma (95%)
  last_updated?: string;
}

/**
 * Detector Evidence returned by Member 1 intelligence pipeline
 */
export interface DetectorEvidence {
  z_score?: number;                  // e.g. 4.2σ
  trend?: number;                    // e.g. +0.18 °C/sample
  direction_consistency?: number;    // e.g. 91%
  persistence?: number;              // e.g. 14 observations
  variance?: number;                 // e.g. collapsed to 0.002
  alternation_ratio?: number;        // e.g. 84%
  amplitude?: number;                // e.g. ±12.4
  profile_similarity?: number;       // e.g. 0.88 with DEV-019
  details?: Record<string, string | number | boolean>;
}

/**
 * Canonical HealthResult returned by Backend / Intelligence engine
 */
export interface HealthResult {
  device_id: string;
  device_instance_id: string;
  region: RegionName;
  status: HealthStatus;
  anomaly_type: FailureMode;
  severity: number;    // 0 to 100% (how serious)
  confidence: number;  // 0 to 100% (how strongly evidence supports classification)
  current_metrics: {
    temperature: number;
    vibration: number;
    current: number;
    rpm: number;
  };
  baseline_metrics: {
    temperature_mean: number;
    temperature_std: number;
    vibration_mean: number;
    vibration_std: number;
    current_mean: number;
    current_std: number;
    rpm_mean: number;
    rpm_std: number;
  };
  detectors?: DetectorEvidence;
  explanation: string;
  timestamp: string;
  is_mature: boolean;
  observation_count?: number;
  max_maturity_observations?: number;
  source?: 'LIVE' | 'MANUAL';
}

export interface UserSession {
  id?: number;
  username: string;
  full_name: string;
  role: string;
  token?: string;
  login_timestamp?: string;
}

/**
 * Persistent Incident / Alert Log item
 */
export interface Alert {
  id: string;
  device_id: string;
  device_instance_id: string;
  region: RegionName;
  anomaly_type: FailureMode;
  status: HealthStatus;
  severity: number;    // 0 - 100%
  confidence: number;  // 0 - 100%
  timestamp: string;
  lifecycle_status: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';
  acknowledged_at?: string;
  acknowledged_by?: string;
  resolved_at?: string;
  resolved_by?: string;
  resolution_reason?: string;
  source: 'LIVE' | 'MANUAL';
  explanation: string;
  current_metrics: {
    temperature: number;
    vibration: number;
    current: number;
    rpm: number;
  };
  baseline_metrics: {
    temperature: number;
    vibration: number;
    current: number;
    rpm: number;
  };
  detectors?: DetectorEvidence;
  acknowledged?: boolean;
}

/**
 * Device entity (1 of 50 assets)
 */
export interface Device {
  device_id: string;          // e.g. DEV-007
  device_instance_id: string; // e.g. INST-007
  region: RegionName;
  status: HealthStatus;
  telemetry_status: TelemetryStatus;
  latest_reading: TelemetryReading;
  baseline: AdaptiveBaseline;
  latest_alert?: Alert | null;
  severity: number;           // 0 - 100%
  confidence: number;         // 0 - 100%
  anomaly_type: FailureMode;
  explanation?: string;
  detectors?: DetectorEvidence;
  seconds_since_last_reading?: number;
  is_updated_recently?: boolean;
  history: TelemetryReading[];
  anomaly_onset_index?: number | null;
  detection_point_index?: number | null;
  last_updated: string;
}

export interface FleetSummary {
  total_devices: number;  // 50
  healthy: number;
  warning: number;
  critical: number;
  active_alerts: number;
  regions_affected: number;
}

export interface RegionSummary {
  total_devices: number;
  healthy: number;
  warning: number;
  critical: number;
  active_alerts: number;
}

export interface RegionalConflict {
  id: string;
  region: RegionName;
  severity: HealthStatus;
  affected_devices: string[];
  conflict_type: string;
  reason: string;
  metric_divergence?: {
    metric: 'temperature' | 'vibration' | 'current' | 'rpm';
    regional_mean: number;
    deviant_mean: number;
    deviation_pct: number;
  };
  detected_at: string;
}

export interface DuplicateDeviceMerge {
  duplicate_id: string;
  fleet_a: {
    alias_id: string;
    fleet_name: string;
    region: RegionName;
    reading_count: number;
    first_seen: string;
    last_seen: string;
    latest_reading: TelemetryReading;
    baseline: AdaptiveBaseline;
  };
  fleet_b: {
    alias_id: string;
    fleet_name: string;
    region: RegionName;
    reading_count: number;
    first_seen: string;
    last_seen: string;
    latest_reading: TelemetryReading;
    baseline: AdaptiveBaseline;
  };
  suggested_action: 'keep_both' | 'merge_linked' | 'rename_secondary';
  status: 'PENDING' | 'RESOLVED';
}

// WebSocket Event Payloads
export type FleetWebSocketEvent =
  | {
      event: 'fleet_snapshot';
      devices: Device[];
      summary?: FleetSummary;
      regions?: Record<RegionName, RegionSummary>;
    }
  | {
      event: 'telemetry_update';
      device_id: string;
      device_instance_id?: string;
      region: RegionName;
      reading: TelemetryReading;
      health_result?: HealthResult;
    }
  | {
      event: 'device_update';
      device_id: string;
      status: HealthStatus;
      anomaly_type: FailureMode;
      severity: number;
      confidence: number;
      explanation?: string;
      timestamp: string;
    }
  | {
      event: 'alert_new';
      alert: Alert;
    }
  | {
      event: 'alert_resolved';
      alert_id: string;
      resolved_at: string;
    }
  | {
      event: 'conflict_update';
      conflict: RegionalConflict;
    };

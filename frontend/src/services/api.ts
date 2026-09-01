import type {
  Device,
  FleetSummary,
  RegionSummary,
  Alert,
  AdaptiveBaseline,
  TelemetryReading,
  RegionalConflict,
  DuplicateDeviceMerge,
  HealthResult,
  RegionName,
} from '../types/fleet';
import { generateInitialFleet, evaluateManualTelemetryFallback } from './mockData';
import {
  normalizeDevice,
  normalizeFleetSummary,
  normalizeRegionSummary,
  normalizeBaseline,
  normalizeReadings,
  normalizeAlert,
  normalizeHealthResult,
} from './normalizers';

// Central configuration
let API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
let WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL || API_BASE_URL.replace(/^http/, 'ws') + '/ws/fleet';

export function getApiBaseUrl(): string {
  return API_BASE_URL;
}

export function setApiBaseUrl(newUrl: string): void {
  API_BASE_URL = newUrl.replace(/\/$/, '');
  WS_BASE_URL = API_BASE_URL.replace(/^http/, 'ws') + '/ws/fleet';
}

export function getWsBaseUrl(): string {
  return WS_BASE_URL;
}

// In-memory cache & fallback generator
let mockState = generateInitialFleet();

export function getMockState() {
  return mockState;
}

export function resetMockState() {
  mockState = generateInitialFleet();
  return mockState;
}

// Generic safe fetch with timeout
async function fetchJson<T>(
  endpoint: string,
  transform: (data: any) => T,
  fallback: () => T,
  timeoutMs = 2500,
  options?: RequestInit
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`[API] ${endpoint} returned HTTP ${response.status}. Using simulation fallback.`);
      return fallback();
    }

    const data = await response.json();
    return transform(data);
  } catch {
    clearTimeout(timeoutId);
    return fallback();
  }
}

/**
 * GET /fleet/summary
 */
export async function getFleetSummary(): Promise<FleetSummary> {
  return fetchJson<FleetSummary>(
    '/fleet/summary',
    (data) => normalizeFleetSummary(data, mockState.devices.length),
    () => {
      const healthy = mockState.devices.filter((d) => d.status === 'HEALTHY').length;
      const warning = mockState.devices.filter((d) => d.status === 'WARNING').length;
      const critical = mockState.devices.filter((d) => d.status === 'CRITICAL').length;
      const activeAlerts = mockState.alerts.filter((a) => a.lifecycle_status === 'ACTIVE').length;
      const affectedRegions = new Set(mockState.devices.filter((d) => d.status !== 'HEALTHY').map((d) => d.region)).size;
      return {
        total_devices: mockState.devices.length,
        healthy,
        warning,
        critical,
        active_alerts: activeAlerts,
        regions_affected: affectedRegions,
      };
    }
  );
}

/**
 * GET /fleet/devices or GET /devices
 */
export async function getDevices(): Promise<Device[]> {
  return fetchJson<Device[]>(
    '/fleet/devices',
    (data) => {
      const rawList = Array.isArray(data) ? data : data.devices || [];
      return rawList.map(normalizeDevice);
    },
    () => mockState.devices
  );
}

/**
 * GET /fleet/devices/{id}
 */
export async function getDeviceState(deviceId: string): Promise<Device | null> {
  return fetchJson<Device | null>(
    `/fleet/devices/${encodeURIComponent(deviceId)}`,
    (data) => normalizeDevice(data),
    () => mockState.devices.find((d) => d.device_id === deviceId) || null
  );
}

/**
 * GET /fleet/regions
 */
export async function getRegionsSummary(): Promise<Record<RegionName, RegionSummary>> {
  return fetchJson<Record<RegionName, RegionSummary>>(
    '/fleet/regions',
    (data) => normalizeRegionSummary(data),
    () => mockState.regions
  );
}

/**
 * GET /fleet/devices/{id}/readings
 */
export async function getDeviceReadings(deviceId: string, limit = 50): Promise<TelemetryReading[]> {
  return fetchJson<TelemetryReading[]>(
    `/fleet/devices/${encodeURIComponent(deviceId)}/readings?limit=${limit}`,
    (data) => normalizeReadings(data),
    () => {
      const dev = mockState.devices.find((d) => d.device_id === deviceId);
      return dev ? dev.history : [];
    }
  );
}

/**
 * GET /fleet/devices/{id}/baseline
 */
export async function getDeviceBaseline(deviceId: string): Promise<AdaptiveBaseline | null> {
  return fetchJson<AdaptiveBaseline | null>(
    `/fleet/devices/${encodeURIComponent(deviceId)}/baseline`,
    (data) => (data ? normalizeBaseline(data, deviceId) : null),
    () => {
      const dev = mockState.devices.find((d) => d.device_id === deviceId);
      return dev?.baseline || null;
    }
  );
}

/**
 * GET /alerts
 */
export async function getAlerts(): Promise<Alert[]> {
  return fetchJson<Alert[]>(
    '/alerts',
    (data) => {
      const rawList = Array.isArray(data) ? data : data.alerts || [];
      return rawList.map(normalizeAlert);
    },
    () => mockState.alerts
  );
}

/**
 * GET /conflicts
 */
export async function getRegionalConflicts(): Promise<RegionalConflict[]> {
  return fetchJson<RegionalConflict[]>(
    '/conflicts',
    (data) => (Array.isArray(data) ? data : data.conflicts || []),
    () => mockState.conflicts
  );
}

/**
 * GET /duplicates
 */
export async function getDuplicateDevices(): Promise<DuplicateDeviceMerge[]> {
  return fetchJson<DuplicateDeviceMerge[]>(
    '/duplicates',
    (data) => (Array.isArray(data) ? data : data.duplicates || []),
    () => mockState.duplicates
  );
}

/**
 * POST /telemetry/analyze
 * Single packet manual submission to backend intelligence pipeline
 */
export async function analyzeTelemetry(packet: {
  device_id: string;
  device_instance_id?: string;
  region?: RegionName;
  temperature: number;
  vibration: number;
  current: number;
  rpm: number;
  timestamp?: string;
}): Promise<HealthResult> {
  return fetchJson<HealthResult>(
    '/telemetry/analyze',
    (data) => normalizeHealthResult(data),
    () => {
      const existing = mockState.devices.find((d) => d.device_id === packet.device_id);
      return evaluateManualTelemetryFallback(packet, existing);
    },
    3000,
    {
      method: 'POST',
      body: JSON.stringify(packet),
    }
  );
}

/**
 * POST /telemetry/feed
 * Multi-packet batch manual ingestion to backend intelligence pipeline
 */
export async function ingestTelemetryFeed(packets: Array<{
  device_id: string;
  device_instance_id?: string;
  region?: RegionName;
  temperature: number;
  vibration: number;
  current: number;
  rpm: number;
  timestamp?: string;
}>): Promise<HealthResult[]> {
  return fetchJson<HealthResult[]>(
    '/telemetry/feed',
    (data) => (Array.isArray(data) ? data.map(normalizeHealthResult) : [normalizeHealthResult(data)]),
    () => {
      return packets.map((p) => {
        const existing = mockState.devices.find((d) => d.device_id === p.device_id);
        return evaluateManualTelemetryFallback(p, existing);
      });
    },
    4000,
    {
      method: 'POST',
      body: JSON.stringify({ packets }),
    }
  );
}

/**
 * POST /alerts/{id}/resolve
 */
export async function resolveAlertApi(alertId: string): Promise<boolean> {
  return fetchJson<boolean>(
    `/alerts/${encodeURIComponent(alertId)}/resolve`,
    () => true,
    () => {
      const found = mockState.alerts.find((a) => a.id === alertId);
      if (found) {
        found.lifecycle_status = 'RESOLVED';
        found.resolved_at = new Date().toISOString();
      }
      return true;
    },
    2000,
    { method: 'POST' }
  );
}

/**
 * POST /duplicates/{id}/resolve
 */
export async function resolveDuplicateDevice(
  duplicateId: string,
  action: 'keep_both' | 'merge_linked' | 'rename_secondary'
): Promise<boolean> {
  return fetchJson<boolean>(
    `/duplicates/${encodeURIComponent(duplicateId)}/resolve`,
    () => true,
    () => {
      const dup = mockState.duplicates.find((d) => d.duplicate_id === duplicateId);
      if (dup) {
        dup.status = 'RESOLVED';
        dup.suggested_action = action;
      }
      return true;
    },
    2000,
    {
      method: 'POST',
      body: JSON.stringify({ action }),
    }
  );
}

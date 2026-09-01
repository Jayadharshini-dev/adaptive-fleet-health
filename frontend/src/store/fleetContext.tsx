import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import type {
  Device,
  FleetSummary,
  RegionSummary,
  Alert,
  RegionalConflict,
  DuplicateDeviceMerge,
  ConnectionStatus,
  FleetWebSocketEvent,
  TelemetryReading,
  HealthResult,
  RegionName,
} from '../types/fleet';
import {
  getDevices,
  getFleetSummary,
  getRegionsSummary,
  getAlerts,
  getRegionalConflicts,
  getDuplicateDevices,
  getDeviceState,
  resolveAlertApi,
  resolveDuplicateDevice as apiResolveDuplicate,
} from '../services/api';
import { normalizeDevice, normalizeAlert } from '../services/normalizers';
import { wsService } from '../services/websocket';
import { fleetSimulator } from '../services/simulator';
import { telemetryService, type TelemetryPacketInput } from '../services/telemetryService';

interface FleetContextType {
  devicesById: Record<string, Device>;
  devicesList: Device[];
  selectedDeviceId: string | null;
  selectedDevice: Device | null;
  selectedAlert: Alert | null;
  fleetSummary: FleetSummary;
  regionsSummary: Record<RegionName, RegionSummary>;
  alerts: Alert[];
  conflicts: RegionalConflict[];
  duplicates: DuplicateDeviceMerge[];
  connectionStatus: ConnectionStatus;
  lastSyncTime: Date;
  isSimulatorActive: boolean;
  recentlyUpdatedId: string | null;
  setSelectedDeviceId: (id: string | null) => void;
  setSelectedAlert: (alert: Alert | null) => void;
  refreshFleet: () => Promise<void>;
  resolveAlert: (alertId: string) => Promise<void>;
  submitManualPacket: (packet: TelemetryPacketInput) => Promise<HealthResult>;
  ingestManualFeed: (jsonString: string) => Promise<HealthResult[]>;
  runDemoScenario: (scenario: 'drift' | 'spike' | 'flatline' | 'oscillation' | 'sensor_swap') => void;
  toggleSimulator: () => void;
  resolveDuplicate: (duplicateId: string, action: 'keep_both' | 'merge_linked' | 'rename_secondary') => Promise<void>;
}

const FleetContext = createContext<FleetContextType | null>(null);

export const FleetProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [devicesById, setDevicesById] = useState<Record<string, Device>>({});
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [fleetSummary, setFleetSummary] = useState<FleetSummary>({
    total_devices: 50,
    healthy: 44,
    warning: 3,
    critical: 3,
    active_alerts: 6,
    regions_affected: 2,
  });
  const [regionsSummary, setRegionsSummary] = useState<Record<RegionName, RegionSummary>>({
    North: { total_devices: 13, healthy: 11, warning: 2, critical: 0, active_alerts: 2 },
    South: { total_devices: 12, healthy: 10, warning: 1, critical: 1, active_alerts: 2 },
    East: { total_devices: 12, healthy: 11, warning: 0, critical: 1, active_alerts: 1 },
    West: { total_devices: 13, healthy: 12, warning: 0, critical: 1, active_alerts: 1 },
  });
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [conflicts, setConflicts] = useState<RegionalConflict[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicateDeviceMerge[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('RECONNECTING');
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());
  const [isSimulatorActive, setIsSimulatorActive] = useState<boolean>(true);
  const [recentlyUpdatedId, setRecentlyUpdatedId] = useState<string | null>(null);

  // Compute fleet and region stats dynamically from normalized devicesById
  const recomputeSummaries = useCallback((currentMap: Record<string, Device>, currentAlerts: Alert[]) => {
    const list = Object.values(currentMap);
    if (list.length === 0) return;

    const healthy = list.filter((d) => d.status === 'HEALTHY').length;
    const warning = list.filter((d) => d.status === 'WARNING').length;
    const critical = list.filter((d) => d.status === 'CRITICAL').length;
    const activeAlerts = currentAlerts.filter((a) => a.lifecycle_status === 'ACTIVE').length;

    const affectedRegions = new Set<RegionName>();
    for (const d of list) {
      if (d.status !== 'HEALTHY') {
        affectedRegions.add(d.region);
      }
    }

    setFleetSummary({
      total_devices: list.length,
      healthy,
      warning,
      critical,
      active_alerts: activeAlerts,
      regions_affected: affectedRegions.size,
    });

    const regions: Record<RegionName, RegionSummary> = {
      North: { total_devices: 0, healthy: 0, warning: 0, critical: 0, active_alerts: 0 },
      South: { total_devices: 0, healthy: 0, warning: 0, critical: 0, active_alerts: 0 },
      East: { total_devices: 0, healthy: 0, warning: 0, critical: 0, active_alerts: 0 },
      West: { total_devices: 0, healthy: 0, warning: 0, critical: 0, active_alerts: 0 },
    };

    for (const dev of list) {
      if (!regions[dev.region]) {
        regions[dev.region] = { total_devices: 0, healthy: 0, warning: 0, critical: 0, active_alerts: 0 };
      }
      regions[dev.region].total_devices += 1;
      if (dev.status === 'HEALTHY') regions[dev.region].healthy += 1;
      if (dev.status === 'WARNING') regions[dev.region].warning += 1;
      if (dev.status === 'CRITICAL') regions[dev.region].critical += 1;
    }

    for (const alt of currentAlerts) {
      if (alt.lifecycle_status === 'ACTIVE' && regions[alt.region]) {
        regions[alt.region].active_alerts += 1;
      }
    }

    setRegionsSummary(regions);
  }, []);

  // Fetch initial fleet data from REST APIs
  const refreshFleet = useCallback(async () => {
    try {
      const [devs, summary, regSummary, alts, confs, dups] = await Promise.all([
        getDevices(),
        getFleetSummary(),
        getRegionsSummary(),
        getAlerts(),
        getRegionalConflicts(),
        getDuplicateDevices(),
      ]);

      const map: Record<string, Device> = {};
      devs.forEach((d) => {
        map[d.device_id] = d;
      });

      setDevicesById(map);
      setFleetSummary(summary);
      setRegionsSummary(regSummary);
      setAlerts(alts);
      setConflicts(confs);
      setDuplicates(dups);
      setLastSyncTime(new Date());
    } catch (err) {
      console.error('[FleetContext] Initial load failed:', err);
    }
  }, []);

  // Sync selected device state if requested
  useEffect(() => {
    if (!selectedDeviceId) return;

    let isMounted = true;
    getDeviceState(selectedDeviceId).then((state) => {
      if (isMounted && state) {
        setDevicesById((prev) => ({
          ...prev,
          [state.device_id]: {
            ...(prev[state.device_id] || {}),
            ...state,
            history: prev[state.device_id]?.history || state.history || [],
          },
        }));
      }
    });

    return () => {
      isMounted = false;
    };
  }, [selectedDeviceId]);

  // Handle WebSocket Event Stream
  const handleWebSocketEvent = useCallback((event: FleetWebSocketEvent) => {
    setLastSyncTime(new Date());

    if (event.event === 'fleet_snapshot') {
      const map: Record<string, Device> = {};
      const rawList = Array.isArray(event.devices) ? event.devices : [];
      rawList.forEach((d) => {
        const normalized = normalizeDevice(d);
        map[normalized.device_id] = normalized;
      });
      setDevicesById(map);
      if (event.summary) setFleetSummary(event.summary);
      if (event.regions) setRegionsSummary(event.regions);
    } else if (event.event === 'telemetry_update') {
      const { device_id, reading } = event;
      setRecentlyUpdatedId(device_id);

      setDevicesById((prev) => {
        const existing = prev[device_id];
        if (!existing) return prev;

        const updatedHistory = existing.history
          ? [...existing.history.slice(-49), reading]
          : [reading];

        return {
          ...prev,
          [device_id]: {
            ...existing,
            latest_reading: reading,
            seconds_since_last_reading: 0,
            history: updatedHistory,
            last_updated: reading.timestamp,
          },
        };
      });
    } else if (event.event === 'device_update') {
      const { device_id, status, anomaly_type, severity, confidence, explanation } = event;
      setRecentlyUpdatedId(device_id);

      setDevicesById((prev) => {
        const existing = prev[device_id];
        if (!existing) return prev;

        const updatedDev: Device = {
          ...existing,
          status,
          anomaly_type,
          severity,
          confidence,
          explanation: explanation || existing.explanation,
        };

        const nextMap = { ...prev, [device_id]: updatedDev };
        recomputeSummaries(nextMap, alerts);
        return nextMap;
      });
    } else if (event.event === 'alert_new') {
      const newAlt = normalizeAlert(event.alert);
      setAlerts((prev) => {
        const exists = prev.some((a) => a.id === newAlt.id);
        const updated = exists ? prev.map((a) => (a.id === newAlt.id ? newAlt : a)) : [newAlt, ...prev];
        recomputeSummaries(devicesById, updated);
        return updated;
      });
    } else if (event.event === 'alert_resolved') {
      setAlerts((prev) => {
        const updated = prev.map((a) =>
          a.id === event.alert_id
            ? { ...a, lifecycle_status: 'RESOLVED' as const, resolved_at: event.resolved_at }
            : a
        );
        recomputeSummaries(devicesById, updated);
        return updated;
      });
    } else if (event.event === 'conflict_update') {
      setConflicts((prev) => {
        const exists = prev.some((c) => c.id === event.conflict.id);
        return exists ? prev : [event.conflict, ...prev];
      });
    }
  }, [alerts, devicesById, recomputeSummaries]);

  // Connect WebSocket on mount
  useEffect(() => {
    wsService.onStatusChange((status) => {
      setConnectionStatus(status);
    });

    wsService.onEvent((event) => {
      handleWebSocketEvent(event);
    });

    wsService.connect();
    refreshFleet();

    // Start subtle simulator if enabled
    if (isSimulatorActive) {
      fleetSimulator.start(2500);
    }

    return () => {
      wsService.disconnect();
      fleetSimulator.stop();
    };
  }, [handleWebSocketEvent, isSimulatorActive, refreshFleet]);

  // Clear recently updated visual flash
  useEffect(() => {
    if (!recentlyUpdatedId) return;
    const timer = setTimeout(() => setRecentlyUpdatedId(null), 1200);
    return () => clearTimeout(timer);
  }, [recentlyUpdatedId]);

  // Actions
  const resolveAlert = useCallback(async (alertId: string) => {
    await resolveAlertApi(alertId);
    setAlerts((prev) => {
      const updated = prev.map((a) =>
        a.id === alertId
          ? { ...a, lifecycle_status: 'RESOLVED' as const, resolved_at: new Date().toISOString() }
          : a
      );
      recomputeSummaries(devicesById, updated);
      return updated;
    });
  }, [devicesById, recomputeSummaries]);

  // Manual Telemetry Lab Packet Submission
  const submitManualPacket = useCallback(async (packet: TelemetryPacketInput): Promise<HealthResult> => {
    const result = await telemetryService.submitPacket(packet);

    // If an anomaly is returned, inject it into alerts tagged with MANUAL
    if (result.status !== 'HEALTHY' && result.anomaly_type !== 'none') {
      const newAlert: Alert = {
        id: `ALT-MANUAL-${result.device_id}-${Date.now()}`,
        device_id: result.device_id,
        device_instance_id: result.device_instance_id,
        region: result.region,
        anomaly_type: result.anomaly_type,
        status: result.status,
        severity: result.severity,
        confidence: result.confidence,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        lifecycle_status: 'ACTIVE',
        source: 'MANUAL',
        explanation: result.explanation,
        current_metrics: result.current_metrics,
        baseline_metrics: {
          temperature: result.baseline_metrics.temperature_mean,
          vibration: result.baseline_metrics.vibration_mean,
          current: result.baseline_metrics.current_mean,
          rpm: result.baseline_metrics.rpm_mean,
        },
        detectors: result.detectors,
      };

      setAlerts((prev) => [newAlert, ...prev]);

      // Also update device in fleet
      setDevicesById((prev) => {
        const existing = prev[result.device_id];
        if (!existing) return prev;
        const updatedReading: TelemetryReading = {
          ...result.current_metrics,
          timestamp: result.timestamp,
          is_anomaly: true,
          anomaly_label: `Manual ${result.anomaly_type.toUpperCase()}`,
        };
        const updated: Device = {
          ...existing,
          status: result.status,
          anomaly_type: result.anomaly_type,
          severity: result.severity,
          confidence: result.confidence,
          explanation: result.explanation,
          detectors: result.detectors,
          latest_reading: updatedReading,
          history: [...(existing.history || []).slice(-49), updatedReading],
        };
        const nextMap = { ...prev, [result.device_id]: updated };
        recomputeSummaries(nextMap, [newAlert, ...alerts]);
        return nextMap;
      });
    }

    return result;
  }, [alerts, recomputeSummaries]);

  // Manual Feed Batch Ingestion
  const ingestManualFeed = useCallback(async (jsonString: string): Promise<HealthResult[]> => {
    const results = await telemetryService.ingestFeed(jsonString);

    // Process any anomalies generated from feed
    const newAlerts: Alert[] = [];
    for (const res of results) {
      if (res.status !== 'HEALTHY' && res.anomaly_type !== 'none') {
        newAlerts.push({
          id: `ALT-MANUAL-${res.device_id}-${Date.now()}`,
          device_id: res.device_id,
          device_instance_id: res.device_instance_id,
          region: res.region,
          anomaly_type: res.anomaly_type,
          status: res.status,
          severity: res.severity,
          confidence: res.confidence,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          lifecycle_status: 'ACTIVE',
          source: 'MANUAL',
          explanation: res.explanation,
          current_metrics: res.current_metrics,
          baseline_metrics: {
            temperature: res.baseline_metrics.temperature_mean,
            vibration: res.baseline_metrics.vibration_mean,
            current: res.baseline_metrics.current_mean,
            rpm: res.baseline_metrics.rpm_mean,
          },
          detectors: res.detectors,
        });
      }
    }

    if (newAlerts.length > 0) {
      setAlerts((prev) => [...newAlerts, ...prev]);
    }

    return results;
  }, []);

  const runDemoScenario = useCallback((scenario: 'drift' | 'spike' | 'flatline' | 'oscillation' | 'sensor_swap') => {
    fleetSimulator.runDemoScenario(scenario);
  }, []);

  const toggleSimulator = useCallback(() => {
    setIsSimulatorActive((prev) => {
      const next = !prev;
      if (next) {
        fleetSimulator.start(2500);
      } else {
        fleetSimulator.stop();
      }
      return next;
    });
  }, []);

  const resolveDuplicate = useCallback(async (duplicateId: string, action: 'keep_both' | 'merge_linked' | 'rename_secondary') => {
    await apiResolveDuplicate(duplicateId, action);
    setDuplicates((prev) =>
      prev.map((d) => (d.duplicate_id === duplicateId ? { ...d, status: 'RESOLVED', suggested_action: action } : d))
    );
  }, []);

  const devicesList = useMemo(() => {
    return Object.values(devicesById).sort((a, b) => a.device_id.localeCompare(b.device_id));
  }, [devicesById]);

  const selectedDevice = useMemo(() => {
    return selectedDeviceId ? devicesById[selectedDeviceId] || null : null;
  }, [selectedDeviceId, devicesById]);

  const value = useMemo(
    () => ({
      devicesById,
      devicesList,
      selectedDeviceId,
      selectedDevice,
      selectedAlert,
      fleetSummary,
      regionsSummary,
      alerts,
      conflicts,
      duplicates,
      connectionStatus,
      lastSyncTime,
      isSimulatorActive,
      recentlyUpdatedId,
      setSelectedDeviceId,
      setSelectedAlert,
      refreshFleet,
      resolveAlert,
      submitManualPacket,
      ingestManualFeed,
      runDemoScenario,
      toggleSimulator,
      resolveDuplicate,
    }),
    [
      devicesById,
      devicesList,
      selectedDeviceId,
      selectedDevice,
      selectedAlert,
      fleetSummary,
      regionsSummary,
      alerts,
      conflicts,
      duplicates,
      connectionStatus,
      lastSyncTime,
      isSimulatorActive,
      recentlyUpdatedId,
      setSelectedDeviceId,
      setSelectedAlert,
      refreshFleet,
      resolveAlert,
      submitManualPacket,
      ingestManualFeed,
      runDemoScenario,
      toggleSimulator,
      resolveDuplicate,
    ]
  );

  return <FleetContext.Provider value={value}>{children}</FleetContext.Provider>;
};

export const useFleetStore = () => {
  const context = useContext(FleetContext);
  if (!context) {
    throw new Error('useFleetStore must be used within a FleetProvider');
  }
  return context;
};

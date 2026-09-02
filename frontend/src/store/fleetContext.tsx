import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import type {
  Device,
  FleetSummary,
  RegionSummary,
  Alert,
  RegionalConflict,
  DuplicateDeviceMerge,
  ConnectionStatus,
  TelemetryReading,
  HealthResult,
  RegionName,
  UserSession,
} from '../types/fleet';
import {
  getDevices,
  getFleetSummary,
  getRegionsSummary,
  getAlerts,
  getRegionalConflicts,
  getDuplicateDevices,
  acknowledgeAlertApi,
  resolveAlertApi,
  resolveDuplicateDevice as apiResolveDuplicate,
} from '../services/api';
import { normalizeDevice, normalizeAlert } from '../services/normalizers';
import { wsService } from '../services/websocket';
import { fleetSimulator } from '../services/simulator';
import { telemetryService, type TelemetryPacketInput } from '../services/telemetryService';

interface FleetContextType {
  userSession: UserSession | null;
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
  loginSession: (session: UserSession) => void;
  logoutSession: () => void;
  setSelectedDeviceId: (id: string | null) => void;
  setSelectedAlert: (alert: Alert | null) => void;
  refreshFleet: () => Promise<void>;
  acknowledgeAlert: (alertId: string) => Promise<void>;
  resolveAlert: (alertId: string, reason?: string) => Promise<void>;
  submitManualPacket: (packet: TelemetryPacketInput) => Promise<HealthResult>;
  ingestManualFeed: (jsonString: string) => Promise<HealthResult[]>;
  runDemoScenario: (scenario: 'drift' | 'spike' | 'flatline' | 'oscillation' | 'sensor_swap') => void;
  toggleSimulator: () => void;
  resolveDuplicate: (duplicateId: string, action: 'keep_both' | 'merge_linked' | 'rename_secondary') => Promise<void>;
}

const FleetContext = createContext<FleetContextType | null>(null);

export const FleetProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [userSession, setUserSession] = useState<UserSession | null>(() => {
    const saved = localStorage.getItem('fleet_operator');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return null;
      }
    }
    return null;
  });

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



  const recomputeSummaries = useCallback((currentMap: Record<string, Device>, currentAlerts: Alert[]) => {
    const list = Object.values(currentMap);
    if (list.length === 0) return;

    const healthy = list.filter((d) => d.status === 'HEALTHY').length;
    const warning = list.filter((d) => d.status === 'WARNING').length;
    const critical = list.filter((d) => d.status === 'CRITICAL').length;
    const activeAlerts = currentAlerts.filter((a) => a.lifecycle_status === 'ACTIVE' || a.lifecycle_status === 'ACKNOWLEDGED').length;

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
      if ((alt.lifecycle_status === 'ACTIVE' || alt.lifecycle_status === 'ACKNOWLEDGED') && regions[alt.region]) {
        regions[alt.region].active_alerts += 1;
      }
    }

    setRegionsSummary(regions);
  }, []);

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

  const loginSession = useCallback((session: UserSession) => {
    setUserSession(session);
    localStorage.setItem('fleet_operator', JSON.stringify(session));
    refreshFleet();
    wsService.connect();
  }, [refreshFleet]);

  const logoutSession = useCallback(() => {
    setUserSession(null);
    localStorage.removeItem('fleet_operator');
  }, []);

  const handleWebSocketEvent = useCallback((event: any) => {
    setLastSyncTime(new Date());
    const eventType = event.event || event.type;

    if (eventType === 'fleet_snapshot') {
      const map: Record<string, Device> = {};
      const rawList = Array.isArray(event.devices) ? event.devices : [];
      rawList.forEach((d: any) => {
        const normalized = normalizeDevice(d);
        map[normalized.device_id] = normalized;
      });
      setDevicesById(map);
      if (event.summary) setFleetSummary(event.summary);
      if (event.regions) setRegionsSummary(event.regions);
      if (Array.isArray(event.alerts)) setAlerts(event.alerts.map(normalizeAlert));
    } else if (eventType === 'telemetry_update') {
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
    } else if (eventType === 'device_update') {
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
    } else if (eventType === 'alert_new' || eventType === 'incident_created' || eventType === 'alert_updated' || eventType === 'incident_updated') {
      const rawAlt = event.alert || event.incident || event.data || event;
      const newAlt = normalizeAlert(rawAlt);
      setAlerts((prev) => {
        const exists = prev.some((a) => a.id === newAlt.id || (a.device_id === newAlt.device_id && a.device_instance_id === newAlt.device_instance_id && a.lifecycle_status !== 'RESOLVED'));
        const updated = exists
          ? prev.map((a) => (a.id === newAlt.id || (a.device_id === newAlt.device_id && a.device_instance_id === newAlt.device_instance_id && a.lifecycle_status !== 'RESOLVED') ? { ...a, ...newAlt } : a))
          : [newAlt, ...prev];
        recomputeSummaries(devicesById, updated);
        return updated;
      });
    } else if (eventType === 'alert_acknowledged' || eventType === 'incident_acknowledged') {
      const inc = event.alert || event.incident || event;
      const targetId = event.alert_id || event.incident_id || inc.id;
      setAlerts((prev) => {
        const updated = prev.map((a) =>
          a.id === targetId || (a.device_id === inc.device_id && a.lifecycle_status === 'ACTIVE')
            ? {
                ...a,
                lifecycle_status: 'ACKNOWLEDGED' as const,
                acknowledged_at: event.acknowledged_at || inc.acknowledged_at || new Date().toISOString(),
                acknowledged_by: event.acknowledged_by || inc.acknowledged_by || 'Operator',
              }
            : a
        );
        recomputeSummaries(devicesById, updated);
        return updated;
      });
    } else if (eventType === 'alert_resolved' || eventType === 'incident_resolved') {
      const inc = event.alert || event.incident || event;
      const targetId = event.alert_id || event.incident_id || inc.id;
      setAlerts((prev) => {
        const updated = prev.map((a) =>
          a.id === targetId || (a.device_id === inc.device_id && a.lifecycle_status !== 'RESOLVED')
            ? {
                ...a,
                lifecycle_status: 'RESOLVED' as const,
                resolved_at: event.resolved_at || inc.resolved_at || new Date().toISOString(),
                resolved_by: event.resolved_by || inc.resolved_by || 'Operator',
                resolution_reason: event.resolution_reason || inc.resolution_reason || 'Operator inspection completed',
              }
            : a
        );
        recomputeSummaries(devicesById, updated);
        return updated;
      });
    } else if (eventType === 'conflict_update' || eventType === 'regional_conflict') {
      const rawConflict = event.conflict || event.data || event;
      if (rawConflict && (rawConflict.conflict_id || rawConflict.id)) {
        setConflicts((prev) => {
          const confId = rawConflict.conflict_id || rawConflict.id;
          const exists = prev.some((c) => c.conflict_id === confId || c.id === confId);
          return exists
            ? prev.map((c) => (c.conflict_id === confId || c.id === confId ? { ...c, ...rawConflict } : c))
            : [rawConflict, ...prev];
        });
      }
    }
  }, [alerts, devicesById, recomputeSummaries]);

  useEffect(() => {
    wsService.onStatusChange((status) => {
      setConnectionStatus(status);
    });

    wsService.onEvent((event) => {
      handleWebSocketEvent(event);
    });

    wsService.connect();
    refreshFleet();

    return () => {
      wsService.disconnect();
    };
  }, [handleWebSocketEvent, refreshFleet]);

  useEffect(() => {
    if (!recentlyUpdatedId) return;
    const timer = setTimeout(() => setRecentlyUpdatedId(null), 1200);
    return () => clearTimeout(timer);
  }, [recentlyUpdatedId]);

  const acknowledgeAlert = useCallback(async (alertId: string) => {
    const operatorName = userSession ? userSession.full_name : 'Operator 01';
    await acknowledgeAlertApi(alertId, operatorName);
    setAlerts((prev) => {
      const updated = prev.map((a) =>
        a.id === alertId
          ? {
              ...a,
              lifecycle_status: 'ACKNOWLEDGED' as const,
              acknowledged_at: new Date().toISOString(),
              acknowledged_by: operatorName,
            }
          : a
      );
      recomputeSummaries(devicesById, updated);
      return updated;
    });
  }, [userSession, devicesById, recomputeSummaries]);

  const resolveAlert = useCallback(async (alertId: string, reason: string = 'Operator inspection completed') => {
    const operatorName = userSession ? userSession.full_name : 'Operator 01';
    await resolveAlertApi(alertId, operatorName, reason);
    setAlerts((prev) => {
      const updated = prev.map((a) =>
        a.id === alertId
          ? {
              ...a,
              lifecycle_status: 'RESOLVED' as const,
              resolved_at: new Date().toISOString(),
              resolved_by: operatorName,
              resolution_reason: reason,
            }
          : a
      );
      recomputeSummaries(devicesById, updated);
      return updated;
    });
  }, [userSession, devicesById, recomputeSummaries]);

  const submitManualPacket = useCallback(async (packet: TelemetryPacketInput): Promise<HealthResult> => {
    const result = await telemetryService.submitPacket(packet);

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
        timestamp: new Date().toISOString(),
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

  const ingestManualFeed = useCallback(async (jsonString: string): Promise<HealthResult[]> => {
    const results = await telemetryService.ingestFeed(jsonString);

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
          timestamp: new Date().toISOString(),
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
    fetch('http://127.0.0.1:8000/scenarios/trigger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario }),
    }).catch((err) => {
      console.warn('Backend scenario trigger fallback to local:', err);
      fleetSimulator.runDemoScenario(scenario);
    });
  }, []);

  const toggleSimulator = useCallback(() => {
    setIsSimulatorActive((prev) => !prev);
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
      userSession,
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
      loginSession,
      logoutSession,
      setSelectedDeviceId,
      setSelectedAlert,
      refreshFleet,
      acknowledgeAlert,
      resolveAlert,
      submitManualPacket,
      ingestManualFeed,
      runDemoScenario,
      toggleSimulator,
      resolveDuplicate,
    }),
    [
      userSession,
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
      loginSession,
      logoutSession,
      setSelectedDeviceId,
      setSelectedAlert,
      refreshFleet,
      acknowledgeAlert,
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

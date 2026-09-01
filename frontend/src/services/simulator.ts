import { wsService } from './websocket';
import { getMockState } from './api';
import type { RegionalConflict, TelemetryReading, RegionName } from '../types/fleet';

class FleetSimulator {
  private timer: ReturnType<typeof setInterval> | null = null;
  private isEnabled = true;

  public start(intervalMs = 2000) {
    if (this.timer) clearInterval(this.timer);
    this.isEnabled = true;

    this.timer = setInterval(() => {
      if (!this.isEnabled) return;
      this.tick();
    }, intervalMs);
  }

  public stop() {
    this.isEnabled = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public isRunning(): boolean {
    return this.isEnabled;
  }

  private tick() {
    const mock = getMockState();
    if (!mock || !mock.devices || mock.devices.length === 0) return;

    // Pick 2-4 devices to update telemetry for in real time
    const numDevices = 2 + Math.floor(Math.random() * 3);
    for (let k = 0; k < numDevices; k++) {
      const idx = Math.floor(Math.random() * mock.devices.length);
      const dev = mock.devices[idx];

      if (dev.telemetry_status === 'OFFLINE') continue;

      const base = dev.baseline;

      let t = base.temperature_mean + (Math.random() - 0.5) * (base.temperature_std * 1.2);
      let v = base.vibration_mean + (Math.random() - 0.5) * (base.vibration_std * 1.2);
      let c = base.current_mean + (Math.random() - 0.5) * (base.current_std * 1.2);
      let r = base.rpm_mean + (Math.random() - 0.5) * (base.rpm_std * 1.2);

      // Preserve active failure mode profiles
      if (dev.latest_alert && dev.latest_alert.lifecycle_status === 'ACTIVE') {
        const mode = dev.latest_alert.anomaly_type;
        if (mode === 'drift') {
          t = base.temperature_mean + base.temperature_std * 3.8 + Math.random() * 0.4;
        } else if (mode === 'spike') {
          c = base.current_mean + base.current_std * 5.2;
          v = base.vibration_mean + base.vibration_std * 2.8;
        } else if (mode === 'flatline') {
          v = 0.02; // Flat zero vibration
          c = base.current_mean;
        } else if (mode === 'oscillation') {
          const osc = Math.sin(Date.now() / 600) * (base.vibration_std * 3.6);
          v = base.vibration_mean + osc;
        } else if (mode === 'sensor_swap') {
          t = base.temperature_mean + 24.0;
          c = base.current_mean + 6.5;
          r = base.rpm_mean + 400;
        }
      }

      const reading: TelemetryReading = {
        temperature: Number(t.toFixed(1)),
        vibration: Number(Math.max(0.01, v).toFixed(2)),
        current: Number(Math.max(0.1, c).toFixed(1)),
        rpm: Math.round(r),
        timestamp: new Date().toISOString(),
      };

      // Emit telemetry_update event
      wsService.emitSyntheticEvent({
        event: 'telemetry_update',
        device_id: dev.device_id,
        device_instance_id: dev.device_instance_id,
        region: dev.region,
        reading,
      });
    }
  }

  /**
   * Demo scenario runner for judges / evaluation
   */
  public runDemoScenario(scenario: 'drift' | 'spike' | 'flatline' | 'oscillation' | 'sensor_swap') {
    const mock = getMockState();
    let targetId = 'DEV-007';

    switch (scenario) {
      case 'drift':
        targetId = 'DEV-007';
        break;
      case 'spike':
        targetId = 'DEV-014';
        break;
      case 'flatline':
        targetId = 'DEV-021';
        break;
      case 'oscillation':
        targetId = 'DEV-032';
        break;
      case 'sensor_swap':
        targetId = 'DEV-045';
        break;
    }

    const dev = mock.devices.find((d) => d.device_id === targetId);
    if (!dev) return;

    // Send updated device state event
    wsService.emitSyntheticEvent({
      event: 'device_update',
      device_id: dev.device_id,
      status: scenario === 'drift' || scenario === 'flatline' ? 'WARNING' : 'CRITICAL',
      anomaly_type: scenario,
      severity: scenario === 'sensor_swap' ? 94 : scenario === 'spike' ? 88 : scenario === 'oscillation' ? 91 : 82,
      confidence: 90,
      explanation: dev.explanation || `Telemetry departure flagged by ${scenario.toUpperCase()} detector.`,
      timestamp: new Date().toISOString(),
    });
  }

  public triggerConflict(region: RegionName, devices: string[], reason: string) {
    const conflict: RegionalConflict = {
      id: `RC-${Date.now()}`,
      region,
      severity: 'WARNING',
      affected_devices: devices,
      conflict_type: 'Cross-Device Correlated Anomaly',
      reason,
      detected_at: new Date().toISOString(),
    };

    wsService.emitSyntheticEvent({
      event: 'conflict_update',
      conflict,
    });
  }
}

export const fleetSimulator = new FleetSimulator();

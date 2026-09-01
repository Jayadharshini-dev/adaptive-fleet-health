import type { Device, AdaptiveBaseline, TelemetryReading } from '../types/fleet';
import { getDevices, getDeviceState, getDeviceReadings, getDeviceBaseline } from './api';

export const deviceService = {
  async fetchAllDevices(): Promise<Device[]> {
    return await getDevices();
  },

  async fetchDevice(deviceId: string): Promise<Device | null> {
    return await getDeviceState(deviceId);
  },

  async fetchDeviceReadings(deviceId: string, limit = 50): Promise<TelemetryReading[]> {
    return await getDeviceReadings(deviceId, limit);
  },

  async fetchDeviceBaseline(deviceId: string): Promise<AdaptiveBaseline | null> {
    return await getDeviceBaseline(deviceId);
  },
};

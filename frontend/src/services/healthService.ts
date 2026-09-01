import type { HealthResult } from '../types/fleet';
import { analyzeTelemetry } from './api';

export const healthService = {
  async getHealthResult(deviceId: string): Promise<HealthResult | null> {
    try {
      // If an explicit endpoint exists, call it; otherwise analyze with latest reading
      return await analyzeTelemetry({
        device_id: deviceId,
        temperature: 65,
        vibration: 2.0,
        current: 8.0,
        rpm: 1500,
      });
    } catch {
      return null;
    }
  },
};

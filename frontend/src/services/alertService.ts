import type { Alert } from '../types/fleet';
import { getAlerts, resolveAlertApi } from './api';

export const alertService = {
  async fetchAlerts(): Promise<Alert[]> {
    return await getAlerts();
  },

  async resolveAlert(alertId: string): Promise<boolean> {
    return await resolveAlertApi(alertId);
  },
};

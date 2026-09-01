import { useFleetStore } from '../store/fleetContext';

export function useFleetWebSocket() {
  const store = useFleetStore();

  return {
    connectionStatus: store.connectionStatus,
    lastSyncTime: store.lastSyncTime,
    isSimulatorActive: store.isSimulatorActive,
    recentlyUpdatedId: store.recentlyUpdatedId,
    refreshFleet: store.refreshFleet,
    toggleSimulator: store.toggleSimulator,
  };
}

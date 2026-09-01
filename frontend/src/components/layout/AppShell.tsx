import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { DeviceDrawer } from '../fleet/DeviceDrawer';
import { AlertDetailPopover } from '../alerts/AlertDetailPopover';
import { useFleetStore } from '../../store/fleetContext';

export const AppShell: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { selectedAlert, setSelectedAlert, setSelectedDeviceId, resolveAlert } = useFleetStore();

  return (
    <div className="flex min-h-screen w-full bg-[#EEF7FF] text-[#172033] antialiased selection:bg-[#2563EB] selection:text-white cool-grid-bg">
      {/* Persistent Left Sidebar */}
      <Sidebar
        isOpenMobile={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-x-hidden min-w-0">
        {/* Sticky Top Header */}
        <Header onOpenMobileMenu={() => setMobileMenuOpen(true)} />

        {/* Dynamic Route View */}
        <main className="flex-1 p-4 md:p-6 max-w-7xl w-full mx-auto space-y-6">
          <Outlet />
        </main>
      </div>

      {/* Global Contextual Alert Detail Popover */}
      {selectedAlert && (
        <AlertDetailPopover
          alert={selectedAlert}
          onClose={() => setSelectedAlert(null)}
          onViewFullAnalysis={(deviceId) => {
            setSelectedAlert(null);
            setSelectedDeviceId(deviceId);
          }}
          onResolveAlert={(alertId) => resolveAlert(alertId)}
        />
      )}

      {/* Global Slide-Over Device Details Inspector */}
      <DeviceDrawer />
    </div>
  );
};

export default AppShell;

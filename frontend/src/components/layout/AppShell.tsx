import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { DeviceDrawer } from '../fleet/DeviceDrawer';
import { AlertDetailPopover } from '../alerts/AlertDetailPopover';
import { LoginPage } from '../../pages/LoginPage';
import { useFleetStore } from '../../store/fleetContext';

export const AppShell: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { userSession, loginSession, selectedAlert, setSelectedAlert, setSelectedDeviceId, resolveAlert } = useFleetStore();

  if (!userSession) {
    return <LoginPage onLoginSuccess={(session) => loginSession(session)} />;
  }

  return (
    <div className="flex min-h-screen w-full bg-[#F7F6F2] text-[#17191C] antialiased">
      <Sidebar
        isOpenMobile={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex flex-1 flex-col overflow-x-hidden min-w-0">
        <Header onOpenMobileMenu={() => setMobileMenuOpen(true)} />

        <main className="flex-1 p-4 md:p-6 max-w-7xl w-full mx-auto space-y-6 font-mono">
          <Outlet />
        </main>
      </div>

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

      <DeviceDrawer />
    </div>
  );
};

export default AppShell;

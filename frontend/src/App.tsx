import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { FleetProvider } from './store/fleetContext';
import { AppShell } from './components/layout/AppShell';

// Pages
import { DashboardPage } from './pages/DashboardPage';
import { FleetPage } from './pages/FleetPage';
import { RegionsPage } from './pages/RegionsPage';
import { ConflictsPage } from './pages/ConflictsPage';
import { AlertsPage } from './pages/AlertsPage';
import { ManualLabPage } from './pages/ManualLabPage';
import { FleetMergePage } from './pages/FleetMergePage';
import { SettingsPage } from './pages/SettingsPage';

export const App: React.FC = () => {
  return (
    <FleetProvider>
      <BrowserRouter>
        <Routes>
          {/* Presentation routes removed */}

          {/* Operations Console Layout */}
          <Route element={<AppShell />}>
            <Route index element={<DashboardPage />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="fleet" element={<FleetPage />} />
            <Route path="regions" element={<RegionsPage />} />
            <Route path="alerts" element={<AlertsPage />} />
            <Route path="incidents" element={<AlertsPage />} />
            <Route path="manual-lab" element={<ManualLabPage />} />
            <Route path="manual" element={<ManualLabPage />} />
            <Route path="conflicts" element={<ConflictsPage />} />
            <Route path="fleet-merge" element={<FleetMergePage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </FleetProvider>
  );
};

export default App;

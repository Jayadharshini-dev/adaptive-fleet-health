import React from 'react';
import { SummaryCards } from '../components/dashboard/SummaryCards';
import { FleetHealthDonut } from '../components/dashboard/FleetHealthDonut';
import { RegionalMiniBars } from '../components/dashboard/RegionalMiniBars';
import { RegionalConflictBanner } from '../components/dashboard/RegionalConflictBanner';
import { LiveAlertStream } from '../components/dashboard/LiveAlertStream';
import { FleetQuickGrid } from '../components/dashboard/FleetQuickGrid';

export const DashboardPage: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Top 5 KPI Metric Cards */}
      <SummaryCards />

      {/* Prominent Cross-Device Regional Conflict Banner if any active */}
      <RegionalConflictBanner />

      {/* Fleet Health Distribution + Regional Mini Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FleetHealthDonut />
        <RegionalMiniBars />
      </div>

      {/* Real-time Incident & Anomaly Stream */}
      <LiveAlertStream />

      {/* Quick Fleet Grid Inspector */}
      <FleetQuickGrid />
    </div>
  );
};

import React from 'react';
import { SummaryCards } from '../components/dashboard/SummaryCards';
import { FleetHealthDonut } from '../components/dashboard/FleetHealthDonut';
import { RegionalMiniBars } from '../components/dashboard/RegionalMiniBars';
import { RegionalConflictBanner } from '../components/dashboard/RegionalConflictBanner';
import { LiveAlertStream } from '../components/dashboard/LiveAlertStream';
import { FleetQuickGrid } from '../components/dashboard/FleetQuickGrid';

export const DashboardPage: React.FC = () => {
  return (
    <div className="space-y-6 font-mono">
      {/* Command Center Title Header */}
      <div className="border-b border-[#E2E0D8] pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold tracking-widest text-[#17191C] uppercase">
              FLEET COMMAND CENTER
            </h1>
            <span className="text-xs font-bold text-[#c2410c] bg-[#F0EEE6] border border-[#E2E0D8] px-2 py-0.5 rounded">
              50 ASSETS / 4 REGIONS
            </span>
          </div>
          <p className="text-xs text-[#59616A] font-sans mt-0.5">
            Real-time operational condition monitoring driven by per-device adaptive baseline intelligence.
          </p>
        </div>
      </div>

      {/* Top 6 KPI Cards */}
      <SummaryCards />

      {/* Cross-Device Regional Conflict Banner */}
      <RegionalConflictBanner />

      {/* Fleet Condition & Regional Picture */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FleetHealthDonut />
        <RegionalMiniBars />
      </div>

      {/* Incident Stream */}
      <LiveAlertStream />

      {/* Quick Fleet Wall Inspector */}
      <FleetQuickGrid />
    </div>
  );
};

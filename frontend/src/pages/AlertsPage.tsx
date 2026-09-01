import React from 'react';
import { AlertTable } from '../components/alerts/AlertTable';
import { Bell, History } from 'lucide-react';
import { useFleetStore } from '../store/fleetContext';

export const AlertsPage: React.FC = () => {
  const { alerts } = useFleetStore();
  const activeCount = alerts.filter((a) => a.lifecycle_status === 'ACTIVE').length;
  const resolvedCount = alerts.filter((a) => a.lifecycle_status === 'RESOLVED').length;

  return (
    <div className="space-y-6 font-mono">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#D8E5F0] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Bell className="text-[#EF4444]" size={20} />
            <h2 className="text-base font-bold uppercase tracking-wider text-[#172033]">
              Persistent Incident & Alert Log
            </h2>
          </div>
          <p className="text-xs text-[#526174] mt-1 font-sans">
            Chronological log of classified fleet anomalies across all 5 failure modes with full detector evidence. Click any incident to open the contextual analysis drawer.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto text-xs">
          <div className="flex items-center gap-1.5 bg-[#FEF2F2] border border-[#FECACA] px-3 py-1.5 rounded-lg text-[#B91C1C] shadow-xs">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#EF4444] opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#DC2626]" />
            </span>
            <span className="font-bold">{activeCount} ACTIVE</span>
          </div>

          <div className="flex items-center gap-1.5 bg-white border border-[#D8E5F0] px-3 py-1.5 rounded-lg text-[#526174] shadow-xs">
            <History size={13} />
            <span className="font-bold">{resolvedCount} RESOLVED</span>
          </div>
        </div>
      </div>

      {/* Main Alert Table */}
      <AlertTable />
    </div>
  );
};

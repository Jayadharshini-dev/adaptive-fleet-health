import React, { useState } from 'react';
import { useFleetStore } from '../../store/fleetContext';
import { DeviceCard } from '../fleet/DeviceCard';
import { Server, ArrowRight, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';

export const FleetQuickGrid: React.FC = () => {
  const { devicesList, setSelectedDeviceId } = useFleetStore();
  const [activeTab, setActiveTab] = useState<'all' | 'anomalies' | 'active'>('all');

  // Filter based on tab
  const displayedDevices = devicesList.filter((d) => {
    if (activeTab === 'anomalies') return d.status !== 'HEALTHY';
    if (activeTab === 'active') return d.telemetry_status === 'ACTIVE';
    return true;
  }).slice(0, 8); // Display first 8 for dashboard preview

  const anomalyCount = devicesList.filter((d) => d.status !== 'HEALTHY').length;

  return (
    <div className="cool-panel rounded-xl p-5 space-y-4 bg-white border border-[#D8E5F0] shadow-xs">
      {/* Header with Quick Filter Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#D8E5F0] pb-3">
        <div className="flex items-center gap-2">
          <Server size={16} className="text-[#2563EB]" />
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#172033]">
            Fleet Operations Grid Preview
          </span>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-3">
          <div className="flex items-center gap-1 rounded-lg bg-[#EEF7FF] p-1 border border-[#D8E5F0] font-mono text-xs">
            <button
              onClick={() => setActiveTab('all')}
              className={`rounded px-2.5 py-1 transition-all cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-white text-[#2563EB] font-bold shadow-xs border border-[#BFDBFE]'
                  : 'text-[#526174] hover:text-[#172033]'
              }`}
            >
              All (50)
            </button>
            <button
              onClick={() => setActiveTab('anomalies')}
              className={`flex items-center gap-1 rounded px-2.5 py-1 transition-all cursor-pointer ${
                activeTab === 'anomalies'
                  ? 'bg-[#FEF2F2] text-[#B91C1C] font-bold shadow-xs border border-[#FECACA]'
                  : 'text-[#526174] hover:text-[#172033]'
              }`}
            >
              <ShieldAlert size={12} />
              <span>Anomalies ({anomalyCount})</span>
            </button>
          </div>

          <Link
            to="/fleet"
            className="flex items-center gap-1 font-mono text-xs text-[#2563EB] hover:text-[#1D4ED8] transition-colors font-semibold"
          >
            <span>Full Fleet Grid</span>
            <ArrowRight size={12} />
          </Link>
        </div>
      </div>

      {/* Grid of Preview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {displayedDevices.map((dev) => (
          <DeviceCard
            key={dev.device_id}
            device={dev}
            onSelect={setSelectedDeviceId}
          />
        ))}
      </div>
    </div>
  );
};

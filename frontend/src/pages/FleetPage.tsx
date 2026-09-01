import React from 'react';
import { DeviceGrid } from '../components/fleet/DeviceGrid';
import { Server, Layers } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import type { RegionName } from '../types/fleet';

export const FleetPage: React.FC = () => {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const regionParam = searchParams.get('region');
  const validRegion = (['North', 'South', 'East', 'West'].includes(regionParam || '') ? regionParam : undefined) as RegionName | undefined;

  return (
    <div className="space-y-6 font-mono">
      {/* Page Title & Context */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Server className="text-cyan-400" size={20} />
            <h2 className="text-base font-bold uppercase tracking-wider text-slate-100">
              50-Asset Fleet Operations Matrix
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1 font-sans">
            Real-time telemetry and per-device learned baselines across 50 industrial assets in North, South, East, and West.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800 self-start sm:self-auto">
          <Layers size={14} className="text-cyan-400" />
          <span>"Normal is learned per device"</span>
        </div>
      </div>

      {/* Grid with full multi-facet filters */}
      <DeviceGrid initialRegion={validRegion} />
    </div>
  );
};

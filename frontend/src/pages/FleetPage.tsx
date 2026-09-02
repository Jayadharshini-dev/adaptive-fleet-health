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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E2E0D8] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Server className="text-[#c2410c]" size={18} />
            <h2 className="text-base font-bold uppercase tracking-widest text-[#17191C]">
              50-ASSET INDUSTRIAL MATRIX WALL
            </h2>
          </div>
          <p className="text-xs text-[#59616A] font-sans mt-0.5">
            Real-time telemetry and per-device learned baselines across 50 assets in North, South, East, and West sectors.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-[#59616A] bg-white px-3 py-1 rounded border border-[#E2E0D8] self-start sm:self-auto font-bold">
          <Layers size={14} className="text-[#c2410c]" />
          <span>"Normal is learned per device"</span>
        </div>
      </div>

      <DeviceGrid initialRegion={validRegion} />
    </div>
  );
};

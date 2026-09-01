import React, { useState } from 'react';
import { useFleetStore } from '../store/fleetContext';
import { RegionCard } from '../components/regions/RegionCard';
import { DeviceGrid } from '../components/fleet/DeviceGrid';
import { MapPin, ArrowLeft, Layers } from 'lucide-react';
import type { RegionName, RegionSummary } from '../types/fleet';

export const RegionsPage: React.FC = () => {
  const { regionsSummary } = useFleetStore();
  const [selectedRegion, setSelectedRegion] = useState<RegionName | null>(null);

  const regionEntries = Object.entries(regionsSummary) as [RegionName, RegionSummary][];

  return (
    <div className="space-y-6 font-mono">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#D8E5F0] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <MapPin className="text-[#2563EB]" size={20} />
            <h2 className="text-base font-bold uppercase tracking-wider text-[#172033]">
              Regional Operations Overview
            </h2>
          </div>
          <p className="text-xs text-[#526174] mt-1 font-sans">
            Fleet health and active anomaly distribution across North, South, East, and West operational sectors.
          </p>
        </div>

        {selectedRegion && (
          <button
            onClick={() => setSelectedRegion(null)}
            className="flex items-center gap-1.5 rounded-lg bg-[#EFF6FF] border border-[#BFDBFE] px-3 py-1.5 text-xs font-bold text-[#2563EB] hover:bg-[#DBEAFE] self-start sm:self-auto transition-colors cursor-pointer"
          >
            <ArrowLeft size={13} />
            <span>Show All 4 Regions</span>
          </button>
        )}
      </div>

      {/* Regional Cards Grid (North, South, East, West) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {regionEntries.map(([regionName, summary]) => (
          <RegionCard
            key={regionName}
            regionName={regionName}
            summary={summary}
            isSelected={selectedRegion === regionName}
            onSelect={(reg) => setSelectedRegion(reg === selectedRegion ? null : reg)}
          />
        ))}
      </div>

      {/* Filtered Regional Fleet Drill-Down */}
      <div className="pt-4 border-t border-[#D8E5F0] space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers size={16} className="text-[#2563EB]" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#172033]">
              {selectedRegion ? `Filtered Devices in ${selectedRegion} Region` : 'All 50 Fleet Units by Sector'}
            </h3>
          </div>
          {selectedRegion && (
            <span className="text-xs text-[#526174]">
              Active Regional Filter: <strong className="text-[#2563EB]">{selectedRegion}</strong>
            </span>
          )}
        </div>

        <DeviceGrid key={selectedRegion || 'all'} initialRegion={selectedRegion || undefined} />
      </div>
    </div>
  );
};

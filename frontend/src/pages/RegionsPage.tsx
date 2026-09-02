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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E2E0D8] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <MapPin className="text-[#c2410c]" size={18} />
            <h2 className="text-base font-bold uppercase tracking-widest text-[#17191C]">
              REGIONAL SECTOR OVERVIEW
            </h2>
          </div>
          <p className="text-xs text-[#59616A] font-sans mt-0.5">
            Fleet health and active anomaly distribution across North, South, East, and West sectors.
          </p>
        </div>

        {selectedRegion && (
          <button
            onClick={() => setSelectedRegion(null)}
            className="flex items-center gap-1.5 rounded bg-[#F0EEE6] border border-[#E2E0D8] px-3 py-1 text-xs font-bold text-[#17191C] hover:bg-[#CFCBC0] self-start sm:self-auto transition-colors cursor-pointer"
          >
            <ArrowLeft size={13} />
            <span>Show All 4 Sectors</span>
          </button>
        )}
      </div>

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

      <div className="pt-4 border-t border-[#E2E0D8] space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers size={15} className="text-[#c2410c]" />
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#17191C]">
              {selectedRegion ? `Devices in ${selectedRegion} Sector` : 'All 50 Fleet Units by Sector'}
            </h3>
          </div>
          {selectedRegion && (
            <span className="text-xs text-[#59616A]">
              Filter: <strong className="text-[#c2410c]">{selectedRegion}</strong>
            </span>
          )}
        </div>

        <DeviceGrid key={selectedRegion || 'all'} initialRegion={selectedRegion || undefined} />
      </div>
    </div>
  );
};

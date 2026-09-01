import React from 'react';
import type { HealthStatus, FailureMode, RegionName } from '../../types/fleet';
import { REGIONS } from '../../types/fleet';
import { Search, RotateCcw } from 'lucide-react';

export interface AlertFilterState {
  search: string;
  severity: HealthStatus | 'ALL';
  failureType: FailureMode | 'ALL';
  region: RegionName | 'ALL';
  lifecycle: 'ALL' | 'ACTIVE' | 'RESOLVED';
  source: 'ALL' | 'LIVE' | 'MANUAL';
}

interface AlertFiltersProps {
  filters: AlertFilterState;
  onFilterChange: (filters: AlertFilterState) => void;
  filteredCount: number;
  totalCount: number;
}

export const AlertFilters: React.FC<AlertFiltersProps> = ({
  filters,
  onFilterChange,
  filteredCount,
  totalCount,
}) => {
  const handleReset = () => {
    onFilterChange({
      search: '',
      severity: 'ALL',
      failureType: 'ALL',
      region: 'ALL',
      lifecycle: 'ALL',
      source: 'ALL',
    });
  };

  const hasFilters =
    filters.search !== '' ||
    filters.severity !== 'ALL' ||
    filters.failureType !== 'ALL' ||
    filters.region !== 'ALL' ||
    filters.lifecycle !== 'ALL' ||
    filters.source !== 'ALL';

  return (
    <div className="cool-panel rounded-xl border border-[#D8E5F0] bg-white p-4 space-y-3 font-mono shadow-xs">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8494A7]" />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => onFilterChange({ ...filters, search: e.target.value })}
            placeholder="Search alerts by Device ID (e.g. DEV-007)..."
            className="w-full rounded-lg border border-[#D8E5F0] bg-[#F8FBFF] pl-9 pr-4 py-2 font-mono text-xs text-[#172033] placeholder:text-[#8494A7] focus:border-[#2563EB] focus:outline-hidden"
          />
        </div>

        {hasFilters && (
          <button
            onClick={handleReset}
            className="flex items-center gap-1 self-start sm:self-center rounded-lg border border-[#D8E5F0] bg-[#F8FBFF] px-2.5 py-1.5 font-mono text-xs text-[#526174] hover:text-[#172033] hover:border-[#CBDCEB] transition-colors cursor-pointer"
          >
            <RotateCcw size={12} />
            <span>Reset Filters</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2 border-t border-[#D8E5F0] text-xs">
        {/* Status Lifecycle */}
        <div>
          <label className="text-[10px] uppercase text-[#526174] block mb-1 font-bold">Lifecycle</label>
          <select
            value={filters.lifecycle}
            onChange={(e) =>
              onFilterChange({
                ...filters,
                lifecycle: e.target.value as AlertFilterState['lifecycle'],
              })
            }
            className="w-full rounded-lg border border-[#D8E5F0] bg-[#F8FBFF] px-2 py-1.5 text-xs text-[#172033] focus:border-[#2563EB] focus:outline-hidden"
          >
            <option value="ALL">All States</option>
            <option value="ACTIVE">Active Incidents</option>
            <option value="RESOLVED">Resolved Incidents</option>
          </select>
        </div>

        {/* Severity */}
        <div>
          <label className="text-[10px] uppercase text-[#526174] block mb-1 font-bold">Severity</label>
          <select
            value={filters.severity}
            onChange={(e) =>
              onFilterChange({
                ...filters,
                severity: e.target.value as AlertFilterState['severity'],
              })
            }
            className="w-full rounded-lg border border-[#D8E5F0] bg-[#F8FBFF] px-2 py-1.5 text-xs text-[#172033] focus:border-[#2563EB] focus:outline-hidden"
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="WARNING">Warning</option>
            <option value="HEALTHY">Healthy (Resolved)</option>
          </select>
        </div>

        {/* Failure Mode */}
        <div>
          <label className="text-[10px] uppercase text-[#526174] block mb-1 font-bold">Anomaly Type</label>
          <select
            value={filters.failureType}
            onChange={(e) =>
              onFilterChange({
                ...filters,
                failureType: e.target.value as AlertFilterState['failureType'],
              })
            }
            className="w-full rounded-lg border border-[#D8E5F0] bg-[#F8FBFF] px-2 py-1.5 text-xs text-[#172033] focus:border-[#2563EB] focus:outline-hidden"
          >
            <option value="ALL">All Types</option>
            <option value="drift">Drift</option>
            <option value="spike">Spike</option>
            <option value="flatline">Flatline</option>
            <option value="oscillation">Oscillation</option>
            <option value="sensor_swap">Sensor Swap</option>
          </select>
        </div>

        {/* Region */}
        <div>
          <label className="text-[10px] uppercase text-[#526174] block mb-1 font-bold">Region</label>
          <select
            value={filters.region}
            onChange={(e) =>
              onFilterChange({
                ...filters,
                region: e.target.value as AlertFilterState['region'],
              })
            }
            className="w-full rounded-lg border border-[#D8E5F0] bg-[#F8FBFF] px-2 py-1.5 text-xs text-[#172033] focus:border-[#2563EB] focus:outline-hidden"
          >
            <option value="ALL">All Regions</option>
            {REGIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        {/* Source */}
        <div>
          <label className="text-[10px] uppercase text-[#526174] block mb-1 font-bold">Origin</label>
          <select
            value={filters.source}
            onChange={(e) =>
              onFilterChange({
                ...filters,
                source: e.target.value as AlertFilterState['source'],
              })
            }
            className="w-full rounded-lg border border-[#D8E5F0] bg-[#F8FBFF] px-2 py-1.5 text-xs text-[#172033] focus:border-[#2563EB] focus:outline-hidden"
          >
            <option value="ALL">All Origins</option>
            <option value="LIVE">Live Fleet</option>
            <option value="MANUAL">Manual Lab</option>
          </select>
        </div>
      </div>

      <div className="pt-2 text-[11px] text-[#526174] flex justify-between">
        <span>
          Showing <strong className="text-[#2563EB]">{filteredCount}</strong> of{' '}
          <strong className="text-[#172033]">{totalCount}</strong> incidents
        </span>
        {hasFilters && <span className="text-[#B45309] font-bold">Filters Active</span>}
      </div>
    </div>
  );
};

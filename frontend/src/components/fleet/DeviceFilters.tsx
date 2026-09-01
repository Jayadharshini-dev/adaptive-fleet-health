import React from 'react';
import type { HealthStatus, TelemetryStatus, FailureMode, RegionName } from '../../types/fleet';
import { REGIONS } from '../../types/fleet';
import { Search, Filter, LayoutGrid, List, RotateCcw } from 'lucide-react';

export interface FilterState {
  search: string;
  status: HealthStatus | 'ALL';
  telemetry: TelemetryStatus | 'ALL';
  region: RegionName | 'ALL';
  failure: FailureMode | 'ALL';
  sortBy: 'severity' | 'id' | 'recent_alert' | 'region';
}

interface DeviceFiltersProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  viewMode: 'grid' | 'list';
  onViewModeChange: (mode: 'grid' | 'list') => void;
  deviceCount: number;
  totalCount: number;
}

export const DeviceFilters: React.FC<DeviceFiltersProps> = ({
  filters,
  onFilterChange,
  viewMode,
  onViewModeChange,
  deviceCount,
  totalCount,
}) => {
  const handleReset = () => {
    onFilterChange({
      search: '',
      status: 'ALL',
      telemetry: 'ALL',
      region: 'ALL',
      failure: 'ALL',
      sortBy: 'severity',
    });
  };

  const hasActiveFilters =
    filters.search !== '' ||
    filters.status !== 'ALL' ||
    filters.telemetry !== 'ALL' ||
    filters.region !== 'ALL' ||
    filters.failure !== 'ALL';

  return (
    <div className="cool-panel rounded-xl border border-[#D8E5F0] bg-white p-4 space-y-3 font-mono shadow-xs">
      {/* Top row: Search, Filter reset, Layout View Toggles */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8494A7]"
          />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => onFilterChange({ ...filters, search: e.target.value })}
            placeholder="Search by device ID (e.g. DEV-007, DEV-045)..."
            className="w-full rounded-lg border border-[#D8E5F0] bg-[#F8FBFF] pl-9 pr-4 py-2 font-mono text-xs text-[#172033] placeholder:text-[#8494A7] focus:border-[#2563EB] focus:outline-hidden"
          />
        </div>

        {/* View Mode & Filter Reset */}
        <div className="flex items-center gap-2 justify-end">
          {hasActiveFilters && (
            <button
              onClick={handleReset}
              className="flex items-center gap-1 rounded-lg border border-[#D8E5F0] bg-[#F8FBFF] px-2.5 py-1.5 font-mono text-xs text-[#526174] hover:text-[#172033] hover:border-[#CBDCEB] transition-colors cursor-pointer"
            >
              <RotateCcw size={12} />
              <span>Reset</span>
            </button>
          )}

          <div className="flex rounded-lg border border-[#D8E5F0] bg-[#F8FBFF] p-0.5">
            <button
              onClick={() => onViewModeChange('grid')}
              className={`rounded p-1.5 transition-colors cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-white text-[#2563EB] shadow-xs border border-[#BFDBFE]'
                  : 'text-[#526174] hover:text-[#172033]'
              }`}
              title="Grid View"
            >
              <LayoutGrid size={15} />
            </button>
            <button
              onClick={() => onViewModeChange('list')}
              className={`rounded p-1.5 transition-colors cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-white text-[#2563EB] shadow-xs border border-[#BFDBFE]'
                  : 'text-[#526174] hover:text-[#172033]'
              }`}
              title="Compact Row View"
            >
              <List size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Second row: Dropdown Filters */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2 border-t border-[#D8E5F0] text-xs">
        {/* Status Filter */}
        <div>
          <label className="text-[10px] uppercase text-[#526174] block mb-1 font-bold">Health Status</label>
          <select
            value={filters.status}
            onChange={(e) =>
              onFilterChange({ ...filters, status: e.target.value as FilterState['status'] })
            }
            className="w-full rounded-lg border border-[#D8E5F0] bg-[#F8FBFF] px-2 py-1.5 text-xs text-[#172033] focus:border-[#2563EB] focus:outline-hidden"
          >
            <option value="ALL">All States</option>
            <option value="HEALTHY">Healthy</option>
            <option value="WARNING">Warning</option>
            <option value="CRITICAL">Critical</option>
          </select>
        </div>

        {/* Region */}
        <div>
          <label className="text-[10px] uppercase text-[#526174] block mb-1 font-bold">Region</label>
          <select
            value={filters.region}
            onChange={(e) => onFilterChange({ ...filters, region: e.target.value as FilterState['region'] })}
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

        {/* Failure Mode */}
        <div>
          <label className="text-[10px] uppercase text-[#526174] block mb-1 font-bold">Anomaly Type</label>
          <select
            value={filters.failure}
            onChange={(e) =>
              onFilterChange({ ...filters, failure: e.target.value as FilterState['failure'] })
            }
            className="w-full rounded-lg border border-[#D8E5F0] bg-[#F8FBFF] px-2 py-1.5 text-xs text-[#172033] focus:border-[#2563EB] focus:outline-hidden"
          >
            <option value="ALL">All Anomalies</option>
            <option value="drift">Drift</option>
            <option value="spike">Spike</option>
            <option value="flatline">Flatline</option>
            <option value="oscillation">Oscillation</option>
            <option value="sensor_swap">Sensor Swap</option>
          </select>
        </div>

        {/* Connectivity */}
        <div>
          <label className="text-[10px] uppercase text-[#526174] block mb-1 font-bold">Telemetry Status</label>
          <select
            value={filters.telemetry}
            onChange={(e) =>
              onFilterChange({ ...filters, telemetry: e.target.value as FilterState['telemetry'] })
            }
            className="w-full rounded-lg border border-[#D8E5F0] bg-[#F8FBFF] px-2 py-1.5 text-xs text-[#172033] focus:border-[#2563EB] focus:outline-hidden"
          >
            <option value="ALL">All Connectivity</option>
            <option value="ACTIVE">Active</option>
            <option value="STALE">Stale</option>
            <option value="OFFLINE">Offline</option>
          </select>
        </div>

        {/* Sort By */}
        <div>
          <label className="text-[10px] uppercase text-[#526174] block mb-1 font-bold">Sort By</label>
          <select
            value={filters.sortBy}
            onChange={(e) =>
              onFilterChange({ ...filters, sortBy: e.target.value as FilterState['sortBy'] })
            }
            className="w-full rounded-lg border border-[#D8E5F0] bg-[#F8FBFF] px-2 py-1.5 text-xs text-[#172033] focus:border-[#2563EB] focus:outline-hidden"
          >
            <option value="severity">Severity (High to Low)</option>
            <option value="recent_alert">Recent Alert</option>
            <option value="id">Device ID (Numeric)</option>
            <option value="region">Region</option>
          </select>
        </div>
      </div>

      {/* Filter Stats Counter */}
      <div className="flex items-center justify-between pt-2 text-[11px] text-[#526174]">
        <span>
          Displaying <strong className="text-[#2563EB]">{deviceCount}</strong> of{' '}
          <strong className="text-[#172033]">{totalCount}</strong> physical assets
        </span>
        {hasActiveFilters && (
          <span className="text-[#B45309] font-bold flex items-center gap-1">
            <Filter size={11} /> Filters active
          </span>
        )}
      </div>
    </div>
  );
};

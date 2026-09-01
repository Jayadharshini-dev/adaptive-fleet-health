import React, { useState, useMemo } from 'react';
import { useFleetStore } from '../../store/fleetContext';
import { DeviceCard } from './DeviceCard';
import { DeviceFilters } from './DeviceFilters';
import type { FilterState } from './DeviceFilters';
import { ServerOff, ChevronRight } from 'lucide-react';
import { StatusBadge } from '../common/StatusBadge';
import { FailureTypeBadge } from '../common/FailureTypeBadge';
import type { RegionName } from '../../types/fleet';

interface DeviceGridProps {
  initialRegion?: RegionName;
}

export const DeviceGrid: React.FC<DeviceGridProps> = ({ initialRegion }) => {
  const { devicesList, setSelectedDeviceId } = useFleetStore();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const [filters, setFilters] = useState<FilterState>({
    search: '',
    status: 'ALL',
    telemetry: 'ALL',
    region: initialRegion || 'ALL',
    failure: 'ALL',
    sortBy: 'severity',
  });

  // Apply multi-facet filtering and sorting
  const filteredDevices = useMemo(() => {
    return devicesList
      .filter((d) => {
        // Search filter
        if (filters.search) {
          const q = filters.search.toLowerCase().trim();
          const matchId = d.device_id.toLowerCase().includes(q);
          const matchInst = d.device_instance_id.toLowerCase().includes(q);
          const matchRegion = d.region.toLowerCase().includes(q);
          if (!matchId && !matchInst && !matchRegion) return false;
        }

        // Status filter
        if (filters.status !== 'ALL' && d.status !== filters.status) {
          return false;
        }

        // Telemetry filter
        if (filters.telemetry !== 'ALL' && d.telemetry_status !== filters.telemetry) {
          return false;
        }

        // Region filter
        if (filters.region !== 'ALL' && d.region !== filters.region) {
          return false;
        }

        // Failure mode filter
        if (filters.failure !== 'ALL') {
          if (d.anomaly_type !== filters.failure) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (filters.sortBy === 'severity') {
          if (b.severity !== a.severity) {
            return b.severity - a.severity;
          }
          const rank = { CRITICAL: 0, WARNING: 1, HEALTHY: 2 };
          return rank[a.status] - rank[b.status];
        }
        if (filters.sortBy === 'recent_alert') {
          return new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime();
        }
        if (filters.sortBy === 'id') {
          return a.device_id.localeCompare(b.device_id, undefined, { numeric: true });
        }
        if (filters.sortBy === 'region') {
          return a.region.localeCompare(b.region);
        }
        return 0;
      });
  }, [devicesList, filters]);

  return (
    <div className="space-y-4 font-mono">
      {/* Search & Filters */}
      <DeviceFilters
        filters={filters}
        onFilterChange={setFilters}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        deviceCount={filteredDevices.length}
        totalCount={devicesList.length}
      />

      {/* Grid or List Layout */}
      {filteredDevices.length === 0 ? (
        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-12 text-center">
          <ServerOff className="mx-auto h-12 w-12 text-slate-600 mb-3" />
          <h3 className="text-sm font-bold text-slate-300 uppercase">
            No matching devices found
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto font-sans">
            Try adjusting your search query or reset filters to inspect all 50 physical assets.
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filteredDevices.map((device) => (
            <DeviceCard
              key={device.device_id}
              device={device}
              onSelect={setSelectedDeviceId}
            />
          ))}
        </div>
      ) : (
        /* Polished compact table / list mode matching Section 6 */
        <div className="rounded-lg border border-slate-800 bg-slate-950/80 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/80 text-[11px] text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Device</th>
                  <th className="py-3 px-3">Region</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Primary Anomaly</th>
                  <th className="py-3 px-3">Severity</th>
                  <th className="py-3 px-3">Telemetry (T / V / I / RPM)</th>
                  <th className="py-3 px-3">Last Updated</th>
                  <th className="py-3 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {filteredDevices.map((device) => {
                  const r = device.latest_reading;
                  return (
                    <tr
                      key={device.device_id}
                      onClick={() => setSelectedDeviceId(device.device_id)}
                      className="hover:bg-slate-900/60 transition-colors cursor-pointer group"
                    >
                      <td className="py-2.5 px-4 font-bold text-cyan-400 flex items-center gap-2">
                        <span>{device.device_id}</span>
                        <span className="text-[10px] text-slate-500 font-normal">
                          {device.device_instance_id}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-300">{device.region}</td>
                      <td className="py-2.5 px-3">
                        <StatusBadge status={device.status} size="sm" />
                      </td>
                      <td className="py-2.5 px-3">
                        {device.anomaly_type !== 'none' ? (
                          <FailureTypeBadge type={device.anomaly_type} confidence={device.confidence} size="sm" />
                        ) : (
                          <span className="text-slate-500 text-[11px]">Nominal</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-semibold">
                        {device.severity > 0 ? (
                          <span className="text-rose-400">{device.severity}%</span>
                        ) : (
                          <span className="text-slate-500">0%</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">
                        <span className="text-rose-300">{r.temperature}°C</span> /{' '}
                        <span className="text-purple-300">{r.vibration}</span> /{' '}
                        <span className="text-amber-300">{r.current}A</span> /{' '}
                        <span className="text-cyan-300">{Math.round(r.rpm)}</span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                        {new Date(device.last_updated).toLocaleTimeString()}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <span className="inline-flex items-center text-cyan-400 group-hover:translate-x-0.5 transition-transform text-[11px]">
                          Inspect <ChevronRight size={12} />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

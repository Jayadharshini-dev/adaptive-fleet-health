import React, { useState, useMemo } from 'react';
import { useFleetStore } from '../../store/fleetContext';
import { DeviceCard } from './DeviceCard';
import { DeviceFilters } from './DeviceFilters';
import type { FilterState } from './DeviceFilters';
import { ServerOff, ChevronRight } from 'lucide-react';
import { StatusBadge } from '../common/StatusBadge';
import { FailureTypeBadge } from '../common/FailureTypeBadge';
import type { RegionName } from '../../types/fleet';
import { formatSeverity, formatTimestamp, formatMetricValue } from '../../utils/formatters';

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

  const filteredDevices = useMemo(() => {
    return devicesList
      .filter((d) => {
        if (filters.search) {
          const q = filters.search.toLowerCase().trim();
          const matchId = d.device_id.toLowerCase().includes(q);
          const matchInst = d.device_instance_id.toLowerCase().includes(q);
          const matchRegion = d.region.toLowerCase().includes(q);
          if (!matchId && !matchInst && !matchRegion) return false;
        }

        if (filters.status !== 'ALL' && d.status !== filters.status) {
          return false;
        }

        if (filters.telemetry !== 'ALL' && d.telemetry_status !== filters.telemetry) {
          return false;
        }

        if (filters.region !== 'ALL' && d.region !== filters.region) {
          return false;
        }

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
      <DeviceFilters
        filters={filters}
        onFilterChange={setFilters}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        deviceCount={filteredDevices.length}
        totalCount={devicesList.length}
      />

      {filteredDevices.length === 0 ? (
        <div className="rounded border border-[#E2E0D8] bg-white p-12 text-center">
          <ServerOff className="mx-auto h-10 w-10 text-[#7A838C] mb-3" />
          <h3 className="text-sm font-bold text-[#17191C] uppercase">
            No matching devices found
          </h3>
          <p className="text-xs text-[#59616A] mt-1 max-w-sm mx-auto font-sans">
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
        <div className="rounded border border-[#E2E0D8] bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#E2E0D8] bg-[#F7F6F2] text-[11px] text-[#59616A] uppercase tracking-wider">
                  <th className="py-2.5 px-4">Device</th>
                  <th className="py-2.5 px-3">Region</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Primary Anomaly</th>
                  <th className="py-2.5 px-3">Severity</th>
                  <th className="py-2.5 px-3">Telemetry (T / V / I / RPM)</th>
                  <th className="py-2.5 px-3">Last Updated</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E0D8]">
                {filteredDevices.map((device) => {
                  const r = device.latest_reading;
                  return (
                    <tr
                      key={device.device_id}
                      onClick={() => setSelectedDeviceId(device.device_id)}
                      className="hover:bg-[#F0EEE6] transition-colors cursor-pointer group"
                    >
                      <td className="py-2.5 px-4 font-bold text-[#17191C] flex items-center gap-2">
                        <span>{device.device_id}</span>
                        <span className="text-[10px] text-[#7A838C] font-normal">
                          {device.device_instance_id}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-[#59616A]">{device.region}</td>
                      <td className="py-2.5 px-3">
                        <StatusBadge status={device.status} size="sm" />
                      </td>
                      <td className="py-2.5 px-3">
                        {device.anomaly_type !== 'none' ? (
                          <FailureTypeBadge type={device.anomaly_type} confidence={device.confidence} size="sm" />
                        ) : (
                          <span className="text-[#7A838C] text-[11px]">Nominal</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-semibold">
                        {device.severity > 0 ? (
                          <span className="text-[#dc2626]">{formatSeverity(device.severity)}</span>
                        ) : (
                          <span className="text-[#7A838C]">0%</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-[#17191C] font-mono text-[11px]">
                        <span>{formatMetricValue('temperature', r?.temperature)}</span> /{' '}
                        <span>{formatMetricValue('vibration', r?.vibration)}</span> /{' '}
                        <span>{formatMetricValue('current', r?.current)}</span> /{' '}
                        <span>{formatMetricValue('rpm', r?.rpm)}</span>
                      </td>
                      <td className="py-2.5 px-3 text-[#7A838C] text-[11px]">
                        {formatTimestamp(device.last_updated)}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <span className="inline-flex items-center text-[#c2410c] group-hover:translate-x-0.5 transition-transform text-[11px] font-bold">
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

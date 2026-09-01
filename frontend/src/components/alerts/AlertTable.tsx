import React, { useState, useMemo } from 'react';
import { useFleetStore } from '../../store/fleetContext';
import { StatusBadge } from '../common/StatusBadge';
import { FailureTypeBadge } from '../common/FailureTypeBadge';
import { AlertFilters } from './AlertFilters';
import type { AlertFilterState } from './AlertFilters';
import { Clock, MapPin, ShieldCheck, CheckCircle2, ChevronRight } from 'lucide-react';

export const AlertTable: React.FC = () => {
  const { alerts, setSelectedAlert } = useFleetStore();

  const [filters, setFilters] = useState<AlertFilterState>({
    search: '',
    severity: 'ALL',
    failureType: 'ALL',
    region: 'ALL',
    lifecycle: 'ALL',
    source: 'ALL',
  });

  const filteredAlerts = useMemo(() => {
    return alerts.filter((alt) => {
      if (filters.search) {
        const q = filters.search.toLowerCase().trim();
        if (!alt.device_id.toLowerCase().includes(q) && !alt.region.toLowerCase().includes(q)) {
          return false;
        }
      }

      if (filters.severity !== 'ALL' && alt.status !== filters.severity) {
        return false;
      }

      if (filters.failureType !== 'ALL' && alt.anomaly_type !== filters.failureType) {
        return false;
      }

      if (filters.region !== 'ALL' && alt.region !== filters.region) {
        return false;
      }

      if (filters.lifecycle !== 'ALL' && alt.lifecycle_status !== filters.lifecycle) {
        return false;
      }

      if (filters.source !== 'ALL' && alt.source !== filters.source) {
        return false;
      }

      return true;
    });
  }, [alerts, filters]);

  return (
    <div className="space-y-4 font-mono">
      {/* Filtering Bar */}
      <AlertFilters
        filters={filters}
        onFilterChange={setFilters}
        filteredCount={filteredAlerts.length}
        totalCount={alerts.length}
      />

      {/* Events Table */}
      <div className="cool-panel rounded-xl overflow-hidden border border-[#D8E5F0] bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#F8FBFF] text-[11px] uppercase tracking-wider text-[#526174] border-b border-[#D8E5F0]">
              <tr>
                <th className="px-4 py-3 font-bold">Lifecycle</th>
                <th className="px-4 py-3 font-bold">Device ID</th>
                <th className="px-4 py-3 font-bold">Region</th>
                <th className="px-4 py-3 font-bold">Anomaly Type</th>
                <th className="px-4 py-3 font-bold">Severity</th>
                <th className="px-4 py-3 font-bold">Confidence</th>
                <th className="px-4 py-3 font-bold">Detected At</th>
                <th className="px-4 py-3 font-bold">Source</th>
                <th className="px-4 py-3 text-right font-bold">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D8E5F0]">
              {filteredAlerts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-[#526174]">
                    <ShieldCheck className="mx-auto h-8 w-8 text-[#22C55E] mb-2" />
                    <span>No incidents matching the selected filter criteria.</span>
                  </td>
                </tr>
              ) : (
                filteredAlerts.map((alt) => {
                  const isResolved = alt.lifecycle_status === 'RESOLVED';

                  return (
                    <tr
                      key={alt.id}
                      onClick={() => setSelectedAlert(alt)}
                      className={`hover:bg-[#F8FBFF] cursor-pointer transition-colors group ${
                        isResolved ? 'opacity-65' : ''
                      }`}
                    >
                      {/* Lifecycle Status */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {isResolved ? (
                          <span className="inline-flex items-center gap-1 rounded bg-[#F1F5F9] px-2 py-0.5 text-[10px] font-bold text-[#64748B] border border-[#E2E8F0]">
                            <CheckCircle2 size={10} className="text-[#64748B]" />
                            RESOLVED
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded bg-[#FEF2F2] border border-[#FECACA] px-2 py-0.5 text-[10px] font-bold text-[#B91C1C]">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#EF4444] animate-ping" />
                            ACTIVE
                          </span>
                        )}
                      </td>

                      {/* Device */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="font-bold text-[#2563EB] group-hover:text-[#1D4ED8]">
                          {alt.device_id}
                        </span>
                        <span className="text-[10px] text-[#8494A7] block">
                          {alt.device_instance_id}
                        </span>
                      </td>

                      {/* Region */}
                      <td className="px-4 py-3.5 text-[#526174] whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <MapPin size={11} className="text-[#8494A7]" />
                          <span>{alt.region}</span>
                        </div>
                      </td>

                      {/* Anomaly Type & Health Status */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <StatusBadge status={alt.status} size="sm" />
                          <FailureTypeBadge type={alt.anomaly_type} showConfidence={false} size="sm" />
                        </div>
                      </td>

                      {/* Severity */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-12 rounded-full bg-[#EEF7FF] border border-[#D8E5F0] overflow-hidden">
                            <div
                              className="h-full bg-[#EF4444]"
                              style={{ width: `${alt.severity}%` }}
                            />
                          </div>
                          <span className="font-bold text-[#172033]">{alt.severity}%</span>
                        </div>
                      </td>

                      {/* Confidence */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-[#526174]">
                        {alt.confidence ? `${Math.round(alt.confidence * 100)}%` : '--'}
                      </td>

                      {/* Detected At */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-[#526174]">
                        <div className="flex items-center gap-1">
                          <Clock size={11} className="text-[#8494A7]" />
                          <span>{alt.timestamp}</span>
                        </div>
                      </td>

                      {/* Source */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          alt.source === 'MANUAL'
                            ? 'bg-[#FAF5FF] text-[#7C3AED] border border-[#E9D5FF]'
                            : 'bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]'
                        }`}>
                          {alt.source || 'STREAM'}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 text-[#2563EB] group-hover:text-[#1D4ED8] font-bold">
                          <span>Inspect</span>
                          <ChevronRight size={12} />
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

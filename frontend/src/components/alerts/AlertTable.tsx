import React, { useState, useMemo } from 'react';
import { useFleetStore } from '../../store/fleetContext';
import { StatusBadge } from '../common/StatusBadge';
import { FailureTypeBadge } from '../common/FailureTypeBadge';
import { AlertFilters } from './AlertFilters';
import type { AlertFilterState } from './AlertFilters';
import type { Alert } from '../../types/fleet';
import { Clock, MapPin, ShieldCheck, CheckCircle2, UserCheck, ChevronRight, Activity, Zap } from 'lucide-react';
import { formatConfidence, formatSeverity, formatTimestamp } from '../../utils/formatters';

interface AlertTableProps {
  alertList?: Alert[];
}

export const AlertTable: React.FC<AlertTableProps> = ({ alertList }) => {
  const { alerts: storeAlerts, setSelectedAlert, acknowledgeAlert, resolveAlert } = useFleetStore();
  const sourceAlerts = alertList || storeAlerts;

  const [filters, setFilters] = useState<AlertFilterState>({
    search: '',
    severity: 'ALL',
    failureType: 'ALL',
    region: 'ALL',
    lifecycle: 'ALL',
    source: 'ALL',
  });

  const filteredAlerts = useMemo(() => {
    return sourceAlerts.filter((alt) => {
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
  }, [sourceAlerts, filters]);

  return (
    <div className="space-y-4 font-mono">
      <AlertFilters
        filters={filters}
        onFilterChange={setFilters}
        filteredCount={filteredAlerts.length}
        totalCount={sourceAlerts.length}
      />

      <div className="rounded border border-[#E2E0D8] bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#F7F6F2] text-[11px] uppercase tracking-wider text-[#59616A] border-b border-[#E2E0D8]">
              <tr>
                <th className="px-4 py-3 font-bold">Category</th>
                <th className="px-4 py-3 font-bold">Lifecycle State & Action</th>
                <th className="px-4 py-3 font-bold">Device ID</th>
                <th className="px-4 py-3 font-bold">Region</th>
                <th className="px-4 py-3 font-bold">Anomaly Type</th>
                <th className="px-4 py-3 font-bold">Severity</th>
                <th className="px-4 py-3 font-bold">Confidence</th>
                <th className="px-4 py-3 font-bold">Timestamp</th>
                <th className="px-4 py-3 text-right font-bold">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E0D8]">
              {filteredAlerts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-[#59616A]">
                    <ShieldCheck className="mx-auto h-8 w-8 text-[#16a34a] mb-2" />
                    <span>No operational incidents in this log view.</span>
                  </td>
                </tr>
              ) : (
                filteredAlerts.map((alt) => {
                  const isResolved = alt.lifecycle_status === 'RESOLVED';
                  const isAck = alt.lifecycle_status === 'ACKNOWLEDGED';
                  const isTransient = alt.id.startsWith('TRANS-') || alt.lifecycle_status === 'RESOLVED' && alt.resolution_reason?.includes('Transient');

                  return (
                    <tr
                      key={alt.id}
                      onClick={() => setSelectedAlert(alt)}
                      className={`hover:bg-[#F0EEE6] cursor-pointer transition-colors group ${
                        isResolved ? 'opacity-70' : ''
                      }`}
                    >
                      {/* Category Badge (PERSISTENT INCIDENT vs TRANSIENT EVENT) */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {isTransient ? (
                          <span className="inline-flex items-center gap-1 rounded bg-[#F7F6F2] border border-[#E2E0D8] px-2 py-0.5 text-[10px] font-bold text-[#59616A]">
                            <Zap size={10} className="text-[#59616A]" />
                            TRANSIENT EVENT
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded bg-[#FFF7ED] border border-[#ffedd5] px-2 py-0.5 text-[10px] font-bold text-[#c2410c]">
                            <Activity size={10} className="text-[#c2410c]" />
                            PERSISTENT INCIDENT
                          </span>
                        )}
                      </td>

                      {/* Lifecycle Status + Action Controls */}
                      <td className="px-4 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        {alt.lifecycle_status === 'ACTIVE' && (
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 rounded bg-[#fee2e2] border border-[#fca5a5] px-2 py-0.5 text-[10px] font-bold text-[#dc2626]">
                              <span className="h-1.5 w-1.5 rounded-full bg-[#dc2626]" />
                              ACTIVE
                            </span>
                            <button
                              onClick={() => acknowledgeAlert(alt.id)}
                              className="rounded bg-[#d97706] hover:bg-[#b45309] text-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
                            >
                              ACKNOWLEDGE
                            </button>
                          </div>
                        )}

                        {isAck && (
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 rounded bg-[#fef3c7] border border-[#fde68a] px-2 py-0.5 text-[10px] font-bold text-[#d97706]">
                              <UserCheck size={10} />
                              ACKNOWLEDGED
                            </span>
                            <span className="text-[10px] text-[#59616A]">
                              by {alt.acknowledged_by || 'Operator'}
                            </span>
                            <button
                              onClick={() => resolveAlert(alt.id)}
                              className="rounded bg-[#16a34a] hover:bg-[#15803d] text-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
                            >
                              RESOLVE
                            </button>
                          </div>
                        )}

                        {isResolved && (
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 rounded bg-[#F0EEE6] px-2 py-0.5 text-[10px] font-bold text-[#59616A] border border-[#E2E0D8]">
                              <CheckCircle2 size={10} className="text-[#16a34a]" />
                              RESOLVED
                            </span>
                            {alt.resolved_by && (
                              <span className="text-[10px] font-bold text-[#17191C]">
                                BY {alt.resolved_by.toUpperCase()}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-bold text-[#17191C] group-hover:text-[#c2410c]">
                          {alt.device_id}
                        </span>
                        <span className="text-[10px] text-[#7A838C] block">
                          {alt.device_instance_id}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-[#59616A] whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <MapPin size={11} className="text-[#7A838C]" />
                          <span>{alt.region}</span>
                        </div>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <StatusBadge status={alt.status} size="sm" />
                          <FailureTypeBadge type={alt.anomaly_type} showConfidence={false} size="sm" />
                        </div>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-bold text-[#dc2626]">{formatSeverity(alt.severity)}</span>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap text-[#59616A]">
                        {formatConfidence(alt.confidence)}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap text-[#59616A]">
                        <div className="flex items-center gap-1">
                          <Clock size={11} className="text-[#7A838C]" />
                          <span>{formatTimestamp(alt.timestamp)}</span>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 text-[#c2410c] group-hover:underline font-bold">
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

import React from 'react';
import type { RegionalConflict } from '../../types/fleet';
import { useFleetStore } from '../../store/fleetContext';
import { StatusBadge } from '../common/StatusBadge';
import { AlertTriangle, Clock, Users } from 'lucide-react';
import { formatTimestamp, formatMetricValue } from '../../utils/formatters';

interface ConflictCardProps {
  conflict: RegionalConflict;
}

export const ConflictCard: React.FC<ConflictCardProps> = ({ conflict }) => {
  const { devicesById, setSelectedDeviceId } = useFleetStore();

  return (
    <div className="rounded border border-[#fde68a] bg-[#fef3c7]/40 p-5 space-y-4 font-mono">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E2E0D8] pb-3">
        <div className="flex items-start gap-3">
          <div className="rounded bg-[#fde68a] p-2 text-[#d97706] shrink-0">
            <AlertTriangle size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-widest text-[#d97706]">
                REGIONAL CONFLICT
              </span>
              <StatusBadge status={conflict.severity} size="sm" />
            </div>
            <h3 className="text-base font-bold text-[#17191C] mt-0.5">
              {conflict.region} Region
            </h3>
            <div className="flex items-center gap-3 text-xs text-[#59616A] mt-1">
              <span className="flex items-center gap-1">
                <Users size={12} className="text-[#7A838C]" />
                {conflict.affected_devices.length} devices showing correlated abnormal behavior
              </span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <Clock size={12} className="text-[#7A838C]" />
                {formatTimestamp(conflict.detected_at)}
              </span>
            </div>
          </div>
        </div>

        <span className="text-xs font-bold text-[#d97706] rounded bg-white border border-[#fde68a] px-2.5 py-1 self-start sm:self-center">
          {conflict.conflict_type || 'CORRELATED DEPARTURE'}
        </span>
      </div>

      <div className="rounded bg-white border border-[#E2E0D8] p-3.5">
        <span className="text-[11px] font-bold uppercase text-[#59616A] block mb-1">
          Explanation & Cross-Device Correlation
        </span>
        <p className="text-xs text-[#17191C] font-sans leading-relaxed">
          {conflict.reason}
        </p>
      </div>

      <div>
        <span className="text-xs font-bold uppercase tracking-wider text-[#59616A] block mb-2">
          Affected Devices (Click to inspect)
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {conflict.affected_devices.map((id) => {
            const dev = devicesById[id];
            return (
              <div
                key={id}
                onClick={() => setSelectedDeviceId(id)}
                className="flex items-center justify-between rounded border border-[#E2E0D8] bg-white p-3 hover:border-[#17191C] hover:bg-[#F7F6F2] cursor-pointer transition-all group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded bg-[#17191C] font-mono text-xs font-bold text-white">
                    {id.replace('DEV-', '')}
                  </div>
                  <div>
                    <span className="text-xs font-bold text-[#17191C] group-hover:text-[#c2410c] block">
                      {id}
                    </span>
                    <span className="text-[10px] text-[#59616A]">
                      T: {formatMetricValue('temperature', dev?.latest_reading?.temperature)}
                    </span>
                  </div>
                </div>
                {dev && <StatusBadge status={dev.status} size="sm" showIcon={false} />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

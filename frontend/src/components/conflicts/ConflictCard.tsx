import React from 'react';
import type { RegionalConflict } from '../../types/fleet';
import { useFleetStore } from '../../store/fleetContext';
import { StatusBadge } from '../common/StatusBadge';
import { AlertTriangle, Clock, Users } from 'lucide-react';

interface ConflictCardProps {
  conflict: RegionalConflict;
}

export const ConflictCard: React.FC<ConflictCardProps> = ({ conflict }) => {
  const { devicesById, setSelectedDeviceId } = useFleetStore();

  return (
    <div className="cool-panel rounded-xl p-5 border border-[#FDE68A] bg-[#FFFBEB]/40 space-y-4 font-mono shadow-xs">
      {/* Header matching Section 26 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#D8E5F0] pb-3">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-[#FEF3C7] border border-[#FDE68A] p-2 text-[#B45309] shrink-0">
            <AlertTriangle size={20} className="animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold uppercase tracking-wider text-[#B45309]">
                REGIONAL CONFLICT
              </span>
              <StatusBadge status={conflict.severity} size="sm" />
            </div>
            <h3 className="text-base font-bold text-[#172033] mt-0.5">
              {conflict.region} Region
            </h3>
            <div className="flex items-center gap-3 text-xs text-[#526174] mt-1">
              <span className="flex items-center gap-1">
                <Users size={12} className="text-[#8494A7]" />
                {conflict.affected_devices.length} devices showing correlated abnormal behavior
              </span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <Clock size={12} className="text-[#8494A7]" />
                {new Date(conflict.detected_at).toLocaleTimeString()}
              </span>
            </div>
          </div>
        </div>

        <span className="text-xs font-bold text-[#B45309] rounded-lg bg-white border border-[#FDE68A] px-2.5 py-1 self-start sm:self-center shadow-xs">
          {conflict.conflict_type || 'CROSS-DEVICE CORRELATION'}
        </span>
      </div>

      {/* Explanation */}
      <div className="rounded-xl bg-white border border-[#D8E5F0] p-3.5 shadow-xs">
        <span className="text-[11px] font-bold uppercase text-[#526174] block mb-1">
          Explanation & Cross-Device Mechanism
        </span>
        <p className="text-xs text-[#172033] font-sans leading-relaxed">
          {conflict.reason}
        </p>
      </div>

      {/* Affected Devices Interactive Chips */}
      <div>
        <span className="text-xs font-bold uppercase tracking-wider text-[#526174] block mb-2">
          Affected Devices (Click to inspect)
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {conflict.affected_devices.map((id) => {
            const dev = devicesById[id];
            return (
              <div
                key={id}
                onClick={() => setSelectedDeviceId(id)}
                className="flex items-center justify-between rounded-xl border border-[#D8E5F0] bg-white p-3 hover:border-[#2563EB] hover:bg-[#F8FBFF] cursor-pointer transition-all group shadow-xs"
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EFF6FF] border border-[#BFDBFE] font-mono text-xs font-bold text-[#2563EB]">
                    {id.replace('DEV-', '')}
                  </div>
                  <div>
                    <span className="text-xs font-bold text-[#172033] group-hover:text-[#2563EB] block">
                      {id}
                    </span>
                    <span className="text-[11px] text-[#526174]">
                      T: {dev?.latest_reading?.temperature ?? '--'}°C · Vib: {dev?.latest_reading?.vibration ?? '--'}
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

import React from 'react';
import { useFleetStore } from '../../store/fleetContext';
import { AlertTriangle, ArrowRight, Server } from 'lucide-react';
import { Link } from 'react-router-dom';

export const RegionalConflictBanner: React.FC = () => {
  const { conflicts, setSelectedDeviceId } = useFleetStore();

  if (conflicts.length === 0) return null;

  const topConflict = conflicts[0];

  return (
    <div className="rounded-xl border border-[#FDE68A] bg-white p-4 shadow-xs">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="rounded-xl bg-[#FFFBEB] border border-[#FDE68A] p-2.5 text-[#D97706] shrink-0 mt-0.5">
            <AlertTriangle size={20} className="animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#B45309]">
                Active Cross-Device Regional Conflict
              </span>
              <span className="rounded bg-[#FEF3C7] px-2 py-0.5 font-mono text-[10px] font-bold text-[#92400E] border border-[#FCD34D]">
                {topConflict.region.toUpperCase()}
              </span>
            </div>
            <p className="text-xs text-[#526174] mt-1 max-w-3xl font-sans">
              {topConflict.reason}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span className="font-mono text-[11px] text-[#8494A7]">Affected devices:</span>
              <div className="flex flex-wrap gap-1.5">
                {topConflict.affected_devices.map((id) => (
                  <button
                    key={id}
                    onClick={() => setSelectedDeviceId(id)}
                    className="inline-flex items-center gap-1 rounded bg-[#FFFBEB] border border-[#FDE68A] px-2 py-0.5 font-mono text-xs font-bold text-[#B45309] hover:bg-[#FEF3C7] transition-colors cursor-pointer"
                  >
                    <Server size={11} />
                    <span>{id}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <Link
          to="/conflicts"
          className="flex items-center justify-center gap-2 rounded-lg bg-[#F59E0B] text-white px-4 py-2 text-xs font-mono font-bold hover:bg-[#D97706] transition-all shrink-0 cursor-pointer shadow-xs"
        >
          <span>Conflict Center</span>
          <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
};

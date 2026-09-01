import React from 'react';
import { useFleetStore } from '../store/fleetContext';
import { ConflictCard } from '../components/conflicts/ConflictCard';
import { AlertTriangle, ShieldCheck } from 'lucide-react';

export const ConflictsPage: React.FC = () => {
  const { conflicts } = useFleetStore();

  return (
    <div className="space-y-6 font-mono">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#D8E5F0] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="text-[#F59E0B]" size={20} />
            <h2 className="text-base font-bold uppercase tracking-wider text-[#172033]">
              Regional Cross-Device Conflicts
            </h2>
          </div>
          <p className="text-xs text-[#526174] mt-1 font-sans">
            Architected visualization for backend detection of multi-device correlated departures within common geographic zones.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-[#526174] bg-white px-3 py-1.5 rounded-lg border border-[#D8E5F0] self-start sm:self-auto shadow-xs">
          <span>Passive Receiver: Algorithmic detection decoupled on server</span>
        </div>
      </div>

      {/* Conflicts List */}
      {conflicts.length === 0 ? (
        <div className="cool-panel rounded-xl p-12 text-center border border-[#D8E5F0] bg-white shadow-xs">
          <ShieldCheck className="mx-auto h-12 w-12 text-[#22C55E] mb-3" />
          <h3 className="text-sm font-bold text-[#172033] uppercase">
            No Active Cross-Device Conflicts
          </h3>
          <p className="text-xs text-[#526174] mt-1 max-w-md mx-auto font-sans">
            All regional sectors exhibit nominal inter-device decorrelation. No regional conflict events received from backend engine.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {conflicts.map((conflict) => (
            <ConflictCard key={conflict.id} conflict={conflict} />
          ))}
        </div>
      )}
    </div>
  );
};

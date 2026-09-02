import React from 'react';
import { useFleetStore } from '../store/fleetContext';
import { ConflictCard } from '../components/conflicts/ConflictCard';
import { AlertTriangle, ShieldCheck } from 'lucide-react';

export const ConflictsPage: React.FC = () => {
  const { conflicts } = useFleetStore();

  return (
    <div className="space-y-6 font-mono">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E2E0D8] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="text-[#d97706]" size={18} />
            <h2 className="text-base font-bold uppercase tracking-widest text-[#17191C]">
              REGIONAL CROSS-DEVICE CONFLICTS
            </h2>
          </div>
          <p className="text-xs text-[#59616A] font-sans mt-0.5">
            Correlated multi-device anomalies flagged across shared operational sectors.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-[#59616A] bg-white px-3 py-1 rounded border border-[#E2E0D8] self-start sm:self-auto">
          <span>DYNAMIC BACKEND REGIONAL COORDINATION</span>
        </div>
      </div>

      {conflicts.length === 0 ? (
        <div className="rounded border border-[#E2E0D8] bg-white p-12 text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-[#16a34a] mb-3" />
          <h3 className="text-sm font-bold text-[#17191C] uppercase tracking-wider">
            No Active Cross-Device Conflicts
          </h3>
          <p className="text-xs text-[#59616A] mt-1 max-w-md mx-auto font-sans">
            All regional sectors exhibit nominal inter-device decorrelation. No regional conflict events detected by server.
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

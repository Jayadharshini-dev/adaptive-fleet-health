import React from 'react';
import { useFleetStore } from '../store/fleetContext';
import { DuplicateCard } from '../components/merge/DuplicateCard';
import { GitMerge, Database, ShieldCheck, Info } from 'lucide-react';

export const FleetMergePage: React.FC = () => {
  const { duplicates } = useFleetStore();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <GitMerge className="text-cyan-400" size={20} />
            <h2 className="font-mono text-base font-bold uppercase tracking-wider text-slate-100">
              Fleet Merge & Duplicate ID Resolution Studio
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Reconciliation of overlapping device identities when two distinct fleets merge without telemetry loss
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs text-slate-300 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 self-start sm:self-auto">
          <Database size={14} className="text-cyan-400" />
          <span>Multi-Fleet Identity Preservation</span>
        </div>
      </div>

      {/* Concept Architecture Card */}
      <div className="rounded-lg border border-cyan-500/20 bg-slate-950/60 p-4">
        <div className="flex items-start gap-3">
          <Info size={18} className="text-cyan-400 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-300 space-y-1">
            <span className="font-mono font-bold text-slate-100 uppercase block">
              Continuous Telemetry Identity Integrity Guarantee
            </span>
            <p>
              When organizational clusters merge (e.g. Alpha Fleet + Beta Fleet), overlapping hardware identifiers (like <code className="text-cyan-300 bg-slate-900 px-1 py-0.5 rounded font-mono">D01</code>) are flagged. This studio enables operations engineers to choose an authoritative resolution policy while maintaining independent baseline history and telemetry time series for both physical machines.
            </p>
          </div>
        </div>
      </div>

      {/* Duplicate Devices List */}
      {duplicates.length === 0 ? (
        <div className="industrial-panel rounded-lg p-12 text-center border-slate-800">
          <ShieldCheck className="mx-auto h-12 w-12 text-emerald-500/70 mb-3" />
          <h3 className="font-mono text-sm font-bold text-slate-200 uppercase">
            No Duplicate Identities Detected
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            All connected devices maintain unique cluster identity hashes with no merge conflicts.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {duplicates.map((dup) => (
            <DuplicateCard key={dup.duplicate_id} item={dup} />
          ))}
        </div>
      )}
    </div>
  );
};

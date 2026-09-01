import React, { useState } from 'react';
import type { DuplicateDeviceMerge } from '../../types/fleet';
import { useFleetStore } from '../../store/fleetContext';
import { GitMerge, Database, MapPin, CheckCircle2, ArrowRight } from 'lucide-react';

interface DuplicateCardProps {
  item: DuplicateDeviceMerge;
}

export const DuplicateCard: React.FC<DuplicateCardProps> = ({ item }) => {
  const { resolveDuplicate } = useFleetStore();
  const [selectedAction, setSelectedAction] = useState<'keep_both' | 'merge_linked' | 'rename_secondary'>(
    item.suggested_action
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [resolvedMessage, setResolvedMessage] = useState<string | null>(
    item.status === 'RESOLVED' ? 'Resolution policy applied.' : null
  );

  const handleResolve = async () => {
    setIsProcessing(true);
    await resolveDuplicate(item.duplicate_id, selectedAction);
    setIsProcessing(false);
    setResolvedMessage(
      `Resolved duplicate conflict for ${item.duplicate_id} using '${selectedAction}' strategy. Both historical records preserved.`
    );
  };

  return (
    <div className="industrial-panel rounded-lg p-5 border-amber-500/30 bg-slate-950/70 space-y-5">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-amber-500/20 border border-amber-500/40 p-2 text-amber-400">
            <GitMerge size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold uppercase tracking-wider text-slate-100">
                DUPLICATE DEVICE IDENTIFIER: {item.duplicate_id}
              </span>
              <span
                className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded border ${
                  item.status === 'RESOLVED'
                    ? 'bg-emerald-950/70 text-emerald-400 border-emerald-500/30'
                    : 'bg-amber-950/70 text-amber-400 border-amber-500/30'
                }`}
              >
                {item.status}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Identical device ID detected during cluster merge of Alpha Fleet and Beta Fleet.
            </p>
          </div>
        </div>

        <span className="font-mono text-xs text-slate-400 bg-slate-900 px-3 py-1 rounded border border-slate-800 self-start sm:self-center">
          Zero Data Loss Policy
        </span>
      </div>

      {/* Side-by-Side Fleet Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Fleet A Column */}
        <div className="rounded-lg border border-cyan-500/30 bg-slate-900/80 p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="font-mono text-xs font-bold text-cyan-400">
              CLUSTER A: {item.fleet_a.alias_id}
            </span>
            <span className="font-mono text-[11px] text-slate-400">
              {item.fleet_a.fleet_name}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <div className="rounded bg-slate-950/60 p-2 border border-slate-800">
              <span className="text-[10px] text-slate-500 block">Telemetry History</span>
              <span className="text-sm font-bold text-slate-100 flex items-center gap-1">
                <Database size={12} className="text-cyan-400" />
                {item.fleet_a.reading_count.toLocaleString()} readings
              </span>
            </div>
            <div className="rounded bg-slate-950/60 p-2 border border-slate-800">
              <span className="text-[10px] text-slate-500 block">Region Location</span>
              <span className="text-sm font-bold text-slate-100 flex items-center gap-1">
                <MapPin size={12} className="text-slate-400" />
                {item.fleet_a.region}
              </span>
            </div>
          </div>

          <div className="rounded bg-slate-950/70 p-2.5 border border-slate-800 font-mono text-xs space-y-1">
            <span className="text-[10px] text-slate-500 uppercase block">Learned Baseline Model</span>
            <div className="text-slate-300">
              Temp: {item.fleet_a.baseline.temperature_mean} ± {item.fleet_a.baseline.temperature_std} °C
            </div>
            <div className="text-slate-300">
              Vib: {item.fleet_a.baseline.vibration_mean} ± {item.fleet_a.baseline.vibration_std} mm/s
            </div>
          </div>
        </div>

        {/* Fleet B Column */}
        <div className="rounded-lg border border-purple-500/30 bg-slate-900/80 p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="font-mono text-xs font-bold text-purple-400">
              CLUSTER B: {item.fleet_b.alias_id}
            </span>
            <span className="font-mono text-[11px] text-slate-400">
              {item.fleet_b.fleet_name}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <div className="rounded bg-slate-950/60 p-2 border border-slate-800">
              <span className="text-[10px] text-slate-500 block">Telemetry History</span>
              <span className="text-sm font-bold text-slate-100 flex items-center gap-1">
                <Database size={12} className="text-purple-400" />
                {item.fleet_b.reading_count.toLocaleString()} readings
              </span>
            </div>
            <div className="rounded bg-slate-950/60 p-2 border border-slate-800">
              <span className="text-[10px] text-slate-500 block">Region Location</span>
              <span className="text-sm font-bold text-slate-100 flex items-center gap-1">
                <MapPin size={12} className="text-slate-400" />
                {item.fleet_b.region}
              </span>
            </div>
          </div>

          <div className="rounded bg-slate-950/70 p-2.5 border border-slate-800 font-mono text-xs space-y-1">
            <span className="text-[10px] text-slate-500 uppercase block">Learned Baseline Model</span>
            <div className="text-slate-300">
              Temp: {item.fleet_b.baseline.temperature_mean} ± {item.fleet_b.baseline.temperature_std} °C
            </div>
            <div className="text-slate-300">
              Vib: {item.fleet_b.baseline.vibration_mean} ± {item.fleet_b.baseline.vibration_std} mm/s
            </div>
          </div>
        </div>
      </div>

      {/* Resolution Controls */}
      <div className="rounded-lg bg-slate-900/90 border border-slate-800 p-4 space-y-3">
        <span className="font-mono text-xs font-bold uppercase tracking-wider text-slate-300 block">
          Resolution Strategy Selection
        </span>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 font-mono text-xs">
          <button
            onClick={() => setSelectedAction('keep_both')}
            className={`p-3 rounded-lg border text-left transition-all ${
              selectedAction === 'keep_both'
                ? 'border-cyan-500 bg-cyan-950/30 text-cyan-300'
                : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700'
            }`}
          >
            <span className="font-bold block mb-1">1. Keep Both Identities</span>
            <span className="text-[11px] text-slate-400 block font-sans">
              Assign prefix tags ({item.fleet_a.alias_id} & {item.fleet_b.alias_id}) with separate histories.
            </span>
          </button>

          <button
            onClick={() => setSelectedAction('merge_linked')}
            className={`p-3 rounded-lg border text-left transition-all ${
              selectedAction === 'merge_linked'
                ? 'border-cyan-500 bg-cyan-950/30 text-cyan-300'
                : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700'
            }`}
          >
            <span className="font-bold block mb-1">2. Merge as Linked</span>
            <span className="text-[11px] text-slate-400 block font-sans">
              Link telemetry histories into a unified chronological log under composite ID.
            </span>
          </button>

          <button
            onClick={() => setSelectedAction('rename_secondary')}
            className={`p-3 rounded-lg border text-left transition-all ${
              selectedAction === 'rename_secondary'
                ? 'border-cyan-500 bg-cyan-950/30 text-cyan-300'
                : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700'
            }`}
          >
            <span className="font-bold block mb-1">3. Rename Secondary</span>
            <span className="text-[11px] text-slate-400 block font-sans">
              Preserve primary {item.duplicate_id} and remap acquired unit to next available ID.
            </span>
          </button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
          {resolvedMessage ? (
            <span className="font-mono text-xs text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 size={14} />
              {resolvedMessage}
            </span>
          ) : (
            <span className="font-mono text-xs text-slate-400">
              Ready to apply conflict resolution policy.
            </span>
          )}

          <button
            onClick={handleResolve}
            disabled={isProcessing}
            className="flex items-center justify-center gap-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 px-4 py-2 font-mono text-xs font-bold text-white transition-colors disabled:opacity-50"
          >
            <span>{isProcessing ? 'Applying Policy...' : 'Commit Merge Resolution'}</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

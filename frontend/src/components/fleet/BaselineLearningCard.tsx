import React from 'react';
import type { AdaptiveBaseline } from '../../types/fleet';
import { BrainCircuit, Clock } from 'lucide-react';

interface BaselineLearningCardProps {
  baseline: AdaptiveBaseline;
}

export const BaselineLearningCard: React.FC<BaselineLearningCardProps> = ({ baseline }) => {
  const isMature = baseline.is_mature;
  const observations = baseline.observations ?? (isMature ? 50 : 8);
  const maxObs = baseline.max_observations ?? 15;
  const progressPct = Math.min(100, Math.round((observations / maxObs) * 100));

  return (
    <div className={`rounded-xl border p-4 font-mono shadow-xs ${isMature ? 'border-[#BBF7D0] bg-[#F0FDF4]' : 'border-[#FDE68A] bg-[#FFFBEB]'}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <BrainCircuit size={16} className={isMature ? 'text-[#15803D]' : 'text-[#B45309]'} />
          <span className="text-xs font-bold tracking-wider uppercase text-[#172033]">
            {isMature ? 'BASELINE MATURE' : 'BASELINE LEARNING'}
          </span>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${isMature ? 'bg-white border-[#BBF7D0] text-[#15803D]' : 'bg-white border-[#FDE68A] text-[#B45309]'}`}>
          {isMature ? 'MATURE' : 'TRAINING IN PROGRESS'}
        </span>
      </div>

      <p className="text-[11px] text-[#526174] font-sans mb-2.5 leading-relaxed">
        {isMature
          ? 'Statistical health envelope established from continuous telemetry. Anomaly detectors active against individual device baseline.'
          : 'Device is actively learning its unique operating envelope. Baseline sensitivity automatically calibrated once observation threshold is reached.'}
      </p>

      {/* Observation count */}
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className="text-[#526174] flex items-center gap-1">
          <Clock size={12} className="text-[#8494A7]" />
          Observations:
        </span>
        <span className="font-bold text-[#172033]">
          {observations} {isMature ? 'samples' : `/ ${maxObs}`}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="h-2 w-full rounded-full bg-white overflow-hidden border border-[#D8E5F0]">
        <div
          className={`h-full transition-all duration-500 rounded-full ${isMature ? 'bg-[#22C55E]' : 'bg-[#F59E0B]'}`}
          style={{ width: `${progressPct}%` }}
        />
      </div>
    </div>
  );
};

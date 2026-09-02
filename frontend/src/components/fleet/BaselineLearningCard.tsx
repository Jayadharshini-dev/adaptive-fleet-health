import React from 'react';
import type { AdaptiveBaseline } from '../../types/fleet';
import { BrainCircuit } from 'lucide-react';

interface BaselineLearningCardProps {
  baseline: AdaptiveBaseline;
}

export const BaselineLearningCard: React.FC<BaselineLearningCardProps> = ({ baseline }) => {
  const isMature = baseline.is_mature;
  const observations = baseline.observations ?? (isMature ? 30 : 8);

  return (
    <div className={`rounded border p-4 font-mono ${isMature ? 'border-[#bbf7d0] bg-[#f0fdf4]' : 'border-[#fde68a] bg-[#fef3c7]/50'}`}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <BrainCircuit size={16} className={isMature ? 'text-[#16a34a]' : 'text-[#d97706]'} />
          <span className="text-xs font-bold tracking-widest uppercase text-[#17191C]">
            {isMature ? 'BASELINE MATURE' : 'BASELINE LEARNING'}
          </span>
          <span className="text-xs font-bold text-[#17191C]">
            · {observations} OBSERVATIONS
          </span>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${isMature ? 'bg-white border-[#bbf7d0] text-[#16a34a]' : 'bg-white border-[#fde68a] text-[#d97706]'}`}>
          {isMature ? 'MATURE' : 'TRAINING'}
        </span>
      </div>

      <p className="text-xs text-[#59616A] font-sans leading-relaxed">
        {isMature
          ? 'Individual device statistical envelope established. Anomaly detectors active against per-device baseline.'
          : 'Device is actively learning its unique operating envelope. Baseline sensitivity automatically calibrated.'}
      </p>
    </div>
  );
};

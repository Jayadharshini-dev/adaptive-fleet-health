import React, { useState } from 'react';
import type { DetectorEvidence as EvidenceType } from '../../types/fleet';
import { Cpu, ChevronDown, ChevronUp } from 'lucide-react';

interface DetectorEvidenceProps {
  evidence?: EvidenceType | null;
  anomalyType?: string;
}

export const DetectorEvidence: React.FC<DetectorEvidenceProps> = ({
  evidence,
  anomalyType = 'none',
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  if (!evidence) {
    return (
      <div className="cool-panel rounded-xl border border-[#D8E5F0] bg-white p-4 font-mono text-xs text-[#526174] shadow-xs">
        <span className="flex items-center gap-1.5 text-[#172033] font-bold mb-1">
          <Cpu size={14} className="text-[#2563EB]" />
          DETECTION EVIDENCE
        </span>
        Operating within nominal baseline bounds. No detector triggers active.
      </div>
    );
  }

  const items: Array<{ label: string; value: string; desc: string }> = [];

  if (evidence.z_score !== undefined) {
    items.push({
      label: 'Z-SCORE',
      value: `${evidence.z_score}σ`,
      desc: 'Standard deviations from learned mean',
    });
  }

  if (evidence.trend !== undefined) {
    items.push({
      label: 'TREND',
      value: `${evidence.trend > 0 ? '+' : ''}${evidence.trend}/sample`,
      desc: 'Linear regression rate of departure',
    });
  }

  if (evidence.direction_consistency !== undefined) {
    items.push({
      label: 'DIRECTION CONSISTENCY',
      value: `${evidence.direction_consistency}%`,
      desc: 'Monotonic directional agreement',
    });
  }

  if (evidence.persistence !== undefined) {
    items.push({
      label: 'PERSISTENCE',
      value: `${evidence.persistence} observations`,
      desc: 'Consecutive samples exceeding envelope',
    });
  }

  if (evidence.variance !== undefined) {
    items.push({
      label: 'VARIANCE',
      value: `${evidence.variance}`,
      desc: 'Signal dispersion collapse indicator',
    });
  }

  if (evidence.alternation_ratio !== undefined) {
    items.push({
      label: 'ALTERNATION RATIO',
      value: `${evidence.alternation_ratio}%`,
      desc: 'Waveform phase reversal consistency',
    });
  }

  if (evidence.amplitude !== undefined) {
    items.push({
      label: 'AMPLITUDE',
      value: `±${evidence.amplitude}`,
      desc: 'Peak-to-peak excursion magnitude',
    });
  }

  if (evidence.profile_similarity !== undefined) {
    items.push({
      label: 'PROFILE SIMILARITY',
      value: `${Math.round(evidence.profile_similarity * 100)}%`,
      desc: 'Correlation with external device profile',
    });
  }

  return (
    <div className="cool-panel rounded-xl border border-[#D8E5F0] bg-white p-4 font-mono shadow-xs">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between text-xs font-bold text-[#172033] hover:text-[#2563EB] transition-colors cursor-pointer"
      >
        <span className="flex items-center gap-2">
          <Cpu size={15} className="text-[#2563EB]" />
          DETECTION EVIDENCE ({anomalyType.toUpperCase()})
        </span>
        <span className="flex items-center gap-1 text-[11px] text-[#526174] font-normal">
          {items.length} indicators
          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </button>

      {isExpanded && (
        <div className="mt-3 grid grid-cols-2 gap-2 pt-2 border-t border-[#D8E5F0] text-xs">
          {items.map((item, idx) => (
            <div
              key={idx}
              className="rounded-lg border border-[#D8E5F0] bg-[#F8FBFF] p-2.5"
            >
              <div className="text-[10px] text-[#526174] font-bold tracking-wider uppercase mb-0.5">
                {item.label}
              </div>
              <div className="text-sm font-bold text-[#2563EB] mb-0.5">
                {item.value}
              </div>
              <div className="text-[10px] text-[#526174] font-sans leading-tight">
                {item.desc}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

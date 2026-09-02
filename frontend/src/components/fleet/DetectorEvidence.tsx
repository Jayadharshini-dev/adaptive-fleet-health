import React, { useState } from 'react';
import type { DetectorEvidence as EvidenceType } from '../../types/fleet';
import { Cpu, ChevronDown, ChevronUp } from 'lucide-react';

interface DetectorEvidenceProps {
  evidence?: EvidenceType | Array<Record<string, any>> | null;
  anomalyType?: string;
}

export const DetectorEvidence: React.FC<DetectorEvidenceProps> = ({
  evidence,
  anomalyType = 'none',
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  if (!evidence) {
    return (
      <div className="rounded border border-[#E2E0D8] bg-white p-3 font-mono text-xs text-[#59616A]">
        <span className="flex items-center gap-1.5 text-[#17191C] font-bold mb-1 uppercase">
          <Cpu size={13} className="text-[#c2410c]" />
          DETECTOR EVIDENCE
        </span>
        Operating within nominal baseline bounds. No detector triggers active.
      </div>
    );
  }

  const items: Array<{ label: string; value: string; desc: string }> = [];

  if (Array.isArray(evidence)) {
    evidence.forEach((ev) => {
      if (ev.anomaly_type) {
        items.push({
          label: ev.anomaly_type.toUpperCase(),
          value: `Score: ${Math.round((ev.score || 0) * 100)}% | Conf: ${Math.round((ev.confidence || 0) * 100)}%`,
          desc: ev.metric ? `Metric: ${ev.metric}` : 'Detector evidence payload',
        });
      }
    });
  } else {
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
  }

  return (
    <div className="rounded border border-[#E2E0D8] bg-white p-3 font-mono">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between text-xs font-bold text-[#17191C] hover:text-[#c2410c] transition-colors cursor-pointer"
      >
        <span className="flex items-center gap-1.5 uppercase">
          <Cpu size={14} className="text-[#c2410c]" />
          DETECTOR EVIDENCE ({anomalyType.toUpperCase()})
        </span>
        <span className="flex items-center gap-1 text-[11px] text-[#59616A] font-normal">
          {items.length} indicators
          {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </span>
      </button>

      {isExpanded && (
        <div className="mt-3 grid grid-cols-2 gap-2 pt-2 border-t border-[#E2E0D8] text-xs">
          {items.map((item, idx) => (
            <div
              key={idx}
              className="rounded border border-[#E2E0D8] bg-[#F7F6F2] p-2"
            >
              <div className="text-[10px] text-[#59616A] font-bold tracking-wider uppercase mb-0.5">
                {item.label}
              </div>
              <div className="text-xs font-bold text-[#17191C] mb-0.5">
                {item.value}
              </div>
              <div className="text-[10px] text-[#7A838C] font-sans leading-tight">
                {item.desc}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

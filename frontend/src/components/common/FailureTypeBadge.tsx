import React from 'react';
import type { FailureMode } from '../../types/fleet';
import { TrendingUp, Zap, Minus, Activity, Shuffle } from 'lucide-react';

interface FailureTypeBadgeProps {
  type: FailureMode;
  confidence?: number;
  showConfidence?: boolean;
  size?: 'sm' | 'md';
}

export const FailureTypeBadge: React.FC<FailureTypeBadgeProps> = ({
  type,
  confidence,
  showConfidence = true,
  size = 'md',
}) => {
  if (type === 'none') return null;

  const configs: Record<
    Exclude<FailureMode, 'none'>,
    {
      label: string;
      desc: string;
      icon: React.ElementType;
      badgeColor: string;
      textColor: string;
      borderColor: string;
    }
  > = {
    drift: {
      label: 'DRIFT DETECTED',
      desc: 'Gradual deviation from baseline',
      icon: TrendingUp,
      badgeColor: 'bg-[#FFF7ED]',
      textColor: 'text-[#C2410C]',
      borderColor: 'border-[#FED7AA]',
    },
    spike: {
      label: 'SPIKE DETECTED',
      desc: 'Sudden abnormal value surge',
      icon: Zap,
      badgeColor: 'bg-[#FEF2F2]',
      textColor: 'text-[#B91C1C]',
      borderColor: 'border-[#FECACA]',
    },
    flatline: {
      label: 'FLATLINE DETECTED',
      desc: 'Telemetry signal frozen / no variance',
      icon: Minus,
      badgeColor: 'bg-[#FAF5FF]',
      textColor: 'text-[#6B21A8]',
      borderColor: 'border-[#E9D5FF]',
    },
    oscillation: {
      label: 'OSCILLATION DETECTED',
      desc: 'Repeated unstable cyclic fluctuations',
      icon: Activity,
      badgeColor: 'bg-[#FFFBEB]',
      textColor: 'text-[#B45309]',
      borderColor: 'border-[#FDE68A]',
    },
    sensor_swap: {
      label: 'SENSOR SWAP DETECTED',
      desc: 'Telemetry identity / channel mismatch',
      icon: Shuffle,
      badgeColor: 'bg-[#EFF6FF]',
      textColor: 'text-[#1D4ED8]',
      borderColor: 'border-[#BFDBFE]',
    },
  };

  const config = configs[type as Exclude<FailureMode, 'none'>] || configs.spike;
  const Icon = config.icon;

  const confidencePercent = confidence ? Math.round(confidence <= 1 ? confidence * 100 : confidence) : null;

  return (
    <div
      className={`inline-flex flex-wrap items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono shadow-xs ${config.badgeColor} ${config.borderColor} ${config.textColor}`}
      title={config.desc}
    >
      <Icon size={size === 'sm' ? 12 : 14} className="shrink-0 animate-pulse" />
      <span className="font-bold tracking-wider text-[11px]">{config.label}</span>
      {showConfidence && confidencePercent !== null && (
        <span className="rounded bg-white/90 px-1 py-0.2 text-[10px] font-bold text-[#172033] border border-[#D8E5F0]">
          {confidencePercent}% conf
        </span>
      )}
    </div>
  );
};

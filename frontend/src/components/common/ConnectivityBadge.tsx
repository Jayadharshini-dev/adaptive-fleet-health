import React from 'react';
import type { TelemetryStatus } from '../../types/fleet';
import { Radio, WifiOff, Clock } from 'lucide-react';

interface ConnectivityBadgeProps {
  status: TelemetryStatus;
  size?: 'sm' | 'md';
  showIcon?: boolean;
}

export const ConnectivityBadge: React.FC<ConnectivityBadgeProps> = ({
  status,
}) => {
  const configs = {
    ACTIVE: {
      dotBg: 'bg-cyan-400',
      dotPing: 'bg-cyan-400',
      text: 'text-cyan-300',
      border: 'border-cyan-500/20',
      bg: 'bg-cyan-950/40',
      icon: Radio,
      label: 'ACTIVE',
    },
    STALE: {
      dotBg: 'bg-amber-400',
      dotPing: 'hidden',
      text: 'text-amber-300',
      border: 'border-amber-500/20',
      bg: 'bg-amber-950/40',
      icon: Clock,
      label: 'STALE',
    },
    OFFLINE: {
      dotBg: 'bg-slate-500',
      dotPing: 'hidden',
      text: 'text-slate-400',
      border: 'border-slate-700/40',
      bg: 'bg-slate-900/60',
      icon: WifiOff,
      label: 'OFFLINE',
    },
  };

  const config = configs[status] || configs.OFFLINE;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[11px] font-medium tracking-wide ${config.bg} ${config.border} ${config.text}`}
      title={`Telemetry stream state: ${config.label}`}
    >
      <span className="relative flex h-2 w-2 items-center justify-center">
        {status === 'ACTIVE' && (
          <span
            className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${config.dotPing}`}
          />
        )}
        <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${config.dotBg}`} />
      </span>
      <span>{config.label}</span>
    </span>
  );
};

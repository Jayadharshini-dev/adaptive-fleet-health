import React from 'react';
import type { AdaptiveBaseline as BaselineType } from '../../types/fleet';
import { Sparkles, Activity, Zap, RotateCw, Thermometer, Info } from 'lucide-react';

interface AdaptiveBaselineProps {
  baseline?: BaselineType | null;
  deviceId: string;
}

export const AdaptiveBaseline: React.FC<AdaptiveBaselineProps> = ({ baseline, deviceId }) => {
  if (!baseline) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4 text-center font-mono">
        <span className="text-xs text-slate-500">
          Calculating adaptive baseline for {deviceId}...
        </span>
      </div>
    );
  }

  const metrics = [
    {
      label: 'Temperature',
      mean: baseline.temperature_mean,
      std: baseline.temperature_std,
      unit: '°C',
      icon: Thermometer,
      accent: 'text-rose-400',
      bg: 'bg-rose-500/10 border-rose-500/20',
    },
    {
      label: 'Vibration',
      mean: baseline.vibration_mean,
      std: baseline.vibration_std,
      unit: 'mm/s',
      icon: Activity,
      accent: 'text-purple-400',
      bg: 'bg-purple-500/10 border-purple-500/20',
    },
    {
      label: 'Current',
      mean: baseline.current_mean,
      std: baseline.current_std,
      unit: 'A',
      icon: Zap,
      accent: 'text-amber-400',
      bg: 'bg-amber-500/10 border-amber-500/20',
    },
    {
      label: 'RPM',
      mean: Math.round(baseline.rpm_mean),
      std: Math.round(baseline.rpm_std),
      unit: 'rpm',
      icon: RotateCw,
      accent: 'text-cyan-400',
      bg: 'bg-cyan-500/10 border-cyan-500/20',
    },
  ];

  return (
    <div className="rounded-lg border border-cyan-500/20 bg-slate-950/80 p-4 shadow-inner font-mono">
      <div className="flex items-center justify-between mb-3 border-b border-slate-800/80 pb-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-cyan-400" />
          <span className="text-xs font-bold tracking-wider text-slate-200 uppercase">
            Learned Adaptive Baseline Models
          </span>
        </div>
        <span className="rounded bg-cyan-950 px-2 py-0.5 text-[10px] font-semibold text-cyan-300 border border-cyan-500/30">
          95% CI (±2σ)
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-3">
        {metrics.map((m) => {
          const Icon = m.icon;
          return (
            <div
              key={m.label}
              className={`rounded-lg border p-2.5 ${m.bg}`}
            >
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span className="text-[11px] font-medium">{m.label}</span>
                <Icon size={13} className={m.accent} />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-base font-bold text-slate-100">{m.mean}</span>
                <span className="text-[10px] text-slate-400">± {m.std} {m.unit}</span>
              </div>
              <div className="mt-1 text-[9px] text-slate-500">
                Range: [{(m.mean - m.std * 2).toFixed(1)} – {(m.mean + m.std * 2).toFixed(1)}]
              </div>
            </div>
          );
        })}
      </div>

      {/* Critical Hackathon Principle */}
      <div className="flex items-center gap-2 rounded bg-slate-900/90 border border-slate-800 p-2 text-slate-400">
        <Info size={14} className="shrink-0 text-cyan-400" />
        <p className="text-[11px] font-sans italic text-slate-300">
          "Normal is learned per device for <span className="font-mono font-bold text-cyan-300">{deviceId}</span> without arbitrary global thresholds."
        </p>
      </div>
    </div>
  );
};

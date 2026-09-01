import React from 'react';
import { Thermometer, Activity, Zap, RotateCw, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface MetricCardProps {
  name: 'temperature' | 'vibration' | 'current' | 'rpm';
  currentValue: number;
  baselineValue: number;
  unit: string;
  std?: number;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  name,
  currentValue,
  baselineValue,
  unit,
  std = 1.0,
}) => {
  const configs = {
    temperature: {
      label: 'TEMPERATURE',
      icon: Thermometer,
      accentColor: 'text-[#EF4444]',
      borderColor: 'border-[#FECACA]',
    },
    vibration: {
      label: 'VIBRATION',
      icon: Activity,
      accentColor: 'text-[#8B5CF6]',
      borderColor: 'border-[#E9D5FF]',
    },
    current: {
      label: 'CURRENT',
      icon: Zap,
      accentColor: 'text-[#F59E0B]',
      borderColor: 'border-[#FDE68A]',
    },
    rpm: {
      label: 'RPM',
      icon: RotateCw,
      accentColor: 'text-[#2563EB]',
      borderColor: 'border-[#BFDBFE]',
    },
  };

  const config = configs[name];
  const Icon = config.icon;

  const deviation = Number((currentValue - baselineValue).toFixed(name === 'rpm' ? 0 : 2));
  const deviationSign = deviation > 0 ? `+${deviation}` : `${deviation}`;
  const isHighDeviation = Math.abs(deviation) > std * 2;

  return (
    <div
      className={`rounded-xl border bg-white p-3.5 shadow-xs transition-all ${isHighDeviation ? 'border-[#FECACA] bg-[#FEF2F2]/30' : 'border-[#D8E5F0]'}`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-[11px] font-bold tracking-wider text-[#526174] flex items-center gap-1.5">
          <Icon size={14} className={config.accentColor} />
          {config.label}
        </span>
        {isHighDeviation && (
          <span className="rounded bg-[#FEF2F2] border border-[#FECACA] px-1.5 py-0.5 text-[9px] font-mono font-bold text-[#B91C1C]">
            OUTLIER
          </span>
        )}
      </div>

      {/* Primary Value */}
      <div className="flex items-baseline gap-1.5">
        <span className="font-mono text-2xl font-bold tracking-tight text-[#172033]">
          {name === 'rpm' ? Math.round(currentValue).toLocaleString() : currentValue.toFixed(1)}
        </span>
        <span className="font-mono text-xs text-[#526174]">{unit}</span>
      </div>

      {/* Learned Baseline & Deviation */}
      <div className="mt-2.5 pt-2 border-t border-[#D8E5F0] flex items-center justify-between text-[11px] font-mono">
        <div>
          <span className="text-[#8494A7]">Baseline: </span>
          <span className="font-bold text-[#172033]">
            {name === 'rpm' ? Math.round(baselineValue).toLocaleString() : baselineValue.toFixed(1)}
            <span className="text-[10px] text-[#8494A7] ml-0.5">{unit}</span>
          </span>
        </div>

        <div className="flex items-center gap-1">
          <span className="text-[#8494A7]">Dev: </span>
          <span
            className={`font-bold flex items-center gap-0.5 ${
              deviation === 0
                ? 'text-[#526174]'
                : isHighDeviation
                ? 'text-[#B91C1C]'
                : deviation > 0
                ? 'text-[#B45309]'
                : 'text-[#2563EB]'
            }`}
          >
            {deviation > 0 ? (
              <TrendingUp size={11} />
            ) : deviation < 0 ? (
              <TrendingDown size={11} />
            ) : (
              <Minus size={11} />
            )}
            {deviationSign}
          </span>
        </div>
      </div>
    </div>
  );
};

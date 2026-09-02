import React from 'react';
import { Thermometer, Activity, Zap, RotateCw, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { formatMetricValue } from '../../utils/formatters';

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
  unit: _unit,
  std = 1.0,
}) => {
  const configs = {
    temperature: {
      label: 'TEMPERATURE',
      icon: Thermometer,
      accentColor: 'text-[#dc2626]',
    },
    vibration: {
      label: 'VIBRATION',
      icon: Activity,
      accentColor: 'text-[#c2410c]',
    },
    current: {
      label: 'CURRENT',
      icon: Zap,
      accentColor: 'text-[#d97706]',
    },
    rpm: {
      label: 'RPM',
      icon: RotateCw,
      accentColor: 'text-[#16a34a]',
    },
  };

  const config = configs[name] || configs.temperature;
  const Icon = config.icon;

  const deviation = Number((currentValue - baselineValue).toFixed(name === 'rpm' ? 0 : 2));
  const deviationSign = deviation > 0 ? `+${deviation}` : `${deviation}`;
  const isHighDeviation = Math.abs(deviation) > std * 2;

  return (
    <div
      className={`rounded border bg-white p-3 font-mono transition-all ${
        isHighDeviation ? 'border-[#fca5a5] bg-[#fee2e2]/30' : 'border-[#E2E0D8]'
      }`}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-bold tracking-wider text-[#59616A] flex items-center gap-1.5 uppercase">
          <Icon size={13} className={config.accentColor} />
          {config.label}
        </span>
        {isHighDeviation && (
          <span className="rounded bg-[#fee2e2] border border-[#fca5a5] px-1 py-0.2 text-[9px] font-bold text-[#dc2626]">
            DEPARTURE
          </span>
        )}
      </div>

      <div className="flex items-baseline gap-1">
        <span className="text-xl font-bold tracking-tight text-[#17191C]">
          {formatMetricValue(name, currentValue)}
        </span>
      </div>

      <div className="mt-2 pt-2 border-t border-[#E2E0D8] flex items-center justify-between text-[11px]">
        <div>
          <span className="text-[#7A838C]">Base: </span>
          <span className="font-bold text-[#17191C]">
            {formatMetricValue(name, baselineValue)}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <span className="text-[#7A838C]">Dev: </span>
          <span
            className={`font-bold flex items-center gap-0.5 ${
              deviation === 0
                ? 'text-[#59616A]'
                : isHighDeviation
                ? 'text-[#dc2626]'
                : deviation > 0
                ? 'text-[#d97706]'
                : 'text-[#16a34a]'
            }`}
          >
            {deviation > 0 ? (
              <TrendingUp size={10} />
            ) : deviation < 0 ? (
              <TrendingDown size={10} />
            ) : (
              <Minus size={10} />
            )}
            {deviationSign}
          </span>
        </div>
      </div>
    </div>
  );
};

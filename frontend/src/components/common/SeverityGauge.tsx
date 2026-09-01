import React from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

interface SeverityGaugeProps {
  severity: number;    // 0 - 100%
  confidence: number;  // 0 - 100%
}

export const SeverityGauge: React.FC<SeverityGaugeProps> = ({
  severity,
  confidence,
}) => {
  const sevPercent = Math.min(100, Math.max(0, Math.round(severity)));
  const confPercent = Math.min(100, Math.max(0, Math.round(confidence)));

  const getSeverityColor = (val: number) => {
    if (val >= 80) return 'bg-[#EF4444] text-[#B91C1C]';
    if (val >= 50) return 'bg-[#F59E0B] text-[#B45309]';
    return 'bg-[#22C55E] text-[#15803D]';
  };

  return (
    <div className="rounded-xl border border-[#D8E5F0] bg-[#F8FBFF] p-3.5 space-y-3 font-mono shadow-xs">
      {/* Severity */}
      <div>
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="flex items-center gap-1.5 text-[#526174] font-bold">
            <AlertCircle size={13} className="text-[#EF4444]" />
            SEVERITY
          </span>
          <span className="text-[11px] text-[#8494A7]">
            How serious abnormality is
          </span>
          <span className="font-bold text-[#172033] text-sm">
            {sevPercent}%
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-white border border-[#D8E5F0] overflow-hidden">
          <div
            className={`h-full transition-all duration-500 rounded-full ${getSeverityColor(sevPercent).split(' ')[0]}`}
            style={{ width: `${sevPercent}%` }}
          />
        </div>
      </div>

      {/* Confidence */}
      <div>
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="flex items-center gap-1.5 text-[#526174] font-bold">
            <CheckCircle2 size={13} className="text-[#2563EB]" />
            CONFIDENCE
          </span>
          <span className="text-[11px] text-[#8494A7]">
            Evidence classification strength
          </span>
          <span className="font-bold text-[#172033] text-sm">
            {confPercent}%
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-white border border-[#D8E5F0] overflow-hidden">
          <div
            className="h-full bg-[#2563EB] transition-all duration-500 rounded-full"
            style={{ width: `${confPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
};

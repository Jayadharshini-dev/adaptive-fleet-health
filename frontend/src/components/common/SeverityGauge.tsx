import React from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { formatConfidence, formatSeverity } from '../../utils/formatters';

interface SeverityGaugeProps {
  severity: number;    // 0 - 1.0 or 0 - 100%
  confidence: number;  // 0 - 1.0 or 0 - 100%
}

export const SeverityGauge: React.FC<SeverityGaugeProps> = ({
  severity,
  confidence,
}) => {
  const sevVal = severity <= 1.0 ? severity * 100 : severity;
  const confVal = confidence <= 1.0 ? confidence * 100 : confidence;
  const sevPercent = Math.min(100, Math.max(0, Math.round(sevVal)));
  const confPercent = Math.min(100, Math.max(0, Math.round(confVal)));

  const getSeverityBg = (val: number) => {
    if (val >= 70) return 'bg-[#dc2626]';
    if (val >= 35) return 'bg-[#d97706]';
    return 'bg-[#16a34a]';
  };

  return (
    <div className="rounded border border-[#E2E0D8] bg-[#F7F6F2] p-3 space-y-3 font-mono">
      {/* Severity */}
      <div>
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="flex items-center gap-1.5 text-[#59616A] font-bold">
            <AlertCircle size={13} className="text-[#dc2626]" />
            SEVERITY
          </span>
          <span className="font-bold text-[#17191C]">
            {formatSeverity(severity)}
          </span>
        </div>
        <div className="h-1.5 w-full rounded bg-[#E2E0D8] overflow-hidden">
          <div
            className={`h-full transition-all duration-500 rounded ${getSeverityBg(sevPercent)}`}
            style={{ width: `${sevPercent}%` }}
          />
        </div>
      </div>

      {/* Confidence */}
      <div>
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="flex items-center gap-1.5 text-[#59616A] font-bold">
            <CheckCircle2 size={13} className="text-[#c2410c]" />
            CONFIDENCE
          </span>
          <span className="font-bold text-[#17191C]">
            {formatConfidence(confidence)}
          </span>
        </div>
        <div className="h-1.5 w-full rounded bg-[#E2E0D8] overflow-hidden">
          <div
            className="h-full bg-[#c2410c] transition-all duration-500 rounded"
            style={{ width: `${confPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
};

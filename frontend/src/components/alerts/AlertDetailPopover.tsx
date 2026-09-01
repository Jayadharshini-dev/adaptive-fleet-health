import React from 'react';
import type { Alert } from '../../types/fleet';
import { StatusBadge } from '../common/StatusBadge';
import { FailureTypeBadge } from '../common/FailureTypeBadge';
import { SeverityGauge } from '../common/SeverityGauge';
import { X, MapPin, Clock, ArrowRight, CheckCheck, HelpCircle } from 'lucide-react';

interface AlertDetailPopoverProps {
  alert: Alert | null;
  onClose: () => void;
  onViewFullAnalysis: (deviceId: string) => void;
  onResolveAlert?: (alertId: string) => void;
}

export const AlertDetailPopover: React.FC<AlertDetailPopoverProps> = ({
  alert,
  onClose,
  onViewFullAnalysis,
  onResolveAlert,
}) => {
  if (!alert) return null;

  const {
    id,
    device_id,
    region,
    status,
    anomaly_type,
    severity,
    confidence,
    timestamp,
    explanation,
    current_metrics,
    baseline_metrics,
    lifecycle_status,
  } = alert;

  const isResolved = lifecycle_status === 'RESOLVED';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-150">
      <div
        className="h-full w-full max-w-lg bg-white border-l border-[#D8E5F0] shadow-2xl p-6 flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-200 font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-5">
          {/* Header */}
          <div className="flex items-start justify-between border-b border-[#D8E5F0] pb-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5 font-mono">
                <StatusBadge status={status} size="sm" />
                <span className="text-xs px-2 py-0.5 rounded bg-[#EEF7FF] border border-[#D8E5F0] text-[#526174]">
                  {isResolved ? 'RESOLVED' : 'ACTIVE INCIDENT'}
                </span>
                {alert.source && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${alert.source === 'MANUAL' ? 'bg-[#FAF5FF] border border-[#E9D5FF] text-[#7C3AED]' : 'bg-[#EEF7FF] text-[#526174]'}`}>
                    {alert.source}
                  </span>
                )}
              </div>

              <h2 className="font-mono text-xl font-bold text-[#172033] flex items-center gap-2">
                {device_id}
                <span className="text-sm font-normal text-[#526174]">
                  ({region} Region)
                </span>
              </h2>

              <div className="flex items-center gap-3 text-xs font-mono text-[#526174] mt-1">
                <span className="flex items-center gap-1">
                  <Clock size={12} className="text-[#8494A7]" />
                  Detected: {timestamp}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin size={12} className="text-[#8494A7]" />
                  {region}
                </span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-[#526174] hover:bg-[#EEF7FF] hover:text-[#172033] transition-colors cursor-pointer"
              title="Close panel"
            >
              <X size={18} />
            </button>
          </div>

          {/* Anomaly Badge */}
          <div className="flex items-center justify-between bg-[#F8FBFF] border border-[#D8E5F0] rounded-xl p-3 shadow-xs">
            <FailureTypeBadge type={anomaly_type} confidence={confidence} size="md" />
            <span className="font-mono text-xs font-bold text-[#172033]">
              Severity {severity}%
            </span>
          </div>

          {/* WHY WAS THIS FLAGGED? */}
          <div className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-4 shadow-xs">
            <h3 className="font-mono text-xs font-bold tracking-wider text-[#B45309] uppercase flex items-center gap-1.5 mb-2">
              <HelpCircle size={14} className="text-[#B45309]" />
              Why Was This Flagged?
            </h3>
            <p className="text-xs text-[#172033] leading-relaxed font-sans font-medium">
              {explanation}
            </p>
          </div>

          {/* KEY EVIDENCE */}
          <div>
            <h3 className="font-mono text-xs font-bold tracking-wider text-[#172033] uppercase mb-2">
              Key Evidence (Current vs Learned Baseline)
            </h3>

            <div className="grid grid-cols-2 gap-2 font-mono text-xs">
              {/* Temperature */}
              <div className="rounded-xl border border-[#D8E5F0] bg-[#F8FBFF] p-2.5 shadow-xs">
                <div className="text-[11px] text-[#526174] font-bold mb-1">Temperature</div>
                <div className="flex justify-between">
                  <span className="text-[#8494A7]">Current:</span>
                  <span className="font-bold text-[#172033]">{current_metrics?.temperature ?? '--'}°C</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8494A7]">Baseline:</span>
                  <span className="text-[#526174]">{baseline_metrics?.temperature ?? '--'}°C</span>
                </div>
              </div>

              {/* Vibration */}
              <div className="rounded-xl border border-[#D8E5F0] bg-[#F8FBFF] p-2.5 shadow-xs">
                <div className="text-[11px] text-[#526174] font-bold mb-1">Vibration</div>
                <div className="flex justify-between">
                  <span className="text-[#8494A7]">Current:</span>
                  <span className="font-bold text-[#172033]">{current_metrics?.vibration ?? '--'} mm/s</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8494A7]">Baseline:</span>
                  <span className="text-[#526174]">{baseline_metrics?.vibration ?? '--'} mm/s</span>
                </div>
              </div>

              {/* Current */}
              <div className="rounded-xl border border-[#D8E5F0] bg-[#F8FBFF] p-2.5 shadow-xs">
                <div className="text-[11px] text-[#526174] font-bold mb-1">Current</div>
                <div className="flex justify-between">
                  <span className="text-[#8494A7]">Current:</span>
                  <span className="font-bold text-[#172033]">{current_metrics?.current ?? '--'} A</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8494A7]">Baseline:</span>
                  <span className="text-[#526174]">{baseline_metrics?.current ?? '--'} A</span>
                </div>
              </div>

              {/* RPM */}
              <div className="rounded-xl border border-[#D8E5F0] bg-[#F8FBFF] p-2.5 shadow-xs">
                <div className="text-[11px] text-[#526174] font-bold mb-1">RPM</div>
                <div className="flex justify-between">
                  <span className="text-[#8494A7]">Current:</span>
                  <span className="font-bold text-[#172033]">{Math.round(current_metrics?.rpm ?? 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8494A7]">Baseline:</span>
                  <span className="text-[#526174]">{Math.round(baseline_metrics?.rpm ?? 0)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Severity + Confidence Gauges */}
          <SeverityGauge severity={severity} confidence={confidence} />
        </div>

        {/* Action Buttons */}
        <div className="pt-4 border-t border-[#D8E5F0] space-y-2 mt-6">
          <button
            onClick={() => {
              onClose();
              onViewFullAnalysis(device_id);
            }}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-white shadow-sm hover:bg-[#1D4ED8] transition-all cursor-pointer"
          >
            <span>View Full Analysis & Graphs</span>
            <ArrowRight size={14} />
          </button>

          {!isResolved && onResolveAlert && (
            <button
              onClick={() => onResolveAlert(id)}
              className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-[#D8E5F0] bg-white px-4 py-2 font-mono text-xs text-[#526174] hover:text-[#172033] hover:bg-[#F8FBFF] transition-colors cursor-pointer shadow-xs"
            >
              <CheckCheck size={14} className="text-[#22C55E]" />
              <span>Acknowledge & Mark Resolved</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

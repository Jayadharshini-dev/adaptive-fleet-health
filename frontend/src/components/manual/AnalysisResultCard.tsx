import React from 'react';
import type { HealthResult } from '../../types/fleet';
import { StatusBadge } from '../common/StatusBadge';
import { FailureTypeBadge } from '../common/FailureTypeBadge';
import { SeverityGauge } from '../common/SeverityGauge';
import { DetectorEvidence } from '../fleet/DetectorEvidence';
import { ShieldCheck, HelpCircle, ArrowRight, Layers } from 'lucide-react';

interface AnalysisResultCardProps {
  result: HealthResult | null;
  onInspectDevice?: (deviceId: string) => void;
}

export const AnalysisResultCard: React.FC<AnalysisResultCardProps> = ({
  result,
  onInspectDevice,
}) => {
  if (!result) {
    return (
      <div className="cool-panel rounded-xl border border-[#D8E5F0] bg-white p-8 text-center font-mono shadow-xs">
        <ShieldCheck className="mx-auto h-12 w-12 text-[#8494A7] mb-3" />
        <h3 className="text-sm font-bold text-[#172033] uppercase">
          Awaiting Telemetry Packet Submission
        </h3>
        <p className="text-xs text-[#526174] mt-1 max-w-md mx-auto font-sans">
          Submit single telemetry or ingest a batch feed to run Member 1’s 5-detector adaptive baseline intelligence pipeline.
        </p>
      </div>
    );
  }

  const {
    device_id,
    device_instance_id,
    region,
    status,
    anomaly_type,
    severity,
    confidence,
    explanation,
    current_metrics,
    baseline_metrics,
    detectors,
    timestamp,
    is_mature,
  } = result;

  const isHealthy = status === 'HEALTHY';

  return (
    <div className="cool-panel rounded-xl border border-[#D8E5F0] bg-white p-5 space-y-4 font-mono shadow-xs animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-[#D8E5F0] pb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-[#2563EB]">
              TELEMETRY ANALYSIS RESULT
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#FAF5FF] border border-[#E9D5FF] text-[#7C3AED] font-bold">
              MANUAL LAB
            </span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded border font-bold ${is_mature ? 'bg-[#F0FDF4] border-[#BBF7D0] text-[#15803D]' : 'bg-[#FFFBEB] border-[#FDE68A] text-[#B45309]'}`}>
              {is_mature ? 'BASELINE MATURE' : 'BASELINE LEARNING'}
            </span>
          </div>

          <h2 className="text-lg font-bold text-[#172033] flex items-center gap-2">
            {device_id}
            <span className="text-xs font-normal text-[#526174]">
              ({device_instance_id} · {region})
            </span>
          </h2>
          <span className="text-[11px] text-[#8494A7]">
            Evaluated at: {new Date(timestamp).toLocaleTimeString()}
          </span>
        </div>

        <div className="flex flex-col items-end gap-1.5">
          <StatusBadge status={status} size="md" />
          {anomaly_type !== 'none' && (
            <FailureTypeBadge type={anomaly_type} confidence={confidence} size="sm" />
          )}
        </div>
      </div>

      {/* WHY WAS THIS DETECTED? */}
      <div className={`rounded-xl border p-3.5 ${isHealthy ? 'border-[#BBF7D0] bg-[#F0FDF4]' : 'border-[#FDE68A] bg-[#FFFBEB]'}`}>
        <div className="flex items-center gap-1.5 font-bold text-xs uppercase tracking-wider mb-1 text-[#172033]">
          <HelpCircle size={14} className={isHealthy ? 'text-[#15803D]' : 'text-[#B45309]'} />
          Why?
        </div>
        <p className="text-xs text-[#172033] font-sans leading-relaxed">
          {explanation}
        </p>
      </div>

      {/* Metrics Comparison: Current vs Learned Baseline */}
      <div>
        <div className="text-xs font-bold text-[#172033] uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Layers size={13} className="text-[#2563EB]" />
          Key Metrics vs Learned Baseline
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          {/* Temp */}
          <div className="rounded-lg border border-[#D8E5F0] bg-[#F8FBFF] p-2">
            <div className="text-[10px] text-[#526174] mb-0.5">Temperature</div>
            <div className="font-bold text-[#172033]">{current_metrics.temperature}°C</div>
            <div className="text-[10px] text-[#8494A7]">Base: {baseline_metrics.temperature_mean}°C</div>
          </div>

          {/* Vib */}
          <div className="rounded-lg border border-[#D8E5F0] bg-[#F8FBFF] p-2">
            <div className="text-[10px] text-[#526174] mb-0.5">Vibration</div>
            <div className="font-bold text-[#172033]">{current_metrics.vibration} mm/s</div>
            <div className="text-[10px] text-[#8494A7]">Base: {baseline_metrics.vibration_mean} mm/s</div>
          </div>

          {/* Current */}
          <div className="rounded-lg border border-[#D8E5F0] bg-[#F8FBFF] p-2">
            <div className="text-[10px] text-[#526174] mb-0.5">Current</div>
            <div className="font-bold text-[#172033]">{current_metrics.current} A</div>
            <div className="text-[10px] text-[#8494A7]">Base: {baseline_metrics.current_mean} A</div>
          </div>

          {/* RPM */}
          <div className="rounded-lg border border-[#D8E5F0] bg-[#F8FBFF] p-2">
            <div className="text-[10px] text-[#526174] mb-0.5">RPM</div>
            <div className="font-bold text-[#172033]">{Math.round(current_metrics.rpm)}</div>
            <div className="text-[10px] text-[#8494A7]">Base: {Math.round(baseline_metrics.rpm_mean)}</div>
          </div>
        </div>
      </div>

      {/* Severity & Confidence */}
      {!isHealthy && (
        <SeverityGauge severity={severity} confidence={confidence} />
      )}

      {/* Detector Evidence */}
      {detectors && (
        <DetectorEvidence evidence={detectors} anomalyType={anomaly_type} />
      )}

      {/* Inspect in fleet link */}
      {onInspectDevice && (
        <div className="pt-2">
          <button
            onClick={() => onInspectDevice(device_id)}
            className="flex items-center gap-1 text-xs text-[#2563EB] hover:text-[#1D4ED8] font-bold transition-colors cursor-pointer"
          >
            <span>Open {device_id} Full Device Investigation & Historical Charts</span>
            <ArrowRight size={13} />
          </button>
        </div>
      )}
    </div>
  );
};

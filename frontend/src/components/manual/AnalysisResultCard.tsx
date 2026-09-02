import React from 'react';
import type { HealthResult } from '../../types/fleet';
import { StatusBadge } from '../common/StatusBadge';
import { FailureTypeBadge } from '../common/FailureTypeBadge';
import { SeverityGauge } from '../common/SeverityGauge';
import { DetectorEvidence } from '../fleet/DetectorEvidence';
import { ShieldCheck, HelpCircle, ArrowRight, Layers } from 'lucide-react';
import { formatTimestamp, formatMetricValue } from '../../utils/formatters';

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
      <div className="rounded border border-[#E2E0D8] bg-white p-8 text-center font-mono">
        <ShieldCheck className="mx-auto h-10 w-10 text-[#7A838C] mb-3" />
        <h3 className="text-sm font-bold text-[#17191C] uppercase tracking-wider">
          Awaiting Telemetry Packet Submission
        </h3>
        <p className="text-xs text-[#59616A] mt-1 max-w-md mx-auto font-sans">
          Enter telemetry metrics on the test bench to evaluate through Member 1’s 5-detector adaptive baseline intelligence pipeline.
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
    <div className="rounded border border-[#E2E0D8] bg-white p-5 space-y-4 font-mono">
      <div className="flex items-start justify-between border-b border-[#E2E0D8] pb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-[#c2410c] tracking-widest uppercase">
              SYSTEM ANALYSIS READOUT
            </span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded border font-bold ${is_mature ? 'bg-[#f0fdf4] border-[#bbf7d0] text-[#16a34a]' : 'bg-[#fef3c7] border-[#fde68a] text-[#d97706]'}`}>
              {is_mature ? 'BASELINE MATURE' : 'BASELINE WARMUP'}
            </span>
          </div>

          <h2 className="text-lg font-bold text-[#17191C] flex items-center gap-2">
            {device_id}
            <span className="text-xs font-normal text-[#59616A]">
              ({device_instance_id} · {region})
            </span>
          </h2>
          <span className="text-[11px] text-[#7A838C]">
            Evaluated at: {formatTimestamp(timestamp)}
          </span>
        </div>

        <div className="flex flex-col items-end gap-1.5">
          <StatusBadge status={status} size="md" />
          {anomaly_type !== 'none' && (
            <FailureTypeBadge type={anomaly_type} confidence={confidence} size="sm" />
          )}
        </div>
      </div>

      <div className={`rounded border p-3.5 ${isHealthy ? 'border-[#bbf7d0] bg-[#f0fdf4]' : 'border-[#fde68a] bg-[#fef3c7]/50'}`}>
        <div className="flex items-center gap-1.5 font-bold text-xs uppercase tracking-wider mb-1 text-[#17191C]">
          <HelpCircle size={14} className={isHealthy ? 'text-[#16a34a]' : 'text-[#d97706]'} />
          WHY WAS THIS FLAGGED?
        </div>
        <p className="text-xs text-[#17191C] font-sans leading-relaxed">
          {explanation}
        </p>
      </div>

      <div>
        <div className="text-xs font-bold text-[#17191C] uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Layers size={13} className="text-[#c2410c]" />
          Key Metrics vs Learned Baseline
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div className="rounded border border-[#E2E0D8] bg-[#F7F6F2] p-2">
            <div className="text-[10px] text-[#59616A] mb-0.5">Temperature</div>
            <div className="font-bold text-[#17191C]">{formatMetricValue('temperature', current_metrics.temperature)}</div>
            <div className="text-[10px] text-[#7A838C]">Base: {formatMetricValue('temperature', baseline_metrics.temperature_mean)}</div>
          </div>

          <div className="rounded border border-[#E2E0D8] bg-[#F7F6F2] p-2">
            <div className="text-[10px] text-[#59616A] mb-0.5">Vibration</div>
            <div className="font-bold text-[#17191C]">{formatMetricValue('vibration', current_metrics.vibration)}</div>
            <div className="text-[10px] text-[#7A838C]">Base: {formatMetricValue('vibration', baseline_metrics.vibration_mean)}</div>
          </div>

          <div className="rounded border border-[#E2E0D8] bg-[#F7F6F2] p-2">
            <div className="text-[10px] text-[#59616A] mb-0.5">Current</div>
            <div className="font-bold text-[#17191C]">{formatMetricValue('current', current_metrics.current)}</div>
            <div className="text-[10px] text-[#7A838C]">Base: {formatMetricValue('current', baseline_metrics.current_mean)}</div>
          </div>

          <div className="rounded border border-[#E2E0D8] bg-[#F7F6F2] p-2">
            <div className="text-[10px] text-[#59616A] mb-0.5">RPM</div>
            <div className="font-bold text-[#17191C]">{formatMetricValue('rpm', current_metrics.rpm)}</div>
            <div className="text-[10px] text-[#7A838C]">Base: {formatMetricValue('rpm', baseline_metrics.rpm_mean)}</div>
          </div>
        </div>
      </div>

      {!isHealthy && (
        <SeverityGauge severity={severity} confidence={confidence} />
      )}

      {detectors && (
        <DetectorEvidence evidence={detectors} anomalyType={anomaly_type} />
      )}

      {onInspectDevice && (
        <div className="pt-2">
          <button
            onClick={() => onInspectDevice(device_id)}
            className="flex items-center gap-1 text-xs text-[#c2410c] hover:underline font-bold transition-colors cursor-pointer"
          >
            <span>Open {device_id} Full Device Investigation & Historical Charts</span>
            <ArrowRight size={13} />
          </button>
        </div>
      )}
    </div>
  );
};

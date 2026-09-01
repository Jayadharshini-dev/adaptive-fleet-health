import React from 'react';
import type { RegionSummary, RegionName } from '../../types/fleet';
import { MapPin, ShieldCheck, AlertTriangle, AlertOctagon, BellRing, ArrowRight } from 'lucide-react';

interface RegionCardProps {
  regionName: RegionName;
  summary: RegionSummary;
  isSelected?: boolean;
  onSelect?: (regionName: RegionName) => void;
}

export const RegionCard: React.FC<RegionCardProps> = ({
  regionName,
  summary,
  isSelected = false,
  onSelect,
}) => {
  const healthyPct =
    summary.total_devices > 0
      ? Math.round((summary.healthy / summary.total_devices) * 100)
      : 100;

  const hasIssues = summary.critical > 0 || summary.warning > 0;

  return (
    <div
      onClick={() => onSelect && onSelect(regionName)}
      className={`cool-panel rounded-xl p-5 cursor-pointer transition-all border font-mono bg-white hover:border-[#BFDBFE] shadow-xs ${
        isSelected
          ? 'border-[#2563EB] bg-[#F8FBFF] ring-2 ring-[#2563EB]/20'
          : summary.critical > 0
          ? 'border-[#FECACA]'
          : summary.warning > 0
          ? 'border-[#FDE68A]'
          : 'border-[#D8E5F0]'
      }`}
    >
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-[#D8E5F0] pb-3 mb-3">
        <div className="flex items-center gap-2.5">
          <div
            className={`rounded-lg p-2 ${
              summary.critical > 0
                ? 'bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA]'
                : summary.warning > 0
                ? 'bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A]'
                : 'bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]'
            }`}
          >
            <MapPin size={16} />
          </div>
          <div>
            <h3 className="text-base font-bold tracking-wider text-[#172033] uppercase">
              {regionName} Region
            </h3>
            <span className="text-[11px] text-[#526174]">
              {summary.total_devices} Monitored Devices
            </span>
          </div>
        </div>

        {/* Health Score Pill */}
        <span
          className={`text-xs font-bold px-2.5 py-1 rounded border shadow-xs ${
            healthyPct === 100
              ? 'bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0]'
              : healthyPct >= 80
              ? 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]'
              : 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]'
          }`}
        >
          {healthyPct}% HEALTHY
        </span>
      </div>

      {/* Breakdown Metrics */}
      <div className="grid grid-cols-4 gap-2 my-3 text-xs">
        <div className="rounded-lg bg-[#EEF7FF] p-2 border border-[#D8E5F0] text-center">
          <div className="flex items-center justify-center gap-1 text-[10px] text-[#15803D] mb-0.5 font-bold">
            <ShieldCheck size={11} />
            <span>Healthy</span>
          </div>
          <span className="text-base font-bold text-[#172033]">{summary.healthy}</span>
        </div>

        <div className="rounded-lg bg-[#EEF7FF] p-2 border border-[#D8E5F0] text-center">
          <div className="flex items-center justify-center gap-1 text-[10px] text-[#B45309] mb-0.5 font-bold">
            <AlertTriangle size={11} />
            <span>Warning</span>
          </div>
          <span className="text-base font-bold text-[#172033]">{summary.warning}</span>
        </div>

        <div className="rounded-lg bg-[#EEF7FF] p-2 border border-[#D8E5F0] text-center">
          <div className="flex items-center justify-center gap-1 text-[10px] text-[#B91C1C] mb-0.5 font-bold">
            <AlertOctagon size={11} />
            <span>Critical</span>
          </div>
          <span className="text-base font-bold text-[#172033]">{summary.critical}</span>
        </div>

        <div className="rounded-lg bg-[#EEF7FF] p-2 border border-[#D8E5F0] text-center">
          <div className="flex items-center justify-center gap-1 text-[10px] text-[#B91C1C] mb-0.5 font-bold">
            <BellRing size={11} />
            <span>Alerts</span>
          </div>
          <span className="text-base font-bold text-[#172033]">{summary.active_alerts}</span>
        </div>
      </div>

      {/* Distribution Bar */}
      <div className="space-y-1 my-3">
        <div className="flex h-2 w-full overflow-hidden rounded-full bg-[#EEF7FF] border border-[#D8E5F0]">
          <div
            style={{ width: `${(summary.healthy / (summary.total_devices || 1)) * 100}%` }}
            className="bg-[#22C55E]"
          />
          <div
            style={{ width: `${(summary.warning / (summary.total_devices || 1)) * 100}%` }}
            className="bg-[#F59E0B]"
          />
          <div
            style={{ width: `${(summary.critical / (summary.total_devices || 1)) * 100}%` }}
            className="bg-[#EF4444]"
          />
        </div>
      </div>

      {/* Footer Drilldown link */}
      <div className="mt-3 pt-2.5 border-t border-[#D8E5F0] flex items-center justify-between text-xs text-[#2563EB]">
        <span className="text-[#526174] text-[11px]">
          {hasIssues ? '⚠ Active Anomaly Detected' : '✓ All Devices Nominal'}
        </span>
        <span className="flex items-center gap-1 font-bold hover:text-[#1D4ED8]">
          <span>Filter Fleet</span>
          <ArrowRight size={12} />
        </span>
      </div>
    </div>
  );
};

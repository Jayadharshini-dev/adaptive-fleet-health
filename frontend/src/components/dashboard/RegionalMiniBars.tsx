import React from 'react';
import { useFleetStore } from '../../store/fleetContext';
import { MapPin, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export const RegionalMiniBars: React.FC = () => {
  const { regionsSummary } = useFleetStore();

  const regionEntries = Object.entries(regionsSummary);

  return (
    <div className="cool-panel rounded-xl border border-[#D8E5F0] bg-white p-5 flex flex-col justify-between h-full font-mono shadow-xs">
      <div className="flex items-center justify-between border-b border-[#D8E5F0] pb-3 mb-2">
        <div className="flex items-center gap-2">
          <MapPin size={16} className="text-[#2563EB]" />
          <span className="text-xs font-bold uppercase tracking-wider text-[#172033]">
            Regional Fleet Breakdown
          </span>
        </div>
        <Link
          to="/regions"
          className="flex items-center gap-1 text-xs text-[#2563EB] hover:text-[#1D4ED8] transition-colors font-semibold"
        >
          <span>View All</span>
          <ArrowRight size={12} />
        </Link>
      </div>

      <div className="space-y-3.5 my-auto py-1">
        {regionEntries.length === 0 ? (
          <div className="text-center text-xs text-[#526174] py-6">
            Loading regional distribution...
          </div>
        ) : (
          regionEntries.map(([regionName, stats]) => {
            const healthyRatio = stats.total_devices > 0 ? (stats.healthy / stats.total_devices) * 100 : 100;
            const warningRatio = stats.total_devices > 0 ? (stats.warning / stats.total_devices) * 100 : 0;
            const criticalRatio = stats.total_devices > 0 ? (stats.critical / stats.total_devices) * 100 : 0;

            return (
              <div key={regionName} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#172033] flex items-center gap-1.5">
                    {regionName}
                    {stats.critical > 0 && (
                      <span className="h-1.5 w-1.5 rounded-full bg-[#EF4444] animate-pulse" />
                    )}
                  </span>
                  <span className="text-[#526174] text-[11px]">
                    <span className="text-[#15803D] font-bold">{stats.healthy}</span>
                    <span className="text-[#94A3B8] mx-0.5">/</span>
                    <span className="text-[#172033]">{stats.total_devices} devs</span>
                    {stats.active_alerts > 0 && (
                      <span className="text-[#B91C1C] ml-1.5 font-bold">({stats.active_alerts} alert{stats.active_alerts > 1 ? 's' : ''})</span>
                    )}
                  </span>
                </div>

                {/* Stacked Progress Bar */}
                <div className="flex h-2 w-full overflow-hidden rounded-full bg-[#EEF7FF] border border-[#D8E5F0]">
                  <div
                    style={{ width: `${healthyRatio}%` }}
                    className="bg-[#22C55E] transition-all duration-300"
                    title={`Healthy: ${stats.healthy}`}
                  />
                  <div
                    style={{ width: `${warningRatio}%` }}
                    className="bg-[#F59E0B] transition-all duration-300"
                    title={`Warning: ${stats.warning}`}
                  />
                  <div
                    style={{ width: `${criticalRatio}%` }}
                    className="bg-[#EF4444] transition-all duration-300"
                    title={`Critical: ${stats.critical}`}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="pt-3 border-t border-[#D8E5F0] flex items-center justify-between text-[11px] text-[#526174]">
        <span>4 Canonical Industrial Regions</span>
        <span className="text-[#15803D] font-bold">Synchronized</span>
      </div>
    </div>
  );
};

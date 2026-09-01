import React from 'react';
import { useFleetStore } from '../../store/fleetContext';
import { StatusBadge } from '../common/StatusBadge';
import { FailureTypeBadge } from '../common/FailureTypeBadge';
import { ArrowRight, Clock, MapPin, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export const LiveAlertStream: React.FC = () => {
  const { alerts, setSelectedAlert } = useFleetStore();

  const recentAlerts = alerts.slice(0, 6);

  return (
    <div className="cool-panel rounded-xl border border-[#D8E5F0] bg-white p-5 font-mono shadow-xs">
      <div className="flex items-center justify-between border-b border-[#D8E5F0] pb-3 mb-4">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#EF4444] opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#DC2626]" />
          </span>
          <span className="text-xs font-bold uppercase tracking-wider text-[#172033]">
            Recent Incidents & Anomaly Stream
          </span>
          <span className="rounded bg-[#FEF2F2] border border-[#FECACA] px-1.5 py-0.5 text-[10px] text-[#B91C1C] font-bold">
            LIVE FEED
          </span>
        </div>
        <Link
          to="/alerts"
          className="flex items-center gap-1 text-xs text-[#2563EB] hover:text-[#1D4ED8] transition-colors font-semibold"
        >
          <span>All Incidents ({alerts.length})</span>
          <ArrowRight size={12} />
        </Link>
      </div>

      {recentAlerts.length === 0 ? (
        <div className="py-8 text-center text-xs text-[#526174]">
          ✓ No active fleet incidents. All devices operating within learned baseline envelopes.
        </div>
      ) : (
        <div className="space-y-2">
          {recentAlerts.map((alt) => {
            const isResolved = alt.lifecycle_status === 'RESOLVED';
            return (
              <div
                key={alt.id}
                onClick={() => setSelectedAlert(alt)}
                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-xl border border-[#D8E5F0] bg-[#F8FBFF] p-3 hover:border-[#BFDBFE] hover:bg-white hover:shadow-xs transition-all cursor-pointer group ${
                  isResolved ? 'opacity-65' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white border border-[#D8E5F0] font-mono text-xs font-bold text-[#2563EB] group-hover:border-[#BFDBFE]">
                    {alt.device_id.replace('DEV-', '')}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#172033]">
                        {alt.device_id}
                      </span>
                      <span className="flex items-center gap-1 text-[11px] text-[#526174]">
                        <MapPin size={11} className="text-[#8494A7]" />
                        {alt.region}
                      </span>
                      {alt.source && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${alt.source === 'MANUAL' ? 'bg-[#FAF5FF] text-[#7C3AED] border border-[#E9D5FF]' : 'bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]'}`}>
                          {alt.source}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-[#526174] mt-0.5">
                      <span className="flex items-center gap-1">
                        <Clock size={11} />
                        {alt.timestamp}
                      </span>
                      {isResolved && (
                        <span className="text-[#15803D] font-bold">✓ Resolved</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <FailureTypeBadge
                    type={alt.anomaly_type}
                    confidence={alt.confidence}
                    size="sm"
                  />
                  <StatusBadge status={alt.status} size="sm" />
                  <span className="text-[#94A3B8] group-hover:text-[#2563EB] transition-colors ml-1">
                    <ChevronRight size={14} />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

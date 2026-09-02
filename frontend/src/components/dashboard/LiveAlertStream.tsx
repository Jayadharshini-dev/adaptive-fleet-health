import React from 'react';
import { useFleetStore } from '../../store/fleetContext';
import { StatusBadge } from '../common/StatusBadge';
import { FailureTypeBadge } from '../common/FailureTypeBadge';
import { ArrowRight, Clock, MapPin, ChevronRight, Activity, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatTimestamp } from '../../utils/formatters';

export const LiveAlertStream: React.FC = () => {
  const { alerts, userSession, setSelectedAlert } = useFleetStore();

  const loginTime = userSession?.login_timestamp;

  const liveAlerts = alerts.filter((alt) => {
    if (!loginTime) return true;
    return new Date(alt.timestamp).getTime() >= new Date(loginTime).getTime();
  });

  const displayList = liveAlerts.slice(0, 10);

  return (
    <div className="rounded border border-[#E2E0D8] bg-white p-5 font-mono shadow-xs">
      <div className="flex items-center justify-between border-b border-[#E2E0D8] pb-3 mb-4">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#c2410c] opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#c2410c]" />
          </span>
          <span className="text-xs font-bold uppercase tracking-widest text-[#17191C]">
            LIVE INCIDENT LOG (SINCE SESSION LOGIN)
          </span>
          <span className="rounded bg-[#F0EEE6] border border-[#E2E0D8] px-2 py-0.5 text-[10px] text-[#17191C] font-bold">
            {liveAlerts.length} OPERATIONAL RECORDS
          </span>
        </div>
        <Link
          to="/alerts"
          className="flex items-center gap-1 text-xs text-[#c2410c] hover:underline font-bold"
        >
          <span>All Incidents & Log Archive ({alerts.length})</span>
          <ArrowRight size={12} />
        </Link>
      </div>

      {displayList.length === 0 ? (
        <div className="py-8 text-center text-xs text-[#59616A]">
          ✓ No active incidents in current session. All devices operating within learned baseline envelopes.
        </div>
      ) : (
        <div className="space-y-2">
          {displayList.map((alt) => {
            const isResolved = alt.lifecycle_status === 'RESOLVED';
            const isTransient = alt.id.startsWith('TRANS-') || (isResolved && alt.resolution_reason?.includes('Transient'));

            return (
              <div
                key={alt.id}
                onClick={() => setSelectedAlert(alt)}
                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded border border-[#E2E0D8] bg-[#F7F6F2] p-3 hover:bg-[#F0EEE6] hover:border-[#17191C] transition-all cursor-pointer group ${
                  isResolved ? 'opacity-70' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded bg-white border border-[#E2E0D8] font-mono text-xs font-bold text-[#17191C]">
                    {alt.device_id.replace('DEV-', '')}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#17191C] group-hover:text-[#c2410c]">
                        {alt.device_id}
                      </span>
                      <span className="flex items-center gap-1 text-[11px] text-[#59616A]">
                        <MapPin size={11} className="text-[#7A838C]" />
                        {alt.region}
                      </span>
                      {isTransient ? (
                        <span className="inline-flex items-center gap-1 rounded bg-[#F7F6F2] border border-[#E2E0D8] px-1.5 py-0.2 text-[9px] font-bold text-[#59616A]">
                          <Zap size={9} /> TRANSIENT
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded bg-[#FFF7ED] border border-[#ffedd5] px-1.5 py-0.2 text-[9px] font-bold text-[#c2410c]">
                          <Activity size={9} /> PERSISTENT
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-[#59616A] mt-0.5">
                      <span className="flex items-center gap-1">
                        <Clock size={11} className="text-[#7A838C]" />
                        {formatTimestamp(alt.timestamp)}
                      </span>
                      {isResolved && (
                        <span className="text-[#16a34a] font-bold">
                          ✓ RESOLVED BY {alt.resolved_by?.toUpperCase() || 'OPERATOR'}
                        </span>
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
                  <span className="text-[#7A838C] group-hover:text-[#17191C] transition-colors ml-1">
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

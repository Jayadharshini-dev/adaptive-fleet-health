import React, { useState } from 'react';
import { AlertTable } from '../components/alerts/AlertTable';
import { Bell, History, Activity } from 'lucide-react';
import { useFleetStore } from '../store/fleetContext';

export const AlertsPage: React.FC = () => {
  const { alerts, userSession, refreshFleet } = useFleetStore();
  const [activeTab, setActiveTab] = useState<'LIVE' | 'HISTORICAL'>('LIVE');

  React.useEffect(() => {
    refreshFleet();
  }, [refreshFleet]);

  const loginTime = userSession?.login_timestamp;

  const liveAlerts = alerts.filter((alt) => {
    if (!loginTime) return true;
    return new Date(alt.timestamp).getTime() >= new Date(loginTime).getTime();
  });

  const historicalAlerts = alerts.filter((alt) => {
    if (!loginTime) return false;
    return new Date(alt.timestamp).getTime() < new Date(loginTime).getTime();
  });

  const activeLiveCount = liveAlerts.filter((a) => a.lifecycle_status === 'ACTIVE').length;

  return (
    <div className="space-y-6 font-mono">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E2E0D8] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Bell className="text-[#c2410c]" size={18} />
            <h2 className="text-base font-bold uppercase tracking-widest text-[#17191C]">
              ENGINEERING INCIDENT COMMAND LOG
            </h2>
          </div>
          <p className="text-xs text-[#59616A] font-sans mt-0.5">
            Classified incident timeline separated by authenticated session operating window.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('LIVE')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === 'LIVE'
                ? 'bg-[#17191C] text-white border border-[#17191C]'
                : 'bg-[#F7F6F2] text-[#59616A] border border-[#E2E0D8] hover:bg-[#F0EEE6]'
            }`}
          >
            <Activity size={13} className={activeTab === 'LIVE' ? 'text-[#16a34a]' : ''} />
            <span>LIVE OPERATIONS</span>
            <span className="ml-1 px-1.5 py-0.2 text-[10px] bg-[#c2410c] text-white rounded font-bold">
              {liveAlerts.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('HISTORICAL')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === 'HISTORICAL'
                ? 'bg-[#17191C] text-white border border-[#17191C]'
                : 'bg-[#F7F6F2] text-[#59616A] border border-[#E2E0D8] hover:bg-[#F0EEE6]'
            }`}
          >
            <History size={13} />
            <span>HISTORICAL LOG</span>
            <span className="ml-1 px-1.5 py-0.2 text-[10px] bg-[#59616A] text-white rounded font-bold">
              {historicalAlerts.length}
            </span>
          </button>
        </div>
      </div>

      {activeTab === 'LIVE' ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs bg-[#FFF7ED] border border-[#ffedd5] p-3 rounded text-[#c2410c]">
            <span className="font-bold flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#16a34a] animate-pulse" />
              LIVE OPERATIONAL WINDOW · ACTIVE SESSION ({userSession?.username || 'OPERATOR 01'})
            </span>
            <span className="font-bold">{activeLiveCount} ACTIVE INCIDENTS NEED TRIAGE</span>
          </div>
          <AlertTable alertList={liveAlerts} />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs bg-[#F7F6F2] border border-[#E2E0D8] p-3 rounded text-[#59616A]">
            <span className="font-bold flex items-center gap-2">
              <History size={14} className="text-[#59616A]" />
              HISTORICAL AUDIT ARCHIVE · PRIOR TO CURRENT SESSION LOGIN
            </span>
            <span className="font-bold">{historicalAlerts.length} ARCHIVED INCIDENTS</span>
          </div>
          <AlertTable alertList={historicalAlerts} />
        </div>
      )}
    </div>
  );
};

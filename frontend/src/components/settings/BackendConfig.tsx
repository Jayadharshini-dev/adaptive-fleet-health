import React, { useState } from 'react';
import { getApiBaseUrl, setApiBaseUrl, getWsBaseUrl } from '../../services/api';
import { wsService } from '../../services/websocket';
import { useFleetStore } from '../../store/fleetContext';
import { Server, Radio, Save, CheckCircle2 } from 'lucide-react';

export const BackendConfig: React.FC = () => {
  const { connectionStatus, refreshFleet } = useFleetStore();
  const [apiUrl, setApiUrl] = useState(getApiBaseUrl());
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiBaseUrl(apiUrl);
    wsService.connect();
    await refreshFleet();
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div className="cool-panel rounded-xl p-5 border border-[#D8E5F0] bg-white space-y-4 shadow-xs">
      <div className="flex items-center justify-between border-b border-[#D8E5F0] pb-3">
        <div className="flex items-center gap-2">
          <Server size={18} className="text-[#2563EB]" />
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#172033]">
            Backend REST & WebSocket Endpoints
          </span>
        </div>
        <span className="font-mono text-xs text-[#526174]">
          Target: {getApiBaseUrl()}
        </span>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-mono uppercase text-[#526174] font-bold mb-1.5">
              REST API Base URL
            </label>
            <input
              type="text"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="http://127.0.0.1:8000"
              className="w-full rounded-lg border border-[#D8E5F0] bg-[#F8FBFF] px-3 py-2 font-mono text-xs text-[#172033] font-bold placeholder:text-[#8494A7] focus:border-[#2563EB] focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-[11px] font-mono uppercase text-[#526174] font-bold mb-1.5">
              WebSocket Fleet Stream Endpoint
            </label>
            <input
              type="text"
              readOnly
              value={getWsBaseUrl()}
              className="w-full rounded-lg border border-[#D8E5F0] bg-[#EEF7FF] px-3 py-2 font-mono text-xs text-[#526174] cursor-not-allowed"
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-2 text-xs font-mono">
            <Radio size={14} className="text-[#8494A7]" />
            <span className="text-[#526174]">Current Status:</span>
            <span className="font-bold text-[#2563EB]">{connectionStatus}</span>
          </div>

          <div className="flex items-center gap-2">
            {isSaved && (
              <span className="font-mono text-xs text-[#15803D] flex items-center gap-1 font-bold">
                <CheckCircle2 size={13} />
                Endpoint updated
              </span>
            )}
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-lg bg-[#2563EB] px-4 py-2 font-mono text-xs font-bold text-white hover:bg-[#1D4ED8] transition-colors cursor-pointer shadow-xs"
            >
              <Save size={13} />
              <span>Save & Reconnect</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

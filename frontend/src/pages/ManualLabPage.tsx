import React, { useState } from 'react';
import { ManualTelemetryForm } from '../components/manual/ManualTelemetryForm';
import { TelemetryFeedInput } from '../components/manual/TelemetryFeedInput';
import { AnalysisResultCard } from '../components/manual/AnalysisResultCard';
import type { HealthResult } from '../types/fleet';
import { TerminalSquare, FileText } from 'lucide-react';
import { useFleetStore } from '../store/fleetContext';

export const ManualLabPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'single' | 'feed'>('single');
  const [latestResult, setLatestResult] = useState<HealthResult | null>(null);
  const [feedResults, setFeedResults] = useState<HealthResult[]>([]);
  const { setSelectedDeviceId } = useFleetStore();

  const handleSingleResult = (result: HealthResult) => {
    setLatestResult(result);
  };

  const handleFeedResults = (results: HealthResult[]) => {
    setFeedResults(results);
    if (results.length > 0) {
      setLatestResult(results[0]);
    }
  };

  return (
    <div className="space-y-6 font-mono">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#D8E5F0] pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold tracking-wide text-[#172033] uppercase">
              Manual Telemetry Lab
            </h1>
            <span className="rounded-md bg-[#EFF6FF] border border-[#BFDBFE] px-2 py-0.5 text-xs text-[#2563EB] font-bold">
              JUDGE INTERACTION PORTAL
            </span>
          </div>
          <p className="text-xs text-[#526174] font-sans">
            Submit custom or adversarial telemetry directly into Member 1’s 5-detector intelligence pipeline. Verify that anomalous packets generate genuine alerts and explanatory diagnostics.
          </p>
        </div>

        {/* Tab switcher: Single packet vs Batch Feed */}
        <div className="flex items-center rounded-lg border border-[#D8E5F0] bg-[#EEF7FF] p-1">
          <button
            onClick={() => setActiveTab('single')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === 'single'
                ? 'bg-white text-[#2563EB] border border-[#BFDBFE] shadow-xs font-bold'
                : 'text-[#526174] hover:text-[#172033]'
            }`}
          >
            <TerminalSquare size={14} />
            <span>Single Packet Form</span>
          </button>

          <button
            onClick={() => setActiveTab('feed')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === 'feed'
                ? 'bg-white text-[#2563EB] border border-[#BFDBFE] shadow-xs font-bold'
                : 'text-[#526174] hover:text-[#172033]'
            }`}
          >
            <FileText size={14} />
            <span>Batch JSON Feed</span>
          </button>
        </div>
      </div>

      {/* Main Interactive Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Input Form or Batch Feed */}
        <div className="lg:col-span-6 space-y-4">
          {activeTab === 'single' ? (
            <ManualTelemetryForm onResultReceived={handleSingleResult} />
          ) : (
            <TelemetryFeedInput onResultsReceived={handleFeedResults} />
          )}

          {/* Batch results list if in feed mode */}
          {activeTab === 'feed' && feedResults.length > 0 && (
            <div className="cool-panel rounded-xl border border-[#D8E5F0] bg-white p-4 space-y-2 shadow-xs">
              <span className="text-xs font-bold uppercase tracking-wider text-[#172033] block mb-2">
                Batch Ingestion Breakdown ({feedResults.length} Packets)
              </span>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {feedResults.map((r, i) => (
                  <div
                    key={i}
                    onClick={() => setLatestResult(r)}
                    className={`flex items-center justify-between p-2 rounded-lg border cursor-pointer transition-colors text-xs ${
                      latestResult === r
                        ? 'border-[#2563EB] bg-[#EFF6FF]'
                        : 'border-[#D8E5F0] bg-[#F8FBFF] hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#2563EB]">{r.device_id}</span>
                      <span className="text-[#526174] text-[11px]">{r.region}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`font-bold text-[11px] ${
                          r.status === 'CRITICAL'
                            ? 'text-[#B91C1C]'
                            : r.status === 'WARNING'
                            ? 'text-[#B45309]'
                            : 'text-[#15803D]'
                        }`}
                      >
                        {r.status}
                      </span>
                      {r.anomaly_type !== 'none' && (
                        <span className="rounded bg-white border border-[#D8E5F0] px-1.5 py-0.5 text-[10px] text-[#526174] uppercase font-bold">
                          {r.anomaly_type}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Live HealthResult Inspection Panel */}
        <div className="lg:col-span-6">
          <AnalysisResultCard
            result={latestResult}
            onInspectDevice={(devId) => setSelectedDeviceId(devId)}
          />
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { ManualTelemetryForm } from '../components/manual/ManualTelemetryForm';
import { TelemetryFeedInput } from '../components/manual/TelemetryFeedInput';
import { AnalysisResultCard } from '../components/manual/AnalysisResultCard';
import type { HealthResult } from '../types/fleet';
import { Terminal, FileText } from 'lucide-react';
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E2E0D8] pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold tracking-widest text-[#17191C] uppercase">
              MANUAL TELEMETRY LAB
            </h1>
            <span className="rounded bg-[#F0EEE6] border border-[#E2E0D8] px-2 py-0.5 text-xs text-[#c2410c] font-bold">
              ENGINEERING TEST BENCH
            </span>
          </div>
          <p className="text-xs text-[#59616A] font-sans">
            Test live telemetry against the same adaptive health pipeline used by the fleet.
          </p>
        </div>

        <div className="flex items-center rounded border border-[#E2E0D8] bg-[#F7F6F2] p-1">
          <button
            onClick={() => setActiveTab('single')}
            className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === 'single'
                ? 'bg-white text-[#17191C] border border-[#CFCBC0] font-bold shadow-xs'
                : 'text-[#59616A] hover:text-[#17191C]'
            }`}
          >
            <Terminal size={14} />
            <span>Single Packet Form</span>
          </button>

          <button
            onClick={() => setActiveTab('feed')}
            className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === 'feed'
                ? 'bg-white text-[#17191C] border border-[#CFCBC0] font-bold shadow-xs'
                : 'text-[#59616A] hover:text-[#17191C]'
            }`}
          >
            <FileText size={14} />
            <span>Batch JSON Feed</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 space-y-4">
          {activeTab === 'single' ? (
            <ManualTelemetryForm onResultReceived={handleSingleResult} />
          ) : (
            <TelemetryFeedInput onResultsReceived={handleFeedResults} />
          )}

          {activeTab === 'feed' && feedResults.length > 0 && (
            <div className="rounded border border-[#E2E0D8] bg-white p-4 space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#17191C] block mb-2">
                Batch Ingestion Breakdown ({feedResults.length} Packets)
              </span>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {feedResults.map((r, i) => (
                  <div
                    key={i}
                    onClick={() => setLatestResult(r)}
                    className={`flex items-center justify-between p-2 rounded border cursor-pointer transition-colors text-xs ${
                      latestResult === r
                        ? 'border-[#17191C] bg-[#F0EEE6]'
                        : 'border-[#E2E0D8] bg-[#F7F6F2] hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#17191C]">{r.device_id}</span>
                      <span className="text-[#59616A] text-[11px]">{r.region}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`font-bold text-[11px] ${
                          r.status === 'CRITICAL'
                            ? 'text-[#dc2626]'
                            : r.status === 'WARNING'
                            ? 'text-[#d97706]'
                            : 'text-[#16a34a]'
                        }`}
                      >
                        {r.status}
                      </span>
                      {r.anomaly_type !== 'none' && (
                        <span className="rounded bg-white border border-[#E2E0D8] px-1.5 py-0.5 text-[10px] text-[#59616A] uppercase font-bold">
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

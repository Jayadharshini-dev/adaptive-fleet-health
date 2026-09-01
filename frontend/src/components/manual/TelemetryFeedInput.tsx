import React, { useState } from 'react';
import { useFleetStore } from '../../store/fleetContext';
import type { HealthResult } from '../../types/fleet';
import { UploadCloud, FileCode, CheckCircle2, AlertCircle, RefreshCw, Sparkles } from 'lucide-react';

interface TelemetryFeedInputProps {
  onResultsReceived: (results: HealthResult[]) => void;
}

const SAMPLE_FEED_JSON = JSON.stringify(
  [
    {
      device_id: 'DEV-007',
      device_instance_id: 'INST-007',
      region: 'North',
      timestamp: new Date().toISOString(),
      metrics: {
        temperature: 72.4,
        vibration: 2.3,
        current: 8.7,
        rpm: 1482,
      },
    },
    {
      device_id: 'DEV-014',
      device_instance_id: 'INST-014',
      region: 'South',
      timestamp: new Date().toISOString(),
      metrics: {
        temperature: 64.5,
        vibration: 3.2,
        current: 16.8,
        rpm: 1510,
      },
    },
    {
      device_id: 'DEV-021',
      device_instance_id: 'INST-021',
      region: 'South',
      timestamp: new Date().toISOString(),
      metrics: {
        temperature: 68.0,
        vibration: 0.01,
        current: 11.2,
        rpm: 1600,
      },
    },
  ],
  null,
  2
);

export const TelemetryFeedInput: React.FC<TelemetryFeedInputProps> = ({
  onResultsReceived,
}) => {
  const { ingestManualFeed } = useFleetStore();
  const [jsonText, setJsonText] = useState(SAMPLE_FEED_JSON);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);

  const handleIngest = async () => {
    setErrorMsg(null);
    setSuccessCount(null);

    if (!jsonText.trim()) {
      setErrorMsg('Please paste a JSON array or object of telemetry packets.');
      return;
    }

    setIsLoading(true);
    try {
      const results = await ingestManualFeed(jsonText);
      setSuccessCount(results.length);
      onResultsReceived(results);
    } catch (err: any) {
      setErrorMsg(err.message || 'Validation error processing feed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadSample = () => {
    setJsonText(SAMPLE_FEED_JSON);
    setErrorMsg(null);
    setSuccessCount(null);
  };

  return (
    <div className="cool-panel rounded-xl border border-[#D8E5F0] bg-white p-5 font-mono space-y-4 shadow-xs">
      <div className="flex items-center justify-between border-b border-[#D8E5F0] pb-3">
        <div>
          <h2 className="text-sm font-bold text-[#172033] uppercase tracking-wider flex items-center gap-2">
            <FileCode size={15} className="text-[#2563EB]" />
            Batch Telemetry Feed Ingestion
          </h2>
          <p className="text-xs text-[#526174] font-sans mt-0.5">
            Paste raw multi-device telemetry payloads in JSON format. Evaluates each packet against individual learned baselines.
          </p>
        </div>

        <button
          onClick={handleLoadSample}
          className="rounded-lg bg-[#EFF6FF] border border-[#BFDBFE] px-2.5 py-1 text-[11px] text-[#2563EB] hover:bg-[#DBEAFE] flex items-center gap-1 cursor-pointer transition-colors font-bold"
        >
          <Sparkles size={12} className="text-[#2563EB]" />
          <span>Load 3-Packet Sample</span>
        </button>
      </div>

      {errorMsg && (
        <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-3 text-xs text-[#B91C1C] flex items-center gap-2 font-sans">
          <AlertCircle size={15} className="shrink-0 text-[#EF4444]" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successCount !== null && (
        <div className="rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] p-3 text-xs text-[#15803D] flex items-center gap-2 font-sans">
          <CheckCircle2 size={15} className="shrink-0 text-[#22C55E]" />
          <span>Successfully ingested and processed {successCount} telemetry packets through the intelligence engine.</span>
        </div>
      )}

      <div>
        <label className="text-[10px] uppercase text-[#526174] font-bold block mb-1.5 flex items-center justify-between">
          <span>JSON Telemetry Payload (Array of Packets)</span>
          <span className="text-[10px] text-[#8494A7]">metrics: temperature, vibration, current, rpm</span>
        </label>
        <textarea
          rows={11}
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
          className="w-full rounded-xl border border-[#D8E5F0] bg-[#F8FBFF] p-3 text-xs text-[#172033] font-mono focus:border-[#2563EB] focus:outline-hidden leading-relaxed"
          placeholder="[ { 'device_id': 'DEV-007', ... } ]"
          spellCheck={false}
        />
      </div>

      <button
        onClick={handleIngest}
        disabled={isLoading}
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-5 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-white shadow-sm hover:bg-[#1D4ED8] transition-all cursor-pointer disabled:opacity-50"
      >
        {isLoading ? (
          <>
            <RefreshCw size={14} className="animate-spin" />
            <span>Processing Batch Feed...</span>
          </>
        ) : (
          <>
            <UploadCloud size={15} />
            <span>Ingest Feed</span>
          </>
        )}
      </button>
    </div>
  );
};

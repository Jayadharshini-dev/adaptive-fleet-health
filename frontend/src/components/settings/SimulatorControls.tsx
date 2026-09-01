import React, { useState } from 'react';
import { useFleetStore } from '../../store/fleetContext';
import {
  Cpu,
  CheckCircle2,
  Play,
  Pause,
  RotateCcw,
  Sliders,
} from 'lucide-react';

export const SimulatorControls: React.FC = () => {
  const {
    isSimulatorActive,
    toggleSimulator,
    runDemoScenario,
    refreshFleet,
  } = useFleetStore();

  const [notification, setNotification] = useState<string | null>(null);

  const notify = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  const handleScenario = (
    scenario: 'drift' | 'spike' | 'flatline' | 'oscillation' | 'sensor_swap',
    label: string,
    target: string
  ) => {
    runDemoScenario(scenario);
    notify(`Simulated ${label} on ${target} — Intelligence engine independently evaluating telemetry.`);
  };

  const handleResetAll = async () => {
    await refreshFleet();
    notify('Refreshed all 50 physical assets from server state.');
  };

  return (
    <div className="cool-panel rounded-xl p-5 border border-[#D8E5F0] bg-white space-y-4 font-mono shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#D8E5F0] pb-3">
        <div className="flex items-center gap-2.5">
          <Cpu className="text-[#2563EB]" size={20} />
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#172033]">
              Demo Scenario Controller & Simulator
            </h3>
            <span className="text-[11px] text-[#526174] font-sans">
              Feeds continuous operational telemetry into the pipeline. Anomaly classification is determined independently by Member 1’s health engine.
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleSimulator}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer shadow-xs ${
              isSimulatorActive
                ? 'bg-[#F0FDF4] border border-[#BBF7D0] text-[#15803D]'
                : 'bg-white border border-[#D8E5F0] text-[#526174]'
            }`}
          >
            {isSimulatorActive ? (
              <>
                <Pause size={12} />
                <span>Simulator Active</span>
              </>
            ) : (
              <>
                <Play size={12} />
                <span>Simulator Paused</span>
              </>
            )}
          </button>

          <button
            onClick={handleResetAll}
            className="flex items-center gap-1.5 rounded-lg bg-[#EFF6FF] border border-[#BFDBFE] px-3 py-1.5 text-xs text-[#2563EB] font-bold hover:bg-[#DBEAFE] transition-colors cursor-pointer shadow-xs"
          >
            <RotateCcw size={12} />
            <span>Resync Fleet</span>
          </button>
        </div>
      </div>

      {notification && (
        <div className="rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] p-2.5 text-xs text-[#15803D] flex items-center gap-2 font-sans animate-in fade-in shadow-xs">
          <CheckCircle2 size={14} className="text-[#22C55E] shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Controlled Scenarios for Evaluation */}
      <div>
        <span className="text-xs font-bold uppercase tracking-wider text-[#526174] block mb-2.5 flex items-center gap-1.5">
          <Sliders size={13} className="text-[#2563EB]" />
          Five Failure Mode Scenarios (Telemetry Stream Controllers)
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 text-xs">
          {/* Drift */}
          <button
            onClick={() => handleScenario('drift', 'Thermal Drift', 'DEV-007 (North)')}
            className="rounded-xl border border-[#FED7AA] bg-[#FFF7ED] p-3 hover:bg-[#FFEDD5] text-left transition-all cursor-pointer group shadow-xs"
          >
            <div className="text-[#C2410C] font-bold mb-1 flex items-center justify-between">
              <span>1. DRIFT</span>
              <span className="text-[10px] text-[#8494A7] font-normal">North</span>
            </div>
            <span className="text-[#172033] block font-bold">DEV-007</span>
            <span className="text-[10px] text-[#526174] font-sans block mt-0.5">
              Gradual thermal elevation
            </span>
          </button>

          {/* Spike */}
          <button
            onClick={() => handleScenario('spike', 'Current Surge', 'DEV-014 (South)')}
            className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-3 hover:bg-[#FEE2E2] text-left transition-all cursor-pointer group shadow-xs"
          >
            <div className="text-[#B91C1C] font-bold mb-1 flex items-center justify-between">
              <span>2. SPIKE</span>
              <span className="text-[10px] text-[#8494A7] font-normal">South</span>
            </div>
            <span className="text-[#172033] block font-bold">DEV-014</span>
            <span className="text-[10px] text-[#526174] font-sans block mt-0.5">
              Current excursion
            </span>
          </button>

          {/* Flatline */}
          <button
            onClick={() => handleScenario('flatline', 'Sensor Collapse', 'DEV-021 (South)')}
            className="rounded-xl border border-[#E9D5FF] bg-[#FAF5FF] p-3 hover:bg-[#F3E8FF] text-left transition-all cursor-pointer group shadow-xs"
          >
            <div className="text-[#6B21A8] font-bold mb-1 flex items-center justify-between">
              <span>3. FLATLINE</span>
              <span className="text-[10px] text-[#8494A7] font-normal">South</span>
            </div>
            <span className="text-[#172033] block font-bold">DEV-021</span>
            <span className="text-[10px] text-[#526174] font-sans block mt-0.5">
              Frozen zero variance
            </span>
          </button>

          {/* Oscillation */}
          <button
            onClick={() => handleScenario('oscillation', 'Harmonic Vibration', 'DEV-032 (East)')}
            className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-3 hover:bg-[#FEF3C7] text-left transition-all cursor-pointer group shadow-xs"
          >
            <div className="text-[#B45309] font-bold mb-1 flex items-center justify-between">
              <span>4. OSCILLATION</span>
              <span className="text-[10px] text-[#8494A7] font-normal">East</span>
            </div>
            <span className="text-[#172033] block font-bold">DEV-032</span>
            <span className="text-[10px] text-[#526174] font-sans block mt-0.5">
              Cyclic alternating wave
            </span>
          </button>

          {/* Sensor Swap */}
          <button
            onClick={() => handleScenario('sensor_swap', 'Channel Mismatch', 'DEV-045 (West)')}
            className="rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] p-3 hover:bg-[#DBEAFE] text-left transition-all cursor-pointer group shadow-xs"
          >
            <div className="text-[#1D4ED8] font-bold mb-1 flex items-center justify-between">
              <span>5. SENSOR SWAP</span>
              <span className="text-[10px] text-[#8494A7] font-normal">West</span>
            </div>
            <span className="text-[#172033] block font-bold">DEV-045</span>
            <span className="text-[10px] text-[#526174] font-sans block mt-0.5">
              Multi-metric profile jump
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

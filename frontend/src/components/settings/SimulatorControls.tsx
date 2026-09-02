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
    notify(`Injected telemetry behavior '${label}' on ${target}. HealthEngine independently analyzing telemetry stream.`);
  };

  const handleResetAll = async () => {
    await refreshFleet();
    notify('Refreshed all 50 physical assets from server state.');
  };

  return (
    <div className="rounded border border-[#E2E0D8] bg-white p-5 space-y-4 font-mono">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E2E0D8] pb-3">
        <div className="flex items-center gap-2.5">
          <Cpu className="text-[#c2410c]" size={18} />
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#17191C]">
              Demo Scenario Controller
            </h3>
            <span className="text-[11px] text-[#59616A] font-sans">
              Controls simulator input behavior. Anomaly classification is independently evaluated by HealthEngine.
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleSimulator}
            className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
              isSimulatorActive
                ? 'bg-[#f0fdf4] border border-[#bbf7d0] text-[#16a34a]'
                : 'bg-white border border-[#E2E0D8] text-[#59616A]'
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
            className="flex items-center gap-1.5 rounded bg-[#F0EEE6] border border-[#E2E0D8] px-3 py-1.5 text-xs text-[#17191C] font-bold hover:bg-[#CFCBC0] transition-colors cursor-pointer"
          >
            <RotateCcw size={12} />
            <span>Resync Fleet</span>
          </button>
        </div>
      </div>

      {notification && (
        <div className="rounded border border-[#bbf7d0] bg-[#f0fdf4] p-2.5 text-xs text-[#16a34a] flex items-center gap-2 font-sans">
          <CheckCircle2 size={14} className="text-[#16a34a] shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      <div>
        <span className="text-xs font-bold uppercase tracking-wider text-[#59616A] block mb-2.5 flex items-center gap-1.5">
          <Sliders size={13} className="text-[#c2410c]" />
          Five Failure Mode Scenarios (Simulator Behavior Injection)
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 text-xs">
          {/* Drift */}
          <button
            onClick={() => handleScenario('drift', 'Thermal Drift', 'DEV-007 (East)')}
            className="rounded border border-[#fde68a] bg-[#fef3c7]/40 p-3 hover:bg-[#fde68a] text-left transition-all cursor-pointer group"
          >
            <div className="text-[#d97706] font-bold mb-1 flex items-center justify-between">
              <span>1. DRIFT</span>
              <span className="text-[10px] text-[#7A838C] font-normal">East</span>
            </div>
            <span className="text-[#17191C] block font-bold">DEV-007</span>
            <span className="text-[10px] text-[#59616A] font-sans block mt-0.5">
              Gradual thermal elevation
            </span>
          </button>

          {/* Spike */}
          <button
            onClick={() => handleScenario('spike', 'Current Surge', 'DEV-014 (South)')}
            className="rounded border border-[#fca5a5] bg-[#fee2e2]/40 p-3 hover:bg-[#fca5a5] text-left transition-all cursor-pointer group"
          >
            <div className="text-[#dc2626] font-bold mb-1 flex items-center justify-between">
              <span>2. SPIKE</span>
              <span className="text-[10px] text-[#7A838C] font-normal">South</span>
            </div>
            <span className="text-[#17191C] block font-bold">DEV-014</span>
            <span className="text-[10px] text-[#59616A] font-sans block mt-0.5">
              Current surge excursion
            </span>
          </button>

          {/* Flatline */}
          <button
            onClick={() => handleScenario('flatline', 'Sensor Collapse', 'DEV-021 (North)')}
            className="rounded border border-[#E2E0D8] bg-[#F7F6F2] p-3 hover:bg-[#E2E0D8] text-left transition-all cursor-pointer group"
          >
            <div className="text-[#17191C] font-bold mb-1 flex items-center justify-between">
              <span>3. FLATLINE</span>
              <span className="text-[10px] text-[#7A838C] font-normal">North</span>
            </div>
            <span className="text-[#17191C] block font-bold">DEV-021</span>
            <span className="text-[10px] text-[#59616A] font-sans block mt-0.5">
              Frozen zero variance
            </span>
          </button>

          {/* Oscillation */}
          <button
            onClick={() => handleScenario('oscillation', 'Harmonic Vibration', 'DEV-032 (West)')}
            className="rounded border border-[#fde68a] bg-[#fef3c7]/40 p-3 hover:bg-[#fde68a] text-left transition-all cursor-pointer group"
          >
            <div className="text-[#d97706] font-bold mb-1 flex items-center justify-between">
              <span>4. OSCILLATION</span>
              <span className="text-[10px] text-[#7A838C] font-normal">West</span>
            </div>
            <span className="text-[#17191C] block font-bold">DEV-032</span>
            <span className="text-[10px] text-[#59616A] font-sans block mt-0.5">
              Cyclic alternating wave
            </span>
          </button>

          {/* Sensor Swap */}
          <button
            onClick={() => handleScenario('sensor_swap', 'Channel Mismatch', 'DEV-045 (North)')}
            className="rounded border border-[#fca5a5] bg-[#fee2e2]/40 p-3 hover:bg-[#fca5a5] text-left transition-all cursor-pointer group"
          >
            <div className="text-[#dc2626] font-bold mb-1 flex items-center justify-between">
              <span>5. SENSOR SWAP</span>
              <span className="text-[10px] text-[#7A838C] font-normal">North</span>
            </div>
            <span className="text-[#17191C] block font-bold">DEV-045</span>
            <span className="text-[10px] text-[#59616A] font-sans block mt-0.5">
              Multi-metric profile jump
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

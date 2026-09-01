import React from 'react';
import { BackendConfig } from '../components/settings/BackendConfig';
import { SimulatorControls } from '../components/settings/SimulatorControls';
import { Settings, Award, HelpCircle } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#D8E5F0] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Settings className="text-[#2563EB]" size={20} />
            <h2 className="font-mono text-base font-bold uppercase tracking-wider text-[#172033]">
              System Configuration & Hackathon Demo Center
            </h2>
          </div>
          <p className="text-xs text-[#526174] mt-1">
            Manage backend connection endpoints and execute live failure simulation routines for evaluation
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs text-[#2563EB] bg-[#EFF6FF] border border-[#BFDBFE] px-3 py-1.5 rounded-lg self-start sm:self-auto font-bold shadow-xs">
          <Award size={14} />
          <span>Evaluation Demo Mode Ready</span>
        </div>
      </div>

      {/* Interactive Hackathon Demo Controls */}
      <SimulatorControls />

      {/* Backend Endpoints Configuration */}
      <BackendConfig />

      {/* Evaluation & Architecture Criteria Guide */}
      <div className="cool-panel rounded-xl p-5 border border-[#D8E5F0] bg-white space-y-4 shadow-xs">
        <div className="flex items-center gap-2 border-b border-[#D8E5F0] pb-3">
          <HelpCircle size={18} className="text-[#2563EB]" />
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#172033]">
            Hackathon Judging & Architectural Highlights
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-[#172033]">
          <div className="rounded-xl bg-[#F8FBFF] p-4 border border-[#D8E5F0] space-y-1.5 shadow-xs">
            <span className="font-mono font-bold text-[#2563EB] block uppercase">
              1. Adaptive Baselines vs Fixed Thresholds
            </span>
            <p className="text-[#526174] leading-relaxed">
              Every device in the 50-device fleet learns its own statistical model (<code className="text-[#2563EB] font-mono bg-[#EEF7FF] px-1 py-0.5 rounded">mean ± 2σ</code>) independently based on historical operational context. No arbitrary global limits are applied.
            </p>
          </div>

          <div className="rounded-xl bg-[#F8FBFF] p-4 border border-[#D8E5F0] space-y-1.5 shadow-xs">
            <span className="font-mono font-bold text-[#2563EB] block uppercase">
              2. Strict Health vs Connectivity Separation
            </span>
            <p className="text-[#526174] leading-relaxed">
              Machine health (<code className="text-[#15803D] font-mono bg-[#F0FDF4] px-1 py-0.5 rounded">HEALTHY</code>, <code className="text-[#B45309] font-mono bg-[#FFFBEB] px-1 py-0.5 rounded">WARNING</code>, <code className="text-[#B91C1C] font-mono bg-[#FEF2F2] px-1 py-0.5 rounded">CRITICAL</code>) is strictly decoupled from telemetry connectivity (<code className="text-[#2563EB] font-mono bg-[#EFF6FF] px-1 py-0.5 rounded">ACTIVE</code>, <code className="text-[#B45309] font-mono bg-[#FFFBEB] px-1 py-0.5 rounded">STALE</code>, <code className="text-[#526174] font-mono bg-[#F1F5F9] px-1 py-0.5 rounded">OFFLINE</code>).
            </p>
          </div>

          <div className="rounded-xl bg-[#F8FBFF] p-4 border border-[#D8E5F0] space-y-1.5 shadow-xs">
            <span className="font-mono font-bold text-[#2563EB] block uppercase">
              3. Five Distinct Anomaly Classifications
            </span>
            <p className="text-[#526174] leading-relaxed">
              Real-time classification for <strong className="text-[#172033]">Drift</strong>, <strong className="text-[#172033]">Spike</strong>, <strong className="text-[#172033]">Flatline</strong>, <strong className="text-[#172033]">Oscillation</strong>, and <strong className="text-[#172033]">Sensor Swap</strong> with model confidence ratings.
            </p>
          </div>

          <div className="rounded-xl bg-[#F8FBFF] p-4 border border-[#D8E5F0] space-y-1.5 shadow-xs">
            <span className="font-mono font-bold text-[#2563EB] block uppercase">
              4. Multi-Session WebSocket Synchronization
            </span>
            <p className="text-[#526174] leading-relaxed">
              Open multiple browser tabs simultaneously. When an event fires or backend emits a state change, all connected dashboards instantly update without reloading.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

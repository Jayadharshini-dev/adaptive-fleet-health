import React from 'react';
import { BackendConfig } from '../components/settings/BackendConfig';
import { SimulatorControls } from '../components/settings/SimulatorControls';
import { Sliders, Award, HelpCircle } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  return (
    <div className="space-y-6 font-mono">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E2E0D8] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Sliders className="text-[#c2410c]" size={18} />
            <h2 className="text-base font-bold uppercase tracking-widest text-[#17191C]">
              DEMO CONTROL CENTER & SYSTEM CONFIGURATION
            </h2>
          </div>
          <p className="text-xs text-[#59616A] mt-1 font-sans">
            Drive simulator failure behaviors and manage system connection parameters for judge evaluation.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-[#c2410c] bg-[#F0EEE6] border border-[#E2E0D8] px-3 py-1 rounded self-start sm:self-auto font-bold">
          <Award size={14} />
          <span>EVALUATION DEMO MODE ACTIVE</span>
        </div>
      </div>

      <SimulatorControls />
      <BackendConfig />

      <div className="rounded border border-[#E2E0D8] bg-white p-5 space-y-4">
        <div className="flex items-center gap-2 border-b border-[#E2E0D8] pb-3">
          <HelpCircle size={16} className="text-[#c2410c]" />
          <span className="text-xs font-bold uppercase tracking-wider text-[#17191C]">
            Architectural Highlights & Evaluation Criteria
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-[#17191C]">
          <div className="rounded bg-[#F7F6F2] p-4 border border-[#E2E0D8] space-y-1.5">
            <span className="font-bold text-[#c2410c] block uppercase">
              1. Adaptive Baselines vs Fixed Thresholds
            </span>
            <p className="text-[#59616A] font-sans leading-relaxed">
              Every device in the 50-device fleet learns its own statistical model (<code className="font-mono bg-white px-1 py-0.5 border border-[#E2E0D8] text-[#17191C]">mean ± 2σ</code>) independently based on historical operational context.
            </p>
          </div>

          <div className="rounded bg-[#F7F6F2] p-4 border border-[#E2E0D8] space-y-1.5">
            <span className="font-bold text-[#c2410c] block uppercase">
              2. Decoupled Health & Telemetry State
            </span>
            <p className="text-[#59616A] font-sans leading-relaxed">
              Device health (<code className="font-mono text-[#16a34a]">HEALTHY</code>, <code className="font-mono text-[#d97706]">WARNING</code>, <code className="font-mono text-[#dc2626]">CRITICAL</code>) is evaluated strictly per-device and separated from connection status (<code className="font-mono text-[#17191C]">ACTIVE</code>, <code className="font-mono text-[#7A838C]">OFFLINE</code>).
            </p>
          </div>

          <div className="rounded bg-[#F7F6F2] p-4 border border-[#E2E0D8] space-y-1.5">
            <span className="font-bold text-[#c2410c] block uppercase">
              3. Five Distinct Anomaly Classifications
            </span>
            <p className="text-[#59616A] font-sans leading-relaxed">
              Independent statistical detection for <strong className="text-[#17191C]">Drift</strong>, <strong className="text-[#17191C]">Spike</strong>, <strong className="text-[#17191C]">Flatline</strong>, <strong className="text-[#17191C]">Oscillation</strong>, and <strong className="text-[#17191C]">Sensor Swap</strong>.
            </p>
          </div>

          <div className="rounded bg-[#F7F6F2] p-4 border border-[#E2E0D8] space-y-1.5">
            <span className="font-bold text-[#c2410c] block uppercase">
              4. Multi-Session Concurrent Synchronization
            </span>
            <p className="text-[#59616A] font-sans leading-relaxed">
              WebSocket events broadcast state changes across all connected browser tabs in real time without page reloads.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

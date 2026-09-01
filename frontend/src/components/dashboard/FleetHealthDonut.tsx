import React from 'react';
import { useFleetStore } from '../../store/fleetContext';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { Activity, ShieldCheck, AlertTriangle, AlertOctagon } from 'lucide-react';

export const FleetHealthDonut: React.FC = () => {
  const { fleetSummary } = useFleetStore();

  const data = [
    { name: 'Healthy', value: fleetSummary.healthy, color: '#22C55E' },
    { name: 'Warning', value: fleetSummary.warning, color: '#F59E0B' },
    { name: 'Critical', value: fleetSummary.critical, color: '#EF4444' },
  ].filter((d) => d.value > 0);

  const total = fleetSummary.total_devices;
  const healthyPct = total > 0 ? Math.round((fleetSummary.healthy / total) * 100) : 100;

  return (
    <div className="cool-panel rounded-xl p-5 flex flex-col justify-between h-full bg-white border border-[#D8E5F0] shadow-xs">
      <div className="flex items-center justify-between border-b border-[#D8E5F0] pb-3 mb-2">
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-[#2563EB]" />
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#172033]">
            Fleet Risk Distribution
          </span>
        </div>
        <span className="font-mono text-xs text-[#526174]">Live Breakdown</span>
      </div>

      <div className="relative flex-1 flex items-center justify-center my-2 min-h-[190px]">
        <ResponsiveContainer width="100%" height={190}>
          <PieChart>
            <Pie
              data={data.length > 0 ? data : [{ name: 'Healthy', value: 50, color: '#22C55E' }]}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={78}
              paddingAngle={3}
              dataKey="value"
              stroke="#FFFFFF"
              strokeWidth={2}
            >
              {(data.length > 0 ? data : [{ name: 'Healthy', value: 50, color: '#22C55E' }]).map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: '#FFFFFF',
                borderColor: '#D8E5F0',
                borderRadius: '0.5rem',
                fontFamily: 'monospace',
                fontSize: '12px',
                color: '#172033',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
              }}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Center Percentage Display */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="font-mono text-2xl font-bold text-[#172033]">{healthyPct}%</span>
          <span className="font-mono text-[10px] uppercase tracking-wider text-[#526174]">
            HEALTH SCORE
          </span>
        </div>
      </div>

      {/* Legend & Exact Live Numbers */}
      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-[#D8E5F0] font-mono text-xs">
        <div className="flex flex-col items-center rounded-lg bg-[#F0FDF4] p-2 border border-[#BBF7D0]">
          <div className="flex items-center gap-1 text-[#15803D] text-[11px] font-bold">
            <ShieldCheck size={12} />
            <span>Healthy</span>
          </div>
          <span className="text-sm font-bold text-[#172033] mt-0.5">{fleetSummary.healthy}</span>
        </div>

        <div className="flex flex-col items-center rounded-lg bg-[#FFFBEB] p-2 border border-[#FDE68A]">
          <div className="flex items-center gap-1 text-[#B45309] text-[11px] font-bold">
            <AlertTriangle size={12} />
            <span>Warning</span>
          </div>
          <span className="text-sm font-bold text-[#172033] mt-0.5">{fleetSummary.warning}</span>
        </div>

        <div className="flex flex-col items-center rounded-lg bg-[#FEF2F2] p-2 border border-[#FECACA]">
          <div className="flex items-center gap-1 text-[#B91C1C] text-[11px] font-bold">
            <AlertOctagon size={12} />
            <span>Critical</span>
          </div>
          <span className="text-sm font-bold text-[#172033] mt-0.5">{fleetSummary.critical}</span>
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { useFleetStore } from '../../store/fleetContext';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';
import { GitCompare } from 'lucide-react';
import type { RegionName } from '../../types/fleet';

interface PeerComparisonProps {
  region: RegionName;
  affectedDevices: string[];
}

export const PeerComparison: React.FC<PeerComparisonProps> = ({
  region,
  affectedDevices,
}) => {
  const { devicesList, setSelectedDeviceId } = useFleetStore();

  // Get all devices in this region
  const regionalDevices = devicesList.filter((d) => d.region === region);

  const comparisonData = regionalDevices.map((d) => {
    const isAffected = affectedDevices.includes(d.device_id);
    return {
      id: d.device_id,
      temperature: d.latest_reading?.temperature ?? 0,
      vibration: d.latest_reading?.vibration ?? 0,
      current: d.latest_reading?.current ?? 0,
      rpm: d.latest_reading?.rpm ?? 0,
      isAffected,
      status: d.status,
    };
  });

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-4 space-y-4 font-mono">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <GitCompare size={16} className="text-amber-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
            Regional Peer Vibration Comparison ({region} Region)
          </span>
        </div>
        <span className="text-[11px] text-amber-400">
          Correlated: {affectedDevices.join(', ')}
        </span>
      </div>

      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={comparisonData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.6} />
            <XAxis
              dataKey="id"
              stroke="#64748b"
              tick={{ fill: '#94a3b8', fontSize: 10 }}
            />
            <YAxis
              stroke="#64748b"
              tick={{ fill: '#64748b', fontSize: 10 }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#0f172a',
                borderColor: '#334155',
                borderRadius: '0.375rem',
                fontSize: '12px',
              }}
              formatter={(val: any) => [`${val} mm/s`, 'Vibration']}
            />
            <Bar dataKey="vibration" radius={[4, 4, 0, 0]}>
              {comparisonData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={
                    entry.isAffected
                      ? entry.status === 'CRITICAL'
                        ? '#ef4444'
                        : '#f59e0b'
                      : '#38bdf8'
                  }
                  cursor="pointer"
                  onClick={() => setSelectedDeviceId(entry.id)}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80 text-xs text-slate-400">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-xs bg-[#38bdf8] inline-block" />
            <span>Nominal Peers</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-xs bg-[#f59e0b] inline-block" />
            <span>Warning Deviation</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-xs bg-[#ef4444] inline-block" />
            <span>Critical Deviation</span>
          </div>
        </div>

        <span className="text-[11px] text-slate-500">
          Click any bar to inspect asset
        </span>
      </div>
    </div>
  );
};

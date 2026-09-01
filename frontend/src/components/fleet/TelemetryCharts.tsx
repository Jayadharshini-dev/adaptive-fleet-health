import React, { useState } from 'react';
import type { TelemetryReading, AdaptiveBaseline } from '../../types/fleet';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { Thermometer, Activity, Zap, RotateCw, Layers, Eye } from 'lucide-react';

interface TelemetryChartsProps {
  history?: TelemetryReading[];
  baseline?: AdaptiveBaseline | null;
  deviceId: string;
  anomalyOnsetIndex?: number | null;
  detectionPointIndex?: number | null;
}

type MetricType = 'temperature' | 'vibration' | 'current' | 'rpm' | 'all';

export const TelemetryCharts: React.FC<TelemetryChartsProps> = ({
  history = [],
  baseline,
  deviceId,
  anomalyOnsetIndex,
  detectionPointIndex,
}) => {
  const [activeMetric, setActiveMetric] = useState<MetricType>('temperature');

  const configs = {
    temperature: {
      label: 'Temperature',
      unit: '°C',
      icon: Thermometer,
      color: '#f43f5e',
      baselineKey: 'tempMean',
      dataKey: 'temperature',
      yDomain: (mean: number, std: number) => [
        Math.max(0, Math.floor(mean - std * 5)),
        Math.ceil(mean + std * 6),
      ],
    },
    vibration: {
      label: 'Vibration',
      unit: 'mm/s',
      icon: Activity,
      color: '#a855f7',
      baselineKey: 'vibMean',
      dataKey: 'vibration',
      yDomain: (mean: number, std: number) => [
        0,
        Math.max(4, Number((mean + std * 6).toFixed(1))),
      ],
    },
    current: {
      label: 'Current',
      unit: 'A',
      icon: Zap,
      color: '#f59e0b',
      baselineKey: 'currMean',
      dataKey: 'current',
      yDomain: (mean: number, std: number) => [
        Math.max(0, Math.floor(mean - std * 4)),
        Math.ceil(mean + std * 6),
      ],
    },
    rpm: {
      label: 'RPM',
      unit: 'rpm',
      icon: RotateCw,
      color: '#06b6d4',
      baselineKey: 'rpmMean',
      dataKey: 'rpm',
      yDomain: (mean: number, std: number) => [
        Math.max(0, Math.floor(mean - std * 4)),
        Math.ceil(mean + std * 6),
      ],
    },
  };

  const tempMean = baseline?.temperature_mean ?? 62.1;
  const tempStd = baseline?.temperature_std ?? 1.6;
  const vibMean = baseline?.vibration_mean ?? 2.1;
  const vibStd = baseline?.vibration_std ?? 0.3;
  const currMean = baseline?.current_mean ?? 8.3;
  const currStd = baseline?.current_std ?? 0.5;
  const rpmMean = baseline?.rpm_mean ?? 1482;
  const rpmStd = baseline?.rpm_std ?? 22;

  // Format chart data
  const chartData = history.map((item, idx) => {
    const timeStr = item.timestamp
      ? new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      : `T-${history.length - idx}`;

    return {
      index: idx,
      time: timeStr,
      rawTimestamp: item.timestamp,
      temperature: item.temperature,
      vibration: item.vibration,
      current: item.current,
      rpm: item.rpm,
      is_anomaly: item.is_anomaly,
      anomaly_label: item.anomaly_label,

      // Baseline reference lines
      tempMean,
      vibMean,
      currMean,
      rpmMean,
    };
  });

  const onsetItem = anomalyOnsetIndex !== null && anomalyOnsetIndex !== undefined && chartData[anomalyOnsetIndex]
    ? chartData[anomalyOnsetIndex].time
    : null;

  const detectionItem = detectionPointIndex !== null && detectionPointIndex !== undefined && chartData[detectionPointIndex]
    ? chartData[detectionPointIndex].time
    : null;

  const tabs: Array<{ id: MetricType; label: string; icon: React.ElementType; unit: string; color: string }> = [
    { id: 'temperature', label: 'Temperature', icon: Thermometer, unit: '°C', color: '#f43f5e' },
    { id: 'vibration', label: 'Vibration', icon: Activity, unit: 'mm/s', color: '#a855f7' },
    { id: 'current', label: 'Current', icon: Zap, unit: 'A', color: '#f59e0b' },
    { id: 'rpm', label: 'RPM', icon: RotateCw, unit: 'rpm', color: '#06b6d4' },
    { id: 'all', label: 'Multi-Sensor Overlay', icon: Layers, unit: '', color: '#38bdf8' },
  ];

  const currentConfig = activeMetric !== 'all' ? configs[activeMetric] : null;

  return (
    <div className="cool-panel rounded-xl border border-[#D8E5F0] bg-white p-4 font-mono shadow-xs">
      {/* Metric Selector Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#D8E5F0] pb-3 mb-4">
        <div className="flex items-center gap-1.5 flex-wrap">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeMetric === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveMetric(tab.id)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#EFF6FF] border border-[#BFDBFE] text-[#2563EB] font-bold shadow-xs'
                    : 'text-[#526174] hover:bg-[#F8FBFF] hover:text-[#172033] border border-transparent'
                }`}
              >
                <Icon size={14} style={{ color: tab.color }} />
                <span>{tab.label}</span>
                {tab.unit && <span className="text-[10px] text-[#8494A7]">({tab.unit})</span>}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-[11px] text-[#526174]">
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-3 bg-[#2563EB] inline-block" />
            Actual Telemetry
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-3 bg-[#8494A7] inline-block border-t border-dashed border-[#8494A7]" />
            Learned Baseline
          </span>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="h-64 w-full">
        {chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-[#526174]">
            No telemetry history available for {deviceId}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
              <XAxis
                dataKey="time"
                stroke="#CBD5E1"
                tick={{ fill: '#526174', fontSize: 10 }}
                tickLine={false}
              />
              <YAxis
                stroke="#CBD5E1"
                tick={{ fill: '#526174', fontSize: 10 }}
                tickLine={false}
                domain={
                  activeMetric !== 'all' && currentConfig
                    ? currentConfig.yDomain(
                        activeMetric === 'temperature' ? tempMean : activeMetric === 'vibration' ? vibMean : activeMetric === 'current' ? currMean : rpmMean,
                        activeMetric === 'temperature' ? tempStd : activeMetric === 'vibration' ? vibStd : activeMetric === 'current' ? currStd : rpmStd
                      )
                    : ['auto', 'auto']
                }
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="rounded-lg border border-slate-700 bg-slate-900/95 p-3 shadow-xl backdrop-blur-md text-xs font-mono">
                        <div className="text-[11px] text-slate-400 border-b border-slate-800 pb-1.5 mb-2 flex items-center justify-between">
                          <span>{data.rawTimestamp || label}</span>
                          {data.is_anomaly && (
                            <span className="rounded bg-rose-500/20 border border-rose-500/30 px-1 py-0.2 text-[9px] font-bold text-rose-300">
                              {data.anomaly_label || 'ANOMALY'}
                            </span>
                          )}
                        </div>

                        {activeMetric !== 'all' && currentConfig ? (
                          <div className="space-y-1">
                            <div className="flex justify-between gap-4">
                              <span className="text-slate-400">Actual {currentConfig.label}:</span>
                              <span className="font-bold text-slate-100">
                                {data[currentConfig.dataKey]} {currentConfig.unit}
                              </span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-slate-500">Learned Baseline:</span>
                              <span className="text-slate-300">
                                {data[currentConfig.baselineKey]} {currentConfig.unit}
                              </span>
                            </div>
                            <div className="flex justify-between gap-4 pt-1 border-t border-slate-800">
                              <span className="text-slate-500">Deviation:</span>
                              <span className="font-bold text-cyan-300">
                                {(data[currentConfig.dataKey] - data[currentConfig.baselineKey]) > 0 ? '+' : ''}
                                {(data[currentConfig.dataKey] - data[currentConfig.baselineKey]).toFixed(activeMetric === 'rpm' ? 0 : 2)}{' '}
                                {currentConfig.unit}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <div className="flex justify-between gap-4">
                              <span className="text-rose-400">Temp:</span>
                              <span>{data.temperature}°C</span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-purple-400">Vib:</span>
                              <span>{data.vibration} mm/s</span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-amber-400">Current:</span>
                              <span>{data.current} A</span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-cyan-400">RPM:</span>
                              <span>{data.rpm}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  }
                  return null;
                }}
              />

              {/* Anomaly Onset Annotation */}
              {onsetItem && (
                <ReferenceLine
                  x={onsetItem}
                  stroke="#f59e0b"
                  strokeDasharray="4 4"
                  label={{
                    value: 'Anomaly Onset',
                    fill: '#f59e0b',
                    fontSize: 10,
                    position: 'top',
                  }}
                />
              )}

              {/* Detection Point Annotation */}
              {detectionItem && (
                <ReferenceLine
                  x={detectionItem}
                  stroke="#f43f5e"
                  strokeWidth={1.5}
                  label={{
                    value: 'Flagged by Engine',
                    fill: '#f43f5e',
                    fontSize: 10,
                    position: 'top',
                  }}
                />
              )}

              {/* Render Lines Based on Active Tab */}
              {activeMetric === 'temperature' && (
                <>
                  <ReferenceLine
                    y={tempMean}
                    stroke="#94a3b8"
                    strokeDasharray="4 4"
                    label={{ value: `Baseline: ${tempMean}°C`, fill: '#94a3b8', fontSize: 9, position: 'right' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="temperature"
                    stroke="#f43f5e"
                    strokeWidth={2}
                    dot={{ r: 2.5, fill: '#f43f5e' }}
                    activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }}
                  />
                </>
              )}

              {activeMetric === 'vibration' && (
                <>
                  <ReferenceLine
                    y={vibMean}
                    stroke="#94a3b8"
                    strokeDasharray="4 4"
                    label={{ value: `Baseline: ${vibMean} mm/s`, fill: '#94a3b8', fontSize: 9, position: 'right' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="vibration"
                    stroke="#a855f7"
                    strokeWidth={2}
                    dot={{ r: 2.5, fill: '#a855f7' }}
                    activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }}
                  />
                </>
              )}

              {activeMetric === 'current' && (
                <>
                  <ReferenceLine
                    y={currMean}
                    stroke="#94a3b8"
                    strokeDasharray="4 4"
                    label={{ value: `Baseline: ${currMean} A`, fill: '#94a3b8', fontSize: 9, position: 'right' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="current"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={{ r: 2.5, fill: '#f59e0b' }}
                    activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }}
                  />
                </>
              )}

              {activeMetric === 'rpm' && (
                <>
                  <ReferenceLine
                    y={rpmMean}
                    stroke="#94a3b8"
                    strokeDasharray="4 4"
                    label={{ value: `Baseline: ${rpmMean} rpm`, fill: '#94a3b8', fontSize: 9, position: 'right' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="rpm"
                    stroke="#06b6d4"
                    strokeWidth={2}
                    dot={{ r: 2.5, fill: '#06b6d4' }}
                    activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }}
                  />
                </>
              )}

              {activeMetric === 'all' && (
                <>
                  <Line type="monotone" dataKey="temperature" stroke="#f43f5e" strokeWidth={1.5} dot={false} name="Temperature" />
                  <Line type="monotone" dataKey="vibration" stroke="#a855f7" strokeWidth={1.5} dot={false} name="Vibration" />
                  <Line type="monotone" dataKey="current" stroke="#f59e0b" strokeWidth={1.5} dot={false} name="Current" />
                </>
              )}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Chart Footer with Product Principle Note */}
      <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
        <span className="flex items-center gap-1.5">
          <Eye size={12} className="text-cyan-400" />
          Individual baseline learned per device.
        </span>
        <span>{chartData.length} continuous observations recorded</span>
      </div>
    </div>
  );
};

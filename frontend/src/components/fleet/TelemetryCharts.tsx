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
import { formatTimestamp } from '../../utils/formatters';

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
      color: '#dc2626',
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
      color: '#c2410c',
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
      color: '#d97706',
      baselineKey: 'currMean',
      dataKey: 'current',
      yDomain: (mean: number, std: number) => [
        Math.max(0, Math.floor(mean - std * 4)),
        Math.ceil(mean + std * 6),
      ],
    },
    rpm: {
      label: 'RPM',
      unit: 'RPM',
      icon: RotateCw,
      color: '#16a34a',
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

  const chartData = history.map((item, idx) => {
    const timeStr = formatTimestamp(item.timestamp);
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
    { id: 'temperature', label: 'Temperature', icon: Thermometer, unit: '°C', color: '#dc2626' },
    { id: 'vibration', label: 'Vibration', icon: Activity, unit: 'mm/s', color: '#c2410c' },
    { id: 'current', label: 'Current', icon: Zap, unit: 'A', color: '#d97706' },
    { id: 'rpm', label: 'RPM', icon: RotateCw, unit: 'RPM', color: '#16a34a' },
    { id: 'all', label: 'Multi-Sensor Overlay', icon: Layers, unit: '', color: '#17191C' },
  ];

  const currentConfig = activeMetric !== 'all' ? configs[activeMetric] : null;

  return (
    <div className="rounded border border-[#E2E0D8] bg-white p-3 font-mono">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E0D8] pb-2.5 mb-3">
        <div className="flex items-center gap-1 flex-wrap">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeMetric === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveMetric(tab.id)}
                className={`flex items-center gap-1 rounded px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#F0EEE6] border border-[#CFCBC0] text-[#17191C] font-bold'
                    : 'text-[#59616A] hover:bg-[#F7F6F2] hover:text-[#17191C] border border-transparent'
                }`}
              >
                <Icon size={13} style={{ color: tab.color }} />
                <span>{tab.label}</span>
                {tab.unit && <span className="text-[10px] text-[#7A838C]">({tab.unit})</span>}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3 text-[11px] text-[#59616A]">
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-3 bg-[#17191C] inline-block" />
            Actual Telemetry
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-3 bg-[#7A838C] inline-block border-t border-dashed border-[#7A838C]" />
            Learned Baseline
          </span>
        </div>
      </div>

      <div className="h-60 w-full">
        {chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-[#59616A]">
            No telemetry history available for {deviceId}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="2 2" stroke="#E2E0D8" vertical={false} />
              <XAxis
                dataKey="time"
                stroke="#7A838C"
                tick={{ fill: '#59616A', fontSize: 10 }}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                stroke="#7A838C"
                tick={{ fill: '#59616A', fontSize: 10 }}
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
                      <div className="rounded border border-[#CFCBC0] bg-white p-2.5 shadow-md text-xs font-mono text-[#17191C]">
                        <div className="text-[10px] text-[#59616A] border-b border-[#E2E0D8] pb-1 mb-1.5 flex items-center justify-between gap-3">
                          <span>{data.rawTimestamp || label}</span>
                          {data.is_anomaly && (
                            <span className="rounded bg-[#fee2e2] border border-[#fca5a5] px-1 py-0.2 text-[9px] font-bold text-[#dc2626]">
                              {data.anomaly_label || 'ANOMALY'}
                            </span>
                          )}
                        </div>

                        {activeMetric !== 'all' && currentConfig ? (
                          <div className="space-y-1">
                            <div className="flex justify-between gap-4">
                              <span className="text-[#59616A]">Actual {currentConfig.label}:</span>
                              <span className="font-bold text-[#17191C]">
                                {data[currentConfig.dataKey]} {currentConfig.unit}
                              </span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-[#7A838C]">Learned Baseline:</span>
                              <span className="text-[#59616A]">
                                {data[currentConfig.baselineKey]} {currentConfig.unit}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <div className="flex justify-between gap-4">
                              <span className="text-[#dc2626]">Temp:</span>
                              <span>{data.temperature} °C</span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-[#c2410c]">Vib:</span>
                              <span>{data.vibration} mm/s</span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-[#d97706]">Current:</span>
                              <span>{data.current} A</span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-[#16a34a]">RPM:</span>
                              <span>{data.rpm} RPM</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  }
                  return null;
                }}
              />

              {onsetItem && (
                <ReferenceLine
                  x={onsetItem}
                  stroke="#d97706"
                  strokeDasharray="3 3"
                  label={{ value: 'Onset', fill: '#d97706', fontSize: 10, position: 'top' }}
                />
              )}

              {detectionItem && (
                <ReferenceLine
                  x={detectionItem}
                  stroke="#dc2626"
                  strokeWidth={1.5}
                  label={{ value: 'Flagged', fill: '#dc2626', fontSize: 10, position: 'top' }}
                />
              )}

              {activeMetric === 'temperature' && (
                <>
                  <ReferenceLine
                    y={tempMean}
                    stroke="#7A838C"
                    strokeDasharray="4 4"
                    label={{ value: `Baseline: ${tempMean}°C`, fill: '#7A838C', fontSize: 9, position: 'right' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="temperature"
                    stroke="#dc2626"
                    strokeWidth={1.5}
                    dot={{ r: 2, fill: '#dc2626' }}
                    activeDot={{ r: 4, stroke: '#17191C', strokeWidth: 1 }}
                  />
                </>
              )}

              {activeMetric === 'vibration' && (
                <>
                  <ReferenceLine
                    y={vibMean}
                    stroke="#7A838C"
                    strokeDasharray="4 4"
                    label={{ value: `Baseline: ${vibMean} mm/s`, fill: '#7A838C', fontSize: 9, position: 'right' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="vibration"
                    stroke="#c2410c"
                    strokeWidth={1.5}
                    dot={{ r: 2, fill: '#c2410c' }}
                    activeDot={{ r: 4, stroke: '#17191C', strokeWidth: 1 }}
                  />
                </>
              )}

              {activeMetric === 'current' && (
                <>
                  <ReferenceLine
                    y={currMean}
                    stroke="#7A838C"
                    strokeDasharray="4 4"
                    label={{ value: `Baseline: ${currMean} A`, fill: '#7A838C', fontSize: 9, position: 'right' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="current"
                    stroke="#d97706"
                    strokeWidth={1.5}
                    dot={{ r: 2, fill: '#d97706' }}
                    activeDot={{ r: 4, stroke: '#17191C', strokeWidth: 1 }}
                  />
                </>
              )}

              {activeMetric === 'rpm' && (
                <>
                  <ReferenceLine
                    y={rpmMean}
                    stroke="#7A838C"
                    strokeDasharray="4 4"
                    label={{ value: `Baseline: ${rpmMean} RPM`, fill: '#7A838C', fontSize: 9, position: 'right' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="rpm"
                    stroke="#16a34a"
                    strokeWidth={1.5}
                    dot={{ r: 2, fill: '#16a34a' }}
                    activeDot={{ r: 4, stroke: '#17191C', strokeWidth: 1 }}
                  />
                </>
              )}

              {activeMetric === 'all' && (
                <>
                  <Line type="monotone" dataKey="temperature" stroke="#dc2626" strokeWidth={1.5} dot={false} name="Temperature" />
                  <Line type="monotone" dataKey="vibration" stroke="#c2410c" strokeWidth={1.5} dot={false} name="Vibration" />
                  <Line type="monotone" dataKey="current" stroke="#d97706" strokeWidth={1.5} dot={false} name="Current" />
                </>
              )}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="mt-2.5 pt-2 border-t border-[#E2E0D8] flex items-center justify-between text-[10px] text-[#59616A]">
        <span className="flex items-center gap-1.5">
          <Eye size={11} className="text-[#c2410c]" />
          Adaptive per-device learned baseline.
        </span>
        <span>{chartData.length} observations recorded</span>
      </div>
    </div>
  );
};

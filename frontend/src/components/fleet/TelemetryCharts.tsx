import React, { useState, useEffect } from 'react';
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
import { Thermometer, Activity, Zap, RotateCw, Layers } from 'lucide-react';
import { formatTimestamp } from '../../utils/formatters';

export type MetricType = 'temperature' | 'vibration' | 'current' | 'rpm' | 'all';

interface TelemetryChartsProps {
  history?: TelemetryReading[];
  baseline?: AdaptiveBaseline | null;
  deviceId: string;
  anomalyType?: string;
  suggestedMetric?: MetricType;
  anomalyOnsetIndex?: number | null;
  detectionPointIndex?: number | null;
}

export const TelemetryCharts: React.FC<TelemetryChartsProps> = ({
  history = [],
  baseline,
  deviceId,
  anomalyType = 'none',
  suggestedMetric,
  anomalyOnsetIndex,
  detectionPointIndex,
}) => {
  // Determine initial metric based on anomaly type if not explicitly set
  const getInitialMetric = (): MetricType => {
    if (suggestedMetric) return suggestedMetric;
    const anom = anomalyType.toLowerCase();
    if (anom === 'spike') return 'current';
    if (anom === 'flatline' || anom === 'oscillation') return 'vibration';
    if (anom === 'drift') return 'temperature';
    if (anom === 'sensor_swap') return 'all';
    return 'temperature';
  };

  const [activeMetric, setActiveMetric] = useState<MetricType>(getInitialMetric());

  useEffect(() => {
    setActiveMetric(getInitialMetric());
  }, [anomalyType, suggestedMetric]);

  const configs = {
    temperature: {
      label: 'Temperature',
      unit: '°C',
      icon: Thermometer,
      color: '#dc2626',
      baselineKey: 'tempMean',
      dataKey: 'temperature',
      yDomain: (_minVal: number, maxVal: number, mean: number, std: number) => [
        Math.max(0, Math.floor(Math.min(minVal, mean - std * 3) - 5)),
        Math.ceil(Math.max(maxVal, mean + std * 6) + 5),
      ],
    },
    vibration: {
      label: 'Vibration',
      unit: 'mm/s',
      icon: Activity,
      color: '#c2410c',
      baselineKey: 'vibMean',
      dataKey: 'vibration',
      yDomain: (_minVal: number, maxVal: number, mean: number, std: number) => [
        0,
        Math.max(5.0, Math.ceil(Math.max(maxVal, mean + std * 6) + 1)),
      ],
    },
    current: {
      label: 'Current',
      unit: 'A',
      icon: Zap,
      color: '#d97706',
      baselineKey: 'currMean',
      dataKey: 'current',
      yDomain: (_minVal: number, maxVal: number, mean: number, std: number) => [
        Math.max(0, Math.floor(Math.min(minVal, mean - std * 2) - 2)),
        Math.ceil(Math.max(maxVal, mean + std * 8) + 5),
      ],
    },
    rpm: {
      label: 'RPM',
      unit: 'RPM',
      icon: RotateCw,
      color: '#16a34a',
      baselineKey: 'rpmMean',
      dataKey: 'rpm',
      yDomain: (_minVal: number, maxVal: number, mean: number, std: number) => [
        Math.max(0, Math.floor(Math.min(minVal, mean - std * 4) - 50)),
        Math.ceil(Math.max(maxVal, mean + std * 6) + 50),
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
      tempUpper: Number((tempMean + 2 * tempStd).toFixed(2)),
      tempLower: Number((tempMean - 2 * tempStd).toFixed(2)),
      vibMean,
      vibUpper: Number((vibMean + 2 * vibStd).toFixed(2)),
      vibLower: Number((vibMean - 2 * vibStd).toFixed(2)),
      currMean,
      currUpper: Number((currMean + 2 * currStd).toFixed(2)),
      currLower: Number((currMean - 2 * currStd).toFixed(2)),
      rpmMean,
      rpmUpper: Number((rpmMean + 2 * rpmStd).toFixed(1)),
      rpmLower: Number((rpmMean - 2 * rpmStd).toFixed(1)),
    };
  });

  const tabs: Array<{ id: MetricType; label: string; icon: React.ElementType; unit: string; color: string }> = [
    { id: 'temperature', label: 'Temperature', icon: Thermometer, unit: '°C', color: '#dc2626' },
    { id: 'vibration', label: 'Vibration', icon: Activity, unit: 'mm/s', color: '#c2410c' },
    { id: 'current', label: 'Current', icon: Zap, unit: 'A', color: '#d97706' },
    { id: 'rpm', label: 'RPM', icon: RotateCw, unit: 'RPM', color: '#16a34a' },
    { id: 'all', label: 'Multi-Sensor Overlay', icon: Layers, unit: '', color: '#17191C' },
  ];

  const currentConfig = activeMetric !== 'all' ? configs[activeMetric] : null;

  // Calculate actual min/max across history for active metric
  let minVal = 0;
  let maxVal = 100;
  if (activeMetric !== 'all' && chartData.length > 0) {
    const vals = chartData.map((d) => Number(d[activeMetric as keyof typeof d] || 0));
    minVal = Math.min(...vals);
    maxVal = Math.max(...vals);
  }

  const getMeanForActive = () => {
    if (activeMetric === 'temperature') return tempMean;
    if (activeMetric === 'vibration') return vibMean;
    if (activeMetric === 'current') return currMean;
    return rpmMean;
  };

  const getStdForActive = () => {
    if (activeMetric === 'temperature') return tempStd;
    if (activeMetric === 'vibration') return vibStd;
    if (activeMetric === 'current') return currStd;
    return rpmStd;
  };

  return (
    <div className="rounded border border-[#E2E0D8] bg-white p-3 font-mono">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E0D8] pb-2.5 mb-3">
        <div className="flex items-center gap-1 flex-wrap">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeMetric === tab.id;
            const isTarget =
              (tab.id === 'temperature' && anomalyType === 'drift') ||
              (tab.id === 'current' && anomalyType === 'spike') ||
              (tab.id === 'vibration' && (anomalyType === 'flatline' || anomalyType === 'oscillation')) ||
              (tab.id === 'all' && anomalyType === 'sensor_swap');

            return (
              <button
                key={tab.id}
                onClick={() => setActiveMetric(tab.id)}
                className={`flex items-center gap-1 rounded px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#F0EEE6] border border-[#CFCBC0] text-[#17191C] font-bold shadow-xs'
                    : 'text-[#59616A] hover:bg-[#F7F6F2] hover:text-[#17191C] border border-transparent'
                }`}
              >
                <Icon size={13} style={{ color: tab.color }} />
                <span>{tab.label}</span>
                {tab.unit && <span className="text-[10px] text-[#7A838C]">({tab.unit})</span>}
                {isTarget && (
                  <span className="ml-1 rounded bg-[#fee2e2] px-1 py-0.2 text-[9px] font-bold text-[#dc2626]">
                    AFFECTED
                  </span>
                )}
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

      <div className="h-64 w-full">
        {chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-[#59616A]">
            No telemetry history available for {deviceId}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
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
                    ? currentConfig.yDomain(minVal, maxVal, getMeanForActive(), getStdForActive())
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
                            <div className="flex justify-between gap-4 text-[#7A838C]">
                              <span>Learned Baseline:</span>
                              <span>
                                {getMeanForActive()} {currentConfig.unit}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                            <div>Temp: <span className="font-bold">{data.temperature}°C</span></div>
                            <div>Vib: <span className="font-bold">{data.vibration} mm/s</span></div>
                            <div>Curr: <span className="font-bold">{data.current} A</span></div>
                            <div>RPM: <span className="font-bold">{data.rpm}</span></div>
                          </div>
                        )}
                      </div>
                    );
                  }
                  return null;
                }}
              />

              {/* Baseline Reference Line */}
              {activeMetric !== 'all' && (
                <ReferenceLine
                  y={getMeanForActive()}
                  stroke="#7A838C"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={{
                    value: `Baseline (${getMeanForActive()})`,
                    fill: '#7A838C',
                    fontSize: 9,
                    position: 'insideBottomRight',
                  }}
                />
              )}
              {anomalyOnsetIndex !== undefined && anomalyOnsetIndex !== null && chartData[anomalyOnsetIndex] && (
                <ReferenceLine
                  x={chartData[anomalyOnsetIndex].time}
                  stroke="#dc2626"
                  strokeDasharray="3 3"
                  label={{ value: 'Onset', fill: '#dc2626', fontSize: 9, position: 'insideTopLeft' }}
                />
              )}
              {detectionPointIndex !== undefined && detectionPointIndex !== null && chartData[detectionPointIndex] && (
                <ReferenceLine
                  x={chartData[detectionPointIndex].time}
                  stroke="#ea580c"
                  strokeDasharray="2 2"
                  label={{ value: 'Detected', fill: '#ea580c', fontSize: 9, position: 'insideTopRight' }}
                />
              )}

              {/* Single Metric Trace */}
              {activeMetric !== 'all' && currentConfig && (
                <Line
                  type="monotone"
                  dataKey={currentConfig.dataKey}
                  stroke={currentConfig.color}
                  strokeWidth={2.2}
                  dot={(props: any) => {
                    const { cx, cy, payload } = props;
                    if (payload && payload.is_anomaly) {
                      return (
                        <circle
                          key={`dot-anom-${props.index}`}
                          cx={cx}
                          cy={cy}
                          r={4}
                          fill="#dc2626"
                          stroke="#ffffff"
                          strokeWidth={1.5}
                        />
                      );
                    }
                    return <circle key={`dot-${props.index}`} cx={cx} cy={cy} r={1.5} fill={currentConfig.color} />;
                  }}
                  isAnimationActive={false}
                />
              )}

              {/* Multi-Sensor Overlay */}
              {activeMetric === 'all' && (
                <>
                  <Line type="monotone" dataKey="temperature" stroke="#dc2626" strokeWidth={1.8} dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="vibration" stroke="#c2410c" strokeWidth={1.8} dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="current" stroke="#d97706" strokeWidth={1.8} dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="rpm" stroke="#16a34a" strokeWidth={1.8} dot={false} isAnimationActive={false} />
                </>
              )}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

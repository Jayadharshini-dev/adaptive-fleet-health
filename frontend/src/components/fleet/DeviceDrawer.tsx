import React, { useState } from 'react';
import { useFleetStore } from '../../store/fleetContext';
import { StatusBadge } from '../common/StatusBadge';
import { FailureTypeBadge } from '../common/FailureTypeBadge';
import { MetricCard } from '../common/MetricCard';
import { SeverityGauge } from '../common/SeverityGauge';
import { TelemetryCharts } from './TelemetryCharts';
import { DetectorEvidence } from './DetectorEvidence';
import { BaselineLearningCard } from './BaselineLearningCard';
import { X, HelpCircle, Layers, Fingerprint, Clock, Info, CheckCircle2, UserCheck } from 'lucide-react';
import { formatTimestamp } from '../../utils/formatters';

export const DeviceDrawer: React.FC = () => {
  const {
    selectedDevice,
    setSelectedDeviceId,
    alerts,
    acknowledgeAlert,
    resolveAlert,
    userSession,
  } = useFleetStore();

  const [resolutionInput, setResolutionInput] = useState('');
  const [showResolvePrompt, setShowResolvePrompt] = useState(false);

  if (!selectedDevice) return null;

  const reading = selectedDevice.latest_reading;
  const history = selectedDevice.history || [];
  const activeBaseline = selectedDevice.baseline;

  const currentAlert = alerts.find(
    (a) => a.device_id === selectedDevice.device_id && a.lifecycle_status !== 'RESOLVED'
  ) || selectedDevice.latest_alert;

  const handleAcknowledge = async () => {
    if (currentAlert) {
      await acknowledgeAlert(currentAlert.id);
    }
  };

  const handleResolve = async () => {
    if (currentAlert) {
      const reason = resolutionInput.trim() || 'Operator inspection completed';
      await resolveAlert(currentAlert.id, reason);
      setShowResolvePrompt(false);
      setResolutionInput('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs font-mono flex items-center justify-center p-4">
      <div className="relative w-full max-w-3xl max-h-[90vh] bg-white border border-[#E2E0D8] rounded shadow-2xl flex flex-col overflow-hidden">
          {/* Drawer Header */}
          <div className="border-b border-[#E2E0D8] bg-[#F7F6F2] p-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-[#c2410c] tracking-widest uppercase">
                    DEVICE INVESTIGATION
                  </span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded border border-[#E2E0D8] bg-[#F0EEE6] font-bold text-[#59616A]">
                    {selectedDevice.region} Region
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-bold text-[#17191C]">
                    {selectedDevice.device_id}
                  </h2>
                  <StatusBadge status={selectedDevice.status} size="md" />
                  {selectedDevice.anomaly_type !== 'none' && (
                    <FailureTypeBadge
                      type={selectedDevice.anomaly_type}
                      confidence={selectedDevice.confidence}
                      size="md"
                    />
                  )}
                </div>
              </div>

              <button
                onClick={() => setSelectedDeviceId(null)}
                className="rounded p-1.5 text-[#59616A] hover:bg-[#E2E0D8] hover:text-[#17191C] transition-colors cursor-pointer"
                title="Close device investigation"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between text-[11px] font-mono text-[#59616A] pt-2 border-t border-[#E2E0D8]">
              <span className="flex items-center gap-1">
                <Fingerprint size={12} className="text-[#7A838C]" />
                Instance: {selectedDevice.device_instance_id}
              </span>
              <span className="flex items-center gap-1">
                <Clock size={12} className="text-[#7A838C]" />
                Updated: {formatTimestamp(selectedDevice.last_updated)}
              </span>
            </div>
          </div>

          {/* Drawer Body */}
          <div className="p-6 space-y-5 overflow-y-auto">
            {/* Why Was This Flagged? + Incident Lifecycle Buttons */}
            {selectedDevice.status !== 'HEALTHY' && selectedDevice.explanation && (
              <div className="rounded border border-[#fde68a] bg-[#fef3c7]/50 p-4 font-mono space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[#d97706] font-bold text-xs uppercase tracking-wider">
                    <HelpCircle size={15} />
                    WHY WAS THIS FLAGGED?
                  </div>

                  {currentAlert && (
                    <span className={`text-[10px] px-2 py-0.5 rounded border font-bold ${
                      currentAlert.lifecycle_status === 'ACTIVE'
                        ? 'bg-[#fee2e2] border-[#fca5a5] text-[#dc2626]'
                        : currentAlert.lifecycle_status === 'ACKNOWLEDGED'
                        ? 'bg-[#fef3c7] border-[#fde68a] text-[#d97706]'
                        : 'bg-[#f0fdf4] border-[#bbf7d0] text-[#16a34a]'
                    }`}>
                      {currentAlert.lifecycle_status}
                    </span>
                  )}
                </div>

                <p className="text-xs text-[#17191C] font-sans leading-relaxed">
                  {selectedDevice.explanation}
                </p>

                {/* Operator Incident Lifecycle Controls */}
                {currentAlert && (
                  <div className="pt-2 border-t border-[#fde68a] space-y-2">
                    {currentAlert.lifecycle_status === 'ACTIVE' && (
                      <button
                        onClick={handleAcknowledge}
                        className="w-full flex items-center justify-center gap-2 rounded bg-[#d97706] px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-white hover:bg-[#b45309] transition-colors cursor-pointer shadow-xs"
                      >
                        <UserCheck size={14} />
                        <span>ACKNOWLEDGE INCIDENT ({userSession?.full_name || 'Operator 01'})</span>
                      </button>
                    )}

                    {currentAlert.lifecycle_status === 'ACKNOWLEDGED' && (
                      <div className="space-y-2">
                        <div className="text-[11px] text-[#d97706] font-bold flex items-center gap-1.5">
                          <CheckCircle2 size={13} />
                          <span>
                            ACKNOWLEDGED by {currentAlert.acknowledged_by || 'Operator'} at {formatTimestamp(currentAlert.acknowledged_at || '')}
                          </span>
                        </div>

                        {!showResolvePrompt ? (
                          <button
                            onClick={() => setShowResolvePrompt(true)}
                            className="w-full flex items-center justify-center gap-2 rounded bg-[#16a34a] px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-white hover:bg-[#15803d] transition-colors cursor-pointer shadow-xs"
                          >
                            <CheckCircle2 size={14} />
                            <span>RESOLVE INCIDENT</span>
                          </button>
                        ) : (
                          <div className="space-y-2 p-2 bg-white rounded border border-[#E2E0D8]">
                            <input
                              type="text"
                              placeholder="Resolution reason (e.g. Operator inspection completed)"
                              value={resolutionInput}
                              onChange={(e) => setResolutionInput(e.target.value)}
                              className="w-full rounded border border-[#E2E0D8] bg-[#F7F6F2] p-2 text-xs font-mono text-[#17191C]"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={handleResolve}
                                className="flex-1 rounded bg-[#16a34a] py-1.5 text-xs font-bold text-white uppercase tracking-wider cursor-pointer"
                              >
                                Confirm Resolution
                              </button>
                              <button
                                onClick={() => setShowResolvePrompt(false)}
                                className="rounded bg-[#F0EEE6] px-3 py-1.5 text-xs text-[#59616A] font-bold cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {currentAlert.lifecycle_status === 'RESOLVED' && (
                      <div className="text-[11px] text-[#16a34a] font-bold">
                        RESOLVED by {currentAlert.resolved_by || 'Operator'} at {formatTimestamp(currentAlert.resolved_at || '')}
                        {currentAlert.resolution_reason && (
                          <span className="block font-normal text-[#59616A] text-[10px] mt-0.5">
                            Reason: {currentAlert.resolution_reason}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <BaselineLearningCard baseline={activeBaseline} />

            <div>
              <div className="flex items-center justify-between mb-2 font-mono">
                <span className="text-xs font-bold tracking-wider text-[#17191C] uppercase flex items-center gap-1.5">
                  <Layers size={14} className="text-[#c2410c]" />
                  Canonical Telemetry Metrics
                </span>
                <span className="text-[11px] text-[#59616A]">
                  Current vs Learned Baseline
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <MetricCard
                  name="temperature"
                  currentValue={reading?.temperature ?? 62.0}
                  baselineValue={activeBaseline?.temperature_mean ?? 62.1}
                  std={activeBaseline?.temperature_std ?? 1.8}
                  unit="°C"
                />
                <MetricCard
                  name="vibration"
                  currentValue={reading?.vibration ?? 2.0}
                  baselineValue={activeBaseline?.vibration_mean ?? 2.1}
                  std={activeBaseline?.vibration_std ?? 0.3}
                  unit="mm/s"
                />
                <MetricCard
                  name="current"
                  currentValue={reading?.current ?? 8.0}
                  baselineValue={activeBaseline?.current_mean ?? 8.3}
                  std={activeBaseline?.current_std ?? 0.5}
                  unit="A"
                />
                <MetricCard
                  name="rpm"
                  currentValue={reading?.rpm ?? 1480}
                  baselineValue={activeBaseline?.rpm_mean ?? 1482}
                  std={activeBaseline?.rpm_std ?? 22}
                  unit="rpm"
                />
              </div>
            </div>

            {selectedDevice.status !== 'HEALTHY' && (
              <SeverityGauge
                severity={selectedDevice.severity || 0.75}
                confidence={selectedDevice.confidence || 0.88}
              />
            )}

            <div>
              <div className="flex items-center justify-between mb-2 font-mono">
                <span className="text-xs font-bold tracking-wider text-[#17191C] uppercase">
                  Actual Telemetry vs Learned Baseline
                </span>
                <span className="text-[11px] text-[#59616A]">
                  {history.length} samples
                </span>
              </div>

              <TelemetryCharts
                history={history}
                baseline={activeBaseline}
                deviceId={selectedDevice.device_id}
                anomalyOnsetIndex={selectedDevice.anomaly_onset_index}
                detectionPointIndex={selectedDevice.detection_point_index}
              />
            </div>

            <DetectorEvidence
              evidence={selectedDevice.detectors || currentAlert?.detectors}
              anomalyType={selectedDevice.anomaly_type}
            />
          </div>

          {/* Drawer Footer */}
          <div className="border-t border-[#E2E0D8] bg-[#F0EEE6] px-6 py-2.5 text-[11px] font-mono text-[#59616A] flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Info size={12} className="text-[#c2410c]" />
              Intelligence Layer Pipeline: HealthEngine Verified
            </span>
            <span>Device {selectedDevice.device_id}</span>
          </div>
        </div>
    </div>
  );
};

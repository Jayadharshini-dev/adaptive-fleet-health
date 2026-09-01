import React from 'react';
import type { Device } from '../../types/fleet';
import { StatusBadge } from '../common/StatusBadge';
import { FailureTypeBadge } from '../common/FailureTypeBadge';
import { MapPin, Thermometer, Activity, Zap, RotateCw, Clock, ArrowRight } from 'lucide-react';
import { useFleetStore } from '../../store/fleetContext';

interface DeviceCardProps {
  device: Device;
  onSelect?: (deviceId: string) => void;
  isCompact?: boolean;
}

export const DeviceCard: React.FC<DeviceCardProps> = ({
  device,
  onSelect,
  isCompact = false,
}) => {
  const { recentlyUpdatedId } = useFleetStore();
  const isRecentlyUpdated = recentlyUpdatedId === device.device_id;

  const reading = device.latest_reading;
  const lastTime = new Date(device.last_updated).toLocaleTimeString();

  // Status border & accent treatment
  const statusAccents = {
    HEALTHY: 'hover:border-[#86EFAC] border-[#D8E5F0] bg-white',
    WARNING: 'border-[#FDE68A] bg-[#FFFBEB]/40 hover:border-[#FCD34D]',
    CRITICAL: 'border-[#FECACA] bg-[#FEF2F2]/40 hover:border-[#F87171]',
  };

  const topBorderAccent = {
    HEALTHY: 'bg-[#22C55E]',
    WARNING: 'bg-[#F59E0B]',
    CRITICAL: 'bg-[#EF4444]',
  };

  const handleClick = () => {
    if (onSelect) {
      onSelect(device.device_id);
    }
  };

  if (isCompact) {
    return (
      <div
        onClick={handleClick}
        className={`group relative flex items-center justify-between rounded-xl p-3 cursor-pointer transition-all duration-150 border shadow-xs ${
          statusAccents[device.status]
        } ${isRecentlyUpdated ? 'ring-2 ring-[#2563EB] bg-[#EFF6FF]' : ''}`}
      >
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm font-bold text-[#2563EB]">
            {device.device_id}
          </span>
          <span className="flex items-center gap-1 font-mono text-xs text-[#526174]">
            <MapPin size={11} className="text-[#8494A7]" />
            {device.region}
          </span>
          <StatusBadge status={device.status} size="sm" />
          {device.anomaly_type !== 'none' && (
            <FailureTypeBadge type={device.anomaly_type} confidence={device.confidence} size="sm" />
          )}
        </div>

        <div className="flex items-center gap-4 font-mono text-xs text-[#526174]">
          <div>
            <span className="text-[#8494A7]">T: </span>
            <span className="font-bold text-[#172033]">{reading?.temperature ?? '--'}°C</span>
          </div>
          <div>
            <span className="text-[#8494A7]">V: </span>
            <span className="font-bold text-[#172033]">{reading?.vibration ?? '--'}</span>
          </div>
          <div>
            <span className="text-[#8494A7]">I: </span>
            <span className="font-bold text-[#172033]">{reading?.current ?? '--'}A</span>
          </div>
          <div>
            <span className="text-[#8494A7]">RPM: </span>
            <span className="font-bold text-[#172033]">{Math.round(reading?.rpm ?? 0)}</span>
          </div>
          {device.severity > 0 && (
            <span className="rounded bg-[#FEF2F2] border border-[#FECACA] px-1.5 py-0.5 text-[10px] font-bold text-[#B91C1C]">
              {device.severity}% sev
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={handleClick}
      className={`group relative flex flex-col justify-between overflow-hidden rounded-xl p-4 cursor-pointer transition-all duration-200 border shadow-xs ${
        statusAccents[device.status]
      } ${isRecentlyUpdated ? 'ring-2 ring-[#2563EB] bg-[#EFF6FF]' : ''}`}
    >
      {/* Top status bar accent */}
      <div className={`absolute top-0 left-0 right-0 h-[3px] ${topBorderAccent[device.status]}`} />

      {/* Card Header: ID, Region, Health & Severity */}
      <div>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-base font-bold text-[#172033] group-hover:text-[#2563EB] transition-colors">
                {device.device_id}
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#EEF7FF] border border-[#D8E5F0] text-[#526174]">
                {device.device_instance_id}
              </span>
            </div>
            <div className="flex items-center gap-1 font-mono text-xs text-[#526174] mt-0.5">
              <MapPin size={12} className="text-[#8494A7]" />
              <span>{device.region} Region</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <StatusBadge status={device.status} size="sm" />
            {device.severity > 0 && (
              <span className="font-mono text-[10px] font-bold text-[#B91C1C]">
                Severity: {device.severity}%
              </span>
            )}
          </div>
        </div>

        {/* Four Canonical Telemetry Metrics */}
        <div className="grid grid-cols-4 gap-1.5 mt-3 pt-2.5 border-t border-[#D8E5F0] font-mono text-xs">
          {/* Temperature */}
          <div className="rounded-lg bg-[#EEF7FF] p-1.5 border border-[#D8E5F0] text-center">
            <div className="flex items-center justify-center gap-0.5 text-[9px] text-[#526174] mb-0.5">
              <Thermometer size={10} className="text-[#EF4444]" />
              <span>Temp</span>
            </div>
            <span className="text-xs font-bold text-[#172033]">
              {reading?.temperature ?? '--'}
              <span className="text-[9px] font-normal text-[#526174]">°C</span>
            </span>
          </div>

          {/* Vibration */}
          <div className="rounded-lg bg-[#EEF7FF] p-1.5 border border-[#D8E5F0] text-center">
            <div className="flex items-center justify-center gap-0.5 text-[9px] text-[#526174] mb-0.5">
              <Activity size={10} className="text-[#8B5CF6]" />
              <span>Vib</span>
            </div>
            <span className="text-xs font-bold text-[#172033]">
              {reading?.vibration ?? '--'}
            </span>
          </div>

          {/* Current */}
          <div className="rounded-lg bg-[#EEF7FF] p-1.5 border border-[#D8E5F0] text-center">
            <div className="flex items-center justify-center gap-0.5 text-[9px] text-[#526174] mb-0.5">
              <Zap size={10} className="text-[#F59E0B]" />
              <span>Curr</span>
            </div>
            <span className="text-xs font-bold text-[#172033]">
              {reading?.current ?? '--'}
              <span className="text-[9px] font-normal text-[#526174]">A</span>
            </span>
          </div>

          {/* RPM */}
          <div className="rounded-lg bg-[#EEF7FF] p-1.5 border border-[#D8E5F0] text-center">
            <div className="flex items-center justify-center gap-0.5 text-[9px] text-[#526174] mb-0.5">
              <RotateCw size={10} className="text-[#2563EB]" />
              <span>RPM</span>
            </div>
            <span className="text-xs font-bold text-[#172033]">
              {Math.round(reading?.rpm ?? 0)}
            </span>
          </div>
        </div>

        {/* Anomaly Badge if Active */}
        {device.anomaly_type !== 'none' && (
          <div className="mt-2.5">
            <FailureTypeBadge
              type={device.anomaly_type}
              confidence={device.confidence}
              size="sm"
            />
          </div>
        )}
      </div>

      {/* Card Footer: Timestamp & Action */}
      <div className="mt-3 pt-2 border-t border-[#D8E5F0] flex items-center justify-between font-mono text-[11px] text-[#526174]">
        <span className="flex items-center gap-1">
          <Clock size={11} className="text-[#8494A7]" />
          <span>{lastTime}</span>
        </span>
        <span className="text-[#2563EB] group-hover:text-[#1D4ED8] transition-colors text-[10px] font-bold flex items-center gap-0.5">
          Inspect <ArrowRight size={10} />
        </span>
      </div>
    </div>
  );
};

import React from 'react';
import type { Device } from '../../types/fleet';
import { StatusBadge } from '../common/StatusBadge';
import { FailureTypeBadge } from '../common/FailureTypeBadge';
import { MapPin, Thermometer, Activity, Zap, RotateCw, Clock, ArrowRight } from 'lucide-react';
import { useFleetStore } from '../../store/fleetContext';
import { formatSeverity, formatTimestamp, formatMetricValue } from '../../utils/formatters';

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
  const lastTime = formatTimestamp(device.last_updated);

  const statusAccents = {
    HEALTHY: 'border-[#E2E0D8] bg-white hover:border-[#CFCBC0]',
    WARNING: 'border-[#fde68a] bg-[#fef3c7]/30 hover:border-[#fcd34d]',
    CRITICAL: 'border-[#fca5a5] bg-[#fee2e2]/30 hover:border-[#f87171]',
  };

  const topBorderAccent = {
    HEALTHY: 'bg-[#16a34a]',
    WARNING: 'bg-[#d97706]',
    CRITICAL: 'bg-[#dc2626]',
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
        className={`group relative flex items-center justify-between rounded p-2.5 cursor-pointer transition-all border font-mono ${
          statusAccents[device.status]
        } ${isRecentlyUpdated ? 'ring-1 ring-[#c2410c] bg-[#F0EEE6]' : ''}`}
      >
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-bold text-[#17191C]">
            {device.device_id}
          </span>
          <span className="flex items-center gap-1 text-[11px] text-[#59616A]">
            <MapPin size={10} className="text-[#7A838C]" />
            {device.region}
          </span>
          <StatusBadge status={device.status} size="sm" />
          {device.anomaly_type !== 'none' && (
            <FailureTypeBadge type={device.anomaly_type} confidence={device.confidence} size="sm" />
          )}
        </div>

        <div className="flex items-center gap-3 text-xs text-[#59616A]">
          <div>
            <span className="text-[#7A838C]">T: </span>
            <span className="font-bold text-[#17191C]">{formatMetricValue('temperature', reading?.temperature)}</span>
          </div>
          <div>
            <span className="text-[#7A838C]">V: </span>
            <span className="font-bold text-[#17191C]">{formatMetricValue('vibration', reading?.vibration)}</span>
          </div>
          <div>
            <span className="text-[#7A838C]">I: </span>
            <span className="font-bold text-[#17191C]">{formatMetricValue('current', reading?.current)}</span>
          </div>
          <div>
            <span className="text-[#7A838C]">RPM: </span>
            <span className="font-bold text-[#17191C]">{formatMetricValue('rpm', reading?.rpm)}</span>
          </div>
          {device.severity > 0 && (
            <span className="rounded bg-[#fee2e2] border border-[#fca5a5] px-1 py-0.2 text-[9px] font-bold text-[#dc2626]">
              {formatSeverity(device.severity)}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={handleClick}
      className={`group relative flex flex-col justify-between overflow-hidden rounded p-3.5 cursor-pointer transition-all border font-mono ${
        statusAccents[device.status]
      } ${isRecentlyUpdated ? 'ring-1 ring-[#c2410c] bg-[#F0EEE6]' : ''}`}
    >
      <div className={`absolute top-0 left-0 right-0 h-[2px] ${topBorderAccent[device.status]}`} />

      <div>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-[#17191C] group-hover:text-[#c2410c] transition-colors">
                {device.device_id}
              </span>
              <span className="text-[10px] px-1 py-0.2 rounded bg-[#F0EEE6] border border-[#E2E0D8] text-[#59616A]">
                {device.device_instance_id}
              </span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-[#59616A] mt-0.5">
              <MapPin size={11} className="text-[#7A838C]" />
              <span>{device.region} Region</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <StatusBadge status={device.status} size="sm" />
            {device.severity > 0 && (
              <span className="text-[10px] font-bold text-[#dc2626]">
                Sev: {formatSeverity(device.severity)}
              </span>
            )}
          </div>
        </div>

        {/* 4 Canonical Metrics */}
        <div className="grid grid-cols-4 gap-1 mt-3 pt-2 border-t border-[#E2E0D8] text-xs">
          <div className="rounded bg-[#F0EEE6] p-1 border border-[#E2E0D8] text-center">
            <div className="flex items-center justify-center gap-0.5 text-[9px] text-[#59616A] mb-0.5">
              <Thermometer size={9} className="text-[#dc2626]" />
              <span>Temp</span>
            </div>
            <span className="text-xs font-bold text-[#17191C]">
              {reading?.temperature ?? '--'}
            </span>
          </div>

          <div className="rounded bg-[#F0EEE6] p-1 border border-[#E2E0D8] text-center">
            <div className="flex items-center justify-center gap-0.5 text-[9px] text-[#59616A] mb-0.5">
              <Activity size={9} className="text-[#c2410c]" />
              <span>Vib</span>
            </div>
            <span className="text-xs font-bold text-[#17191C]">
              {reading?.vibration ?? '--'}
            </span>
          </div>

          <div className="rounded bg-[#F0EEE6] p-1 border border-[#E2E0D8] text-center">
            <div className="flex items-center justify-center gap-0.5 text-[9px] text-[#59616A] mb-0.5">
              <Zap size={9} className="text-[#d97706]" />
              <span>Curr</span>
            </div>
            <span className="text-xs font-bold text-[#17191C]">
              {reading?.current ?? '--'}
            </span>
          </div>

          <div className="rounded bg-[#F0EEE6] p-1 border border-[#E2E0D8] text-center">
            <div className="flex items-center justify-center gap-0.5 text-[9px] text-[#59616A] mb-0.5">
              <RotateCw size={9} className="text-[#16a34a]" />
              <span>RPM</span>
            </div>
            <span className="text-xs font-bold text-[#17191C]">
              {reading?.rpm ? Math.round(reading.rpm) : '--'}
            </span>
          </div>
        </div>

        {device.anomaly_type !== 'none' && (
          <div className="mt-2">
            <FailureTypeBadge
              type={device.anomaly_type}
              confidence={device.confidence}
              size="sm"
            />
          </div>
        )}
      </div>

      <div className="mt-2.5 pt-2 border-t border-[#E2E0D8] flex items-center justify-between text-[10px] text-[#59616A]">
        <span className="flex items-center gap-1">
          <Clock size={10} className="text-[#7A838C]" />
          <span>{lastTime}</span>
        </span>
        <span className="text-[#c2410c] group-hover:underline font-bold flex items-center gap-0.5">
          Inspect <ArrowRight size={10} />
        </span>
      </div>
    </div>
  );
};

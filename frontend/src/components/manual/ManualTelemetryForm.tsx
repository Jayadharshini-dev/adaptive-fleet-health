import React, { useState } from 'react';
import { useFleetStore } from '../../store/fleetContext';
import type { RegionName, HealthResult } from '../../types/fleet';
import { REGIONS } from '../../types/fleet';
import { Play, Sparkles, AlertCircle, RefreshCw } from 'lucide-react';

interface ManualTelemetryFormProps {
  onResultReceived: (result: HealthResult) => void;
}

export const ManualTelemetryForm: React.FC<ManualTelemetryFormProps> = ({
  onResultReceived,
}) => {
  const { devicesList, submitManualPacket } = useFleetStore();

  const [deviceId, setDeviceId] = useState('DEV-007');
  const [instanceId, setInstanceId] = useState('INST-007');
  const [region, setRegion] = useState<RegionName>('North');
  const [temperature, setTemperature] = useState('72.4');
  const [vibration, setVibration] = useState('2.3');
  const [current, setCurrent] = useState('8.7');
  const [rpm, setRpm] = useState('1482');
  const [timestamp, setTimestamp] = useState(new Date().toLocaleTimeString());

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // When device changes, auto-fill instance & region
  const handleDeviceChange = (devId: string) => {
    setDeviceId(devId);
    const found = devicesList.find((d) => d.device_id === devId);
    if (found) {
      setInstanceId(found.device_instance_id);
      setRegion(found.region);
      setTemperature(String(found.latest_reading.temperature));
      setVibration(String(found.latest_reading.vibration));
      setCurrent(String(found.latest_reading.current));
      setRpm(String(found.latest_reading.rpm));
    } else {
      setInstanceId(`INST-${devId.replace('DEV-', '')}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const tempNum = parseFloat(temperature);
    const vibNum = parseFloat(vibration);
    const currNum = parseFloat(current);
    const rpmNum = parseFloat(rpm);

    if (isNaN(tempNum) || isNaN(vibNum) || isNaN(currNum) || isNaN(rpmNum)) {
      setErrorMsg('All four telemetry metrics (Temp, Vibration, Current, RPM) must be valid numbers.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await submitManualPacket({
        device_id: deviceId,
        device_instance_id: instanceId,
        region,
        temperature: tempNum,
        vibration: vibNum,
        current: currNum,
        rpm: rpmNum,
        timestamp: new Date().toISOString(),
      });
      onResultReceived(result);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit telemetry packet to intelligence engine.');
    } finally {
      setIsLoading(false);
    }
  };

  // Quick-load presets for judges
  const loadPreset = (type: 'drift' | 'spike' | 'flatline' | 'oscillation' | 'sensor_swap' | 'normal') => {
    setErrorMsg(null);
    setTimestamp(new Date().toLocaleTimeString());

    switch (type) {
      case 'normal':
        setDeviceId('DEV-007');
        setInstanceId('INST-007');
        setRegion('North');
        setTemperature('62.1');
        setVibration('2.1');
        setCurrent('8.3');
        setRpm('1482');
        break;
      case 'drift':
        setDeviceId('DEV-007');
        setInstanceId('INST-007');
        setRegion('North');
        setTemperature('72.4'); // Baseline 62.1 + 10.3°C drift
        setVibration('2.3');
        setCurrent('8.7');
        setRpm('1482');
        break;
      case 'spike':
        setDeviceId('DEV-014');
        setInstanceId('INST-014');
        setRegion('South');
        setTemperature('64.5');
        setVibration('3.2');
        setCurrent('16.8'); // Baseline 9.1 + sudden surge
        setRpm('1510');
        break;
      case 'flatline':
        setDeviceId('DEV-021');
        setInstanceId('INST-021');
        setRegion('South');
        setTemperature('68.0');
        setVibration('0.01'); // Signal collapse to near zero
        setCurrent('11.2');
        setRpm('1600');
        break;
      case 'oscillation':
        setDeviceId('DEV-032');
        setInstanceId('INST-032');
        setRegion('East');
        setTemperature('70.4');
        setVibration('4.9'); // High amplitude oscillation
        setCurrent('12.8');
        setRpm('2100');
        break;
      case 'sensor_swap':
        setDeviceId('DEV-045');
        setInstanceId('INST-045');
        setRegion('West');
        setTemperature('84.2'); // Multi-channel mismatch
        setVibration('4.8');
        setCurrent('14.1');
        setRpm('1748');
        break;
    }
  };

  return (
    <div className="cool-panel rounded-xl border border-[#D8E5F0] bg-white p-5 font-mono space-y-4 shadow-xs">
      <div className="flex items-center justify-between border-b border-[#D8E5F0] pb-3">
        <div>
          <h2 className="text-sm font-bold text-[#172033] uppercase tracking-wider">
            Single Telemetry Packet Form
          </h2>
          <p className="text-xs text-[#526174] font-sans mt-0.5">
            Submit canonical metrics to Member 1’s intelligence pipeline. Status and anomaly classification are evaluated server-side.
          </p>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded bg-[#EFF6FF] border border-[#BFDBFE] text-[#2563EB] font-bold">
          JUDGE TESTING LAB
        </span>
      </div>

      {/* Quick Judge Presets */}
      <div>
        <span className="text-[11px] text-[#526174] font-bold uppercase tracking-wider block mb-1.5 flex items-center gap-1">
          <Sparkles size={12} className="text-[#2563EB]" />
          Judge Evaluation Presets (Click to Auto-fill)
        </span>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => loadPreset('normal')}
            className="rounded-lg bg-[#F0FDF4] border border-[#BBF7D0] px-2.5 py-1 text-[11px] text-[#15803D] font-bold hover:bg-[#DCFCE7] transition-colors cursor-pointer"
          >
            Normal (DEV-007)
          </button>
          <button
            type="button"
            onClick={() => loadPreset('drift')}
            className="rounded-lg bg-[#FFF7ED] border border-[#FED7AA] px-2.5 py-1 text-[11px] text-[#C2410C] font-bold hover:bg-[#FFEDD5] transition-colors cursor-pointer"
          >
            Drift (DEV-007)
          </button>
          <button
            type="button"
            onClick={() => loadPreset('spike')}
            className="rounded-lg bg-[#FEF2F2] border border-[#FECACA] px-2.5 py-1 text-[11px] text-[#B91C1C] font-bold hover:bg-[#FEE2E2] transition-colors cursor-pointer"
          >
            Spike (DEV-014)
          </button>
          <button
            type="button"
            onClick={() => loadPreset('flatline')}
            className="rounded-lg bg-[#FAF5FF] border border-[#E9D5FF] px-2.5 py-1 text-[11px] text-[#6B21A8] font-bold hover:bg-[#F3E8FF] transition-colors cursor-pointer"
          >
            Flatline (DEV-021)
          </button>
          <button
            type="button"
            onClick={() => loadPreset('oscillation')}
            className="rounded-lg bg-[#FFFBEB] border border-[#FDE68A] px-2.5 py-1 text-[11px] text-[#B45309] font-bold hover:bg-[#FEF3C7] transition-colors cursor-pointer"
          >
            Oscillation (DEV-032)
          </button>
          <button
            type="button"
            onClick={() => loadPreset('sensor_swap')}
            className="rounded-lg bg-[#EFF6FF] border border-[#BFDBFE] px-2.5 py-1 text-[11px] text-[#1D4ED8] font-bold hover:bg-[#DBEAFE] transition-colors cursor-pointer"
          >
            Sensor Swap (DEV-045)
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-3 text-xs text-[#B91C1C] flex items-center gap-2 font-sans">
          <AlertCircle size={15} className="shrink-0 text-[#EF4444]" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Device Identity Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Device ID */}
          <div>
            <label className="text-[10px] uppercase text-[#526174] font-bold block mb-1">
              Device ID (50 assets)
            </label>
            <select
              value={deviceId}
              onChange={(e) => handleDeviceChange(e.target.value)}
              className="w-full rounded-lg border border-[#D8E5F0] bg-[#F8FBFF] px-3 py-2 text-xs text-[#172033] font-bold focus:border-[#2563EB] focus:outline-hidden"
            >
              {devicesList.map((d) => (
                <option key={d.device_id} value={d.device_id}>
                  {d.device_id} ({d.region})
                </option>
              ))}
            </select>
          </div>

          {/* Instance ID */}
          <div>
            <label className="text-[10px] uppercase text-[#526174] font-bold block mb-1">
              Instance ID
            </label>
            <input
              type="text"
              value={instanceId}
              onChange={(e) => setInstanceId(e.target.value)}
              className="w-full rounded-lg border border-[#D8E5F0] bg-[#F8FBFF] px-3 py-2 text-xs text-[#172033] font-bold focus:border-[#2563EB] focus:outline-hidden"
            />
          </div>

          {/* Region */}
          <div>
            <label className="text-[10px] uppercase text-[#526174] font-bold block mb-1">
              Region
            </label>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value as RegionName)}
              className="w-full rounded-lg border border-[#D8E5F0] bg-[#F8FBFF] px-3 py-2 text-xs text-[#172033] font-bold focus:border-[#2563EB] focus:outline-hidden"
            >
              {REGIONS.map((r) => (
                <option key={r} value={r}>
                  {r} Region
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Four Canonical Telemetry Metrics Inputs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-[#D8E5F0]">
          {/* Temperature */}
          <div>
            <label className="text-[10px] uppercase text-[#EF4444] font-bold block mb-1">
              Temperature (°C)
            </label>
            <input
              type="number"
              step="0.1"
              value={temperature}
              onChange={(e) => setTemperature(e.target.value)}
              className="w-full rounded-lg border border-[#D8E5F0] bg-[#F8FBFF] px-3 py-2 text-xs text-[#172033] font-bold focus:border-[#EF4444] focus:outline-hidden"
              required
            />
          </div>

          {/* Vibration */}
          <div>
            <label className="text-[10px] uppercase text-[#8B5CF6] font-bold block mb-1">
              Vibration (mm/s)
            </label>
            <input
              type="number"
              step="0.01"
              value={vibration}
              onChange={(e) => setVibration(e.target.value)}
              className="w-full rounded-lg border border-[#D8E5F0] bg-[#F8FBFF] px-3 py-2 text-xs text-[#172033] font-bold focus:border-[#8B5CF6] focus:outline-hidden"
              required
            />
          </div>

          {/* Current */}
          <div>
            <label className="text-[10px] uppercase text-[#F59E0B] font-bold block mb-1">
              Current (A)
            </label>
            <input
              type="number"
              step="0.1"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              className="w-full rounded-lg border border-[#D8E5F0] bg-[#F8FBFF] px-3 py-2 text-xs text-[#172033] font-bold focus:border-[#F59E0B] focus:outline-hidden"
              required
            />
          </div>

          {/* RPM */}
          <div>
            <label className="text-[10px] uppercase text-[#2563EB] font-bold block mb-1">
              RPM (rpm)
            </label>
            <input
              type="number"
              step="1"
              value={rpm}
              onChange={(e) => setRpm(e.target.value)}
              className="w-full rounded-lg border border-[#D8E5F0] bg-[#F8FBFF] px-3 py-2 text-xs text-[#172033] font-bold focus:border-[#2563EB] focus:outline-hidden"
              required
            />
          </div>
        </div>

        {/* Timestamp */}
        <div className="flex items-center justify-between text-xs text-[#526174] pt-1">
          <span>Submission timestamp: {timestamp}</span>
          <span className="text-[10px] text-[#8494A7]">Anti-cheat enforced: Anomaly & severity locked</span>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-5 py-3 font-mono text-xs font-bold uppercase tracking-wider text-white shadow-sm hover:bg-[#1D4ED8] transition-all cursor-pointer disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <RefreshCw size={14} className="animate-spin" />
              <span>Analyzing Through Pipeline...</span>
            </>
          ) : (
            <>
              <Play size={14} />
              <span>Analyze Telemetry</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
};

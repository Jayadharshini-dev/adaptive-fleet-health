import React, { useState } from 'react';
import { useFleetStore } from '../../store/fleetContext';
import type { RegionName, HealthResult } from '../../types/fleet';
import { REGIONS } from '../../types/fleet';
import { Play, Sparkles, AlertCircle, RefreshCw } from 'lucide-react';
import { formatTimestamp } from '../../utils/formatters';

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
  const [timestamp, setTimestamp] = useState(formatTimestamp(new Date().toISOString()));

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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

  const loadPreset = (type: 'drift' | 'spike' | 'flatline' | 'oscillation' | 'sensor_swap' | 'normal') => {
    setErrorMsg(null);
    setTimestamp(formatTimestamp(new Date().toISOString()));

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
        setTemperature('72.4');
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
        setCurrent('16.8');
        setRpm('1510');
        break;
      case 'flatline':
        setDeviceId('DEV-021');
        setInstanceId('INST-021');
        setRegion('South');
        setTemperature('68.0');
        setVibration('0.01');
        setCurrent('11.2');
        setRpm('1600');
        break;
      case 'oscillation':
        setDeviceId('DEV-032');
        setInstanceId('INST-032');
        setRegion('East');
        setTemperature('70.4');
        setVibration('4.9');
        setCurrent('12.8');
        setRpm('2100');
        break;
      case 'sensor_swap':
        setDeviceId('DEV-045');
        setInstanceId('INST-045');
        setRegion('West');
        setTemperature('84.2');
        setVibration('4.8');
        setCurrent('14.1');
        setRpm('1748');
        break;
    }
  };

  return (
    <div className="rounded border border-[#E2E0D8] bg-white p-5 font-mono space-y-4">
      <div className="flex items-center justify-between border-b border-[#E2E0D8] pb-3">
        <div>
          <h2 className="text-sm font-bold text-[#17191C] uppercase tracking-widest">
            ENGINEERING TEST BENCH
          </h2>
          <p className="text-xs text-[#59616A] font-sans mt-0.5">
            Test live telemetry against the same adaptive health pipeline used by the fleet.
          </p>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded bg-[#F0EEE6] border border-[#E2E0D8] text-[#c2410c] font-bold">
          LIVE PIPELINE
        </span>
      </div>

      <div>
        <span className="text-[11px] text-[#59616A] font-bold uppercase tracking-wider block mb-1.5 flex items-center gap-1">
          <Sparkles size={12} className="text-[#c2410c]" />
          Judge Evaluation Presets (Click to Populate Telemetry Values)
        </span>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => loadPreset('normal')}
            className="rounded bg-[#f0fdf4] border border-[#bbf7d0] px-2.5 py-1 text-[11px] text-[#16a34a] font-bold hover:bg-[#dcfce7] transition-colors cursor-pointer"
          >
            Normal (DEV-007)
          </button>
          <button
            type="button"
            onClick={() => loadPreset('drift')}
            className="rounded bg-[#fef3c7] border border-[#fde68a] px-2.5 py-1 text-[11px] text-[#d97706] font-bold hover:bg-[#fde68a] transition-colors cursor-pointer"
          >
            Drift (DEV-007)
          </button>
          <button
            type="button"
            onClick={() => loadPreset('spike')}
            className="rounded bg-[#fee2e2] border border-[#fca5a5] px-2.5 py-1 text-[11px] text-[#dc2626] font-bold hover:bg-[#fcd3d3] transition-colors cursor-pointer"
          >
            Spike (DEV-014)
          </button>
          <button
            type="button"
            onClick={() => loadPreset('flatline')}
            className="rounded bg-[#F0EEE6] border border-[#E2E0D8] px-2.5 py-1 text-[11px] text-[#17191C] font-bold hover:bg-[#CFCBC0] transition-colors cursor-pointer"
          >
            Flatline (DEV-021)
          </button>
          <button
            type="button"
            onClick={() => loadPreset('oscillation')}
            className="rounded bg-[#fef3c7] border border-[#fde68a] px-2.5 py-1 text-[11px] text-[#d97706] font-bold hover:bg-[#fde68a] transition-colors cursor-pointer"
          >
            Oscillation (DEV-032)
          </button>
          <button
            type="button"
            onClick={() => loadPreset('sensor_swap')}
            className="rounded bg-[#fee2e2] border border-[#fca5a5] px-2.5 py-1 text-[11px] text-[#dc2626] font-bold hover:bg-[#fcd3d3] transition-colors cursor-pointer"
          >
            Sensor Swap (DEV-045)
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded border border-[#fca5a5] bg-[#fee2e2] p-3 text-xs text-[#dc2626] flex items-center gap-2 font-sans">
          <AlertCircle size={15} className="shrink-0 text-[#dc2626]" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-[10px] uppercase text-[#59616A] font-bold block mb-1">
              Target Asset (Device ID)
            </label>
            <select
              value={deviceId}
              onChange={(e) => handleDeviceChange(e.target.value)}
              className="w-full rounded border border-[#E2E0D8] bg-[#F7F6F2] px-3 py-2 text-xs text-[#17191C] font-bold focus:border-[#17191C] focus:outline-hidden"
            >
              {devicesList.map((d) => (
                <option key={d.device_id} value={d.device_id}>
                  {d.device_id} ({d.region})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] uppercase text-[#59616A] font-bold block mb-1">
              Instance ID
            </label>
            <input
              type="text"
              value={instanceId}
              onChange={(e) => setInstanceId(e.target.value)}
              className="w-full rounded border border-[#E2E0D8] bg-[#F7F6F2] px-3 py-2 text-xs text-[#17191C] font-bold focus:border-[#17191C] focus:outline-hidden"
            />
          </div>

          <div>
            <label className="text-[10px] uppercase text-[#59616A] font-bold block mb-1">
              Region
            </label>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value as RegionName)}
              className="w-full rounded border border-[#E2E0D8] bg-[#F7F6F2] px-3 py-2 text-xs text-[#17191C] font-bold focus:border-[#17191C] focus:outline-hidden"
            >
              {REGIONS.map((r) => (
                <option key={r} value={r}>
                  {r} Region
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* User inputs ONLY canonical metrics. System determines anomaly/severity/confidence */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-[#E2E0D8]">
          <div>
            <label className="text-[10px] uppercase text-[#dc2626] font-bold block mb-1">
              Temperature (°C)
            </label>
            <input
              type="number"
              step="0.1"
              value={temperature}
              onChange={(e) => setTemperature(e.target.value)}
              className="w-full rounded border border-[#E2E0D8] bg-[#F7F6F2] px-3 py-2 text-xs text-[#17191C] font-bold focus:border-[#dc2626] focus:outline-hidden"
              required
            />
          </div>

          <div>
            <label className="text-[10px] uppercase text-[#c2410c] font-bold block mb-1">
              Vibration (mm/s)
            </label>
            <input
              type="number"
              step="0.01"
              value={vibration}
              onChange={(e) => setVibration(e.target.value)}
              className="w-full rounded border border-[#E2E0D8] bg-[#F7F6F2] px-3 py-2 text-xs text-[#17191C] font-bold focus:border-[#c2410c] focus:outline-hidden"
              required
            />
          </div>

          <div>
            <label className="text-[10px] uppercase text-[#d97706] font-bold block mb-1">
              Current (A)
            </label>
            <input
              type="number"
              step="0.1"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              className="w-full rounded border border-[#E2E0D8] bg-[#F7F6F2] px-3 py-2 text-xs text-[#17191C] font-bold focus:border-[#d97706] focus:outline-hidden"
              required
            />
          </div>

          <div>
            <label className="text-[10px] uppercase text-[#16a34a] font-bold block mb-1">
              RPM (RPM)
            </label>
            <input
              type="number"
              step="1"
              value={rpm}
              onChange={(e) => setRpm(e.target.value)}
              className="w-full rounded border border-[#E2E0D8] bg-[#F7F6F2] px-3 py-2 text-xs text-[#17191C] font-bold focus:border-[#16a34a] focus:outline-hidden"
              required
            />
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-[#59616A] pt-1">
          <span>Submission timestamp: {timestamp}</span>
          <span className="text-[10px] text-[#7A838C]">System independently computes diagnosis</span>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 rounded bg-[#17191C] px-5 py-3 font-mono text-xs font-bold uppercase tracking-widest text-white hover:bg-[#c2410c] transition-colors cursor-pointer disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <RefreshCw size={14} className="animate-spin" />
              <span>Analyzing Through HealthEngine...</span>
            </>
          ) : (
            <>
              <Play size={14} />
              <span>ANALYZE TELEMETRY</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
};

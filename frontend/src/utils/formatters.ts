/**
 * Centralized formatting utilities for Adaptive Fleet Health Monitoring.
 * Enforces canonical formatting rules across all views:
 * - Normalized confidence/severity (0.89 -> 89%, never 8900%)
 * - Explicit timestamp spacing ("05:51:35 AM")
 * - Strictly 4 canonical metrics (Temperature °C, Vibration mm/s, Current A, RPM)
 */

export function formatConfidence(val: number | undefined | null): string {
  if (val === undefined || val === null || isNaN(val)) return '0%';
  const norm = val <= 1.0 ? val * 100 : val;
  return `${Math.min(100, Math.max(0, Math.round(norm)))}%`;
}

export function formatSeverity(val: number | undefined | null): string {
  if (val === undefined || val === null || isNaN(val)) return '0%';
  const norm = val <= 1.0 ? val * 100 : val;
  return `${Math.min(100, Math.max(0, Math.round(norm)))}%`;
}

export function formatTimestamp(isoString: string | undefined | null): string {
  if (!isoString) return '--:--:-- AM';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  } catch {
    return String(isoString);
  }
}

export function formatTimeOnly(isoString: string | undefined | null): string {
  if (!isoString) return '--:--';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return String(isoString);
  }
}

export function formatMetricValue(
  metricName: 'temperature' | 'vibration' | 'current' | 'rpm' | string,
  val: number | undefined | null
): string {
  if (val === undefined || val === null || isNaN(val)) return '--';
  const name = metricName.toLowerCase();
  if (name.includes('temp')) return `${val.toFixed(1)} °C`;
  if (name.includes('vib')) return `${val.toFixed(2)} mm/s`;
  if (name.includes('curr')) return `${val.toFixed(1)} A`;
  if (name.includes('rpm')) return `${Math.round(val)} RPM`;
  return `${val.toFixed(1)}`;
}

export function formatAnomalyTypeLabel(anomaly: string | undefined | null): string {
  if (!anomaly || anomaly.toLowerCase() === 'none') return 'HEALTHY';
  const a = anomaly.toLowerCase();
  if (a === 'sensor_swap') return 'SENSOR SWAP';
  return a.toUpperCase();
}

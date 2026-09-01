import React from 'react';
import { useFleetStore } from '../../store/fleetContext';
import { StatCard } from '../common/StatCard';
import { Server, ShieldCheck, AlertTriangle, AlertOctagon, BellRing, MapPin } from 'lucide-react';

export const SummaryCards: React.FC = () => {
  const { fleetSummary } = useFleetStore();

  const healthyPct =
    fleetSummary.total_devices > 0
      ? Math.round((fleetSummary.healthy / fleetSummary.total_devices) * 100)
      : 100;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-3.5">
      {/* Total Devices */}
      <StatCard
        label="TOTAL DEVICES"
        value={fleetSummary.total_devices}
        icon={Server}
        variant="cyan"
        subtitle="Monitored fleet assets"
      />

      {/* Healthy */}
      <StatCard
        label="HEALTHY"
        value={fleetSummary.healthy}
        icon={ShieldCheck}
        variant="healthy"
        subtitle={`${healthyPct}% within baseline`}
      />

      {/* Warning */}
      <StatCard
        label="WARNING"
        value={fleetSummary.warning}
        icon={AlertTriangle}
        variant="warning"
        subtitle="Drift / minor anomalies"
      />

      {/* Critical */}
      <StatCard
        label="CRITICAL"
        value={fleetSummary.critical}
        icon={AlertOctagon}
        variant="critical"
        subtitle="Requires triage"
      />

      {/* Active Alerts */}
      <StatCard
        label="ACTIVE ALERTS"
        value={fleetSummary.active_alerts}
        icon={BellRing}
        variant={fleetSummary.active_alerts > 0 ? 'critical' : 'default'}
        subtitle="Open incident tickets"
      />

      {/* Regions Affected */}
      <StatCard
        label="REGIONS AFFECTED"
        value={fleetSummary.regions_affected}
        icon={MapPin}
        variant={fleetSummary.regions_affected > 0 ? 'warning' : 'default'}
        subtitle="Active anomaly zones"
      />
    </div>
  );
};

import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Server,
  MapPin,
  Bell,
  AlertTriangle,
  Sliders,
  Activity,
  Terminal,
  X,
} from 'lucide-react';
import { useFleetStore } from '../../store/fleetContext';
import { ConnectionBadge } from './ConnectionBadge';
import { wsService } from '../../services/websocket';

interface SidebarProps {
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpenMobile = false,
  onCloseMobile,
}) => {
  const { connectionStatus, isSimulatorActive, fleetSummary, conflicts } = useFleetStore();

  const navItems = [
    {
      to: '/',
      label: 'Overview',
      icon: LayoutDashboard,
    },
    {
      to: '/fleet',
      label: 'Fleet Matrix',
      icon: Server,
      badge: `${fleetSummary.total_devices}`,
    },
    {
      to: '/alerts',
      label: 'Incident Log',
      icon: Bell,
      badge: fleetSummary.active_alerts > 0 ? `${fleetSummary.active_alerts}` : undefined,
      badgeColor: 'bg-[#fee2e2] text-[#dc2626] border border-[#fca5a5]',
    },
    {
      to: '/regions',
      label: 'Regional Overview',
      icon: MapPin,
    },
    {
      to: '/manual-lab',
      label: 'Manual Telemetry Lab',
      icon: Terminal,
      badge: 'TEST BENCH',
      badgeColor: 'bg-[#F0EEE6] text-[#c2410c] border border-[#E2E0D8]',
    },
    {
      to: '/conflicts',
      label: 'Regional Conflicts',
      icon: AlertTriangle,
      badge: conflicts.length > 0 ? `${conflicts.length}` : undefined,
      badgeColor: 'bg-[#fef3c7] text-[#d97706] border border-[#fde68a]',
    },
    {
      to: '/settings',
      label: 'Demo Control Center',
      icon: Sliders,
    },
  ];

  const content = (
    <div className="flex h-full flex-col justify-between bg-[#F7F6F2] border-r border-[#E2E0D8] px-4 py-5 select-none font-mono">
      {/* Brand Header */}
      <div>
        <div className="flex items-center justify-between px-2 mb-6 pb-4 border-b border-[#E2E0D8]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-[#17191C] text-white">
              <Activity className="h-4 w-4 text-[#c2410c]" />
            </div>
            <div>
              <div className="text-xs font-bold tracking-widest text-[#17191C] uppercase">
                CONTROL CONSOLE
              </div>
              <div className="text-[10px] text-[#59616A] tracking-wider font-semibold">
                SYSTEM ID: SOC-50
              </div>
            </div>
          </div>

          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="md:hidden rounded p-1.5 text-[#59616A] hover:bg-[#E2E0D8] hover:text-[#17191C]"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onCloseMobile}
                className={({ isActive }) =>
                  `flex items-center justify-between rounded px-3 py-2.5 text-xs font-semibold uppercase tracking-wider transition-all ${
                    isActive
                      ? 'bg-[#FFFFFF] text-[#17191C] border border-[#CFCBC0] shadow-xs font-bold'
                      : 'text-[#59616A] hover:bg-[#F0EEE6] hover:text-[#17191C] border border-transparent'
                  }`
                }
              >
                <div className="flex items-center gap-3">
                  <Icon size={16} className="shrink-0 text-[#7A838C]" />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`rounded px-1.5 py-0.5 text-[9px] font-mono font-bold ${
                      item.badgeColor || 'bg-[#F0EEE6] text-[#59616A] border border-[#E2E0D8]'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Bottom System & Connection Status */}
      <div className="border-t border-[#E2E0D8] pt-4 space-y-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-[10px] uppercase tracking-widest text-[#7A838C] font-bold">
            WS AGENT LINK
          </span>
          <ConnectionBadge
            status={connectionStatus}
            isSimulated={isSimulatorActive}
            onReconnect={() => wsService.connect()}
          />
        </div>

        <div className="rounded bg-white p-3 border border-[#E2E0D8]">
          <div className="flex items-center justify-between text-[10px] text-[#59616A] mb-1.5 font-mono">
            <span>FLEET HEALTH ENVELOPE</span>
            <span className="font-bold text-[#16a34a]">
              {fleetSummary.total_devices > 0
                ? `${Math.round((fleetSummary.healthy / fleetSummary.total_devices) * 100)}%`
                : '100%'}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded bg-[#F0EEE6]">
            <div
              className="h-full bg-[#16a34a] transition-all duration-500 rounded"
              style={{
                width: `${
                  fleetSummary.total_devices > 0
                    ? (fleetSummary.healthy / fleetSummary.total_devices) * 100
                    : 100
                }%`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden md:flex w-64 flex-col shrink-0 h-screen sticky top-0">
        {content}
      </aside>

      {isOpenMobile && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-black/30 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="relative flex w-4/5 max-w-xs flex-col z-10">
            {content}
          </div>
        </div>
      )}
    </>
  );
};

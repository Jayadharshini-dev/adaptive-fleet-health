import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Server,
  MapPin,
  Bell,
  AlertTriangle,
  Settings,
  Activity,
  TerminalSquare,
  Presentation,
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
      badgeColor: 'bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA]',
    },
    {
      to: '/regions',
      label: 'Regional Overview',
      icon: MapPin,
    },
    {
      to: '/manual-lab',
      label: 'Manual Telemetry Lab',
      icon: TerminalSquare,
      badge: 'JUDGE LAB',
      badgeColor: 'bg-[#F0FDFA] text-[#0F766E] border border-[#99F6E4]',
    },
    {
      to: '/conflicts',
      label: 'Regional Conflicts',
      icon: AlertTriangle,
      badge: conflicts.length > 0 ? `${conflicts.length}` : undefined,
      badgeColor: 'bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A]',
    },
    {
      to: '/settings',
      label: 'System & Scenarios',
      icon: Settings,
    },
  ];

  const content = (
    <div className="flex h-full flex-col justify-between bg-white border-r border-[#D8E5F0] px-4 py-5 select-none font-mono shadow-xs">
      {/* Brand Header */}
      <div>
        <div className="flex items-center justify-between px-2 mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#2563EB] shadow-xs text-white">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="text-sm font-bold tracking-wider text-[#172033] uppercase">
                Adaptive Fleet
              </div>
              <div className="text-[10px] text-[#526174] font-semibold tracking-tight">
                CONCURRENT COMMAND SOC
              </div>
            </div>
          </div>

          {/* Close button on mobile */}
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="md:hidden rounded-lg p-1.5 text-[#526174] hover:bg-[#EEF7FF] hover:text-[#172033]"
            >
              <X size={20} />
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
                  `flex items-center justify-between rounded-lg px-3 py-2.5 text-xs font-semibold uppercase tracking-wider transition-all ${
                    isActive
                      ? 'bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE] shadow-xs font-bold'
                      : 'text-[#526174] hover:bg-[#F8FBFF] hover:text-[#172033] border border-transparent'
                  }`
                }
              >
                <div className="flex items-center gap-3">
                  <Icon size={17} className="shrink-0" />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                      item.badgeColor || 'bg-[#F1F5F9] text-[#475569] border border-[#E2E8F0]'
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
      <div className="border-t border-[#D8E5F0] pt-4 space-y-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-[10px] uppercase tracking-wider text-[#526174] font-bold">
            WS Synchronization
          </span>
          <ConnectionBadge
            status={connectionStatus}
            isSimulated={isSimulatorActive}
            onReconnect={() => wsService.connect()}
          />
        </div>

        <div className="rounded-lg bg-[#F8FBFF] p-2.5 border border-[#D8E5F0]">
          <div className="flex items-center justify-between text-[10px] text-[#526174] mb-1 font-mono">
            <span>FLEET HEALTH ENVELOPE</span>
            <span className="font-bold text-[#15803D]">
              {fleetSummary.total_devices > 0
                ? `${Math.round((fleetSummary.healthy / fleetSummary.total_devices) * 100)}%`
                : '100%'}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#E2E8F0]">
            <div
              className="h-full bg-[#22C55E] transition-all duration-500 rounded-full"
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
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden md:flex w-64 flex-col shrink-0 h-screen sticky top-0">
        {content}
      </aside>

      {/* Mobile Drawer Overlay */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
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

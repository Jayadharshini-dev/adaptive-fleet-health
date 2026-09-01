import React, { useState, useEffect } from 'react';
import { useFleetStore } from '../../store/fleetContext';
import { ConnectionBadge } from './ConnectionBadge';
import { Menu, Bell, Clock, RefreshCw, Presentation } from 'lucide-react';
import { wsService } from '../../services/websocket';
import { Link } from 'react-router-dom';

interface HeaderProps {
  onOpenMobileMenu?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenMobileMenu }) => {
  const {
    connectionStatus,
    lastSyncTime,
    isSimulatorActive,
    refreshFleet,
    alerts,
  } = useFleetStore();

  const [secondsAgo, setSecondsAgo] = useState(0);
  const [currentIstTime, setCurrentIstTime] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Dynamic IST clock
  useEffect(() => {
    const updateTime = () => {
      try {
        const now = new Date();
        const istString = now.toLocaleTimeString('en-GB', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        });
        setCurrentIstTime(`${istString} IST`);
      } catch {
        setCurrentIstTime(`${new Date().toLocaleTimeString()} IST`);
      }

      const diffSec = Math.floor((Date.now() - lastSyncTime.getTime()) / 1000);
      setSecondsAgo(Math.max(0, diffSec));
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, [lastSyncTime]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await refreshFleet();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-[#D8E5F0] bg-white/95 px-4 md:px-6 backdrop-blur-md font-mono shadow-xs">
      {/* Left: Mobile hamburger & title matching Section 5 */}
      <div className="flex items-center gap-3">
        {onOpenMobileMenu && (
          <button
            onClick={onOpenMobileMenu}
            className="md:hidden rounded-lg p-2 text-[#526174] hover:bg-[#EEF7FF] hover:text-[#172033]"
            aria-label="Open navigation menu"
          >
            <Menu size={20} />
          </button>
        )}

        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-sm md:text-base font-bold tracking-wider text-[#172033] uppercase">
              Adaptive Fleet Health
            </h1>

            {/* LIVE ● pulse indicator */}
            <div className="flex items-center gap-1.5 rounded bg-[#F0FDF4] border border-[#BBF7D0] px-2 py-0.5 text-xs font-bold text-[#15803D]">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22C55E] opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#16A34A]" />
              </span>
              <span>LIVE ●</span>
            </div>

            <span className="hidden xl:inline-flex rounded bg-[#EFF6FF] border border-[#BFDBFE] px-1.5 py-0.5 text-[10px] text-[#2563EB] font-semibold">
              50 ASSETS · 4 REGIONS
            </span>
          </div>

          <p className="hidden sm:block text-[11px] text-[#526174] font-sans">
            Continuous adaptive baseline monitoring & multi-session concurrent coordination
          </p>
        </div>
      </div>

      {/* Right: Clock, Sync Status & Alerts (presentation removed) */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Header timestamp: "Last updated: 21:14:32 IST" */}
        <div className="hidden lg:flex items-center gap-1.5 rounded-md bg-[#F8FBFF] border border-[#D8E5F0] px-2.5 py-1 text-xs text-[#526174]">
          <Clock size={13} className="text-[#2563EB]" />
          <span>Last updated: {currentIstTime || 'Connecting...'}</span>
        </div>

        {/* Sync duration */}
        <div className="hidden xl:flex items-center gap-1 text-[11px] text-[#8494A7]">
          <span>Synced {secondsAgo === 0 ? 'now' : `${secondsAgo}s ago`}</span>
        </div>

        {/* Live WS Status Indicator */}
        <ConnectionBadge
          status={connectionStatus}
          isSimulated={isSimulatorActive}
          onReconnect={() => wsService.connect()}
        />

        {/* Manual Refresh Button */}
        <button
          onClick={handleManualRefresh}
          className="rounded-md border border-[#D8E5F0] bg-white p-2 text-[#526174] hover:border-[#CBDCEB] hover:text-[#172033] hover:bg-[#F8FBFF] transition-colors cursor-pointer"
          title="Force refresh state from REST API"
        >
          <RefreshCw size={15} className={isRefreshing ? 'animate-spin text-[#2563EB]' : ''} />
        </button>

        {/* Notification Alert Bell with badge */}
        <Link
          to="/alerts"
          className="relative rounded-md border border-[#D8E5F0] bg-white p-2 text-[#526174] hover:border-[#CBDCEB] hover:text-[#172033] hover:bg-[#F8FBFF] transition-colors"
          title={`${alerts.length} active fleet alerts`}
        >
          <Bell size={15} />
          {alerts.length > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#EF4444] text-[10px] font-bold text-white shadow-xs">
              {alerts.length > 9 ? '9+' : alerts.length}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
};

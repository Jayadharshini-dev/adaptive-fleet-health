import React, { useState, useEffect } from 'react';
import { useFleetStore } from '../../store/fleetContext';
import { ConnectionBadge } from './ConnectionBadge';
import { Menu, Bell, Clock, RefreshCw, UserCheck, LogOut } from 'lucide-react';
import { wsService } from '../../services/websocket';
import { Link } from 'react-router-dom';

interface HeaderProps {
  onOpenMobileMenu?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenMobileMenu }) => {
  const {
    userSession,
    logoutSession,
    connectionStatus,
    lastSyncTime,
    isSimulatorActive,
    refreshFleet,
    alerts,
  } = useFleetStore();

  const [secondsAgo, setSecondsAgo] = useState(0);
  const [currentIstTime, setCurrentIstTime] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      try {
        const now = new Date();
        const istString = now.toLocaleTimeString('en-US', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
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
    <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-[#E2E0D8] bg-[#F7F6F2]/95 px-4 md:px-6 backdrop-blur-xs font-mono">
      <div className="flex items-center gap-3">
        {onOpenMobileMenu && (
          <button
            onClick={onOpenMobileMenu}
            className="md:hidden rounded p-1.5 text-[#59616A] hover:bg-[#E2E0D8] hover:text-[#17191C]"
            aria-label="Open navigation menu"
          >
            <Menu size={18} />
          </button>
        )}

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#c2410c] inline-block" />
            <h1 className="text-sm font-bold tracking-widest text-[#17191C] uppercase">
              ADAPTIVE FLEET HEALTH
            </h1>
          </div>

          <span className="hidden sm:inline-block text-[#CFCBC0]">|</span>

          <span className="hidden md:inline-flex items-center gap-1.5 rounded bg-[#F0EEE6] border border-[#E2E0D8] px-2 py-0.5 text-[11px] font-semibold text-[#59616A]">
            <span>50 ASSETS</span>
            <span className="text-[#CFCBC0]">·</span>
            <span>4 REGIONS</span>
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Logged in Operator Badge */}
        {userSession && (
          <div className="hidden sm:flex items-center gap-1.5 rounded bg-white border border-[#E2E0D8] px-2.5 py-0.5 text-xs text-[#17191C]">
            <UserCheck size={13} className={userSession.username === 'operator1' ? 'text-[#c2410c]' : 'text-[#16a34a]'} />
            <span className="font-bold uppercase">{userSession.role}</span>
            <span className="text-[10px] text-[#59616A]">({userSession.full_name})</span>
            <button
              onClick={logoutSession}
              className="ml-1 text-[#7A838C] hover:text-[#dc2626] transition-colors cursor-pointer"
              title="Logout Operator Session"
            >
              <LogOut size={11} />
            </button>
          </div>
        )}

        <div className="hidden lg:flex items-center gap-1.5 rounded bg-[#F0EEE6] border border-[#E2E0D8] px-2.5 py-0.5 text-xs text-[#59616A]">
          <Clock size={13} className="text-[#c2410c]" />
          <span>{currentIstTime || '05:51:35 AM IST'}</span>
        </div>

        <div className="hidden xl:flex items-center gap-1 text-[11px] text-[#7A838C]">
          <span>Synced {secondsAgo === 0 ? 'now' : `${secondsAgo}s ago`}</span>
        </div>

        <ConnectionBadge
          status={connectionStatus}
          isSimulated={isSimulatorActive}
          onReconnect={() => wsService.connect()}
        />

        <button
          onClick={handleManualRefresh}
          className="rounded border border-[#E2E0D8] bg-white p-1.5 text-[#59616A] hover:border-[#CFCBC0] hover:text-[#17191C] hover:bg-[#F0EEE6] transition-colors cursor-pointer"
          title="Force refresh state from REST API"
        >
          <RefreshCw size={14} className={isRefreshing ? 'animate-spin text-[#c2410c]' : ''} />
        </button>

        <Link
          to="/alerts"
          className="relative rounded border border-[#E2E0D8] bg-white p-1.5 text-[#59616A] hover:border-[#CFCBC0] hover:text-[#17191C] hover:bg-[#F0EEE6] transition-colors"
          title={`${alerts.length} active fleet alerts`}
        >
          <Bell size={14} />
          {alerts.length > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#dc2626] text-[10px] font-bold text-white">
              {alerts.length > 9 ? '9+' : alerts.length}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
};

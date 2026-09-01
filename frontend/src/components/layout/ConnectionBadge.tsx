import React from 'react';
import type { ConnectionStatus } from '../../types/fleet';
import { RefreshCw, AlertCircle, Cpu } from 'lucide-react';

interface ConnectionBadgeProps {
  status: ConnectionStatus;
  isSimulated?: boolean;
  onReconnect?: () => void;
}

export const ConnectionBadge: React.FC<ConnectionBadgeProps> = ({
  status,
  isSimulated = false,
  onReconnect,
}) => {
  if (status === 'LIVE') {
    return (
      <div className="flex items-center gap-2 rounded-full border border-[#86EFAC] bg-[#F0FDF4] px-3 py-1 text-xs font-mono text-[#15803D] shadow-xs">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22C55E] opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-[#16A34A]" />
        </span>
        <span className="font-bold tracking-wide">LIVE</span>
        {isSimulated && (
          <span className="text-[10px] text-[#15803D] border-l border-[#BBF7D0] pl-1.5 flex items-center gap-1 font-semibold">
            <Cpu size={10} /> ENGINE
          </span>
        )}
      </div>
    );
  }

  if (status === 'RECONNECTING') {
    return (
      <div className="flex items-center gap-2 rounded-full border border-[#FDE68A] bg-[#FFFBEB] px-3 py-1 text-xs font-mono text-[#B45309] shadow-xs">
        <RefreshCw size={12} className="animate-spin text-[#F59E0B]" />
        <span className="font-bold tracking-wide">RECONNECTING...</span>
      </div>
    );
  }

  return (
    <button
      onClick={onReconnect}
      className="flex items-center gap-1.5 rounded-full border border-[#FECACA] bg-[#FEF2F2] px-3 py-1 text-xs font-mono text-[#B91C1C] hover:bg-[#FEE2E2] transition-colors cursor-pointer shadow-xs"
      title="Click to reconnect WebSocket"
    >
      <AlertCircle size={12} />
      <span className="font-bold tracking-wide">OFFLINE</span>
    </button>
  );
};

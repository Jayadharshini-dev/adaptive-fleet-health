import React from 'react';
import type { ConnectionStatus } from '../../types/fleet';
import { RefreshCw, AlertCircle } from 'lucide-react';

interface ConnectionBadgeProps {
  status: ConnectionStatus;
  isSimulated?: boolean;
  onReconnect?: () => void;
}

export const ConnectionBadge: React.FC<ConnectionBadgeProps> = ({
  status,
  onReconnect,
}) => {
  if (status === 'LIVE') {
    return (
      <div className="flex items-center gap-1.5 rounded border border-[#bbf7d0] bg-[#f0fdf4] px-2.5 py-0.5 text-xs font-mono text-[#16a34a]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#16a34a] inline-block" />
        <span className="font-bold tracking-wider">LIVE</span>
      </div>
    );
  }

  if (status === 'RECONNECTING') {
    return (
      <div className="flex items-center gap-1.5 rounded border border-[#fde68a] bg-[#fef3c7] px-2.5 py-0.5 text-xs font-mono text-[#d97706]">
        <RefreshCw size={11} className="animate-spin text-[#d97706]" />
        <span className="font-bold tracking-wider">RECONNECTING...</span>
      </div>
    );
  }

  return (
    <button
      onClick={onReconnect}
      className="flex items-center gap-1.5 rounded border border-[#fca5a5] bg-[#fee2e2] px-2.5 py-0.5 text-xs font-mono text-[#dc2626] hover:bg-[#fcd3d3] transition-colors cursor-pointer"
      title="Click to reconnect WebSocket"
    >
      <AlertCircle size={11} />
      <span className="font-bold tracking-wider">OFFLINE</span>
    </button>
  );
};

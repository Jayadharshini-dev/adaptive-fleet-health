import React from 'react';
import type { HealthStatus } from '../../types/fleet';
import { ShieldCheck, AlertTriangle, AlertOctagon } from 'lucide-react';

interface StatusBadgeProps {
  status: HealthStatus;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'md',
  showIcon = true,
}) => {
  const configs = {
    HEALTHY: {
      bg: 'bg-[#F0FDF4]',
      border: 'border-[#BBF7D0]',
      text: 'text-[#15803D]',
      icon: ShieldCheck,
      label: 'HEALTHY',
    },
    WARNING: {
      bg: 'bg-[#FFFBEB]',
      border: 'border-[#FDE68A]',
      text: 'text-[#B45309]',
      icon: AlertTriangle,
      label: 'WARNING',
    },
    CRITICAL: {
      bg: 'bg-[#FEF2F2]',
      border: 'border-[#FECACA]',
      text: 'text-[#B91C1C]',
      icon: AlertOctagon,
      label: 'CRITICAL',
    },
  };

  const config = configs[status] || configs.HEALTHY;
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'px-1.5 py-0.5 text-[11px] gap-1',
    md: 'px-2.5 py-1 text-xs gap-1.5',
    lg: 'px-3 py-1.5 text-sm gap-2 font-medium',
  };

  const iconSizes = {
    sm: 12,
    md: 14,
    lg: 16,
  };

  return (
    <span
      className={`inline-flex items-center rounded-md border font-mono uppercase tracking-wider font-bold shadow-xs ${config.bg} ${config.border} ${config.text} ${sizeClasses[size]}`}
    >
      {showIcon && <Icon size={iconSizes[size]} className="shrink-0" />}
      <span>{config.label}</span>
    </span>
  );
};

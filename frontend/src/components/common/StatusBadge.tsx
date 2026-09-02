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
      bg: 'bg-[#f0fdf4]',
      border: 'border-[#bbf7d0]',
      text: 'text-[#16a34a]',
      icon: ShieldCheck,
      label: 'HEALTHY',
    },
    WARNING: {
      bg: 'bg-[#fef3c7]',
      border: 'border-[#fde68a]',
      text: 'text-[#d97706]',
      icon: AlertTriangle,
      label: 'WARNING',
    },
    CRITICAL: {
      bg: 'bg-[#fee2e2]',
      border: 'border-[#fca5a5]',
      text: 'text-[#dc2626]',
      icon: AlertOctagon,
      label: 'CRITICAL',
    },
  };

  const config = configs[status] || configs.HEALTHY;
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'px-1.5 py-0.5 text-[10px] gap-1',
    md: 'px-2 py-0.5 text-xs gap-1.5',
    lg: 'px-3 py-1 text-sm gap-2 font-medium',
  };

  const iconSizes = {
    sm: 11,
    md: 13,
    lg: 15,
  };

  return (
    <span
      className={`inline-flex items-center rounded border font-mono uppercase tracking-wider font-bold ${config.bg} ${config.border} ${config.text} ${sizeClasses[size]}`}
    >
      {showIcon && <Icon size={iconSizes[size]} className="shrink-0" />}
      <span>{config.label}</span>
    </span>
  );
};

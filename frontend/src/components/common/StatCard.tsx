import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  variant?: 'default' | 'healthy' | 'warning' | 'critical' | 'cyan';
  subtitle?: string;
  trend?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  icon: Icon,
  variant = 'default',
  subtitle,
  trend,
}) => {
  const variantStyles = {
    default: {
      border: 'border-[#D8E5F0]',
      accent: 'bg-[#2563EB]',
      iconBg: 'bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]',
      valueColor: 'text-[#172033]',
    },
    healthy: {
      border: 'border-[#BBF7D0] hover:border-[#86EFAC]',
      accent: 'bg-[#22C55E]',
      iconBg: 'bg-[#F0FDF4] text-[#15803D] border border-[#BBF7D0]',
      valueColor: 'text-[#15803D]',
    },
    warning: {
      border: 'border-[#FDE68A] hover:border-[#FCD34D]',
      accent: 'bg-[#F59E0B]',
      iconBg: 'bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A]',
      valueColor: 'text-[#B45309]',
    },
    critical: {
      border: 'border-[#FECACA] hover:border-[#F87171]',
      accent: 'bg-[#EF4444]',
      iconBg: 'bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA]',
      valueColor: 'text-[#B91C1C]',
    },
    cyan: {
      border: 'border-[#BFDBFE] hover:border-[#93C5FD]',
      accent: 'bg-[#2563EB]',
      iconBg: 'bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]',
      valueColor: 'text-[#2563EB]',
    },
  };

  const style = variantStyles[variant];

  return (
    <div
      className={`cool-panel relative overflow-hidden rounded-xl p-4 transition-all duration-200 bg-white shadow-xs ${style.border}`}
    >
      {/* Top accent line */}
      <div className={`absolute top-0 left-0 right-0 h-[3px] ${style.accent}`} />

      <div className="flex items-center justify-between">
        <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#526174]">
          {label}
        </span>
        <div className={`rounded-lg p-2 shadow-xs ${style.iconBg}`}>
          <Icon size={18} />
        </div>
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        <span className={`font-mono text-3xl font-extrabold tracking-tight ${style.valueColor}`}>
          {value}
        </span>
        {trend && (
          <span className="font-mono text-xs font-semibold text-[#526174]">{trend}</span>
        )}
      </div>

      {subtitle && (
        <p className="mt-1 text-xs text-[#526174] truncate font-sans">{subtitle}</p>
      )}
    </div>
  );
};

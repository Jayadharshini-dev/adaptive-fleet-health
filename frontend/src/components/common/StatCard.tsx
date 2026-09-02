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
      border: 'border-[#E2E0D8]',
      accent: 'bg-[#17191C]',
      iconBg: 'bg-[#F0EEE6] text-[#17191C] border border-[#E2E0D8]',
      valueColor: 'text-[#17191C]',
    },
    healthy: {
      border: 'border-[#bbf7d0]',
      accent: 'bg-[#16a34a]',
      iconBg: 'bg-[#f0fdf4] text-[#16a34a] border border-[#bbf7d0]',
      valueColor: 'text-[#16a34a]',
    },
    warning: {
      border: 'border-[#fde68a]',
      accent: 'bg-[#d97706]',
      iconBg: 'bg-[#fef3c7] text-[#d97706] border border-[#fde68a]',
      valueColor: 'text-[#d97706]',
    },
    critical: {
      border: 'border-[#fca5a5]',
      accent: 'bg-[#dc2626]',
      iconBg: 'bg-[#fee2e2] text-[#dc2626] border border-[#fca5a5]',
      valueColor: 'text-[#dc2626]',
    },
    cyan: {
      border: 'border-[#E2E0D8]',
      accent: 'bg-[#c2410c]',
      iconBg: 'bg-[#F0EEE6] text-[#c2410c] border border-[#E2E0D8]',
      valueColor: 'text-[#c2410c]',
    },
  };

  const style = variantStyles[variant] || variantStyles.default;

  return (
    <div
      className={`relative overflow-hidden rounded border p-4 bg-white font-mono ${style.border}`}
    >
      <div className={`absolute top-0 left-0 right-0 h-[2px] ${style.accent}`} />

      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-widest text-[#59616A]">
          {label}
        </span>
        <div className={`rounded p-1.5 ${style.iconBg}`}>
          <Icon size={16} />
        </div>
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        <span className={`text-3xl font-extrabold tracking-tight ${style.valueColor}`}>
          {value}
        </span>
        {trend && (
          <span className="text-xs font-semibold text-[#7A838C]">{trend}</span>
        )}
      </div>

      {subtitle && (
        <p className="mt-1 text-xs text-[#59616A] truncate font-sans">{subtitle}</p>
      )}
    </div>
  );
};

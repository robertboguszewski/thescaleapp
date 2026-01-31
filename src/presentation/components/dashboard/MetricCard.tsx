/**
 * MetricCard Component
 *
 * Displays a single health metric with value, trend, and status.
 * Used in the dashboard for quick metric overview.
 *
 * @module presentation/components/dashboard/MetricCard
 */

import React from 'react';
import { Card } from '../common/Card';

export type MetricStatus = 'good' | 'warning' | 'critical' | 'neutral';
export type TrendDirection = 'up' | 'down' | 'stable';

export interface MetricCardProps {
  /** Metric label/name */
  label: string;
  /** Current value */
  value: string | number;
  /** Unit of measurement */
  unit?: string;
  /** Health status */
  status?: MetricStatus;
  /** Trend direction */
  trend?: TrendDirection;
  /** Trend value (e.g., "+2.5" or "-1.2") */
  trendValue?: string;
  /** Icon for the metric */
  icon?: React.ReactNode;
  /** Additional description */
  description?: string;
  /** Click handler */
  onClick?: () => void;
}

/**
 * Get status-specific colors
 */
const getStatusColors = (status: MetricStatus) => {
  const colors = {
    good: {
      bg: 'bg-green-50 dark:bg-green-900/20',
      text: 'text-green-600 dark:text-green-400',
      border: 'border-green-200 dark:border-green-800',
    },
    warning: {
      bg: 'bg-yellow-50 dark:bg-yellow-900/20',
      text: 'text-yellow-600 dark:text-yellow-400',
      border: 'border-yellow-200 dark:border-yellow-800',
    },
    critical: {
      bg: 'bg-red-50 dark:bg-red-900/20',
      text: 'text-red-600 dark:text-red-400',
      border: 'border-red-200 dark:border-red-800',
    },
    neutral: {
      bg: 'bg-gray-50 dark:bg-gray-800',
      text: 'text-gray-600 dark:text-gray-400',
      border: 'border-gray-200 dark:border-gray-700',
    },
  };
  return colors[status];
};

/**
 * Trend indicator component - compact version
 */
const TrendIndicator: React.FC<{
  direction: TrendDirection;
  value?: string;
}> = ({ direction, value }) => {
  const config = {
    up: {
      icon: '↑',
      color: 'text-green-500',
    },
    down: {
      icon: '↓',
      color: 'text-red-500',
    },
    stable: {
      icon: '→',
      color: 'text-gray-400',
    },
  }[direction];

  return (
    <span className={`text-sm font-medium ${config.color}`}>
      {config.icon}
      {value && value !== '0' && <span className="ml-0.5">{value}</span>}
    </span>
  );
};

/**
 * Default metric icons
 */
export const MetricIcons = {
  weight: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  ),
  bmi: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M9 21V9" />
    </svg>
  ),
  bodyFat: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2a10 10 0 0 1 10 10c0 5.523-4.477 10-10 10S2 17.523 2 12" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  muscle: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6.5 6.5L17.5 17.5" />
      <path d="M4.5 12.5l5-5 2 2" />
      <path d="M12.5 19.5l5-5-2-2" />
    </svg>
  ),
  water: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
    </svg>
  ),
  visceral: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4M12 16h.01" />
    </svg>
  ),
  bmr: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  ),
};

/**
 * MetricCard component - compact inline layout
 */
export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  unit,
  status = 'neutral',
  trend,
  trendValue,
  icon,
  description,
  onClick,
}) => {
  const statusColors = getStatusColors(status);

  return (
    <div
      className={`rounded-lg p-2.5 ${statusColors.bg} ${statusColors.border} border-l-2 ${onClick ? 'cursor-pointer hover:opacity-80' : ''}`}
      onClick={onClick}
    >
      {/* Label row */}
      <div className="flex items-center gap-1.5 mb-1">
        {icon && (
          <span className={`${statusColors.text} [&>svg]:w-4 [&>svg]:h-4`}>{icon}</span>
        )}
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 truncate">
          {label}
        </span>
      </div>

      {/* Value + Trend */}
      <div className="flex items-baseline justify-between">
        <div className="flex items-baseline gap-0.5">
          <span className="text-lg font-bold text-gray-900 dark:text-white">
            {value}
          </span>
          {unit && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {unit}
            </span>
          )}
        </div>
        {trend && <TrendIndicator direction={trend} value={trendValue} />}
      </div>
    </div>
  );
};

export default MetricCard;

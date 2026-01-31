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
 * Trend indicator component
 */
const TrendIndicator: React.FC<{
  direction: TrendDirection;
  value?: string;
}> = ({ direction, value }) => {
  const trendConfig = {
    up: {
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M7 17l5-5 5 5M7 7l5 5 5-5" />
        </svg>
      ),
      color: 'text-green-500 dark:text-green-400',
      bgColor: 'bg-green-100 dark:bg-green-900/30',
    },
    down: {
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M7 7l5 5 5-5M7 17l5-5 5 5" />
        </svg>
      ),
      color: 'text-red-500 dark:text-red-400',
      bgColor: 'bg-red-100 dark:bg-red-900/30',
    },
    stable: {
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M5 12h14" />
        </svg>
      ),
      color: 'text-gray-500 dark:text-gray-400',
      bgColor: 'bg-gray-100 dark:bg-gray-800',
    },
  };

  const config = trendConfig[direction];

  return (
    <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${config.bgColor}`}>
      <span className={config.color}>{config.icon}</span>
      {value && (
        <span className={`text-xs font-medium ${config.color}`}>{value}</span>
      )}
    </div>
  );
};

/**
 * Default metric icons
 */
export const MetricIcons = {
  weight: (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  ),
  bmi: (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M9 21V9" />
    </svg>
  ),
  bodyFat: (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2a10 10 0 0 1 10 10c0 5.523-4.477 10-10 10S2 17.523 2 12" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  muscle: (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6.5 6.5L17.5 17.5" />
      <path d="M4.5 12.5l5-5 2 2" />
      <path d="M12.5 19.5l5-5-2-2" />
    </svg>
  ),
  water: (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
    </svg>
  ),
  visceral: (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4M12 16h.01" />
    </svg>
  ),
  bmr: (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  ),
};

/**
 * MetricCard component
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
    <Card
      variant="default"
      padding="md"
      interactive={!!onClick}
      onClick={onClick}
      className={`${statusColors.border} border-l-4`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          {icon && (
            <div className={`p-2 rounded-lg ${statusColors.bg}`}>
              <span className={statusColors.text}>{icon}</span>
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              {label}
            </p>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-bold text-gray-900 dark:text-white">
                {value}
              </span>
              {unit && (
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {unit}
                </span>
              )}
            </div>
          </div>
        </div>
        {trend && <TrendIndicator direction={trend} value={trendValue} />}
      </div>
      {description && (
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          {description}
        </p>
      )}
    </Card>
  );
};

export default MetricCard;

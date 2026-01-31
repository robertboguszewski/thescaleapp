/**
 * Trends Comparison Card Component
 *
 * Shows progress over time with metric changes.
 *
 * @module presentation/components/analysis/TrendsComparisonCard
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../common/Card';
import type { MetricTrends } from '../../../shared/types';

interface TrendsComparisonCardProps {
  trends: MetricTrends;
  bodyScoreChange?: number;
  className?: string;
}

/**
 * Trend row component
 */
const TrendRow: React.FC<{
  label: string;
  change: number;
  unit: string;
  inverted?: boolean; // For metrics where decrease is good (e.g., body fat)
}> = ({ label, change, unit, inverted = false }) => {
  const isPositive = inverted ? change < 0 : change > 0;
  const isNegative = inverted ? change > 0 : change < 0;
  const isStable = Math.abs(change) < 0.1;

  const getIcon = () => {
    if (isStable) {
      return (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M5 12h14" />
        </svg>
      );
    }
    if (change > 0) {
      return (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M5 15l7-7 7 7" />
        </svg>
      );
    }
    return (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  const getColorClass = () => {
    if (isStable) return 'text-gray-500 dark:text-gray-400';
    if (isPositive) return 'text-green-600 dark:text-green-400';
    if (isNegative) return 'text-red-600 dark:text-red-400';
    return 'text-gray-500 dark:text-gray-400';
  };

  const getStatusDot = () => {
    if (isStable) return 'bg-amber-500';
    if (isPositive) return 'bg-green-500';
    if (isNegative) return 'bg-red-500';
    return 'bg-gray-500';
  };

  const formatChange = () => {
    if (isStable) return '0';
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(1)} ${unit}`;
  };

  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
      <div className="flex items-center gap-2">
        <span className={`flex items-center gap-1 font-medium ${getColorClass()}`}>
          {getIcon()}
          <span>{formatChange()}</span>
        </span>
        <span className={`w-2 h-2 rounded-full ${getStatusDot()}`} />
      </div>
    </div>
  );
};

/**
 * Trends Comparison Card
 */
export const TrendsComparisonCard: React.FC<TrendsComparisonCardProps> = ({
  trends,
  bodyScoreChange,
  className = '',
}) => {
  const { t } = useTranslation('analysis');

  // Determine overall trend
  const getOverallStatus = (): 'improving' | 'stable' | 'declining' => {
    const changes = [
      trends.weightChange,
      -trends.bodyFatChange, // Inverted - decrease is good
      trends.muscleChange,
    ].filter((c) => Math.abs(c) >= 0.1);

    if (changes.length === 0) return 'stable';

    const positiveChanges = changes.filter((c) => c > 0).length;
    const negativeChanges = changes.filter((c) => c < 0).length;

    if (positiveChanges > negativeChanges) return 'improving';
    if (negativeChanges > positiveChanges) return 'declining';
    return 'stable';
  };

  const overallStatus = getOverallStatus();
  const statusConfig = {
    improving: {
      color: 'text-green-600 dark:text-green-400',
      bg: 'bg-green-50 dark:bg-green-900/20',
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
    },
    stable: {
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-900/20',
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M5 12h14" />
        </svg>
      ),
    },
    declining: {
      color: 'text-red-600 dark:text-red-400',
      bg: 'bg-red-50 dark:bg-red-900/20',
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
        </svg>
      ),
    },
  };

  const config = statusConfig[overallStatus];

  return (
    <Card className={className} padding="lg">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {t('trends.title')}
        </h3>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {t('trends.period', { days: trends.period })}
        </span>
      </div>

      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        <TrendRow
          label={t('trends.metrics.weight')}
          change={trends.weightChange}
          unit="kg"
          inverted={true} // Weight loss is typically good
        />
        <TrendRow
          label={t('trends.metrics.bodyFat')}
          change={trends.bodyFatChange}
          unit="%"
          inverted={true}
        />
        <TrendRow
          label={t('trends.metrics.muscleMass')}
          change={trends.muscleChange}
          unit="kg"
        />
        {bodyScoreChange !== undefined && (
          <TrendRow
            label={t('trends.metrics.bodyScore')}
            change={bodyScoreChange}
            unit="pts"
          />
        )}
      </div>

      {/* Overall status */}
      <div className={`mt-4 p-3 rounded-lg ${config.bg}`}>
        <div className="flex items-center gap-2">
          <span className={config.color}>{config.icon}</span>
          <div>
            <p className={`font-medium ${config.color}`}>
              {t(`trends.overall.${overallStatus}`)}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {t(`trends.overall.${overallStatus}Message`)}
            </p>
          </div>
        </div>
      </div>

      {/* Measurement count */}
      <p className="mt-3 text-xs text-gray-400 text-center">
        {t('trends.measurementCount', { count: trends.measurementCount })}
      </p>
    </Card>
  );
};

export default TrendsComparisonCard;

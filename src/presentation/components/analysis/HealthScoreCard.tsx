/**
 * Health Score Card Component
 *
 * Hero card displaying overall body score with breakdown bars.
 * Wraps the existing BodyScoreGauge component.
 *
 * @module presentation/components/analysis/HealthScoreCard
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../common/Card';
import { BodyScoreGauge } from '../dashboard/BodyScoreGauge';

interface ScoreBreakdown {
  bmi: number;
  bodyFat: number;
  visceral: number;
  muscle: number;
}

interface HealthScoreCardProps {
  score: number;
  status: 'improving' | 'stable' | 'declining';
  breakdown?: ScoreBreakdown;
  className?: string;
}

/**
 * Progress bar for score breakdown
 */
const BreakdownBar: React.FC<{
  label: string;
  value: number;
  maxValue?: number;
}> = ({ label, value, maxValue = 100 }) => {
  const percentage = Math.min((value / maxValue) * 100, 100);

  return (
    <div className="flex items-center gap-3">
      <span className="w-12 text-xs text-gray-500 dark:text-gray-400 truncate">
        {label}
      </span>
      <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-primary-400 to-primary-600 rounded-full transition-all duration-500"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="w-8 text-xs text-gray-600 dark:text-gray-300 text-right">
        {value.toFixed(0)}
      </span>
    </div>
  );
};

/**
 * Get status message key based on score
 */
function getStatusMessage(score: number): string {
  if (score >= 91) return 'excellent';
  if (score >= 76) return 'veryGood';
  if (score >= 61) return 'good';
  if (score >= 41) return 'fair';
  return 'poor';
}

/**
 * Get status color class based on overall status
 */
function getStatusColor(status: 'improving' | 'stable' | 'declining'): string {
  switch (status) {
    case 'improving':
      return 'text-green-600 dark:text-green-400';
    case 'declining':
      return 'text-red-600 dark:text-red-400';
    default:
      return 'text-amber-600 dark:text-amber-400';
  }
}

/**
 * Get status icon
 */
const StatusIcon: React.FC<{ status: 'improving' | 'stable' | 'declining' }> = ({
  status,
}) => {
  const iconPath =
    status === 'improving'
      ? 'M5 15l7-7 7 7' // Arrow up
      : status === 'declining'
        ? 'M19 9l-7 7-7-7' // Arrow down
        : 'M5 12h14'; // Horizontal line

  return (
    <svg
      className="w-4 h-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d={iconPath} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

/**
 * Health Score Card - Hero component for analysis page
 */
export const HealthScoreCard: React.FC<HealthScoreCardProps> = ({
  score,
  status,
  breakdown,
  className = '',
}) => {
  const { t } = useTranslation('analysis');

  const statusMessage = getStatusMessage(score);
  const statusColorClass = getStatusColor(status);

  return (
    <Card className={`${className}`} padding="lg">
      <div className="flex flex-col lg:flex-row items-center gap-6">
        {/* Gauge */}
        <div className="flex-shrink-0">
          <BodyScoreGauge score={score} size={160} strokeWidth={10} showLabels={false} />
        </div>

        {/* Score info and breakdown */}
        <div className="flex-1 text-center lg:text-left">
          {/* Title and status */}
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
            {t('healthScore.title')}
          </h3>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            {score}
            <span className="text-lg text-gray-400 ml-1">/100</span>
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {t(`healthScore.${statusMessage}`)}
          </p>

          {/* Trend status */}
          <div className={`flex items-center gap-1 mt-2 justify-center lg:justify-start ${statusColorClass}`}>
            <StatusIcon status={status} />
            <span className="text-sm font-medium">{t(`trends.${status}`)}</span>
          </div>

          {/* Breakdown bars */}
          {breakdown && (
            <div className="mt-4 space-y-2 w-full max-w-xs mx-auto lg:mx-0">
              <BreakdownBar label="BMI" value={breakdown.bmi} />
              <BreakdownBar label={t('metrics.bodyFat')} value={breakdown.bodyFat} />
              <BreakdownBar label={t('metrics.visceral')} value={breakdown.visceral} maxValue={30} />
              <BreakdownBar label={t('metrics.muscle')} value={breakdown.muscle} />
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};

export default HealthScoreCard;

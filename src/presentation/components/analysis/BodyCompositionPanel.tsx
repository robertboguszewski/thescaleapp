/**
 * Body Composition Panel Component
 *
 * 2x3 grid of metric cards showing body composition breakdown.
 *
 * @module presentation/components/analysis/BodyCompositionPanel
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { MetricCard, MetricIcons } from '../dashboard/MetricCard';
import type { MetricStatus, TrendDirection } from '../dashboard/MetricCard';
import type { CalculatedMetrics } from '../../../shared/types';
import type { ProfileContext } from './status-helpers';
import {
  getBodyFatStatus,
  getMuscleMassStatus,
  getBodyWaterStatus,
  getBoneMassStatus,
  getProteinStatus,
} from './status-helpers';

interface BodyCompositionPanelProps {
  metrics: CalculatedMetrics;
  weightKg: number;
  profile: ProfileContext;
  trends?: {
    bodyFatChange?: number;
    muscleChange?: number;
  };
  className?: string;
}

/**
 * Format metric value with appropriate precision
 */
function formatValue(value: number, precision = 1): string {
  return value.toFixed(precision);
}

/**
 * Calculate trend direction from change value
 * For body fat, lower is better (inverted)
 */
function getTrend(change: number | undefined, inverted = false): TrendDirection | undefined {
  if (change === undefined) return undefined;
  if (Math.abs(change) < 0.1) return 'stable';

  const direction = change > 0 ? 'up' : 'down';
  if (inverted) {
    return direction === 'down' ? 'up' : 'down';
  }
  return direction;
}

/**
 * Format trend value for display
 */
function formatTrend(change: number | undefined, unit: string): string | undefined {
  if (change === undefined) return undefined;
  const sign = change >= 0 ? '+' : '';
  return `${sign}${change.toFixed(1)}${unit}`;
}

/**
 * Body Composition Panel - 6 metric cards in 2x3 grid
 */
export const BodyCompositionPanel: React.FC<BodyCompositionPanelProps> = ({
  metrics,
  weightKg,
  profile,
  trends,
  className = '',
}) => {
  const { t } = useTranslation(['analysis', 'dashboard']);

  // Calculate lean body mass status (healthy if muscle is healthy)
  const leanMassStatus: MetricStatus = getMuscleMassStatus(
    metrics.muscleMassKg,
    weightKg,
    profile.gender
  );

  const compositionMetrics = [
    {
      key: 'bodyFat',
      label: t('dashboard:metrics.bodyFat'),
      value: formatValue(metrics.bodyFatPercent),
      unit: '%',
      status: getBodyFatStatus(metrics.bodyFatPercent, profile),
      trend: getTrend(trends?.bodyFatChange, true), // Lower is better
      trendValue: formatTrend(trends?.bodyFatChange, '%'),
      icon: MetricIcons.bodyFat,
    },
    {
      key: 'muscleMass',
      label: t('dashboard:metrics.muscleMass'),
      value: formatValue(metrics.muscleMassKg),
      unit: 'kg',
      status: getMuscleMassStatus(metrics.muscleMassKg, weightKg, profile.gender),
      trend: getTrend(trends?.muscleChange),
      trendValue: formatTrend(trends?.muscleChange, 'kg'),
      icon: MetricIcons.muscle,
    },
    {
      key: 'bodyWater',
      label: t('dashboard:metrics.water'),
      value: formatValue(metrics.bodyWaterPercent),
      unit: '%',
      status: getBodyWaterStatus(metrics.bodyWaterPercent, profile.gender),
      icon: MetricIcons.water,
    },
    {
      key: 'boneMass',
      label: t('dashboard:metrics.boneMass'),
      value: formatValue(metrics.boneMassKg),
      unit: 'kg',
      status: getBoneMassStatus(metrics.boneMassKg, weightKg, profile.gender),
    },
    {
      key: 'protein',
      label: t('dashboard:metrics.protein'),
      value: formatValue(metrics.proteinPercent),
      unit: '%',
      status: getProteinStatus(metrics.proteinPercent),
    },
    {
      key: 'leanMass',
      label: t('analysis:metrics.leanMass'),
      value: formatValue(metrics.leanBodyMassKg),
      unit: 'kg',
      status: leanMassStatus,
    },
  ];

  return (
    <div className={`${className}`}>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        {t('analysis:bodyComposition.title')}
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {compositionMetrics.map((metric) => (
          <MetricCard
            key={metric.key}
            label={metric.label}
            value={metric.value}
            unit={metric.unit}
            status={metric.status}
            trend={metric.trend}
            trendValue={metric.trendValue}
            icon={metric.icon}
          />
        ))}
      </div>
    </div>
  );
};

export default BodyCompositionPanel;

/**
 * WeeklyTrendCard Component
 *
 * Displays a compact weekly trend visualization with key metrics.
 * Shows weight change direction and mini sparkline chart.
 *
 * @module presentation/components/dashboard/WeeklyTrendCard
 */

import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../common/Card';
import { useMeasurementStore, type Measurement } from '../../stores/measurementStore';
import { useAppStore } from '../../stores/appStore';

/**
 * Mini sparkline chart component
 */
const MiniSparkline: React.FC<{
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}> = ({ data, width = 120, height = 40, color = '#6366f1' }) => {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - ((value - min) / range) * (height - 8) - 4;
    return `${x},${y}`;
  });

  const pathD = `M ${points.join(' L ')}`;

  return (
    <svg width={width} height={height} className="overflow-visible">
      {/* Grid lines */}
      <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke="currentColor" strokeOpacity="0.1" />

      {/* Line chart */}
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* End dot */}
      {data.length > 0 && (
        <circle
          cx={width}
          cy={height - ((data[data.length - 1] - min) / range) * (height - 8) - 4}
          r="3"
          fill={color}
        />
      )}
    </svg>
  );
};

/**
 * Trend indicator component
 */
const TrendIndicator: React.FC<{
  change: number;
  unit: string;
}> = ({ change, unit }) => {
  const isPositive = change > 0;
  const isNeutral = Math.abs(change) < 0.1;

  const colorClass = isNeutral
    ? 'text-gray-500 dark:text-gray-400'
    : isPositive
    ? 'text-red-500 dark:text-red-400'
    : 'text-green-500 dark:text-green-400';

  const bgClass = isNeutral
    ? 'bg-gray-100 dark:bg-gray-800'
    : isPositive
    ? 'bg-red-100 dark:bg-red-900/30'
    : 'bg-green-100 dark:bg-green-900/30';

  return (
    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium ${colorClass} ${bgClass}`}>
      {!isNeutral && (
        <svg
          className={`w-3 h-3 ${isPositive ? '' : 'rotate-180'}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
        >
          <path d="M12 19V5M5 12l7-7 7 7" />
        </svg>
      )}
      <span>
        {isNeutral ? '—' : `${isPositive ? '+' : ''}${change.toFixed(1)}`} {unit}
      </span>
    </div>
  );
};

/**
 * WeeklyTrendCard component
 */
export const WeeklyTrendCard: React.FC = () => {
  const { t } = useTranslation('dashboard');
  const { measurements } = useMeasurementStore();
  const { setActiveTab } = useAppStore();

  // Calculate weekly data
  const weeklyData = useMemo(() => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Filter measurements from the last week
    const weekMeasurements = measurements
      .filter((m: Measurement) => new Date(m.timestamp) >= weekAgo)
      .sort((a: Measurement, b: Measurement) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    if (weekMeasurements.length === 0) {
      return null;
    }

    // Get weights for sparkline
    const weights = weekMeasurements.map((m: Measurement) => m.raw.weightKg);

    // Calculate change
    const firstWeight = weights[0];
    const lastWeight = weights[weights.length - 1];
    const change = lastWeight - firstWeight;

    // Count measurements
    const count = weekMeasurements.length;

    return {
      weights,
      change,
      count,
      currentWeight: lastWeight,
      hasData: true,
    };
  }, [measurements]);

  const handleClick = () => {
    setActiveTab('trends');
  };

  // Empty state
  if (!weeklyData) {
    return (
      <Card className="h-full">
        <button
          onClick={handleClick}
          className="w-full h-full text-left"
          data-testid="weekly-trend-empty"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
              {t('weeklyTrend.title')}
            </h3>
            <svg
              className="w-4 h-4 text-gray-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
          </div>
          <div className="flex flex-col items-center justify-center py-4">
            <div className="w-10 h-10 mb-2 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              <svg className="w-5 h-5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 3v18h18" />
                <path d="M18 9l-5 5-4-4-6 6" />
              </svg>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
              {t('weeklyTrend.noData')}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              {t('weeklyTrend.measureToSee')}
            </p>
          </div>
        </button>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <button
        onClick={handleClick}
        className="w-full h-full text-left"
        data-testid="weekly-trend-card"
      >
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
            {t('weeklyTrend.title')}
          </h3>
          <svg
            className="w-4 h-4 text-gray-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </div>

        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {weeklyData.currentWeight.toFixed(1)}
              <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-1">
                kg
              </span>
            </p>
            <div className="mt-1">
              <TrendIndicator change={weeklyData.change} unit="kg" />
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
              {t('weeklyTrend.measurementsThisWeek', { count: weeklyData.count })}
            </p>
          </div>

          <div className="flex-shrink-0">
            <MiniSparkline
              data={weeklyData.weights}
              width={100}
              height={36}
              color={weeklyData.change <= 0 ? '#22c55e' : '#ef4444'}
            />
          </div>
        </div>
      </button>
    </Card>
  );
};

export default WeeklyTrendCard;

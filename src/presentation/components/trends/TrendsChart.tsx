/**
 * TrendsChart Component
 *
 * Displays health metrics over time using Recharts.
 * Supports multiple metrics, date ranges, and interactive tooltips.
 *
 * @module presentation/components/trends/TrendsChart
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { Skeleton } from '../common/LoadingSpinner';
import { MetricSelector, DateRangeSelector, getMetricConfig, METRIC_CONFIGS } from './MetricSelector';
import { useMeasurementStore, useFilteredMeasurements, MetricType } from '../../stores/measurementStore';
import { useAppStore } from '../../stores/appStore';
import type { StoredMeasurement } from '../../../infrastructure/storage/schemas';

/**
 * Get metric value from measurement
 */
const getMetricValue = (measurement: StoredMeasurement, metric: MetricType): number => {
  switch (metric) {
    case 'weight':
      return measurement.raw.weightKg;
    case 'bmi':
      return measurement.calculated.bmi;
    case 'bodyFatPercent':
      return measurement.calculated.bodyFatPercent;
    case 'muscleMassKg':
      return measurement.calculated.muscleMassKg;
    case 'bodyWaterPercent':
      return measurement.calculated.bodyWaterPercent;
    case 'visceralFatLevel':
      return measurement.calculated.visceralFatLevel;
    case 'bmrKcal':
      return measurement.calculated.bmrKcal;
    case 'bodyScore':
      return measurement.calculated.bodyScore;
    default:
      return 0;
  }
};

/**
 * Format chart data from measurements
 */
const formatChartData = (measurements: StoredMeasurement[], metric: MetricType) => {
  return [...measurements]
    .reverse()
    .map((m) => ({
      date: new Date(m.timestamp).toLocaleDateString('pl-PL', {
        day: 'numeric',
        month: 'short',
      }),
      fullDate: new Date(m.timestamp).toLocaleDateString('pl-PL', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
      value: getMetricValue(m, metric),
      id: m.id,
    }));
};

/**
 * Calculate statistics from data
 */
const calculateStats = (data: { value: number }[]) => {
  if (data.length === 0) {
    return { min: 0, max: 0, avg: 0, change: 0, changePercent: 0 };
  }

  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const first = values[0];
  const last = values[values.length - 1];
  const change = last - first;
  const changePercent = first !== 0 ? (change / first) * 100 : 0;

  return { min, max, avg, change, changePercent };
};

/**
 * Custom tooltip component
 */
const CustomTooltip: React.FC<{
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
  metric: MetricType;
}> = ({ active, payload, label, metric }) => {
  if (!active || !payload || payload.length === 0) return null;

  const config = getMetricConfig(metric);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-3">
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-lg font-bold text-gray-900 dark:text-white">
        {payload[0].value.toFixed(1)} {config.unit}
      </p>
    </div>
  );
};

/**
 * Stats card component
 */
const StatsCard: React.FC<{
  label: string;
  value: string;
  subtext?: string;
  color?: string;
}> = ({ label, value, subtext, color }) => (
  <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
    <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
    <p className="text-xl font-bold text-gray-900 dark:text-white" style={{ color }}>
      {value}
    </p>
    {subtext && (
      <p className="text-xs text-gray-400 mt-0.5">{subtext}</p>
    )}
  </div>
);

/**
 * Empty state component
 */
const EmptyState: React.FC = () => {
  const { t } = useTranslation('dashboard');
  const { setActiveTab } = useAppStore();

  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="w-24 h-24 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-6">
        <svg
          className="w-12 h-12 text-gray-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M3 3v18h18" />
          <path d="M7 16l4-4 4 4 5-6" />
        </svg>
      </div>
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
        {t('trendsChart.noData')}
      </h2>
      <p className="mt-2 text-gray-500 dark:text-gray-400 text-center max-w-md">
        {t('trendsChart.noDataDescription')}
      </p>
      <Button
        variant="primary"
        size="lg"
        className="mt-6"
        onClick={() => setActiveTab('measure')}
      >
        {t('trendsChart.takeMeasurement')}
      </Button>
    </div>
  );
};

/**
 * Chart skeleton
 */
const ChartSkeleton: React.FC = () => (
  <div className="space-y-6">
    <div className="flex justify-between items-center">
      <Skeleton width={200} height={36} />
      <Skeleton width={300} height={36} />
    </div>
    <Skeleton height={400} className="rounded-xl" />
    <div className="grid grid-cols-4 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <Skeleton key={i} height={80} className="rounded-lg" />
      ))}
    </div>
  </div>
);

/**
 * TrendsChart component
 */
export const TrendsChart: React.FC = () => {
  const { t } = useTranslation('dashboard');
  const filteredMeasurements = useFilteredMeasurements();
  const { selectedMetric, isLoading } = useMeasurementStore();
  const { isDarkMode } = useAppStore();

  const metricConfig = getMetricConfig(selectedMetric);
  const chartData = React.useMemo(
    () => formatChartData(filteredMeasurements, selectedMetric),
    [filteredMeasurements, selectedMetric]
  );
  const stats = React.useMemo(() => calculateStats(chartData), [chartData]);

  if (isLoading) {
    return <ChartSkeleton />;
  }

  if (filteredMeasurements.length === 0) {
    return <EmptyState />;
  }

  // Chart colors based on theme
  const gridColor = isDarkMode ? '#374151' : '#e5e7eb';
  const textColor = isDarkMode ? '#9ca3af' : '#6b7280';

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <MetricSelector variant="dropdown" />
        <DateRangeSelector />
      </div>

      {/* Main chart */}
      <Card className="p-0 overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-white">
            {metricConfig.label}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('trendsChart.measurements', { count: chartData.length })}
          </p>
        </div>

        <div className="h-[400px] p-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 20, right: 30, left: 10, bottom: 10 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={gridColor}
                vertical={false}
              />
              <XAxis
                dataKey="date"
                stroke={textColor}
                tick={{ fill: textColor, fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: gridColor }}
              />
              <YAxis
                stroke={textColor}
                tick={{ fill: textColor, fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                domain={['dataMin - 5', 'dataMax + 5']}
                tickFormatter={(value) => value.toFixed(1)}
              />
              <Tooltip content={<CustomTooltip metric={selectedMetric} />} />

              {/* Average reference line */}
              <ReferenceLine
                y={stats.avg}
                stroke={metricConfig.color}
                strokeDasharray="5 5"
                strokeOpacity={0.5}
              />

              <Line
                type="monotone"
                dataKey="value"
                stroke={metricConfig.color}
                strokeWidth={2}
                dot={{
                  fill: metricConfig.color,
                  strokeWidth: 0,
                  r: 4,
                }}
                activeDot={{
                  fill: metricConfig.color,
                  strokeWidth: 2,
                  stroke: isDarkMode ? '#1f2937' : '#ffffff',
                  r: 6,
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatsCard
          label={t('trendsChart.minimum')}
          value={`${stats.min.toFixed(1)} ${metricConfig.unit}`}
        />
        <StatsCard
          label={t('trendsChart.maximum')}
          value={`${stats.max.toFixed(1)} ${metricConfig.unit}`}
        />
        <StatsCard
          label={t('trendsChart.average')}
          value={`${stats.avg.toFixed(1)} ${metricConfig.unit}`}
        />
        <StatsCard
          label={t('trendsChart.change')}
          value={`${stats.change >= 0 ? '+' : ''}${stats.change.toFixed(1)} ${metricConfig.unit}`}
          subtext={`${stats.changePercent >= 0 ? '+' : ''}${stats.changePercent.toFixed(1)}%`}
          color={stats.change >= 0 ? '#22c55e' : '#ef4444'}
        />
      </div>

      {/* Quick metric cards */}
      <Card title={t('trendsChart.allMetrics')} subtitle={t('trendsChart.lastMeasurement')}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {METRIC_CONFIGS.filter((m) => m.id !== selectedMetric).slice(0, 4).map((metric) => {
            const latestValue = filteredMeasurements.length > 0
              ? getMetricValue(filteredMeasurements[0], metric.id)
              : 0;

            return (
              <button
                key={metric.id}
                onClick={() => useMeasurementStore.getState().setSelectedMetric(metric.id)}
                className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors text-left"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: metric.color }}
                  />
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {metric.label}
                  </span>
                </div>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {latestValue.toFixed(1)} {metric.unit}
                </p>
              </button>
            );
          })}
        </div>
      </Card>
    </div>
  );
};

export default TrendsChart;

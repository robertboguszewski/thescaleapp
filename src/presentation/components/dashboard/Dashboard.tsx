/**
 * Dashboard Component
 *
 * Main dashboard view - central hub showing overview of all app modules.
 * Displays status, quick actions, trends, recommendations, and activity.
 *
 * @module presentation/components/dashboard/Dashboard
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { Skeleton } from '../common/LoadingSpinner';
import { MetricCard, MetricIcons, MetricStatus, TrendDirection } from './MetricCard';
import { BodyScoreGauge, MiniBodyScoreGauge } from './BodyScoreGauge';
import { SetupStatus } from './SetupStatus';
import { QuickActionsPanel } from './QuickActionsPanel';
import { StatusOverviewPanel } from './StatusOverviewPanel';
import { WeeklyTrendCard } from './WeeklyTrendCard';
import { SmartRecommendations } from './SmartRecommendations';
import { RecentActivityFeed } from './RecentActivityFeed';
import { QuickMeasurementWidget } from './QuickMeasurementWidget';
import { useAppStore } from '../../stores/appStore';
import { useMeasurementStore, useLatestMeasurement } from '../../stores/measurementStore';
import { useCurrentProfile } from '../../stores/profileStore';
import { useSetupStatus } from '../../hooks/useSetupStatus';

/**
 * Loading skeleton for dashboard
 */
const DashboardSkeleton: React.FC = () => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1">
        <Card className="h-48">
          <Skeleton className="h-full" />
        </Card>
      </div>
      <div className="lg:col-span-2">
        <Card className="h-48">
          <Skeleton className="h-full" />
        </Card>
      </div>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="h-40">
          <Skeleton className="h-full" />
        </Card>
      ))}
    </div>
  </div>
);

/**
 * Get metric status based on value and thresholds
 */
const getMetricStatus = (metric: string, value: number, gender?: 'male' | 'female'): MetricStatus => {
  switch (metric) {
    case 'bmi':
      if (value >= 18.5 && value <= 24.9) return 'good';
      if (value < 18.5 || (value > 24.9 && value <= 29.9)) return 'warning';
      return 'critical';

    case 'bodyFatPercent': {
      const threshold = gender === 'male' ? 25 : 32;
      if (value <= threshold) return 'good';
      if (value <= threshold + 5) return 'warning';
      return 'critical';
    }

    case 'visceralFatLevel':
      if (value <= 9) return 'good';
      if (value <= 14) return 'warning';
      return 'critical';

    case 'bodyScore':
      if (value >= 70) return 'good';
      if (value >= 50) return 'warning';
      return 'critical';

    default:
      return 'neutral';
  }
};

/**
 * Key metrics inline - returns fragments for parent grid
 */
const KeyMetricsInline: React.FC = () => {
  const { t } = useTranslation('dashboard');
  const latestMeasurement = useLatestMeasurement();
  const { measurements } = useMeasurementStore();
  const currentProfile = useCurrentProfile();

  if (!latestMeasurement) return null;

  const metrics = latestMeasurement.calculated;
  const raw = latestMeasurement.raw;
  const previousMeasurement = measurements.length > 1 ? measurements[1] : undefined;
  const prevMetrics = previousMeasurement?.calculated;

  const calculateTrend = (current: number, previous: number | undefined): { direction: TrendDirection; value: string } | undefined => {
    if (previous === undefined) return undefined;
    const diff = current - previous;
    if (Math.abs(diff) < 0.1) return { direction: 'stable', value: '0' };
    return {
      direction: diff > 0 ? 'up' : 'down',
      value: `${diff > 0 ? '+' : ''}${diff.toFixed(1)}`,
    };
  };

  return (
    <>
      <MetricCard
        label={t('metrics.weight')}
        value={raw.weightKg.toFixed(1)}
        unit="kg"
        icon={MetricIcons.weight}
        status="neutral"
        trend={calculateTrend(raw.weightKg, previousMeasurement?.raw.weightKg)?.direction}
        trendValue={calculateTrend(raw.weightKg, previousMeasurement?.raw.weightKg)?.value}
      />
      <MetricCard
        label={t('metrics.bmi')}
        value={metrics.bmi.toFixed(1)}
        icon={MetricIcons.bmi}
        status={getMetricStatus('bmi', metrics.bmi)}
        trend={calculateTrend(metrics.bmi, prevMetrics?.bmi)?.direction}
        trendValue={calculateTrend(metrics.bmi, prevMetrics?.bmi)?.value}
      />
      <MetricCard
        label={t('metrics.bodyFat')}
        value={metrics.bodyFatPercent.toFixed(1)}
        unit="%"
        icon={MetricIcons.bodyFat}
        status={getMetricStatus('bodyFatPercent', metrics.bodyFatPercent, currentProfile?.gender)}
        trend={calculateTrend(metrics.bodyFatPercent, prevMetrics?.bodyFatPercent)?.direction}
        trendValue={calculateTrend(metrics.bodyFatPercent, prevMetrics?.bodyFatPercent)?.value}
      />
      <MetricCard
        label={t('metrics.visceralFat')}
        value={metrics.visceralFatLevel}
        icon={MetricIcons.visceral}
        status={getMetricStatus('visceralFatLevel', metrics.visceralFatLevel)}
      />
    </>
  );
};

/**
 * Dashboard component - Main hub for the application
 */
export const Dashboard: React.FC = () => {
  const { t, i18n } = useTranslation('dashboard');
  const latestMeasurement = useLatestMeasurement();
  const { isLoading } = useMeasurementStore();
  const { setActiveTab } = useAppStore();
  const { isSetupComplete } = useSetupStatus();

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  // Show setup status when setup is incomplete
  if (!isSetupComplete) {
    return (
      <div className="space-y-6">
        <SetupStatus />
        {latestMeasurement && (
          <div className="text-center text-sm text-gray-500 dark:text-gray-400">
            {t('setupIncomplete')}
          </div>
        )}
      </div>
    );
  }

  // Render the comprehensive dashboard
  return (
    <div className="space-y-4">
      {/* Welcome header - compact */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            {t('title')}
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {new Date().toLocaleDateString(i18n.language === 'pl' ? 'pl-PL' : 'en-US', {
              weekday: 'long',
              month: 'short',
              day: 'numeric',
            })}
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setActiveTab('measure')}>
          {t('quickActions.newMeasurement')}
        </Button>
      </div>

      {/* Top section: Quick Measurement + Weekly Trend (2 columns) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <QuickMeasurementWidget />
        <WeeklyTrendCard />
      </div>

      {/* Metrics row: Body Score + Key metrics (if has measurements) */}
      {latestMeasurement && (
        <Card padding="sm">
          <div className="flex items-center gap-4">
            {/* Mini Body Score */}
            <div className="flex-shrink-0 flex flex-col items-center">
              <MiniBodyScoreGauge score={latestMeasurement.calculated.bodyScore} size={56} />
              <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {t('bodyScore.title')}
              </span>
            </div>

            {/* Divider */}
            <div className="w-px h-12 bg-gray-200 dark:bg-gray-700" />

            {/* Key Metrics - horizontal flow */}
            <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3">
              <KeyMetricsInline />
            </div>
          </div>
        </Card>
      )}

      {/* Status + Quick Actions row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StatusOverviewPanel />
        <QuickActionsPanel />
      </div>

      {/* Bottom: Recommendations + Activity (collapsible) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SmartRecommendations />
        <RecentActivityFeed />
      </div>
    </div>
  );
};

export default Dashboard;

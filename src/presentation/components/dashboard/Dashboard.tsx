/**
 * Dashboard Component
 *
 * Main dashboard view - central hub showing overview of all app modules.
 * Displays status, quick actions, trends, recommendations, and activity.
 *
 * @module presentation/components/dashboard/Dashboard
 */

import React from 'react';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { Skeleton } from '../common/LoadingSpinner';
import { MetricCard, MetricIcons, MetricStatus, TrendDirection } from './MetricCard';
import { BodyScoreGauge } from './BodyScoreGauge';
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
 * Key metrics section for dashboard with measurements
 */
const KeyMetricsSection: React.FC = () => {
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
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <MetricCard
        label="Waga"
        value={raw.weightKg.toFixed(1)}
        unit="kg"
        icon={MetricIcons.weight}
        status="neutral"
        trend={calculateTrend(raw.weightKg, previousMeasurement?.raw.weightKg)?.direction}
        trendValue={calculateTrend(raw.weightKg, previousMeasurement?.raw.weightKg)?.value}
      />
      <MetricCard
        label="BMI"
        value={metrics.bmi.toFixed(1)}
        icon={MetricIcons.bmi}
        status={getMetricStatus('bmi', metrics.bmi)}
        trend={calculateTrend(metrics.bmi, prevMetrics?.bmi)?.direction}
        trendValue={calculateTrend(metrics.bmi, prevMetrics?.bmi)?.value}
      />
      <MetricCard
        label="Tkanka tluszczowa"
        value={metrics.bodyFatPercent.toFixed(1)}
        unit="%"
        icon={MetricIcons.bodyFat}
        status={getMetricStatus('bodyFatPercent', metrics.bodyFatPercent, currentProfile?.gender)}
        trend={calculateTrend(metrics.bodyFatPercent, prevMetrics?.bodyFatPercent)?.direction}
        trendValue={calculateTrend(metrics.bodyFatPercent, prevMetrics?.bodyFatPercent)?.value}
      />
      <MetricCard
        label="Tluszcz trzewny"
        value={metrics.visceralFatLevel}
        icon={MetricIcons.visceral}
        status={getMetricStatus('visceralFatLevel', metrics.visceralFatLevel)}
      />
    </div>
  );
};

/**
 * Dashboard component - Main hub for the application
 */
export const Dashboard: React.FC = () => {
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
            Masz zapisane pomiary, ale dokończ konfigurację aby korzystać z pełnych funkcji.
          </div>
        )}
      </div>
    );
  }

  // Render the comprehensive dashboard
  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Pulpit
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {new Date().toLocaleDateString('pl-PL', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>
        <Button variant="primary" onClick={() => setActiveTab('measure')}>
          Nowy pomiar
        </Button>
      </div>

      {/* Top row: Quick Measurement + Status + Weekly Trend */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Quick Measurement Widget - prominent position */}
        <div className="md:col-span-1">
          <QuickMeasurementWidget />
        </div>

        {/* Status overview */}
        <div className="md:col-span-1">
          <StatusOverviewPanel />
        </div>

        {/* Weekly trend card */}
        <div className="md:col-span-2 lg:col-span-1">
          <WeeklyTrendCard />
        </div>
      </div>

      {/* Body Score + Key metrics (if has measurements) */}
      {latestMeasurement && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Body Score Gauge - compact */}
          <div className="lg:col-span-1">
            <BodyScoreGauge score={latestMeasurement.calculated.bodyScore} size={140} showLabels={false} />
          </div>

          {/* Key Metrics - expanded */}
          <div className="lg:col-span-3">
            <KeyMetricsSection />
          </div>
        </div>
      )}

      {/* Middle row: Quick Actions + Recommendations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <QuickActionsPanel />
        <SmartRecommendations />
      </div>

      {/* Bottom row: Recent Activity */}
      <div className="grid grid-cols-1 gap-6">
        <RecentActivityFeed />
      </div>
    </div>
  );
};

export default Dashboard;

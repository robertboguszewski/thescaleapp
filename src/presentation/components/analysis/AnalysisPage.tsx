/**
 * Analysis Page Component
 *
 * Main container for the health analysis dashboard.
 * Orchestrates data loading and renders all analysis components.
 *
 * @module presentation/components/analysis/AnalysisPage
 */

import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useReport } from '../../hooks/useReport';
import { useCurrentProfile } from '../../stores/profileStore';
import { HealthScoreCard } from './HealthScoreCard';
import { BodyCompositionPanel } from './BodyCompositionPanel';
import { MetabolicHealthCard } from './MetabolicHealthCard';
import { TrendsComparisonCard } from './TrendsComparisonCard';
import { RiskAssessmentCard } from './RiskAssessmentCard';
import { RecommendationsPanel } from './RecommendationsPanel';
import type { ProfileContext } from './status-helpers';

/**
 * Loading skeleton for analysis cards
 */
const LoadingSkeleton: React.FC = () => (
  <div className="animate-pulse space-y-6">
    {/* Hero row skeleton */}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-xl" />
      <div className="lg:col-span-2 h-64 bg-gray-200 dark:bg-gray-700 rounded-xl" />
    </div>
    {/* Body composition skeleton */}
    <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded-xl" />
    {/* Bottom row skeleton */}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-xl" />
      <div className="lg:col-span-2 h-64 bg-gray-200 dark:bg-gray-700 rounded-xl" />
    </div>
  </div>
);

/**
 * Empty state when no profile is selected
 */
const NoProfileState: React.FC = () => {
  const { t } = useTranslation('analysis');

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
      <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
        <svg
          className="w-10 h-10 text-gray-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        {t('empty.noProfile')}
      </h3>
      <p className="text-gray-500 dark:text-gray-400 max-w-sm">
        {t('empty.noProfileMessage')}
      </p>
    </div>
  );
};

/**
 * Empty state when no measurements exist
 */
const NoMeasurementsState: React.FC = () => {
  const { t } = useTranslation('analysis');

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
      <div className="w-20 h-20 rounded-full bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center mb-4">
        <svg
          className="w-10 h-10 text-primary-500"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        {t('empty.noMeasurements')}
      </h3>
      <p className="text-gray-500 dark:text-gray-400 max-w-sm">
        {t('empty.noMeasurementsMessage')}
      </p>
    </div>
  );
};

/**
 * Error state
 */
const ErrorState: React.FC<{ error: string; onRetry: () => void }> = ({ error, onRetry }) => {
  const { t } = useTranslation('analysis');

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
      <div className="w-20 h-20 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-4">
        <svg
          className="w-10 h-10 text-red-500"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4M12 16h.01" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        {t('error.title')}
      </h3>
      <p className="text-gray-500 dark:text-gray-400 max-w-sm mb-4">{error}</p>
      <button
        onClick={onRetry}
        className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
      >
        {t('error.retry')}
      </button>
    </div>
  );
};

/**
 * Analysis Page - Main container component
 */
export const AnalysisPage: React.FC = () => {
  const { t } = useTranslation('analysis');
  const currentProfile = useCurrentProfile();
  const {
    report,
    isLoading,
    error,
    generateReportForCurrentProfile,
    clearError,
  } = useReport();

  // Generate report when profile changes
  useEffect(() => {
    if (currentProfile?.id) {
      generateReportForCurrentProfile();
    }
  }, [currentProfile?.id, generateReportForCurrentProfile]);

  // Build profile context for status calculations
  const profileContext: ProfileContext | null = useMemo(() => {
    if (!currentProfile) return null;

    const currentYear = new Date().getFullYear();
    const age = currentYear - currentProfile.birthYear;

    return {
      gender: currentProfile.gender,
      age,
    };
  }, [currentProfile]);

  // Handle retry
  const handleRetry = () => {
    clearError();
    generateReportForCurrentProfile();
  };

  // Render states
  if (!currentProfile) {
    return <NoProfileState />;
  }

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return <ErrorState error={error} onRetry={handleRetry} />;
  }

  if (!report || !report.latestMeasurement) {
    return <NoMeasurementsState />;
  }

  const { latestMeasurement, trends, recommendations, summary } = report;
  const { calculated, raw } = latestMeasurement;

  // Calculate score breakdown for HealthScoreCard
  const scoreBreakdown = {
    bmi: Math.min(100, Math.max(0, 100 - Math.abs(calculated.bmi - 22) * 5)),
    bodyFat: Math.min(100, Math.max(0, 100 - calculated.bodyFatPercent * 2)),
    visceral: Math.min(100, Math.max(0, 100 - calculated.visceralFatLevel * 6)),
    muscle: Math.min(100, (calculated.muscleMassKg / raw.weightKg) * 200),
  };

  return (
    <div className="space-y-6">
      {/* Hero Row: Health Score + Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <HealthScoreCard
          score={summary.bodyScore}
          status={summary.overallStatus}
          breakdown={scoreBreakdown}
        />
        <div className="lg:col-span-2">
          <TrendsComparisonCard trends={trends} />
        </div>
      </div>

      {/* Body Composition Grid */}
      <BodyCompositionPanel
        metrics={calculated}
        weightKg={raw.weightKg}
        profile={profileContext!}
        trends={{
          bodyFatChange: trends.bodyFatChange,
          muscleChange: trends.muscleChange,
        }}
      />

      {/* Metabolic + Recommendations Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <MetabolicHealthCard
          bmrKcal={calculated.bmrKcal}
          visceralFatLevel={calculated.visceralFatLevel}
          bmi={calculated.bmi}
        />
        <div className="lg:col-span-2">
          <RecommendationsPanel recommendations={recommendations} />
        </div>
      </div>

      {/* Risk Assessment */}
      <RiskAssessmentCard
        metrics={calculated}
        profile={profileContext!}
        weightKg={raw.weightKg}
      />

      {/* Generation timestamp */}
      <p className="text-xs text-gray-400 text-center">
        {t('generatedAt', {
          date: new Date(report.generatedAt).toLocaleString(),
        })}
      </p>
    </div>
  );
};

export default AnalysisPage;

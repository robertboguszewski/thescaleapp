/**
 * Risk Assessment Card Component
 *
 * Displays health risk indicators based on body composition metrics.
 *
 * @module presentation/components/analysis/RiskAssessmentCard
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../common/Card';
import type { CalculatedMetrics } from '../../../shared/types';
import type { ProfileContext } from './status-helpers';

interface RiskAssessmentCardProps {
  metrics: CalculatedMetrics;
  profile: ProfileContext;
  weightKg: number;
  className?: string;
}

type RiskLevel = 'low' | 'moderate' | 'high';

interface RiskIndicator {
  category: string;
  level: RiskLevel;
  percentage: number;
}

/**
 * Calculate cardiovascular risk based on visceral fat and BMI
 */
function calculateCardiovascularRisk(visceralFat: number, bmi: number): RiskIndicator {
  let score = 0;

  // Visceral fat contribution (0-50 points)
  if (visceralFat <= 9) score += 10;
  else if (visceralFat <= 14) score += 30;
  else score += 50;

  // BMI contribution (0-50 points)
  if (bmi >= 18.5 && bmi <= 24.9) score += 10;
  else if (bmi >= 25 && bmi <= 29.9) score += 30;
  else if (bmi >= 30) score += 50;
  else score += 20; // Underweight

  const level: RiskLevel = score <= 30 ? 'low' : score <= 60 ? 'moderate' : 'high';

  return {
    category: 'cardiovascular',
    level,
    percentage: score,
  };
}

/**
 * Calculate metabolic syndrome risk
 */
function calculateMetabolicRisk(
  bodyFatPercent: number,
  visceralFat: number,
  profile: ProfileContext
): RiskIndicator {
  let score = 0;

  // Body fat contribution (0-50 points)
  const obesityThreshold = profile.gender === 'male' ? 25 : 32;
  if (bodyFatPercent < obesityThreshold - 5) score += 10;
  else if (bodyFatPercent < obesityThreshold) score += 25;
  else score += 50;

  // Visceral fat contribution (0-50 points)
  if (visceralFat <= 9) score += 10;
  else if (visceralFat <= 14) score += 25;
  else score += 50;

  const level: RiskLevel = score <= 30 ? 'low' : score <= 60 ? 'moderate' : 'high';

  return {
    category: 'metabolic',
    level,
    percentage: score,
  };
}

/**
 * Calculate sarcopenia (muscle loss) risk
 */
function calculateSarcopeniaRisk(
  muscleMassKg: number,
  weightKg: number,
  profile: ProfileContext
): RiskIndicator {
  const musclePercent = (muscleMassKg / weightKg) * 100;
  let score = 0;

  // Age contribution (0-30 points)
  if (profile.age >= 60) score += 30;
  else if (profile.age >= 50) score += 20;
  else if (profile.age >= 40) score += 10;

  // Muscle mass contribution (0-70 points)
  const healthyMin = profile.gender === 'male' ? 36 : 29;
  if (musclePercent >= healthyMin + 4) score += 10;
  else if (musclePercent >= healthyMin) score += 25;
  else if (musclePercent >= healthyMin - 4) score += 50;
  else score += 70;

  const level: RiskLevel = score <= 30 ? 'low' : score <= 60 ? 'moderate' : 'high';

  return {
    category: 'sarcopenia',
    level,
    percentage: Math.min(score, 100),
  };
}

/**
 * Risk progress bar
 */
const RiskBar: React.FC<{
  label: string;
  level: RiskLevel;
  percentage: number;
}> = ({ label, level, percentage }) => {
  const { t } = useTranslation('analysis');

  const levelConfig = {
    low: {
      color: 'bg-green-500',
      text: 'text-green-600 dark:text-green-400',
      label: t('risk.levels.low'),
    },
    moderate: {
      color: 'bg-amber-500',
      text: 'text-amber-600 dark:text-amber-400',
      label: t('risk.levels.moderate'),
    },
    high: {
      color: 'bg-red-500',
      text: 'text-red-600 dark:text-red-400',
      label: t('risk.levels.high'),
    },
  };

  const config = levelConfig[level];

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
        <span className={`text-sm font-medium ${config.text}`}>{config.label}</span>
      </div>
      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${config.color} rounded-full transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

/**
 * Risk Assessment Card
 */
export const RiskAssessmentCard: React.FC<RiskAssessmentCardProps> = ({
  metrics,
  profile,
  weightKg,
  className = '',
}) => {
  const { t } = useTranslation('analysis');

  const risks: RiskIndicator[] = [
    calculateCardiovascularRisk(metrics.visceralFatLevel, metrics.bmi),
    calculateMetabolicRisk(metrics.bodyFatPercent, metrics.visceralFatLevel, profile),
    calculateSarcopeniaRisk(metrics.muscleMassKg, weightKg, profile),
  ];

  // Find primary concern (highest risk)
  const primaryConcern = risks.reduce((prev, current) =>
    current.percentage > prev.percentage ? current : prev
  );

  // Get recommendation based on primary concern
  const getRecommendation = (category: string): string => {
    switch (category) {
      case 'cardiovascular':
        return t('risk.recommendations.cardiovascular');
      case 'metabolic':
        return t('risk.recommendations.metabolic');
      case 'sarcopenia':
        return t('risk.recommendations.sarcopenia');
      default:
        return '';
    }
  };

  const showConcern = primaryConcern.level !== 'low';

  return (
    <Card className={className} padding="lg">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        {t('risk.title')}
      </h3>

      <div className="space-y-4">
        {risks.map((risk) => (
          <RiskBar
            key={risk.category}
            label={t(`risk.categories.${risk.category}`)}
            level={risk.level}
            percentage={risk.percentage}
          />
        ))}
      </div>

      {/* Primary concern alert */}
      {showConcern && (
        <div className="mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <div className="flex items-start gap-2">
            <svg
              className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                {t('risk.primaryConcern')}: {t(`risk.categories.${primaryConcern.category}`)}
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                {getRecommendation(primaryConcern.category)}
              </p>
            </div>
          </div>
        </div>
      )}

      {!showConcern && (
        <div className="mt-4 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
          <div className="flex items-center gap-2">
            <svg
              className="w-5 h-5 text-green-600 dark:text-green-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm font-medium text-green-800 dark:text-green-200">
              {t('risk.allLow')}
            </p>
          </div>
        </div>
      )}
    </Card>
  );
};

export default RiskAssessmentCard;

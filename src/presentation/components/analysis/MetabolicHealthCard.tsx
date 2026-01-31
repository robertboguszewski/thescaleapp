/**
 * Metabolic Health Card Component
 *
 * Displays BMR, Visceral Fat Level, and BMI with visual indicators.
 *
 * @module presentation/components/analysis/MetabolicHealthCard
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../common/Card';
import { getVisceralFatStatus, getBMIStatus } from './status-helpers';

interface MetabolicHealthCardProps {
  bmrKcal: number;
  visceralFatLevel: number;
  bmi: number;
  className?: string;
}

/**
 * Get color classes based on status
 */
function getStatusClasses(status: 'good' | 'warning' | 'critical'): {
  text: string;
  bg: string;
  bar: string;
} {
  switch (status) {
    case 'good':
      return {
        text: 'text-green-600 dark:text-green-400',
        bg: 'bg-green-50 dark:bg-green-900/20',
        bar: 'bg-green-500',
      };
    case 'warning':
      return {
        text: 'text-amber-600 dark:text-amber-400',
        bg: 'bg-amber-50 dark:bg-amber-900/20',
        bar: 'bg-amber-500',
      };
    case 'critical':
      return {
        text: 'text-red-600 dark:text-red-400',
        bg: 'bg-red-50 dark:bg-red-900/20',
        bar: 'bg-red-500',
      };
  }
}

/**
 * Status indicator dot
 */
const StatusDot: React.FC<{ status: 'good' | 'warning' | 'critical' }> = ({ status }) => {
  const colors = {
    good: 'bg-green-500',
    warning: 'bg-amber-500',
    critical: 'bg-red-500',
  };

  return <span className={`inline-block w-2 h-2 rounded-full ${colors[status]} mr-2`} />;
};

/**
 * Progress bar for visceral fat and BMI
 */
const ProgressBar: React.FC<{
  value: number;
  max: number;
  status: 'good' | 'warning' | 'critical';
  thresholds?: { warning: number; critical: number };
}> = ({ value, max, status, thresholds }) => {
  const percentage = Math.min((value / max) * 100, 100);
  const statusClasses = getStatusClasses(status);

  return (
    <div className="relative h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
      <div
        className={`absolute inset-y-0 left-0 ${statusClasses.bar} rounded-full transition-all duration-500`}
        style={{ width: `${percentage}%` }}
      />
      {thresholds && (
        <>
          <div
            className="absolute inset-y-0 w-0.5 bg-amber-600 dark:bg-amber-400 opacity-50"
            style={{ left: `${(thresholds.warning / max) * 100}%` }}
          />
          <div
            className="absolute inset-y-0 w-0.5 bg-red-600 dark:bg-red-400 opacity-50"
            style={{ left: `${(thresholds.critical / max) * 100}%` }}
          />
        </>
      )}
    </div>
  );
};

/**
 * Metabolic Health Card
 */
export const MetabolicHealthCard: React.FC<MetabolicHealthCardProps> = ({
  bmrKcal,
  visceralFatLevel,
  bmi,
  className = '',
}) => {
  const { t } = useTranslation('analysis');

  const visceralStatus = getVisceralFatStatus(visceralFatLevel);
  const bmiStatus = getBMIStatus(bmi);

  // Map MetricStatus to our local status type
  const mapStatus = (s: 'good' | 'warning' | 'critical' | 'neutral'): 'good' | 'warning' | 'critical' => {
    return s === 'neutral' ? 'good' : s;
  };

  const visceralStatusMapped = mapStatus(visceralStatus);
  const bmiStatusMapped = mapStatus(bmiStatus);

  // Get BMI category label
  const getBMICategory = (bmi: number): string => {
    if (bmi < 18.5) return t('metabolic.bmiCategories.underweight');
    if (bmi <= 24.9) return t('metabolic.bmiCategories.normal');
    if (bmi <= 29.9) return t('metabolic.bmiCategories.overweight');
    return t('metabolic.bmiCategories.obese');
  };

  // Get visceral fat category label
  const getVisceralCategory = (level: number): string => {
    if (level <= 9) return t('metabolic.visceralCategories.healthy');
    if (level <= 14) return t('metabolic.visceralCategories.elevated');
    return t('metabolic.visceralCategories.high');
  };

  return (
    <Card className={className} padding="lg">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        {t('metabolic.title')}
      </h3>

      <div className="space-y-6">
        {/* BMR */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('metabolic.bmr')}
            </span>
            <span className="text-lg font-bold text-gray-900 dark:text-white">
              {Math.round(bmrKcal).toLocaleString()} <span className="text-sm font-normal text-gray-500">kcal/day</span>
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t('metabolic.bmrDescription')}
          </p>
        </div>

        {/* Visceral Fat */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('metabolic.visceralFat')}
            </span>
            <div className="flex items-center">
              <StatusDot status={visceralStatusMapped} />
              <span className={`text-lg font-bold ${getStatusClasses(visceralStatusMapped).text}`}>
                {visceralFatLevel}
              </span>
              <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">
                ({getVisceralCategory(visceralFatLevel)})
              </span>
            </div>
          </div>
          <ProgressBar
            value={visceralFatLevel}
            max={30}
            status={visceralStatusMapped}
            thresholds={{ warning: 10, critical: 15 }}
          />
          <div className="flex justify-between mt-1 text-xs text-gray-400">
            <span>1</span>
            <span>{t('metabolic.scale')}: 1-30</span>
            <span>30</span>
          </div>
        </div>

        {/* BMI */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('metabolic.bmi')}
            </span>
            <div className="flex items-center">
              <StatusDot status={bmiStatusMapped} />
              <span className={`text-lg font-bold ${getStatusClasses(bmiStatusMapped).text}`}>
                {bmi.toFixed(1)}
              </span>
              <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">
                ({getBMICategory(bmi)})
              </span>
            </div>
          </div>
          <ProgressBar
            value={Math.min(bmi, 40)}
            max={40}
            status={bmiStatusMapped}
            thresholds={{ warning: 25, critical: 30 }}
          />
          <div className="flex justify-between mt-1 text-xs text-gray-400">
            <span>15</span>
            <span>{t('metabolic.target')}: 18.5-24.9</span>
            <span>40</span>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default MetabolicHealthCard;

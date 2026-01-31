/**
 * MeasurementResult Component
 *
 * Displays the results of a completed measurement.
 * Shows all metrics and allows saving or discarding.
 *
 * @module presentation/components/measurement/MeasurementResult
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { MiniBodyScoreGauge } from '../dashboard/BodyScoreGauge';
import type { CalculatedMetrics, RawMeasurement } from '../../../domain/calculations/types';

export interface MeasurementResultProps {
  /** Raw measurement data */
  raw: RawMeasurement;
  /** Calculated metrics */
  calculated: CalculatedMetrics;
  /** Measurement timestamp */
  timestamp: Date;
  /** Whether the measurement has been saved */
  isSaved: boolean;
  /** Save callback */
  onSave: () => void;
  /** Discard callback */
  onDiscard: () => void;
  /** New measurement callback */
  onNewMeasurement: () => void;
  /** Loading state */
  isLoading?: boolean;
}

/**
 * Metric display row
 */
const MetricRow: React.FC<{
  label: string;
  value: string | number;
  unit?: string;
  highlight?: boolean;
}> = ({ label, value, unit, highlight = false }) => (
  <div className={`flex justify-between items-center py-2 ${highlight ? 'bg-primary-50 dark:bg-primary-900/20 -mx-4 px-4 rounded' : ''}`}>
    <span className="text-gray-600 dark:text-gray-400">{label}</span>
    <span className={`font-medium ${highlight ? 'text-primary-600 dark:text-primary-400' : 'text-gray-900 dark:text-white'}`}>
      {value}{unit && <span className="text-gray-400 ml-1">{unit}</span>}
    </span>
  </div>
);

/**
 * MeasurementResult component
 */
export const MeasurementResult: React.FC<MeasurementResultProps> = ({
  raw,
  calculated,
  timestamp,
  isSaved,
  onSave,
  onDiscard,
  onNewMeasurement,
  isLoading = false,
}) => {
  const { t, i18n } = useTranslation('measurement');

  return (
    <div className="space-y-6">
      {/* Success header */}
      <div className="text-center">
        <div className="w-16 h-16 mx-auto rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
          <svg
            className="w-8 h-8 text-green-500"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M9 12l2 2 4-4" />
            <circle cx="12" cy="12" r="10" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          {t('result.title')}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {timestamp.toLocaleString(i18n.language === 'pl' ? 'pl-PL' : 'en-US', {
            dateStyle: 'medium',
            timeStyle: 'short',
          })}
        </p>
      </div>

      {/* Body score highlight */}
      <Card className="text-center">
        <div className="flex items-center justify-center gap-6">
          <MiniBodyScoreGauge score={calculated.bodyScore} size={80} />
          <div className="text-left">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('result.overallScore')}
            </p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              {calculated.bodyScore}
              <span className="text-lg text-gray-400">/100</span>
            </p>
          </div>
        </div>
      </Card>

      {/* Main metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Weight and BMI */}
        <Card title={t('result.sections.basic')}>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            <MetricRow label={t('result.weight')} value={raw.weightKg.toFixed(1)} unit="kg" highlight />
            <MetricRow label="BMI" value={calculated.bmi.toFixed(1)} />
            {raw.impedanceOhm && (
              <MetricRow label={t('result.metrics.impedance')} value={raw.impedanceOhm} unit="Ohm" />
            )}
            {raw.heartRateBpm && (
              <MetricRow label={t('result.metrics.heartRate')} value={raw.heartRateBpm} unit="BPM" />
            )}
          </div>
        </Card>

        {/* Body composition */}
        <Card title={t('result.sections.bodyComposition')}>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            <MetricRow label={t('result.metrics.bodyFat')} value={calculated.bodyFatPercent.toFixed(1)} unit="%" />
            <MetricRow label={t('result.metrics.muscleMass')} value={calculated.muscleMassKg.toFixed(1)} unit="kg" />
            <MetricRow label={t('result.metrics.bodyWater')} value={calculated.bodyWaterPercent.toFixed(1)} unit="%" />
            <MetricRow label={t('result.metrics.leanBodyMass')} value={calculated.leanBodyMassKg.toFixed(1)} unit="kg" />
          </div>
        </Card>

        {/* Additional metrics */}
        <Card title={t('result.sections.additional')}>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            <MetricRow label={t('result.metrics.visceralFat')} value={calculated.visceralFatLevel} />
            <MetricRow label={t('result.metrics.bmr')} value={Math.round(calculated.bmrKcal)} unit="kcal" />
            <MetricRow label={t('result.metrics.boneMass')} value={calculated.boneMassKg.toFixed(1)} unit="kg" />
            <MetricRow label={t('result.metrics.protein')} value={calculated.proteinPercent.toFixed(1)} unit="%" />
          </div>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex justify-center gap-4">
        {!isSaved ? (
          <>
            <Button
              variant="primary"
              size="lg"
              onClick={onSave}
              loading={isLoading}
            >
              {t('result.save')}
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={onDiscard}
              disabled={isLoading}
            >
              {t('result.discard')}
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="primary"
              size="lg"
              onClick={onNewMeasurement}
            >
              {t('result.new')}
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => {
                // Navigate to history or dashboard
              }}
            >
              {t('result.viewHistory')}
            </Button>
          </>
        )}
      </div>

      {/* Saved confirmation */}
      {isSaved && (
        <div className="flex items-center justify-center gap-2 text-green-600 dark:text-green-400">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 12l2 2 4-4" />
            <circle cx="12" cy="12" r="10" />
          </svg>
          <span className="text-sm font-medium">{t('result.saved')}</span>
        </div>
      )}
    </div>
  );
};

/**
 * Live weight display during measurement
 */
export const LiveWeightDisplay: React.FC<{
  weight: number | null;
  heartRate?: number | null;
  impedance?: number | null;
  isStable: boolean;
}> = ({ weight, heartRate, impedance, isStable }) => {
  const { t } = useTranslation('measurement');

  return (
    <div className="text-center py-8">
      {/* Main weight display */}
      <div className={`text-6xl font-bold transition-colors ${isStable ? 'text-green-500' : 'text-gray-900 dark:text-white'}`}>
        {weight !== null ? weight.toFixed(1) : '--.-'}
        <span className="text-2xl text-gray-400 ml-2">kg</span>
      </div>

      {/* Additional metrics */}
      {(heartRate || impedance) && (
        <div className="flex justify-center gap-6 mt-4">
          {heartRate && (
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
              </svg>
              <span className="text-lg font-semibold text-red-500">{heartRate}</span>
              <span className="text-sm text-gray-400">bpm</span>
            </div>
          )}
          {impedance && (
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/>
              </svg>
              <span className="text-lg font-semibold text-blue-500">{impedance}</span>
              <span className="text-sm text-gray-400">Ω</span>
            </div>
          )}
        </div>
      )}

      <p className={`mt-4 text-sm ${isStable ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
        {isStable ? t('result.stable') : t('result.stabilizing')}
      </p>
      {!isStable && (
        <div className="flex justify-center gap-1 mt-4">
          <div className="w-2 h-2 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      )}
    </div>
  );
};

export default MeasurementResult;

/**
 * MeasurementResult Component
 *
 * Displays the results of a completed measurement.
 * Shows all metrics and allows saving or discarding.
 *
 * @module presentation/components/measurement/MeasurementResult
 */

import React from 'react';
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
          Pomiar zakonczony
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {timestamp.toLocaleString('pl-PL', {
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
              Wynik ogolny
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
        <Card title="Podstawowe">
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            <MetricRow label="Waga" value={raw.weightKg.toFixed(1)} unit="kg" highlight />
            <MetricRow label="BMI" value={calculated.bmi.toFixed(1)} />
            {raw.impedanceOhm && (
              <MetricRow label="Impedancja" value={raw.impedanceOhm} unit="Ohm" />
            )}
            {raw.heartRateBpm && (
              <MetricRow label="Tetno" value={raw.heartRateBpm} unit="BPM" />
            )}
          </div>
        </Card>

        {/* Body composition */}
        <Card title="Sklad ciala">
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            <MetricRow label="Tkanka tluszczowa" value={calculated.bodyFatPercent.toFixed(1)} unit="%" />
            <MetricRow label="Masa miesniowa" value={calculated.muscleMassKg.toFixed(1)} unit="kg" />
            <MetricRow label="Woda w organizmie" value={calculated.bodyWaterPercent.toFixed(1)} unit="%" />
            <MetricRow label="Masa beztluszczowa" value={calculated.leanBodyMassKg.toFixed(1)} unit="kg" />
          </div>
        </Card>

        {/* Additional metrics */}
        <Card title="Dodatkowe">
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            <MetricRow label="Tluszcz trzewny" value={calculated.visceralFatLevel} />
            <MetricRow label="BMR" value={Math.round(calculated.bmrKcal)} unit="kcal" />
            <MetricRow label="Masa kostna" value={calculated.boneMassKg.toFixed(1)} unit="kg" />
            <MetricRow label="Bialko" value={calculated.proteinPercent.toFixed(1)} unit="%" />
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
              Zapisz pomiar
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={onDiscard}
              disabled={isLoading}
            >
              Odrzuc
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="primary"
              size="lg"
              onClick={onNewMeasurement}
            >
              Nowy pomiar
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => {
                // Navigate to history or dashboard
              }}
            >
              Zobacz historie
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
          <span className="text-sm font-medium">Pomiar zapisany</span>
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
  isStable: boolean;
}> = ({ weight, isStable }) => (
  <div className="text-center py-8">
    <div className={`text-6xl font-bold transition-colors ${isStable ? 'text-green-500' : 'text-gray-900 dark:text-white'}`}>
      {weight !== null ? weight.toFixed(1) : '--.-'}
      <span className="text-2xl text-gray-400 ml-2">kg</span>
    </div>
    <p className={`mt-4 text-sm ${isStable ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
      {isStable ? 'Waga ustabilizowana' : 'Czekam na stabilizacje...'}
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

export default MeasurementResult;

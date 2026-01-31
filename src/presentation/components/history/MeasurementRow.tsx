/**
 * MeasurementRow Component
 *
 * Displays a single measurement in the history list.
 * Shows key metrics with option to expand for details.
 *
 * @module presentation/components/history/MeasurementRow
 */

import React from 'react';
import { MiniBodyScoreGauge } from '../dashboard/BodyScoreGauge';
import type { StoredMeasurement } from '../../../infrastructure/storage/schemas';

export interface MeasurementRowProps {
  /** Measurement data */
  measurement: StoredMeasurement;
  /** Whether the row is selected/expanded */
  isSelected: boolean;
  /** Click handler */
  onClick: () => void;
  /** Delete handler */
  onDelete?: () => void;
}

/**
 * Format date for display
 */
const formatDate = (dateString: string): { date: string; time: string } => {
  const date = new Date(dateString);
  return {
    date: date.toLocaleDateString('pl-PL', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }),
    time: date.toLocaleTimeString('pl-PL', {
      hour: '2-digit',
      minute: '2-digit',
    }),
  };
};

/**
 * MeasurementRow component
 */
export const MeasurementRow: React.FC<MeasurementRowProps> = ({
  measurement,
  isSelected,
  onClick,
  onDelete,
}) => {
  const { date, time } = formatDate(measurement.timestamp);
  const { raw, calculated } = measurement;

  return (
    <div
      className={`
        border rounded-xl transition-all duration-200 cursor-pointer
        ${isSelected
          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 shadow-sm'
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/50'
        }
      `}
      onClick={onClick}
    >
      {/* Main row */}
      <div className="flex items-center gap-4 p-4">
        {/* Body score gauge */}
        <MiniBodyScoreGauge score={calculated.bodyScore} size={48} />

        {/* Date and time */}
        <div className="min-w-[100px]">
          <p className="font-medium text-gray-900 dark:text-white">{date}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{time}</p>
        </div>

        {/* Key metrics */}
        <div className="flex-1 grid grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Waga</p>
            <p className="font-semibold text-gray-900 dark:text-white">
              {raw.weightKg.toFixed(1)} <span className="text-xs text-gray-400">kg</span>
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">BMI</p>
            <p className="font-semibold text-gray-900 dark:text-white">
              {calculated.bmi.toFixed(1)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Tluszcz</p>
            <p className="font-semibold text-gray-900 dark:text-white">
              {calculated.bodyFatPercent.toFixed(1)} <span className="text-xs text-gray-400">%</span>
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Wynik</p>
            <p className="font-semibold text-gray-900 dark:text-white">
              {calculated.bodyScore} <span className="text-xs text-gray-400">/100</span>
            </p>
          </div>
        </div>

        {/* Arrow indicator */}
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform ${isSelected ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>

      {/* Expanded details */}
      {isSelected && (
        <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800/50 rounded-b-xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Masa miesniowa</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {calculated.muscleMassKg.toFixed(1)} kg
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Woda</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {calculated.bodyWaterPercent.toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Tluszcz trzewny</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {calculated.visceralFatLevel}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">BMR</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {Math.round(calculated.bmrKcal)} kcal
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Masa beztluszczowa</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {calculated.leanBodyMassKg.toFixed(1)} kg
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Masa kostna</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {calculated.boneMassKg.toFixed(1)} kg
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Bialko</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {calculated.proteinPercent.toFixed(1)}%
              </p>
            </div>
            {raw.impedanceOhm && (
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Impedancja</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {raw.impedanceOhm} Ohm
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          {onDelete && (
            <div className="flex justify-end mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                  <path d="M10 11v6M14 11v6" />
                </svg>
                Usuń pomiar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Compact measurement row for smaller displays
 */
export const CompactMeasurementRow: React.FC<{
  measurement: StoredMeasurement;
  onClick: () => void;
}> = ({ measurement, onClick }) => {
  const { date, time } = formatDate(measurement.timestamp);

  return (
    <button
      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-left"
      onClick={onClick}
    >
      <MiniBodyScoreGauge score={measurement.calculated.bodyScore} size={40} />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 dark:text-white truncate">{date}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {measurement.raw.weightKg.toFixed(1)} kg
        </p>
      </div>
      <svg className="w-5 h-5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M9 18l6-6-6-6" />
      </svg>
    </button>
  );
};

export default MeasurementRow;

/**
 * MetricSelector Component
 *
 * Dropdown/tabs for selecting which metric to display in charts.
 *
 * @module presentation/components/trends/MetricSelector
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { useMeasurementStore, MetricType, DateRange } from '../../stores/measurementStore';

/**
 * Metric configuration
 */
interface MetricConfig {
  id: MetricType;
  label: string;
  unit: string;
  color: string;
}

/**
 * Get metrics configuration with translations
 */
const getMetricsConfig = (t: ReturnType<typeof useTranslation>['t']): MetricConfig[] => [
  { id: 'weight', label: t('metrics.weight'), unit: 'kg', color: '#3b82f6' },
  { id: 'bmi', label: 'BMI', unit: '', color: '#8b5cf6' },
  { id: 'bodyFatPercent', label: t('metrics.bodyFat'), unit: '%', color: '#f59e0b' },
  { id: 'muscleMassKg', label: t('metrics.muscleMass'), unit: 'kg', color: '#10b981' },
  { id: 'bodyWaterPercent', label: t('metrics.water'), unit: '%', color: '#06b6d4' },
  { id: 'visceralFatLevel', label: t('metrics.visceralFat'), unit: '', color: '#ef4444' },
  { id: 'bmrKcal', label: 'BMR', unit: 'kcal', color: '#f97316' },
  { id: 'bodyScore', label: t('metrics.bodyScore'), unit: '', color: '#6366f1' },
];

/**
 * Default metric configs (will be replaced with translated version in component)
 */
export const METRIC_CONFIGS: MetricConfig[] = [
  { id: 'weight', label: 'Weight', unit: 'kg', color: '#3b82f6' },
  { id: 'bmi', label: 'BMI', unit: '', color: '#8b5cf6' },
  { id: 'bodyFatPercent', label: 'Body fat', unit: '%', color: '#f59e0b' },
  { id: 'muscleMassKg', label: 'Muscle mass', unit: 'kg', color: '#10b981' },
  { id: 'bodyWaterPercent', label: 'Water', unit: '%', color: '#06b6d4' },
  { id: 'visceralFatLevel', label: 'Visceral fat', unit: '', color: '#ef4444' },
  { id: 'bmrKcal', label: 'BMR', unit: 'kcal', color: '#f97316' },
  { id: 'bodyScore', label: 'Body score', unit: '', color: '#6366f1' },
];

/**
 * Date range options (English defaults - use DateRangeSelector component for translated version)
 */
export const DATE_RANGE_OPTIONS: { id: DateRange; label: string }[] = [
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
  { id: '90d', label: '3 months' },
  { id: '1y', label: 'Year' },
  { id: 'all', label: 'All' },
];

/**
 * Get metric config by ID
 */
export const getMetricConfig = (id: MetricType): MetricConfig =>
  METRIC_CONFIGS.find((m) => m.id === id) || METRIC_CONFIGS[0];

export interface MetricSelectorProps {
  /** Display variant */
  variant?: 'tabs' | 'dropdown' | 'pills';
  /** Additional class name */
  className?: string;
}

/**
 * Tab-style metric selector
 */
const TabsSelector: React.FC = () => {
  const { t } = useTranslation('dashboard');
  const { selectedMetric, setSelectedMetric } = useMeasurementStore();
  const metricsConfig = getMetricsConfig(t);

  return (
    <div className="flex flex-wrap gap-2">
      {metricsConfig.map((metric) => (
        <button
          key={metric.id}
          onClick={() => setSelectedMetric(metric.id)}
          className={`
            px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
            ${selectedMetric === metric.id
              ? 'text-white'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }
          `}
          style={selectedMetric === metric.id ? { backgroundColor: metric.color } : undefined}
        >
          {metric.label}
        </button>
      ))}
    </div>
  );
};

/**
 * Dropdown-style metric selector
 */
const DropdownSelector: React.FC = () => {
  const { t } = useTranslation('dashboard');
  const { selectedMetric, setSelectedMetric } = useMeasurementStore();
  const [isOpen, setIsOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const metricsConfig = getMetricsConfig(t);

  const currentMetric = getMetricConfig(selectedMetric);

  // Close on outside click
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
      >
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: currentMetric.color }}
        />
        <span className="font-medium text-gray-900 dark:text-white">
          {currentMetric.label}
        </span>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-10 mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1">
          {metricsConfig.map((metric) => (
            <button
              key={metric.id}
              onClick={() => {
                setSelectedMetric(metric.id);
                setIsOpen(false);
              }}
              className={`
                w-full flex items-center gap-3 px-4 py-2 text-left transition-colors
                ${selectedMetric === metric.id
                  ? 'bg-gray-100 dark:bg-gray-700'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }
              `}
            >
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: metric.color }}
              />
              <span className="text-gray-900 dark:text-white">{metric.label}</span>
              {metric.unit && (
                <span className="ml-auto text-sm text-gray-400">{metric.unit}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Pills-style metric selector
 */
const PillsSelector: React.FC = () => {
  const { t } = useTranslation('dashboard');
  const { selectedMetric, setSelectedMetric } = useMeasurementStore();
  const metricsConfig = getMetricsConfig(t);

  return (
    <div className="flex flex-wrap gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
      {metricsConfig.map((metric) => (
        <button
          key={metric.id}
          onClick={() => setSelectedMetric(metric.id)}
          className={`
            px-3 py-1 rounded-md text-sm font-medium transition-all
            ${selectedMetric === metric.id
              ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }
          `}
        >
          {metric.label}
        </button>
      ))}
    </div>
  );
};

/**
 * MetricSelector component
 */
export const MetricSelector: React.FC<MetricSelectorProps> = ({
  variant = 'dropdown',
  className = '',
}) => {
  return (
    <div className={className}>
      {variant === 'tabs' && <TabsSelector />}
      {variant === 'dropdown' && <DropdownSelector />}
      {variant === 'pills' && <PillsSelector />}
    </div>
  );
};

/**
 * Date range selector component
 */
export const DateRangeSelector: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { t } = useTranslation('dashboard');
  const { dateRange, setDateRange } = useMeasurementStore();
  const dateRangeOptions = [
    { id: '7d' as DateRange, label: t('dateRange.days7') },
    { id: '30d' as DateRange, label: t('dateRange.days30') },
    { id: '90d' as DateRange, label: t('dateRange.months3') },
    { id: '1y' as DateRange, label: t('dateRange.year') },
    { id: 'all' as DateRange, label: t('dateRange.all') },
  ];

  return (
    <div className={`flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg ${className}`}>
      {dateRangeOptions.map((option) => (
        <button
          key={option.id}
          onClick={() => setDateRange(option.id)}
          className={`
            px-3 py-1 rounded-md text-sm font-medium transition-all
            ${dateRange === option.id
              ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }
          `}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
};

export default MetricSelector;

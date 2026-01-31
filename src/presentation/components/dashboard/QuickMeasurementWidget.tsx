/**
 * QuickMeasurementWidget Component
 *
 * Compact measurement widget for Dashboard that allows users
 * to perform measurements without leaving the dashboard.
 *
 * @module presentation/components/dashboard/QuickMeasurementWidget
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { useBLEStore, useIsConnected, useIsDeviceConfigured } from '../../stores/bleStore';
import { useMeasurementStore } from '../../stores/measurementStore';
import { useCurrentProfile } from '../../stores/profileStore';
import { useAppStore } from '../../stores/appStore';
import { useBLEAutoConnect } from '../../hooks/useBLEAutoConnect';
import { calculateAllMetrics } from '../../../domain/calculations';
import type { RawMeasurement } from '../../../domain/calculations/types';
import { GUEST_PROFILE_ID } from '../history/GuestMeasurements';

/**
 * Widget states
 */
type WidgetState = 'disconnected' | 'connecting' | 'ready' | 'measuring' | 'result';

/**
 * Scale icon component
 */
const ScaleIcon: React.FC<{ className?: string }> = ({ className = "w-8 h-8" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M12 7v10M7 12h10" />
  </svg>
);

/**
 * Bluetooth icon component
 */
const BluetoothIcon: React.FC<{ className?: string }> = ({ className = "w-5 h-5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M6.5 6.5l11 11L12 23V1l5.5 5.5-11 11" />
  </svg>
);

/**
 * Spinner icon for loading state
 */
const SpinnerIcon: React.FC<{ className?: string }> = ({ className = "w-5 h-5" }) => (
  <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
);

/**
 * Live weight display
 */
const LiveWeightDisplay: React.FC<{
  weight: number;
  isStable: boolean;
  t: (key: string) => string;
}> = ({ weight, isStable, t }) => (
  <div className="text-center py-4">
    {/* Measuring indicator */}
    <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
      {isStable ? (
        <ScaleIcon className="w-7 h-7 text-green-500" />
      ) : (
        <SpinnerIcon className="w-7 h-7 text-blue-500" />
      )}
    </div>

    {/* Weight value */}
    <div className={`text-4xl font-bold transition-colors ${isStable ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400'}`}>
      {weight > 0 ? weight.toFixed(1) : '---'}
      <span className="text-lg font-normal text-gray-500 dark:text-gray-400 ml-1">kg</span>
    </div>

    {/* Status message */}
    <p className={`text-sm mt-2 font-medium ${isStable ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400'}`}>
      {isStable ? t('quick.stabilized') : t('quick.measuring')}
    </p>
    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
      {isStable ? '' : t('quick.standStill')}
    </p>
  </div>
);

/**
 * Check icon for success state
 */
const CheckIcon: React.FC<{ className?: string }> = ({ className = "w-5 h-5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M20 6L9 17l-5-5" />
  </svg>
);

/**
 * Result preview component
 */
const ResultPreview: React.FC<{
  weight: number;
  bmi?: number;
  bodyFat?: number;
  muscleMass?: number;
  onSave: () => void;
  onDiscard: () => void;
  onViewDetails: () => void;
  isSaving: boolean;
  isSaved: boolean;
  t: (key: string) => string;
}> = ({ weight, bmi, bodyFat, muscleMass, onSave, onDiscard, onViewDetails, isSaving, isSaved, t }) => (
  <div className="text-center py-2">
    {/* Success indicator */}
    <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
      <CheckIcon className="w-6 h-6 text-green-500" />
    </div>

    {/* Weight - primary metric */}
    <div className="text-3xl font-bold text-green-600 dark:text-green-400">
      {weight.toFixed(1)}
      <span className="text-base font-normal text-gray-500 dark:text-gray-400 ml-1">kg</span>
    </div>

    {/* Summary metrics grid */}
    <div className="grid grid-cols-3 gap-2 mt-3 text-center">
      {bmi && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2">
          <p className="text-xs text-gray-500 dark:text-gray-400">BMI</p>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">{bmi.toFixed(1)}</p>
        </div>
      )}
      {bodyFat && bodyFat > 0 && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2">
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('result.metrics.bodyFat')}</p>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">{bodyFat.toFixed(1)}%</p>
        </div>
      )}
      {muscleMass && muscleMass > 0 && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2">
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('result.metrics.muscleMass')}</p>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">{muscleMass.toFixed(1)}kg</p>
        </div>
      )}
    </div>

    {!isSaved ? (
      <div className="flex justify-center gap-2 mt-4">
        <Button
          variant="outline"
          size="sm"
          onClick={onDiscard}
          disabled={isSaving}
        >
          {t('result.discard')}
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={onSave}
          disabled={isSaving}
        >
          {isSaving ? t('result.saving') : t('result.save')}
        </Button>
      </div>
    ) : (
      <div className="mt-4">
        <p className="text-sm text-green-600 dark:text-green-400 mb-2">{t('quick.saved')}</p>
        <Button variant="outline" size="sm" onClick={onViewDetails}>
          {t('result.viewDetails')}
        </Button>
      </div>
    )}
  </div>
);

/**
 * QuickMeasurementWidget component
 */
export const QuickMeasurementWidget: React.FC = () => {
  const { t } = useTranslation('measurement');
  const [widgetState, setWidgetState] = useState<WidgetState>('disconnected');
  const [measurementResult, setMeasurementResult] = useState<{
    weight: number;
    bmi?: number;
    raw: RawMeasurement;
    calculated: any;
  } | null>(null);

  // Store hooks
  const { connectionState, liveWeight, isStable, setLiveWeight, setIsStable } = useBLEStore();
  const isConnected = useIsConnected();
  const isDeviceConfigured = useIsDeviceConfigured();
  const { currentMeasurement, setCurrentMeasurement, clearCurrentMeasurement, addMeasurement, isSaving, setSaving } = useMeasurementStore();
  const currentProfile = useCurrentProfile();
  const { setActiveTab, addNotification } = useAppStore();

  // BLE Auto-connect hook
  const bleAutoConnect = useBLEAutoConnect();

  // Track last processed measurement
  const lastProcessedRef = React.useRef<number>(0);

  // Update widget state based on connection state
  useEffect(() => {
    if (connectionState === 'connected' || connectionState === 'reading') {
      if (widgetState !== 'result' && widgetState !== 'measuring') {
        setWidgetState('ready');
      }
    } else if (connectionState === 'connecting' || connectionState === 'scanning') {
      setWidgetState('connecting');
    } else {
      if (widgetState !== 'result') {
        setWidgetState('disconnected');
      }
    }
  }, [connectionState, widgetState]);

  // Show measuring state when liveWeight changes (for live feedback during measurement)
  useEffect(() => {
    if (liveWeight > 0 && widgetState === 'ready') {
      setWidgetState('measuring');
    }
  }, [liveWeight, widgetState]);

  // Handle measurement received (final stabilized measurement)
  useEffect(() => {
    if (bleAutoConnect.lastMeasurement && (widgetState === 'ready' || widgetState === 'measuring')) {
      const raw = bleAutoConnect.lastMeasurement;

      // Debounce - prevent processing same weight
      if (raw.weightKg === lastProcessedRef.current) return;
      lastProcessedRef.current = raw.weightKg;

      // Update live weight display
      setLiveWeight(raw.weightKg);
      setIsStable(true);

      // Calculate metrics
      const profileForCalc = currentProfile
        ? {
            gender: currentProfile.gender,
            birthYear: currentProfile.birthYear,
            heightCm: currentProfile.heightCm,
            ethnicity: currentProfile.ethnicity,
          }
        : {
            gender: 'male' as const,
            birthYear: new Date().getFullYear() - 30,
            heightCm: 175,
          };

      const calculated = calculateAllMetrics(profileForCalc, raw);

      setMeasurementResult({
        weight: raw.weightKg,
        bmi: calculated.bmi,
        raw,
        calculated,
      });

      setCurrentMeasurement({
        raw,
        calculated,
        timestamp: new Date(),
        isSaved: false,
      });

      // Transition to result after brief delay to show stabilized state
      setTimeout(() => {
        setWidgetState('result');
      }, 500);
    }
  }, [bleAutoConnect.lastMeasurement, widgetState, currentProfile, setCurrentMeasurement, setLiveWeight, setIsStable]);

  // Handle connect
  const handleConnect = async () => {
    setWidgetState('connecting');
    const success = await bleAutoConnect.scanAndConnect();
    if (success) {
      setWidgetState('ready');
    } else {
      setWidgetState('disconnected');
    }
  };

  // Handle save measurement
  const handleSave = useCallback(() => {
    if (!measurementResult) return;

    setSaving(true);
    const profileId = currentProfile?.id || GUEST_PROFILE_ID;

    setTimeout(() => {
      const measurement = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        raw: measurementResult.raw,
        calculated: measurementResult.calculated,
        userProfileId: profileId,
      };

      addMeasurement(measurement);
      setCurrentMeasurement({ isSaved: true });
      setSaving(false);

      addNotification({
        type: 'success',
        title: t('quick.saved_notification.title'),
        message: `${measurementResult.weight.toFixed(1)} kg`,
        duration: 3000,
      });
    }, 300);
  }, [measurementResult, currentProfile, addMeasurement, setCurrentMeasurement, setSaving, addNotification, t]);

  // Handle discard
  const handleDiscard = useCallback(() => {
    setMeasurementResult(null);
    clearCurrentMeasurement();
    lastProcessedRef.current = 0;
    setWidgetState('ready');
  }, [clearCurrentMeasurement]);

  // Handle view details (go to history)
  const handleViewDetails = useCallback(() => {
    setActiveTab('history');
  }, [setActiveTab]);

  // Handle new measurement
  const handleNewMeasurement = useCallback(() => {
    setMeasurementResult(null);
    clearCurrentMeasurement();
    lastProcessedRef.current = 0;
    setWidgetState('ready');
  }, [clearCurrentMeasurement]);

  // Handle go to measure tab
  const handleGoToMeasure = () => {
    setActiveTab('measure');
  };

  // Render based on state
  const renderContent = () => {
    switch (widgetState) {
      case 'disconnected':
        return (
          <div className="text-center py-4">
            <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              <BluetoothIcon className="w-7 h-7 text-gray-400" />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
              {isDeviceConfigured ? t('quick.disconnected') : t('quick.connect')}
            </p>
            <div className="flex justify-center gap-2">
              <Button variant="primary" size="sm" onClick={handleConnect}>
                {isDeviceConfigured ? t('common:buttons.connect') : t('common:buttons.configure')}
              </Button>
              <Button variant="outline" size="sm" onClick={handleGoToMeasure}>
                {t('common:buttons.more')}
              </Button>
            </div>
          </div>
        );

      case 'connecting':
        return (
          <div className="text-center py-6">
            <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center animate-pulse">
              <BluetoothIcon className="w-7 h-7 text-yellow-500" />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('quick.connecting')}
            </p>
          </div>
        );

      case 'ready':
        return (
          <div className="text-center py-4">
            <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <ScaleIcon className="w-7 h-7 text-green-500" />
            </div>
            <p className="text-sm font-medium text-green-600 dark:text-green-400 mb-1">
              {t('quick.ready')}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              {t('panel.status.ready')}
            </p>
            <Button variant="outline" size="sm" onClick={handleGoToMeasure}>
              {t('common:buttons.more')}
            </Button>
          </div>
        );

      case 'measuring':
        return <LiveWeightDisplay weight={liveWeight} isStable={isStable} t={t} />;

      case 'result':
        if (measurementResult) {
          return (
            <>
              <ResultPreview
                weight={measurementResult.weight}
                bmi={measurementResult.bmi}
                bodyFat={measurementResult.calculated?.bodyFatPercent}
                muscleMass={measurementResult.calculated?.muscleMassKg}
                onSave={handleSave}
                onDiscard={handleDiscard}
                onViewDetails={handleViewDetails}
                isSaving={isSaving}
                isSaved={currentMeasurement.isSaved}
                t={t}
              />
              {currentMeasurement.isSaved && (
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={handleNewMeasurement}
                  >
                    {t('quick.new')}
                  </Button>
                </div>
              )}
            </>
          );
        }
        return null;

      default:
        return null;
    }
  };

  return (
    <Card className="h-full">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
          {t('quick.title')}
        </h3>
        {isConnected && (
          <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            {t('common:status.connected')}
          </span>
        )}
      </div>
      {renderContent()}
    </Card>
  );
};

export default QuickMeasurementWidget;

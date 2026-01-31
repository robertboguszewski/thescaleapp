/**
 * QuickMeasurementWidget Component
 *
 * Compact measurement widget for Dashboard that allows users
 * to perform measurements without leaving the dashboard.
 *
 * @module presentation/components/dashboard/QuickMeasurementWidget
 */

import React, { useEffect, useState, useCallback } from 'react';
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
 * Live weight display
 */
const LiveWeightDisplay: React.FC<{
  weight: number;
  isStable: boolean;
}> = ({ weight, isStable }) => (
  <div className="text-center py-4">
    <div className={`text-4xl font-bold ${isStable ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'}`}>
      {weight > 0 ? weight.toFixed(1) : '---'}
      <span className="text-lg font-normal text-gray-500 dark:text-gray-400 ml-1">kg</span>
    </div>
    <p className={`text-sm mt-2 ${isStable ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
      {isStable ? 'Pomiar ustabilizowany' : 'Stabilizacja...'}
    </p>
  </div>
);

/**
 * Result preview component
 */
const ResultPreview: React.FC<{
  weight: number;
  bmi?: number;
  onSave: () => void;
  onDiscard: () => void;
  onViewDetails: () => void;
  isSaving: boolean;
  isSaved: boolean;
}> = ({ weight, bmi, onSave, onDiscard, onViewDetails, isSaving, isSaved }) => (
  <div className="text-center py-2">
    <div className="text-3xl font-bold text-green-600 dark:text-green-400">
      {weight.toFixed(1)}
      <span className="text-base font-normal text-gray-500 dark:text-gray-400 ml-1">kg</span>
    </div>
    {bmi && (
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
        BMI: {bmi.toFixed(1)}
      </p>
    )}
    {!isSaved ? (
      <div className="flex justify-center gap-2 mt-4">
        <Button
          variant="outline"
          size="sm"
          onClick={onDiscard}
          disabled={isSaving}
        >
          Odrzuc
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={onSave}
          disabled={isSaving}
        >
          {isSaving ? 'Zapisywanie...' : 'Zapisz'}
        </Button>
      </div>
    ) : (
      <div className="mt-4">
        <p className="text-sm text-green-600 dark:text-green-400 mb-2">Zapisano</p>
        <Button variant="outline" size="sm" onClick={onViewDetails}>
          Zobacz szczegoly
        </Button>
      </div>
    )}
  </div>
);

/**
 * QuickMeasurementWidget component
 */
export const QuickMeasurementWidget: React.FC = () => {
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

  // Handle measurement received
  useEffect(() => {
    if (bleAutoConnect.lastMeasurement && widgetState === 'ready') {
      const raw = bleAutoConnect.lastMeasurement;

      // Debounce
      if (raw.weightKg === lastProcessedRef.current) return;
      lastProcessedRef.current = raw.weightKg;

      setWidgetState('measuring');
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

      setWidgetState('result');
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
        title: 'Pomiar zapisany',
        message: `${measurementResult.weight.toFixed(1)} kg`,
        duration: 3000,
      });
    }, 300);
  }, [measurementResult, currentProfile, addMeasurement, setCurrentMeasurement, setSaving, addNotification]);

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
              {isDeviceConfigured ? 'Waga rozlaczona' : 'Polacz z waga'}
            </p>
            <div className="flex justify-center gap-2">
              <Button variant="primary" size="sm" onClick={handleConnect}>
                {isDeviceConfigured ? 'Polacz' : 'Konfiguruj'}
              </Button>
              <Button variant="outline" size="sm" onClick={handleGoToMeasure}>
                Wiecej
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
              Laczenie z waga...
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
              Gotowe do pomiaru
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Wejdz na wage
            </p>
            <Button variant="outline" size="sm" onClick={handleGoToMeasure}>
              Pelny widok
            </Button>
          </div>
        );

      case 'measuring':
        return <LiveWeightDisplay weight={liveWeight} isStable={isStable} />;

      case 'result':
        if (measurementResult) {
          return (
            <>
              <ResultPreview
                weight={measurementResult.weight}
                bmi={measurementResult.bmi}
                onSave={handleSave}
                onDiscard={handleDiscard}
                onViewDetails={handleViewDetails}
                isSaving={isSaving}
                isSaved={currentMeasurement.isSaved}
              />
              {currentMeasurement.isSaved && (
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={handleNewMeasurement}
                  >
                    Nowy pomiar
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
          Szybki pomiar
        </h3>
        {isConnected && (
          <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Polaczone
          </span>
        )}
      </div>
      {renderContent()}
    </Card>
  );
};

export default QuickMeasurementWidget;

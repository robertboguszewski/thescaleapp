/**
 * MeasurementPanel Component
 *
 * Main panel for taking new measurements.
 * Handles BLE connection, real-time display, result saving,
 * and profile auto-detection for multi-profile support.
 *
 * @module presentation/components/measurement/MeasurementPanel
 */

import React from 'react';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { ErrorMessage } from '../common/ErrorMessage';
import { BLEStatus } from './BLEStatus';
import { MeasurementResult, LiveWeightDisplay } from './MeasurementResult';
import { ProfileSelectionDialog, ProfileOption } from './ProfileSelectionDialog';
import { useBLEStore, useIsConnected, useIsBusy } from '../../stores/bleStore';
import { useMeasurementStore } from '../../stores/measurementStore';
import { useProfileStore, useCurrentProfile } from '../../stores/profileStore';
import { useAppStore } from '../../stores/appStore';
import { GUEST_PROFILE_ID } from '../history/GuestMeasurements';
import { useBLEAutoConnect } from '../../hooks/useBLEAutoConnect';
import type { RawMeasurement } from '../../../domain/calculations/types';
import { calculateAllMetrics } from '../../../domain/calculations';

/**
 * Panel state type
 */
type PanelState = 'idle' | 'connecting' | 'ready' | 'measuring' | 'result' | 'selecting-profile';

/**
 * Detection result interface for profile auto-detection
 */
interface DetectionResult {
  detectedProfileId: string | null;
  confidence: number;
  requiresConfirmation: boolean;
  candidates: Array<{ id: string; name: string; confidence: number }>;
}

/**
 * Calculate age from birth year and optional month
 */
const calculateAgeFromBirthYear = (birthYear: number, birthMonth?: number): number => {
  const today = new Date();
  const currentYear = today.getFullYear();
  let age = currentYear - birthYear;
  if (birthMonth !== undefined && today.getMonth() + 1 < birthMonth) {
    age--;
  }
  return age;
};

/**
 * Instructions step component
 */
const InstructionStep: React.FC<{
  number: number;
  title: string;
  description: string;
  isActive?: boolean;
  isComplete?: boolean;
}> = ({ number, title, description, isActive = false, isComplete = false }) => (
  <div className={`flex gap-4 p-4 rounded-lg transition-colors ${isActive ? 'bg-primary-50 dark:bg-primary-900/20' : ''}`}>
    <div className={`
      w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold
      ${isComplete
        ? 'bg-green-500 text-white'
        : isActive
          ? 'bg-primary-500 text-white'
          : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
      }
    `}>
      {isComplete ? (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        number
      )}
    </div>
    <div>
      <h4 className={`font-medium ${isActive ? 'text-primary-700 dark:text-primary-300' : 'text-gray-900 dark:text-white'}`}>
        {title}
      </h4>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>
    </div>
  </div>
);

/**
 * First-time connection prompt
 * Shows when no device has been connected before
 */
const FirstTimeConnectionPrompt: React.FC<{ onConnect: () => void }> = ({ onConnect }) => {
  return (
    <div className="text-center py-12">
      <div className="w-20 h-20 mx-auto rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-6">
        <svg
          className="w-10 h-10 text-blue-500"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M6.5 6.5l11 11L12 23V1l5.5 5.5-11 11" />
        </svg>
      </div>
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
        Połącz z wagą
      </h2>
      <p className="mt-2 text-gray-500 dark:text-gray-400 max-w-md mx-auto">
        Kliknij przycisk poniżej, aby połączyć się z wagą Xiaomi przez Bluetooth.
        Aplikacja zapamięta urządzenie i będzie automatycznie nasłuchiwać pomiarów.
      </p>
      <div className="mt-4 text-sm text-gray-400 dark:text-gray-500">
        <p>Wskazówka: Wstań na wagę przed kliknięciem "Połącz" aby ją obudzić</p>
      </div>
      <Button
        variant="primary"
        size="lg"
        className="mt-6"
        onClick={onConnect}
      >
        Połącz z wagą
      </Button>
    </div>
  );
};

/**
 * Saved device reconnect prompt
 * Shows when device was previously connected but is currently disconnected
 */
const SavedDeviceReconnectPrompt: React.FC<{
  onConnect: () => void;
  isConnecting: boolean;
}> = ({ onConnect, isConnecting }) => {
  return (
    <div className="text-center py-12">
      <div className={`w-24 h-24 mx-auto rounded-full flex items-center justify-center mb-6 ${
        isConnecting
          ? 'bg-yellow-100 dark:bg-yellow-900/30 animate-pulse'
          : 'bg-green-100 dark:bg-green-900/30'
      }`}>
        <svg
          className={`w-12 h-12 ${isConnecting ? 'text-yellow-500' : 'text-green-500'}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M6.5 6.5l11 11L12 23V1l5.5 5.5-11 11" />
        </svg>
      </div>
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
        {isConnecting ? 'Łączenie...' : 'Waga gotowa do połączenia'}
      </h2>
      <p className="mt-2 text-gray-500 dark:text-gray-400 max-w-md mx-auto">
        {isConnecting
          ? 'Wybierz wagę z listy urządzeń Bluetooth...'
          : 'Twoja waga Mi Scale jest skonfigurowana. Kliknij poniżej aby aktywować nasłuchiwanie pomiarów.'
        }
      </p>
      {!isConnecting && (
        <>
          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg max-w-md mx-auto">
            <p className="text-blue-700 dark:text-blue-300 text-sm">
              <strong>Przed kliknięciem:</strong> Wstań na wagę aby ją obudzić, potem kliknij "Aktywuj nasłuchiwanie"
            </p>
          </div>
          <Button
            variant="primary"
            size="lg"
            className="mt-6"
            onClick={onConnect}
          >
            Aktywuj nasłuchiwanie
          </Button>
        </>
      )}
      {isConnecting && (
        <div className="mt-6">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto"></div>
        </div>
      )}
    </div>
  );
};

/**
 * Profile not selected warning - now allows measurement as guest
 */
const NoProfilesAvailable: React.FC<{
  onContinueAsGuest: () => void;
  onCreateProfile: () => void;
}> = ({ onContinueAsGuest, onCreateProfile }) => {
  return (
    <div className="text-center py-12">
      <div className="w-20 h-20 mx-auto rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center mb-6">
        <svg
          className="w-10 h-10 text-yellow-500"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      </div>
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
        Brak profilu
      </h2>
      <p className="mt-2 text-gray-500 dark:text-gray-400 max-w-md mx-auto">
        Utwórz profil użytkownika, aby móc zapisywać i analizować wyniki pomiarów, lub kontynuuj jako gość.
      </p>
      <div className="flex justify-center gap-4 mt-6">
        <Button
          variant="outline"
          size="lg"
          onClick={onContinueAsGuest}
        >
          Kontynuuj jako gość
        </Button>
        <Button
          variant="primary"
          size="lg"
          onClick={onCreateProfile}
        >
          Utworz profil
        </Button>
      </div>
    </div>
  );
};

/**
 * MeasurementPanel component
 */
export const MeasurementPanel: React.FC = () => {
  const [panelState, setPanelState] = React.useState<PanelState>('idle');
  const [pendingMeasurement, setPendingMeasurement] = React.useState<{
    raw: RawMeasurement;
    calculated: any;
  } | null>(null);
  const [detectionResult, setDetectionResult] = React.useState<DetectionResult | null>(null);

  // Track last processed measurement to prevent duplicates
  const lastProcessedMeasurementRef = React.useRef<number | null>(null);

  // Store hooks
  const { connectionState, liveWeight, isStable, setConnectionState, setLiveWeight, setIsStable, lastError, autoConnect, deviceMac } = useBLEStore();
  const isConnected = useIsConnected();
  const isBusy = useIsBusy();
  const { currentMeasurement, setCurrentMeasurement, clearCurrentMeasurement, addMeasurement, setSaving, isSaving } = useMeasurementStore();
  const { profiles, showProfileSelector, setShowProfileSelector } = useProfileStore();
  const currentProfile = useCurrentProfile();
  const { addNotification, setActiveTab } = useAppStore();

  // BLE Auto-connect hook for background measurement listening
  const bleAutoConnect = useBLEAutoConnect();

  // Check if device is configured (saved from previous connection)
  const isDeviceConfigured = autoConnect && !!deviceMac;

  // Derived state
  const hasMeasurementResult = currentMeasurement.raw !== null && currentMeasurement.calculated !== null;
  const hasProfiles = profiles.length > 0;

  // Get available profiles for selection
  const availableProfiles: ProfileOption[] = React.useMemo(
    () => profiles.map((p) => ({ id: p.id, name: p.name })),
    [profiles]
  );

  // Handle continue as guest when no profiles
  const handleContinueAsGuest = () => {
    // Allow measurement without profile
    setPanelState('idle');
  };

  // Handle create profile
  const handleCreateProfile = () => {
    setActiveTab('settings');
  };

  // Handle connect action - starts background listening
  // Defined before early returns that use it
  const handleConnect = async () => {
    setPanelState('connecting');
    setConnectionState('scanning');

    try {
      // Use auto-connect to scan and connect
      // This will also start background measurement listening
      const connected = await bleAutoConnect.scanAndConnect();

      if (connected) {
        setConnectionState('connected');
        setPanelState('ready');
        // Note: Notification is shown by the auto-connect hook
      } else {
        // Connection failed or cancelled - notification is shown by auto-connect hook
        setConnectionState('disconnected');
        setPanelState('idle');
        // Don't show duplicate notification - auto-connect hook handles it
      }
    } catch (error) {
      console.error('[MeasurementPanel] Connection error:', error);
      setConnectionState('disconnected');
      setPanelState('idle');
      // Don't show duplicate notification - auto-connect hook handles it
    }
  };

  // Check for device configuration and connection state
  // Show appropriate prompt based on state
  if (panelState === 'idle' || panelState === 'connecting') {
    if (!isDeviceConfigured) {
      // First time - no device saved
      return <FirstTimeConnectionPrompt onConnect={handleConnect} />;
    } else if (connectionState !== 'connected' && connectionState !== 'reading') {
      // Device saved but not connected - show reconnect prompt
      return (
        <SavedDeviceReconnectPrompt
          onConnect={handleConnect}
          isConnecting={panelState === 'connecting' || connectionState === 'scanning' || connectionState === 'connecting'}
        />
      );
    }
  }

  // Handle start measurement - with auto-connect, measurements are captured automatically
  // This function now just prepares the UI for passive measurement capture
  const handleStartMeasurement = () => {
    setPanelState('measuring');
    setConnectionState('reading');
    setLiveWeight(0);
    setIsStable(false);

    console.log('[MeasurementPanel] Waiting for measurement... Step on the scale!');

    // The auto-connect hook handles the actual measurement capture via BLE notifications
    // When a measurement is received, it will:
    // 1. Update liveWeight and isStable in the store
    // 2. Call setCurrentMeasurement with raw and calculated metrics
    // 3. Show notification

    // No active waiting needed - the hook will capture the measurement automatically
  };

  // Effect to react to auto-captured measurements (only for manual measurement mode)
  React.useEffect(() => {
    // When auto-connect captures a measurement and we're in manual measuring mode
    if (bleAutoConnect.lastMeasurement && panelState === 'measuring') {
      // Check if we already processed this measurement (prevent duplicates)
      const measurementKey = bleAutoConnect.lastMeasurement.weightKg;
      if (lastProcessedMeasurementRef.current === measurementKey) {
        console.log('[MeasurementPanel] Skipping already processed measurement');
        return;
      }
      lastProcessedMeasurementRef.current = measurementKey;

      const rawMeasurement = bleAutoConnect.lastMeasurement;
      console.log('[MeasurementPanel] Processing measurement for manual mode:', rawMeasurement);

      setLiveWeight(rawMeasurement.weightKg);
      setIsStable(true);

      // Calculate body composition metrics
      // currentProfile is StoredProfile which has birthYear, not age
      const profileForCalc = currentProfile
        ? {
            gender: currentProfile.gender,
            birthYear: currentProfile.birthYear,
            heightCm: currentProfile.heightCm,
            ethnicity: currentProfile.ethnicity,
          }
        : {
            gender: 'male' as const,
            birthYear: new Date().getFullYear() - 30, // Default to 30 years old
            heightCm: 175,
          };

      const calculatedMetrics = calculateAllMetrics(profileForCalc, rawMeasurement);

      // Handle profile detection (this shows the result screen)
      handleProfileDetection(rawMeasurement, calculatedMetrics);
    }
  }, [bleAutoConnect.lastMeasurement, panelState]);

  // Effect to update connection state from auto-connect
  React.useEffect(() => {
    if (bleAutoConnect.isConnected && panelState === 'connecting') {
      setPanelState('ready');
    }
  }, [bleAutoConnect.isConnected, panelState]);

  /**
   * Handle profile detection after measurement capture
   */
  const handleProfileDetection = (raw: RawMeasurement, calculated: any) => {
    setConnectionState('connected');

    // If no profiles exist, always save as guest
    if (!hasProfiles) {
      saveMeasurementToProfile(raw, calculated, GUEST_PROFILE_ID);
      return;
    }

    // If only one profile, use it directly
    if (profiles.length === 1) {
      saveMeasurementToProfile(raw, calculated, profiles[0].id);
      return;
    }

    // Multiple profiles - simulate detection (in real app, this would use weight matching)
    const detection = detectProfile(raw.weightKg);

    if (detection.requiresConfirmation) {
      // Ambiguous - show profile selection dialog
      setPendingMeasurement({ raw, calculated });
      setDetectionResult(detection);
      setPanelState('selecting-profile');
    } else if (detection.detectedProfileId) {
      // Confident detection - save directly
      saveMeasurementToProfile(raw, calculated, detection.detectedProfileId);
    } else {
      // No match - ask user
      setPendingMeasurement({ raw, calculated });
      setDetectionResult(detection);
      setPanelState('selecting-profile');
    }
  };

  /**
   * Detect profile based on weight (simplified implementation)
   * In a real app, this would use historical data and more sophisticated matching
   */
  const detectProfile = (weightKg: number): DetectionResult => {
    // For demonstration, simulate detection based on current profile or ambiguous
    const hasMultipleSimilarProfiles = profiles.length > 1;

    if (currentProfile && !hasMultipleSimilarProfiles) {
      return {
        detectedProfileId: currentProfile.id,
        confidence: 0.95,
        requiresConfirmation: false,
        candidates: [{ id: currentProfile.id, name: currentProfile.name, confidence: 0.95 }],
      };
    }

    // Simulate ambiguous detection
    return {
      detectedProfileId: null,
      confidence: 0.5,
      requiresConfirmation: true,
      candidates: profiles.map((p, index) => ({
        id: p.id,
        name: p.name,
        confidence: 0.5 - index * 0.1,
      })),
    };
  };

  /**
   * Save measurement to specified profile
   */
  const saveMeasurementToProfile = (raw: RawMeasurement, calculated: any, profileId: string) => {
    setCurrentMeasurement({
      raw,
      calculated,
      timestamp: new Date(),
      isSaved: false,
    });
    setPanelState('result');

    // Store the profile ID for saving
    (window as any).__pendingProfileId = profileId;
  };

  // Handle profile selection from dialog
  const handleProfileSelect = (profileId: string) => {
    if (pendingMeasurement) {
      saveMeasurementToProfile(
        pendingMeasurement.raw,
        pendingMeasurement.calculated,
        profileId
      );
      setPendingMeasurement(null);
      setDetectionResult(null);
    }
  };

  // Handle save as guest from dialog
  const handleSaveAsGuest = () => {
    if (pendingMeasurement) {
      saveMeasurementToProfile(
        pendingMeasurement.raw,
        pendingMeasurement.calculated,
        GUEST_PROFILE_ID
      );
      setPendingMeasurement(null);
      setDetectionResult(null);

      addNotification({
        type: 'info',
        title: 'Zapisano jako gość',
        message: 'Możesz przypisać pomiar do profilu później w "Pomiary gości"',
        duration: 5000,
      });
    }
  };

  // Handle cancel profile selection
  const handleCancelSelection = () => {
    setPendingMeasurement(null);
    setDetectionResult(null);
    setPanelState('ready');
  };

  // Handle save measurement
  const handleSave = async () => {
    if (!currentMeasurement.raw || !currentMeasurement.calculated) return;

    setSaving(true);

    const profileId = (window as any).__pendingProfileId || currentProfile?.id || GUEST_PROFILE_ID;

    // Simulate save - in real app, this would call repository
    setTimeout(() => {
      const measurement = {
        id: crypto.randomUUID(),
        timestamp: currentMeasurement.timestamp?.toISOString() || new Date().toISOString(),
        raw: currentMeasurement.raw!,
        calculated: currentMeasurement.calculated!,
        userProfileId: profileId,
      };

      addMeasurement(measurement);
      setCurrentMeasurement({ isSaved: true });
      setSaving(false);

      // Clean up
      delete (window as any).__pendingProfileId;

      const isGuestMeasurement = profileId === GUEST_PROFILE_ID;
      addNotification({
        type: 'success',
        title: 'Pomiar zapisany',
        message: isGuestMeasurement
          ? 'Wyniki zostały zapisane jako pomiar gościa.'
          : 'Wyniki zostały zapisane do historii.',
        duration: 3000,
      });
    }, 500);
  };

  // Handle discard measurement
  const handleDiscard = () => {
    clearCurrentMeasurement();
    delete (window as any).__pendingProfileId;
    setPanelState('ready');
  };

  // Handle new measurement
  const handleNewMeasurement = () => {
    clearCurrentMeasurement();
    delete (window as any).__pendingProfileId;
    setPanelState('ready');
  };

  // Handle retry on error
  const handleRetry = () => {
    setPanelState('idle');
    setConnectionState('disconnected');
  };

  // Get current step for instructions
  const getCurrentStep = (): number => {
    switch (panelState) {
      case 'idle': return 1;
      case 'connecting': return 1;
      case 'ready': return 2;
      case 'measuring': return 3;
      case 'selecting-profile': return 3;
      case 'result': return 4;
      default: return 1;
    }
  };

  // Get current profile display name
  const getProfileDisplayName = (): string => {
    if (!currentProfile) {
      return 'Gość';
    }
    return currentProfile.name;
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* BLE Status */}
      <BLEStatus
        showAction={panelState === 'idle'}
        onAction={handleConnect}
      />

      {/* Error state */}
      {connectionState === 'error' && lastError && (
        <ErrorMessage
          severity="error"
          title={lastError.message}
          message={lastError.suggestion}
          onRetry={handleRetry}
        />
      )}

      {/* Idle state - show instructions */}
      {panelState === 'idle' && connectionState !== 'error' && (
        <Card title="Jak wykonać pomiar" subtitle="Postępuj zgodnie z instrukcjami">
          <div className="space-y-2">
            <InstructionStep
              number={1}
              title="Połącz z wagą"
              description="Upewnij się, że waga jest włączona i kliknij 'Połącz'"
              isActive={getCurrentStep() === 1}
            />
            <InstructionStep
              number={2}
              title="Wejdź na wagę"
              description="Po połączeniu stań na wadze boso"
              isActive={getCurrentStep() === 2}
            />
            <InstructionStep
              number={3}
              title="Czekaj na wynik"
              description="Stój nieruchomo aż waga ustabilizuje pomiar"
              isActive={getCurrentStep() === 3}
            />
            <InstructionStep
              number={4}
              title="Zapisz pomiar"
              description="Sprawdź wyniki i zapisz je do historii"
              isActive={getCurrentStep() === 4}
            />
          </div>
        </Card>
      )}

      {/* Ready state - passive listening mode */}
      {panelState === 'ready' && (
        <Card className="text-center py-12">
          <div className="w-24 h-24 mx-auto rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-6 animate-pulse">
            <svg
              className="w-12 h-12 text-green-500"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Nasłuchiwanie aktywne
          </h2>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            Połączono z: <span className="font-medium text-green-600">{bleAutoConnect.deviceName || 'Mi Scale'}</span>
          </p>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            Profil: <span className="font-medium">{getProfileDisplayName()}</span>
            {profiles.length > 1 && (
              <span className="text-sm ml-2">(automatyczne wykrywanie)</span>
            )}
          </p>
          <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <p className="text-green-700 dark:text-green-300 font-medium">
              Wejdź na wagę - pomiar zostanie wykonany automatycznie
            </p>
          </div>
          <Button
            variant="outline"
            size="md"
            className="mt-6"
            onClick={handleStartMeasurement}
          >
            Ręczny pomiar
          </Button>
        </Card>
      )}

      {/* Measuring state - live weight */}
      {panelState === 'measuring' && (
        <Card>
          <LiveWeightDisplay weight={liveWeight} isStable={isStable} />
          <div className="text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Nie schodź z wagi
            </p>
          </div>
        </Card>
      )}

      {/* Result state */}
      {panelState === 'result' && hasMeasurementResult && (
        <MeasurementResult
          raw={currentMeasurement.raw!}
          calculated={currentMeasurement.calculated!}
          timestamp={currentMeasurement.timestamp || new Date()}
          isSaved={currentMeasurement.isSaved}
          onSave={handleSave}
          onDiscard={handleDiscard}
          onNewMeasurement={handleNewMeasurement}
          isLoading={isSaving}
        />
      )}

      {/* Profile selection dialog for ambiguous detection */}
      <ProfileSelectionDialog
        isOpen={panelState === 'selecting-profile'}
        title="Wybierz profil"
        message="Wykryto niejednoznaczny pomiar. Wybierz, do którego profilu przypisać wynik."
        profiles={availableProfiles}
        onSelect={handleProfileSelect}
        onSaveAsGuest={handleSaveAsGuest}
        onCancel={handleCancelSelection}
      />
    </div>
  );
};

export default MeasurementPanel;

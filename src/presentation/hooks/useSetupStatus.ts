/**
 * useSetupStatus Hook
 *
 * Hook for tracking application setup status.
 * Monitors profile, device, and measurement configuration.
 * Used for onboarding guidance and dashboard setup status display.
 *
 * @module presentation/hooks/useSetupStatus
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useProfileStore } from '../stores/profileStore';
import { useIsDeviceConfigured } from '../stores/bleStore';
import { useMeasurementStore } from '../stores/measurementStore';
import type { Tab } from '../stores/appStore';

/**
 * Step status type
 */
export type StepStatus = 'pending' | 'current' | 'completed';

/**
 * Navigation target for a step
 */
export interface NavigateTarget {
  tab: Tab;
  subTab?: string;
}

/**
 * Setup step definition
 */
export interface SetupStep {
  id: 'profile' | 'device' | 'measurement';
  label: string;
  description: string;
  status: StepStatus;
  navigateTo: NavigateTarget;
}

/**
 * Setup status interface
 */
export interface SetupStatus {
  /** Whether at least one profile is configured */
  profileConfigured: boolean;
  /** Whether BLE device is configured (deviceMac and bleKey present) */
  deviceConfigured: boolean;
  /** Whether at least one measurement exists */
  hasMeasurements: boolean;
  /** Whether minimum setup is complete (profile + device) */
  isSetupComplete: boolean;
  /** Setup steps with their current status */
  setupSteps: SetupStep[];
  /** Completion progress as percentage (0-100) */
  completionProgress: number;
  /** Current step to complete (null if all complete) */
  currentStep: SetupStep | null;
}

/**
 * Hook for monitoring application setup status
 *
 * Tracks the configuration state of profiles, device, and measurements
 * to guide users through initial setup and show completion progress.
 *
 * @example
 * ```typescript
 * const {
 *   isSetupComplete,
 *   setupSteps,
 *   currentStep,
 *   completionProgress
 * } = useSetupStatus();
 *
 * if (!isSetupComplete) {
 *   // Show setup guidance
 * }
 * ```
 */
export function useSetupStatus(): SetupStatus {
  const { t } = useTranslation('dashboard');
  // Get state from stores
  const profiles = useProfileStore((state) => state.profiles);
  const deviceConfigured = useIsDeviceConfigured();
  const measurements = useMeasurementStore((state) => state.measurements);

  // Compute derived values
  const profileConfigured = profiles.length > 0;
  const hasMeasurements = measurements.length > 0;
  const isSetupComplete = profileConfigured && deviceConfigured;

  // Compute step statuses
  const setupSteps = useMemo((): SetupStep[] => {
    const getProfileStatus = (): StepStatus => {
      if (profileConfigured) return 'completed';
      return 'current';
    };

    const getDeviceStatus = (): StepStatus => {
      if (deviceConfigured) return 'completed';
      if (profileConfigured) return 'current';
      return 'pending';
    };

    const getMeasurementStatus = (): StepStatus => {
      if (hasMeasurements) return 'completed';
      if (profileConfigured && deviceConfigured) return 'current';
      return 'pending';
    };

    return [
      {
        id: 'profile',
        label: t('setup.step2'),
        description: t('setup.step2Desc'),
        status: getProfileStatus(),
        navigateTo: { tab: 'settings', subTab: 'profiles' },
      },
      {
        id: 'device',
        label: t('setup.step1'),
        description: t('setup.step1Desc'),
        status: getDeviceStatus(),
        navigateTo: { tab: 'settings', subTab: 'device' },
      },
      {
        id: 'measurement',
        label: t('setup.step3'),
        description: t('setup.step3Desc'),
        status: getMeasurementStatus(),
        navigateTo: { tab: 'measure' },
      },
    ];
  }, [t, profileConfigured, deviceConfigured, hasMeasurements]);

  // Compute completion progress
  const completionProgress = useMemo(() => {
    const completedSteps = setupSteps.filter((s) => s.status === 'completed').length;
    return (completedSteps / setupSteps.length) * 100;
  }, [setupSteps]);

  // Get current step (first non-completed step)
  const currentStep = useMemo(() => {
    return setupSteps.find((s) => s.status === 'current') || null;
  }, [setupSteps]);

  return {
    profileConfigured,
    deviceConfigured,
    hasMeasurements,
    isSetupComplete,
    setupSteps,
    completionProgress,
    currentStep,
  };
}

export default useSetupStatus;

/**
 * useMeasurement Hook
 *
 * Custom React hook for measurement operations.
 * Wraps IPC calls and manages Zustand store state.
 * Includes auto-detection flow for multi-profile support.
 *
 * @module presentation/hooks/useMeasurement
 */

import { useCallback, useEffect } from 'react';
import {
  useMeasurementStore,
  useLatestMeasurement,
  usePaginatedMeasurements,
  useFilteredMeasurements,
  useGuestMeasurements,
  useHasGuestMeasurements,
  GUEST_PROFILE_ID,
  type CurrentMeasurement,
} from '../stores/measurementStore';
import {
  useProfileStore,
  useCurrentProfile,
  type DetectionResult,
} from '../stores/profileStore';
import type { StoredMeasurement } from '../../infrastructure/storage/schemas';
import type { MeasurementQuery } from '../../shared/types';
import type { RawMeasurement, CalculatedMetrics } from '../../domain/calculations/types';

/**
 * Query parameters for loading measurements
 */
interface LoadMeasurementsOptions {
  profileId?: string;
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Detection options for auto-detection
 */
interface DetectionOptions {
  weightKg: number;
  impedanceOhm?: number;
}

/**
 * Capture with detection result
 */
interface CaptureWithDetectionResult {
  raw: RawMeasurement;
  calculated: CalculatedMetrics;
  detection: DetectionResult;
}

/**
 * Hook return type
 */
interface UseMeasurementReturn {
  // State
  measurements: StoredMeasurement[];
  latestMeasurement: StoredMeasurement | null;
  currentMeasurement: CurrentMeasurement;
  selectedMeasurementId: string | null;
  isLoading: boolean;
  isSaving: boolean;

  // Guest measurements
  guestMeasurements: StoredMeasurement[];
  hasGuestMeasurements: boolean;

  // Pagination
  paginatedMeasurements: ReturnType<typeof usePaginatedMeasurements>;
  filteredMeasurements: StoredMeasurement[];

  // Actions
  loadMeasurements: (options?: LoadMeasurementsOptions) => Promise<void>;
  loadMeasurementsForCurrentProfile: () => Promise<void>;
  loadGuestMeasurements: () => void;
  captureMeasurement: (profileId: string) => Promise<StoredMeasurement | null>;
  captureWithAutoDetection: () => Promise<CaptureWithDetectionResult | null>;
  assignGuestToProfile: (measurementId: string, profileId: string) => Promise<boolean>;
  deleteMeasurement: (id: string) => Promise<boolean>;
  deleteAllMeasurements: (profileId: string) => Promise<boolean>;
  setSelectedMeasurementId: (id: string | null) => void;
  setCurrentMeasurement: (measurement: Partial<CurrentMeasurement>) => void;
  clearCurrentMeasurement: () => void;
  refresh: () => Promise<void>;
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
 * Custom hook for measurement operations
 *
 * Provides a clean interface for:
 * - Loading measurements from storage
 * - Capturing new measurements from scale
 * - Auto-detection for multi-profile support
 * - Managing guest measurements
 * - Deleting measurements
 * - Managing loading/error states
 * - Pagination and filtering
 *
 * @example
 * ```typescript
 * const {
 *   measurements,
 *   latestMeasurement,
 *   isLoading,
 *   guestMeasurements,
 *   loadMeasurementsForCurrentProfile,
 *   captureWithAutoDetection,
 *   assignGuestToProfile,
 * } = useMeasurement();
 *
 * useEffect(() => {
 *   loadMeasurementsForCurrentProfile();
 * }, []);
 *
 * // Capture with auto-detection
 * const result = await captureWithAutoDetection();
 * if (result?.detection.requiresConfirmation) {
 *   // Show profile selection dialog
 * }
 * ```
 */
export function useMeasurement(): UseMeasurementReturn {
  const store = useMeasurementStore();
  const latestMeasurement = useLatestMeasurement();
  const paginatedMeasurements = usePaginatedMeasurements();
  const filteredMeasurements = useFilteredMeasurements();
  const guestMeasurements = useGuestMeasurements();
  const hasGuestMeasurements = useHasGuestMeasurements();
  const currentProfile = useCurrentProfile();

  const { profiles } = useProfileStore();

  const {
    measurements,
    currentMeasurement,
    selectedMeasurementId,
    isLoading,
    isSaving,
    setMeasurements,
    addMeasurement,
    removeMeasurement,
    updateMeasurement,
    setSelectedMeasurementId,
    setCurrentMeasurement,
    clearCurrentMeasurement,
    setLoading,
    setSaving,
    loadGuestMeasurements: storeLoadGuestMeasurements,
    assignGuestToProfile: storeAssignGuestToProfile,
  } = store;

  /**
   * Load measurements with optional query
   */
  const loadMeasurements = useCallback(
    async (options?: LoadMeasurementsOptions): Promise<void> => {
      setLoading(true);

      try {
        const query: MeasurementQuery = {};
        if (options?.profileId) query.userProfileId = options.profileId;
        if (options?.fromDate) query.fromDate = options.fromDate;
        if (options?.toDate) query.toDate = options.toDate;
        if (options?.limit) query.limit = options.limit;
        if (options?.offset) query.offset = options.offset;

        const result = await window.electronAPI.getMeasurements(query);

        if (result.success && result.data) {
          // Convert Date objects to ISO strings for storage format
          const storedMeasurements: StoredMeasurement[] = result.data.map((m) => ({
            ...m,
            timestamp:
              typeof m.timestamp === 'string'
                ? m.timestamp
                : m.timestamp.toISOString(),
          }));
          setMeasurements(storedMeasurements);

          // Also load guest measurements
          storeLoadGuestMeasurements();
        } else {
          console.error('Failed to load measurements:', result.error);
        }
      } catch (err) {
        console.error('Error loading measurements:', err);
      } finally {
        setLoading(false);
      }
    },
    [setMeasurements, setLoading, storeLoadGuestMeasurements]
  );

  /**
   * Load measurements for the currently active profile
   */
  const loadMeasurementsForCurrentProfile = useCallback(async (): Promise<void> => {
    if (!currentProfile) {
      setMeasurements([]);
      return;
    }

    await loadMeasurements({ profileId: currentProfile.id });
  }, [currentProfile, loadMeasurements, setMeasurements]);

  /**
   * Load guest measurements
   */
  const loadGuestMeasurements = useCallback((): void => {
    storeLoadGuestMeasurements();
  }, [storeLoadGuestMeasurements]);

  /**
   * Detect profile based on weight and other factors
   * Uses historical data to match user
   */
  const detectProfile = useCallback(
    (options: DetectionOptions): DetectionResult => {
      const { weightKg } = options;

      // No profiles - can't detect
      if (profiles.length === 0) {
        return {
          detectedProfileId: null,
          confidence: 0,
          requiresConfirmation: true,
          candidates: [],
        };
      }

      // Single profile - use it
      if (profiles.length === 1) {
        return {
          detectedProfileId: profiles[0].id,
          confidence: 1.0,
          requiresConfirmation: false,
          candidates: [{ id: profiles[0].id, name: profiles[0].name, confidence: 1.0 }],
        };
      }

      // Multiple profiles - use weight matching
      // In a real implementation, this would use historical weight data
      // For now, we'll simulate based on profile characteristics

      const candidates = profiles.map((profile) => {
        // Estimate expected weight based on height, age, and gender
        // This is a simplified estimation
        let expectedWeight = profile.heightCm - 100; // Very basic estimation

        if (profile.gender === 'female') {
          expectedWeight *= 0.9;
        }

        // Adjust for age (calculate from birthYear)
        const age = calculateAgeFromBirthYear(profile.birthYear, profile.birthMonth);
        if (age > 40) {
          expectedWeight *= 1.05;
        }

        // Calculate confidence based on how close the weight is
        const weightDiff = Math.abs(weightKg - expectedWeight);
        const confidence = Math.max(0, 1 - weightDiff / 30);

        return {
          id: profile.id,
          name: profile.name,
          confidence,
        };
      });

      // Sort by confidence
      candidates.sort((a, b) => b.confidence - a.confidence);

      // Check if we have a confident match
      const topCandidate = candidates[0];
      const secondCandidate = candidates[1];

      // Require confirmation if:
      // - Top confidence is below 0.7
      // - Or top two are too close (within 0.2)
      const confidenceDiff = topCandidate.confidence - (secondCandidate?.confidence || 0);
      const requiresConfirmation =
        topCandidate.confidence < 0.7 || confidenceDiff < 0.2;

      return {
        detectedProfileId: requiresConfirmation ? null : topCandidate.id,
        confidence: topCandidate.confidence,
        requiresConfirmation,
        candidates,
      };
    },
    [profiles]
  );

  /**
   * Capture measurement with auto-detection
   * Returns detection result for handling by caller
   */
  const captureWithAutoDetection = useCallback(
    async (): Promise<CaptureWithDetectionResult | null> => {
      setSaving(true);
      setCurrentMeasurement({ isSaved: false });

      try {
        // In a real implementation, this would capture from the scale
        // For now, we simulate the measurement
        const mockRaw: RawMeasurement = {
          weightKg: 70 + Math.random() * 10,
          impedanceOhm: 500 + Math.random() * 50,
        };

        const mockCalculated: CalculatedMetrics = {
          bmi: 23.4,
          bodyFatPercent: 18.5,
          muscleMassKg: 32.1,
          bodyWaterPercent: 55.2,
          boneMassKg: 3.2,
          visceralFatLevel: 7,
          bmrKcal: 1680,
          leanBodyMassKg: 57.4,
          proteinPercent: 17.8,
          bodyScore: 78,
        };

        // Detect profile
        const detection = detectProfile({ weightKg: mockRaw.weightKg });

        // Update current measurement
        setCurrentMeasurement({
          raw: mockRaw,
          calculated: mockCalculated,
          timestamp: new Date(),
          isSaved: false,
        });

        return {
          raw: mockRaw,
          calculated: mockCalculated,
          detection,
        };
      } catch (err) {
        console.error('Error capturing measurement with detection:', err);
        return null;
      } finally {
        setSaving(false);
      }
    },
    [detectProfile, setCurrentMeasurement, setSaving]
  );

  /**
   * Capture a new measurement from the scale
   */
  const captureMeasurement = useCallback(
    async (profileId: string): Promise<StoredMeasurement | null> => {
      setSaving(true);
      setCurrentMeasurement({ isSaved: false });

      try {
        const result = await window.electronAPI.captureMeasurement(profileId);

        if (result.success && result.data) {
          const storedMeasurement: StoredMeasurement = {
            ...result.data,
            timestamp:
              typeof result.data.timestamp === 'string'
                ? result.data.timestamp
                : result.data.timestamp.toISOString(),
          };

          addMeasurement(storedMeasurement);
          setCurrentMeasurement({
            raw: result.data.raw,
            calculated: result.data.calculated,
            timestamp: new Date(result.data.timestamp),
            isSaved: true,
          });

          return storedMeasurement;
        } else {
          console.error('Failed to capture measurement:', result.error);
          return null;
        }
      } catch (err) {
        console.error('Error capturing measurement:', err);
        return null;
      } finally {
        setSaving(false);
      }
    },
    [addMeasurement, setCurrentMeasurement, setSaving]
  );

  /**
   * Assign a guest measurement to a profile
   */
  const assignGuestToProfile = useCallback(
    async (measurementId: string, profileId: string): Promise<boolean> => {
      setLoading(true);

      try {
        // Update in store
        storeAssignGuestToProfile(measurementId, profileId);

        // Persist to backend
        const result = await window.electronAPI.updateMeasurement?.(measurementId, {
          userProfileId: profileId,
        });

        if (result && !result.success) {
          console.error('Failed to assign guest to profile:', result.error);
          // Revert the change
          storeAssignGuestToProfile(measurementId, GUEST_PROFILE_ID);
          return false;
        }

        return true;
      } catch (err) {
        console.error('Error assigning guest to profile:', err);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [storeAssignGuestToProfile, setLoading]
  );

  /**
   * Delete a measurement by ID
   */
  const deleteMeasurement = useCallback(
    async (id: string): Promise<boolean> => {
      setLoading(true);

      try {
        const result = await window.electronAPI.deleteMeasurement(id);

        if (result.success) {
          removeMeasurement(id);
          return true;
        } else {
          console.error('Failed to delete measurement:', result.error);
          return false;
        }
      } catch (err) {
        console.error('Error deleting measurement:', err);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [removeMeasurement, setLoading]
  );

  /**
   * Delete all measurements for a profile
   */
  const deleteAllMeasurements = useCallback(
    async (profileId: string): Promise<boolean> => {
      setLoading(true);

      try {
        const result = await window.electronAPI.deleteAllMeasurements(profileId);

        if (result.success) {
          // Reload measurements to update state
          if (currentProfile?.id === profileId) {
            setMeasurements([]);
          }
          return true;
        } else {
          console.error('Failed to delete measurements:', result.error);
          return false;
        }
      } catch (err) {
        console.error('Error deleting measurements:', err);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [currentProfile, setMeasurements, setLoading]
  );

  /**
   * Refresh measurements for current profile
   */
  const refresh = useCallback(async (): Promise<void> => {
    await loadMeasurementsForCurrentProfile();
  }, [loadMeasurementsForCurrentProfile]);

  /**
   * Auto-load measurements when current profile changes
   */
  useEffect(() => {
    if (currentProfile) {
      loadMeasurementsForCurrentProfile();
    }
  }, [currentProfile?.id]); // Only depend on ID to avoid unnecessary reloads

  /**
   * Load guest measurements on initial mount
   */
  useEffect(() => {
    loadGuestMeasurements();
  }, [loadGuestMeasurements]);

  return {
    measurements,
    latestMeasurement,
    currentMeasurement,
    selectedMeasurementId,
    isLoading,
    isSaving,
    guestMeasurements,
    hasGuestMeasurements,
    paginatedMeasurements,
    filteredMeasurements,
    loadMeasurements,
    loadMeasurementsForCurrentProfile,
    loadGuestMeasurements,
    captureMeasurement,
    captureWithAutoDetection,
    assignGuestToProfile,
    deleteMeasurement,
    deleteAllMeasurements,
    setSelectedMeasurementId,
    setCurrentMeasurement,
    clearCurrentMeasurement,
    refresh,
  };
}

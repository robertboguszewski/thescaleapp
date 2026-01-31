/**
 * Profile Store
 *
 * Zustand store for managing user profiles.
 * Handles current profile selection and profile list.
 * Supports multi-profile detection and guest measurements.
 *
 * @module presentation/stores/profileStore
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { StoredProfile } from '../../infrastructure/storage/schemas';
import type { RawMeasurement } from '../../domain/calculations/types';

/**
 * Profile form data for creation/editing
 */
export interface ProfileFormData {
  name: string;
  gender: 'male' | 'female';
  age: number;
  heightCm: number;
  ethnicity?: 'asian' | 'non-asian';
  isDefault: boolean;
}

/**
 * Profile validation errors
 */
export interface ProfileValidationErrors {
  name?: string;
  gender?: string;
  age?: string;
  heightCm?: string;
}

/**
 * Detection result for profile auto-detection
 */
export interface DetectionResult {
  /** Detected profile ID (null if no match) */
  detectedProfileId: string | null;
  /** Detection confidence (0-1) */
  confidence: number;
  /** Whether user confirmation is required */
  requiresConfirmation: boolean;
  /** Candidate profiles with confidence scores */
  candidates: Array<{
    id: string;
    name: string;
    confidence: number;
  }>;
}

/**
 * Profile state interface
 */
interface ProfileState {
  // State
  profiles: StoredProfile[];
  currentProfileId: string | null;
  editingProfileId: string | null;
  isEditing: boolean;
  isLoading: boolean;
  isSaving: boolean;
  validationErrors: ProfileValidationErrors;

  // Multi-profile detection state
  detectionResult: DetectionResult | null;
  showProfileSelector: boolean;
  pendingMeasurement: RawMeasurement | null;

  // Actions
  setProfiles: (profiles: StoredProfile[]) => void;
  addProfile: (profile: StoredProfile) => void;
  updateProfile: (id: string, data: Partial<StoredProfile>) => void;
  removeProfile: (id: string) => void;

  setCurrentProfileId: (id: string | null) => void;
  setEditingProfileId: (id: string | null) => void;
  setIsEditing: (editing: boolean) => void;

  setLoading: (loading: boolean) => void;
  setSaving: (saving: boolean) => void;
  setValidationErrors: (errors: ProfileValidationErrors) => void;
  clearValidationErrors: () => void;

  // Multi-profile detection actions
  setDetectionResult: (result: DetectionResult | null) => void;
  setShowProfileSelector: (show: boolean) => void;
  setPendingMeasurement: (measurement: RawMeasurement | null) => void;
  clearDetectionState: () => void;
}

/**
 * Create the profile store
 */
export const useProfileStore = create<ProfileState>()(
  persist(
    (set, get) => ({
      // Initial state
      profiles: [],
      currentProfileId: null,
      editingProfileId: null,
      isEditing: false,
      isLoading: false,
      isSaving: false,
      validationErrors: {},

      // Multi-profile detection state
      detectionResult: null,
      showProfileSelector: false,
      pendingMeasurement: null,

      // Actions
      setProfiles: (profiles) => set({ profiles }),

      addProfile: (profile) =>
        set((state) => ({
          profiles: [...state.profiles, profile],
        })),

      updateProfile: (id, data) =>
        set((state) => ({
          profiles: state.profiles.map((p) =>
            p.id === id ? { ...p, ...data } : p
          ),
        })),

      removeProfile: (id) =>
        set((state) => {
          const newProfiles = state.profiles.filter((p) => p.id !== id);
          return {
            profiles: newProfiles,
            currentProfileId:
              state.currentProfileId === id
                ? newProfiles.find((p) => p.isDefault)?.id || newProfiles[0]?.id || null
                : state.currentProfileId,
            editingProfileId:
              state.editingProfileId === id ? null : state.editingProfileId,
          };
        }),

      setCurrentProfileId: (currentProfileId) => set({ currentProfileId }),

      setEditingProfileId: (editingProfileId) => set({ editingProfileId }),

      setIsEditing: (isEditing) =>
        set({
          isEditing,
          editingProfileId: isEditing ? get().editingProfileId : null,
          validationErrors: {},
        }),

      setLoading: (isLoading) => set({ isLoading }),

      setSaving: (isSaving) => set({ isSaving }),

      setValidationErrors: (validationErrors) => set({ validationErrors }),

      clearValidationErrors: () => set({ validationErrors: {} }),

      // Multi-profile detection actions
      setDetectionResult: (detectionResult) => set({ detectionResult }),

      setShowProfileSelector: (showProfileSelector) => set({ showProfileSelector }),

      setPendingMeasurement: (pendingMeasurement) => set({ pendingMeasurement }),

      clearDetectionState: () =>
        set({
          detectionResult: null,
          showProfileSelector: false,
          pendingMeasurement: null,
        }),
    }),
    {
      name: 'thescale-profile-storage',
      // Only persist current profile selection
      partialize: (state) => ({
        currentProfileId: state.currentProfileId,
      }),
    }
  )
);

/**
 * Selector for current profile
 */
export const useCurrentProfile = () =>
  useProfileStore((state) => {
    if (!state.currentProfileId) {
      // Return default profile or first profile
      return (
        state.profiles.find((p) => p.isDefault) || state.profiles[0] || null
      );
    }
    return state.profiles.find((p) => p.id === state.currentProfileId) || null;
  });

/**
 * Selector for editing profile
 */
export const useEditingProfile = () =>
  useProfileStore((state) => {
    if (!state.editingProfileId) return null;
    return state.profiles.find((p) => p.id === state.editingProfileId) || null;
  });

/**
 * Selector for default profile
 */
export const useDefaultProfile = () =>
  useProfileStore((state) => state.profiles.find((p) => p.isDefault) || null);

/**
 * Selector for checking if multiple profiles exist
 */
export const useHasMultipleProfiles = () =>
  useProfileStore((state) => state.profiles.length > 1);

/**
 * Selector for detection result
 */
export const useDetectionResult = () =>
  useProfileStore((state) => state.detectionResult);

/**
 * Selector for pending measurement
 */
export const usePendingMeasurement = () =>
  useProfileStore((state) => state.pendingMeasurement);

/**
 * Validate profile form data
 */
export const validateProfileData = (data: ProfileFormData): ProfileValidationErrors => {
  const errors: ProfileValidationErrors = {};

  if (!data.name || data.name.trim().length === 0) {
    errors.name = 'Nazwa profilu jest wymagana';
  } else if (data.name.length > 100) {
    errors.name = 'Nazwa profilu nie moze miec wiecej niz 100 znakow';
  }

  if (!data.gender) {
    errors.gender = 'Płeć jest wymagana';
  }

  if (!data.age || data.age < 6 || data.age > 80) {
    errors.age = 'Wiek musi byc w zakresie 6-80 lat';
  }

  if (!data.heightCm || data.heightCm < 90 || data.heightCm > 220) {
    errors.heightCm = 'Wzrost musi byc w zakresie 90-220 cm';
  }

  return errors;
};

/**
 * Check if validation errors exist
 */
export const hasValidationErrors = (errors: ProfileValidationErrors): boolean =>
  Object.keys(errors).length > 0;

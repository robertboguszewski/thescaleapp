/**
 * useProfile Hook
 *
 * Custom React hook for user profile operations.
 * Wraps IPC calls and manages Zustand store state.
 *
 * @module presentation/hooks/useProfile
 */

import { useCallback, useEffect } from 'react';
import {
  useProfileStore,
  useCurrentProfile,
  useEditingProfile,
  useDefaultProfile,
  validateProfileData,
  hasValidationErrors,
  type ProfileFormData,
  type ProfileValidationErrors,
} from '../stores/profileStore';
import type { StoredProfile } from '../../infrastructure/storage/schemas';
import type { CreateProfileInput, UpdateProfileInput } from '../../shared/types';

/**
 * Hook return type
 */
interface UseProfileReturn {
  // State
  profiles: StoredProfile[];
  currentProfile: StoredProfile | null;
  editingProfile: StoredProfile | null;
  defaultProfile: StoredProfile | null;
  isEditing: boolean;
  isLoading: boolean;
  isSaving: boolean;
  validationErrors: ProfileValidationErrors;

  // Actions
  loadProfiles: () => Promise<void>;
  createProfile: (input: CreateProfileInput) => Promise<StoredProfile | null>;
  updateProfile: (id: string, data: UpdateProfileInput) => Promise<boolean>;
  deleteProfile: (id: string) => Promise<boolean>;
  setCurrentProfileId: (id: string | null) => void;
  setEditingProfileId: (id: string | null) => void;
  setIsEditing: (editing: boolean) => void;
  setDefaultProfile: (id: string) => Promise<boolean>;
  validateForm: (data: ProfileFormData) => ProfileValidationErrors;
  clearValidationErrors: () => void;
  getProfileById: (id: string) => StoredProfile | undefined;
  refresh: () => Promise<void>;
}

/**
 * Custom hook for profile operations
 *
 * Provides a clean interface for:
 * - Loading profiles from storage
 * - Creating, updating, deleting profiles
 * - Managing current/editing profile
 * - Form validation
 * - Managing loading/error states
 *
 * @example
 * ```typescript
 * const {
 *   profiles,
 *   currentProfile,
 *   createProfile,
 *   setCurrentProfileId,
 *   validateForm,
 * } = useProfile();
 *
 * // Create a new profile
 * const newProfile = await createProfile({
 *   name: 'John',
 *   gender: 'male',
 *   age: 30,
 *   heightCm: 180,
 * });
 * ```
 */
export function useProfile(): UseProfileReturn {
  const store = useProfileStore();
  const currentProfile = useCurrentProfile();
  const editingProfile = useEditingProfile();
  const defaultProfile = useDefaultProfile();

  const {
    profiles,
    isEditing,
    isLoading,
    isSaving,
    validationErrors,
    setProfiles,
    addProfile,
    updateProfile: updateProfileInStore,
    removeProfile,
    setCurrentProfileId,
    setEditingProfileId,
    setIsEditing,
    setLoading,
    setSaving,
    setValidationErrors,
    clearValidationErrors,
  } = store;

  /**
   * Load all profiles from storage
   */
  const loadProfiles = useCallback(async (): Promise<void> => {
    setLoading(true);

    try {
      const result = await window.electronAPI.getAllProfiles();

      if (result.success && result.data) {
        // Convert to StoredProfile format
        const storedProfiles: StoredProfile[] = result.data.map((p) => ({
          ...p,
          createdAt:
            typeof p.createdAt === 'string'
              ? p.createdAt
              : p.createdAt.toISOString(),
          updatedAt:
            typeof p.updatedAt === 'string'
              ? p.updatedAt
              : p.updatedAt.toISOString(),
        }));
        setProfiles(storedProfiles);

        // Set default profile as current if none selected
        const { currentProfileId } = useProfileStore.getState();
        if (!currentProfileId && storedProfiles.length > 0) {
          const defaultProf = storedProfiles.find((p) => p.isDefault);
          setCurrentProfileId(defaultProf?.id || storedProfiles[0].id);
        }
      } else {
        console.error('Failed to load profiles:', result.error);
      }
    } catch (err) {
      console.error('Error loading profiles:', err);
    } finally {
      setLoading(false);
    }
  }, [setProfiles, setCurrentProfileId, setLoading]);

  /**
   * Create a new profile
   */
  const createProfile = useCallback(
    async (input: CreateProfileInput): Promise<StoredProfile | null> => {
      // Calculate age from birthYear for validation
      const currentYear = new Date().getFullYear();
      const calculatedAge = currentYear - input.birthYear;

      // Validate input
      const formData: ProfileFormData = {
        name: input.name,
        gender: input.gender,
        age: calculatedAge,
        heightCm: input.heightCm,
        ethnicity: input.ethnicity,
        isDefault: false,
      };

      const errors = validateProfileData(formData);
      if (hasValidationErrors(errors)) {
        setValidationErrors(errors);
        return null;
      }

      setSaving(true);
      clearValidationErrors();

      try {
        const result = await window.electronAPI.createProfile(input);

        if (result.success && result.data) {
          const storedProfile: StoredProfile = {
            ...result.data,
            createdAt:
              typeof result.data.createdAt === 'string'
                ? result.data.createdAt
                : result.data.createdAt.toISOString(),
            updatedAt:
              typeof result.data.updatedAt === 'string'
                ? result.data.updatedAt
                : result.data.updatedAt.toISOString(),
          };

          addProfile(storedProfile);

          // Set as current if it's the only profile or is default
          if (profiles.length === 0 || result.data.isDefault) {
            setCurrentProfileId(storedProfile.id);
          }

          return storedProfile;
        } else {
          console.error('Failed to create profile:', result.error);
          return null;
        }
      } catch (err) {
        console.error('Error creating profile:', err);
        return null;
      } finally {
        setSaving(false);
      }
    },
    [
      profiles.length,
      addProfile,
      setCurrentProfileId,
      setSaving,
      setValidationErrors,
      clearValidationErrors,
    ]
  );

  /**
   * Update an existing profile
   */
  const updateProfile = useCallback(
    async (id: string, data: UpdateProfileInput): Promise<boolean> => {
      // Validate input if all required fields present
      if (data.name && data.gender && data.birthYear && data.heightCm) {
        // Calculate age from birthYear for validation
        const currentYear = new Date().getFullYear();
        const calculatedAge = currentYear - data.birthYear;

        const formData: ProfileFormData = {
          name: data.name,
          gender: data.gender,
          age: calculatedAge,
          heightCm: data.heightCm,
          ethnicity: data.ethnicity,
          isDefault: false,
        };

        const errors = validateProfileData(formData);
        if (hasValidationErrors(errors)) {
          setValidationErrors(errors);
          return false;
        }
      }

      setSaving(true);
      clearValidationErrors();

      try {
        const result = await window.electronAPI.updateProfile(id, data);

        if (result.success && result.data) {
          const updatedProfile: StoredProfile = {
            ...result.data,
            createdAt:
              typeof result.data.createdAt === 'string'
                ? result.data.createdAt
                : result.data.createdAt.toISOString(),
            updatedAt:
              typeof result.data.updatedAt === 'string'
                ? result.data.updatedAt
                : result.data.updatedAt.toISOString(),
          };

          updateProfileInStore(id, updatedProfile);
          setIsEditing(false);
          return true;
        } else {
          console.error('Failed to update profile:', result.error);
          return false;
        }
      } catch (err) {
        console.error('Error updating profile:', err);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [
      updateProfileInStore,
      setIsEditing,
      setSaving,
      setValidationErrors,
      clearValidationErrors,
    ]
  );

  /**
   * Delete a profile
   */
  const deleteProfile = useCallback(
    async (id: string): Promise<boolean> => {
      setLoading(true);

      try {
        const result = await window.electronAPI.deleteProfile(id);

        if (result.success) {
          removeProfile(id);
          return true;
        } else {
          console.error('Failed to delete profile:', result.error);
          return false;
        }
      } catch (err) {
        console.error('Error deleting profile:', err);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [removeProfile, setLoading]
  );

  /**
   * Set a profile as default
   */
  const setDefaultProfile = useCallback(
    async (id: string): Promise<boolean> => {
      setSaving(true);

      try {
        const result = await window.electronAPI.setDefaultProfile(id);

        if (result.success) {
          // Update local state - set new default and remove from others
          profiles.forEach((p) => {
            if (p.id === id) {
              updateProfileInStore(p.id, { isDefault: true });
            } else if (p.isDefault) {
              updateProfileInStore(p.id, { isDefault: false });
            }
          });
          return true;
        } else {
          console.error('Failed to set default profile:', result.error);
          return false;
        }
      } catch (err) {
        console.error('Error setting default profile:', err);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [profiles, updateProfileInStore, setSaving]
  );

  /**
   * Validate form data
   */
  const validateForm = useCallback(
    (data: ProfileFormData): ProfileValidationErrors => {
      const errors = validateProfileData(data);
      setValidationErrors(errors);
      return errors;
    },
    [setValidationErrors]
  );

  /**
   * Get a profile by ID from local state
   */
  const getProfileById = useCallback(
    (id: string): StoredProfile | undefined => {
      return profiles.find((p) => p.id === id);
    },
    [profiles]
  );

  /**
   * Refresh profiles
   */
  const refresh = useCallback(async (): Promise<void> => {
    await loadProfiles();
  }, [loadProfiles]);

  /**
   * Load profiles on mount
   */
  useEffect(() => {
    loadProfiles();
  }, []); // Only run once on mount

  return {
    profiles,
    currentProfile,
    editingProfile,
    defaultProfile,
    isEditing,
    isLoading,
    isSaving,
    validationErrors,
    loadProfiles,
    createProfile,
    updateProfile,
    deleteProfile,
    setCurrentProfileId,
    setEditingProfileId,
    setIsEditing,
    setDefaultProfile,
    validateForm,
    clearValidationErrors,
    getProfileById,
    refresh,
  };
}

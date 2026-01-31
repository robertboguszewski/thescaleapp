/**
 * ProfileService
 *
 * Manages user profiles with validation and CRUD operations.
 * Uses birthYear for more accurate age calculation over time.
 *
 * @module application/services/ProfileService
 */

import crypto from 'crypto';
import type {
  ProfileRepository,
  StoredUserProfile,
} from '../ports/ProfileRepository';
import { calculateAgeFromBirthYear } from '../ports/ProfileRepository';
import {
  ProfileNotFoundError,
  ValidationError,
} from '../../domain/errors';

/**
 * Input for creating a new profile
 */
export interface CreateProfileInput {
  name: string;
  gender: 'male' | 'female';
  birthYear: number;
  /** Optional birth month for more accurate age calculation (1-12, 1=January) */
  birthMonth?: number;
  heightCm: number;
  ethnicity?: 'asian' | 'non-asian';
}

/**
 * Input for updating an existing profile
 */
export interface UpdateProfileInput {
  name?: string;
  gender?: 'male' | 'female';
  birthYear?: number;
  /** Optional birth month for more accurate age calculation (1-12, 1=January) */
  birthMonth?: number;
  heightCm?: number;
  ethnicity?: 'asian' | 'non-asian';
}

// Re-export errors for backward compatibility
export { ProfileNotFoundError, ValidationError };

/**
 * Get valid birth year range
 * - Minimum: 1900
 * - Maximum: currentYear - 5 (must be at least 5 years old)
 */
function getBirthYearRange(): { min: number; max: number } {
  const currentYear = new Date().getFullYear();
  return {
    min: 1900,
    max: currentYear - 5,
  };
}

/**
 * Validate profile input data
 */
function validateProfileData(
  data: CreateProfileInput | UpdateProfileInput,
  isPartial: boolean = false
): void {
  if (!isPartial || data.name !== undefined) {
    if (!data.name || (typeof data.name === 'string' && data.name.trim() === '')) {
      throw new ValidationError('Name is required and cannot be empty', 'name');
    }
  }

  if (!isPartial || data.gender !== undefined) {
    if (data.gender && !['male', 'female'].includes(data.gender)) {
      throw new ValidationError('Gender must be "male" or "female"', 'gender');
    }
  }

  if (!isPartial || data.birthYear !== undefined) {
    if (data.birthYear !== undefined) {
      const range = getBirthYearRange();
      if (
        typeof data.birthYear !== 'number' ||
        data.birthYear < range.min ||
        data.birthYear > range.max
      ) {
        throw new ValidationError(
          `Birth year must be between ${range.min} and ${range.max}`,
          'birthYear'
        );
      }
    }
  }

  // Validate birthMonth if provided (optional field, 1-12)
  if (data.birthMonth !== undefined) {
    if (
      typeof data.birthMonth !== 'number' ||
      !Number.isInteger(data.birthMonth) ||
      data.birthMonth < 1 ||
      data.birthMonth > 12
    ) {
      throw new ValidationError(
        'Birth month must be between 1 and 12',
        'birthMonth'
      );
    }
  }

  if (!isPartial || data.heightCm !== undefined) {
    if (data.heightCm !== undefined) {
      if (
        typeof data.heightCm !== 'number' ||
        data.heightCm < 50 ||
        data.heightCm > 250
      ) {
        throw new ValidationError(
          'Height must be between 50 and 250 cm',
          'heightCm'
        );
      }
    }
  }

  if (data.ethnicity !== undefined) {
    if (!['asian', 'non-asian'].includes(data.ethnicity)) {
      throw new ValidationError(
        'Ethnicity must be "asian" or "non-asian"',
        'ethnicity'
      );
    }
  }
}

/**
 * Service for managing user profiles
 */
export class ProfileService {
  constructor(private readonly profileRepository: ProfileRepository) {}

  /**
   * Create a new user profile
   *
   * @param data - Profile creation data
   * @returns The created profile
   * @throws ValidationError if data is invalid
   */
  async createProfile(data: CreateProfileInput): Promise<StoredUserProfile> {
    validateProfileData(data);

    const existingProfiles = await this.profileRepository.getAll();
    const isFirstProfile = existingProfiles.length === 0;

    const now = new Date();
    const profile: StoredUserProfile = {
      id: crypto.randomUUID(),
      name: data.name.trim(),
      gender: data.gender,
      birthYear: data.birthYear,
      birthMonth: data.birthMonth,
      heightCm: data.heightCm,
      ethnicity: data.ethnicity,
      isDefault: isFirstProfile,
      createdAt: now,
      updatedAt: now,
    };

    await this.profileRepository.save(profile);
    return profile;
  }

  /**
   * Update an existing profile
   *
   * @param id - Profile ID to update
   * @param data - Fields to update
   * @returns The updated profile
   * @throws ProfileNotFoundError if profile doesn't exist
   * @throws ValidationError if data is invalid
   */
  async updateProfile(
    id: string,
    data: UpdateProfileInput
  ): Promise<StoredUserProfile> {
    const existing = await this.profileRepository.getById(id);
    if (!existing) {
      throw new ProfileNotFoundError(id);
    }

    validateProfileData(data, true);

    const updated: StoredUserProfile = {
      ...existing,
      ...(data.name !== undefined && { name: data.name.trim() }),
      ...(data.gender !== undefined && { gender: data.gender }),
      ...(data.birthYear !== undefined && { birthYear: data.birthYear }),
      ...(data.birthMonth !== undefined && { birthMonth: data.birthMonth }),
      ...(data.heightCm !== undefined && { heightCm: data.heightCm }),
      ...(data.ethnicity !== undefined && { ethnicity: data.ethnicity }),
      updatedAt: new Date(),
    };

    await this.profileRepository.save(updated);
    return updated;
  }

  /**
   * Get a profile by ID
   */
  async getProfile(id: string): Promise<StoredUserProfile | null> {
    return this.profileRepository.getById(id);
  }

  /**
   * Get all profiles
   */
  async getAllProfiles(): Promise<StoredUserProfile[]> {
    return this.profileRepository.getAll();
  }

  /**
   * Delete a profile
   *
   * @param id - Profile ID to delete
   * @throws ProfileNotFoundError if profile doesn't exist
   */
  async deleteProfile(id: string): Promise<void> {
    const existing = await this.profileRepository.getById(id);
    if (!existing) {
      throw new ProfileNotFoundError(id);
    }
    await this.profileRepository.delete(id);
  }

  /**
   * Get the default profile
   */
  async getDefaultProfile(): Promise<StoredUserProfile | null> {
    return this.profileRepository.getDefault();
  }

  /**
   * Set a profile as the default
   *
   * @param id - Profile ID to set as default
   * @throws ProfileNotFoundError if profile doesn't exist
   */
  async setDefaultProfile(id: string): Promise<void> {
    const existing = await this.profileRepository.getById(id);
    if (!existing) {
      throw new ProfileNotFoundError(id);
    }
    await this.profileRepository.setDefault(id);
  }

  /**
   * Get the current age for a profile
   *
   * @param profileId - The profile ID
   * @returns Current age in years or null if profile not found
   */
  async getProfileAge(profileId: string): Promise<number | null> {
    const profile = await this.profileRepository.getById(profileId);
    if (!profile) {
      return null;
    }
    return calculateAgeFromBirthYear(profile.birthYear, profile.birthMonth);
  }
}

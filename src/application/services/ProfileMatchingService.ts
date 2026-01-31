/**
 * ProfileMatchingService
 *
 * Application service for detecting which user profile a measurement belongs to.
 * Uses domain logic for profile matching and coordinates with repositories.
 *
 * @module application/services/ProfileMatchingService
 */

import {
  detectProfile,
  type DetectionResult,
  type ProfileWeightData,
} from '../../domain/profile-matching';
import type { MeasurementRepository } from '../ports/MeasurementRepository';
import type {
  ProfileRepository,
  StoredUserProfile,
} from '../ports/ProfileRepository';

/**
 * Service for profile detection and matching based on weight measurements
 */
export class ProfileMatchingService {
  constructor(
    private readonly measurementRepository: MeasurementRepository,
    private readonly profileRepository: ProfileRepository
  ) {}

  /**
   * Detect which profile a new measurement belongs to
   *
   * Algorithm:
   * 1. Get all profiles from repository
   * 2. For each profile, fetch recent measurements and calculate average weight
   * 3. Use domain detection logic to find matching profile(s)
   *
   * @param weightKg - The measured weight in kilograms
   * @returns Detection result indicating matched profile, ambiguous candidates, or guest
   */
  async detectProfileForWeight(weightKg: number): Promise<DetectionResult> {
    const profiles = await this.profileRepository.getAll();

    // If no profiles exist, return no_match immediately
    if (profiles.length === 0) {
      return {
        type: 'no_match',
        confidence: 0,
        requiresConfirmation: true,
        reason: 'Brak zdefiniowanych profili',
      };
    }

    // Build weight data for each profile
    const profileWeightData: ProfileWeightData[] = await Promise.all(
      profiles.map(async (profile) => {
        const measurements = await this.measurementRepository.getAll({
          userProfileId: profile.id,
          limit: 10, // Last 10 measurements for average
        });

        if (measurements.length < 2) {
          return {
            profileId: profile.id,
            averageWeight: null,
            measurementCount: measurements.length,
          };
        }

        const avgWeight =
          measurements.reduce((sum, m) => sum + m.raw.weightKg, 0) /
          measurements.length;

        return {
          profileId: profile.id,
          averageWeight: avgWeight,
          measurementCount: measurements.length,
        };
      })
    );

    return detectProfile(weightKg, profileWeightData);
  }

  /**
   * Get profile names for display in selection UI
   *
   * @param profileIds - Array of profile IDs to look up
   * @returns Map of profile ID to display name
   */
  async getProfileNames(profileIds: string[]): Promise<Map<string, string>> {
    const names = new Map<string, string>();

    for (const id of profileIds) {
      const profile = await this.profileRepository.getById(id);
      if (profile) {
        names.set(id, profile.name);
      }
    }

    return names;
  }

  /**
   * Get full profile details for candidates
   *
   * @param profileIds - Array of profile IDs to look up
   * @returns Array of profiles (excludes not found)
   */
  async getProfileDetails(profileIds: string[]): Promise<StoredUserProfile[]> {
    const profiles: StoredUserProfile[] = [];

    for (const id of profileIds) {
      const profile = await this.profileRepository.getById(id);
      if (profile) {
        profiles.push(profile);
      }
    }

    return profiles;
  }

  /**
   * Get the average weight for a specific profile
   *
   * @param profileId - The profile ID
   * @param limit - Number of recent measurements to include (default: 10)
   * @returns Average weight in kg or null if insufficient data
   */
  async getProfileAverageWeight(
    profileId: string,
    limit: number = 10
  ): Promise<number | null> {
    const measurements = await this.measurementRepository.getAll({
      userProfileId: profileId,
      limit,
    });

    if (measurements.length < 2) {
      return null;
    }

    return (
      measurements.reduce((sum, m) => sum + m.raw.weightKg, 0) /
      measurements.length
    );
  }
}

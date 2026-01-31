/**
 * CaptureMeasurementUseCase
 *
 * CQRS Command: Captures a new measurement from the scale and generates health recommendations.
 *
 * Flow:
 * 1. Capture measurement via MeasurementService (handles BLE reading, calculations, storage)
 * 2. Retrieve user profile for recommendation context
 * 3. Generate personalized health recommendations based on calculated metrics
 *
 * @module application/use-cases/CaptureMeasurementUseCase
 */

import type { MeasurementService } from '../services/MeasurementService';
import type { ProfileRepository, StoredUserProfile } from '../ports/ProfileRepository';
import { calculateAgeFromBirthYear } from '../ports/ProfileRepository';
import type { MeasurementResult } from '../ports/MeasurementRepository';
import { generateRecommendations } from '../../domain/calculations/health-assessment';
import type { HealthRecommendation } from '../../domain/calculations/health-assessment/recommendations';
import { ProfileNotFoundError } from '../../domain/errors';

/**
 * Input for capturing a measurement
 */
export interface CaptureMeasurementInput {
  /** The profile ID to associate with the measurement */
  profileId: string;
}

/**
 * Output from capturing a measurement
 */
export interface CaptureMeasurementOutput {
  /** The complete measurement result with raw and calculated metrics */
  measurement: MeasurementResult;
  /** Personalized health recommendations based on the measurement */
  recommendations: HealthRecommendation[];
}

// Re-export for backward compatibility
export { ProfileNotFoundError };

/**
 * Use case for capturing a body composition measurement
 *
 * This is a CQRS command that orchestrates the measurement capture flow
 * and enriches the result with health recommendations.
 */
export class CaptureMeasurementUseCase {
  constructor(
    private readonly measurementService: MeasurementService,
    private readonly profileRepository: ProfileRepository
  ) {}

  /**
   * Execute the use case
   *
   * @param input - The input containing the profile ID
   * @returns The measurement result with recommendations
   * @throws ProfileNotFoundError if profile doesn't exist
   * @throws MeasurementReadError if BLE reading fails (from MeasurementService)
   */
  async execute(input: CaptureMeasurementInput): Promise<CaptureMeasurementOutput> {
    // 1. Capture measurement (handles BLE reading, calculations, and storage)
    const measurement = await this.measurementService.captureMeasurement(input.profileId);

    // 2. Get profile for recommendations context
    const profile = await this.profileRepository.getById(input.profileId);

    // Profile should exist since captureMeasurement succeeded, but check anyway
    if (!profile) {
      throw new ProfileNotFoundError(input.profileId);
    }

    // 3. Generate personalized recommendations based on calculated metrics
    const age = calculateAgeFromBirthYear(profile.birthYear, profile.birthMonth);
    const recommendations = generateRecommendations(measurement.calculated, {
      gender: profile.gender,
      age,
      heightCm: profile.heightCm,
      ethnicity: profile.ethnicity,
    });

    return {
      measurement,
      recommendations,
    };
  }
}

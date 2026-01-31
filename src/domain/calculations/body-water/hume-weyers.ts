/**
 * Hume-Weyers Body Water Formula
 *
 * @module domain/calculations/body-water/hume-weyers
 *
 * Reference: Hume R, Weyers E (1971)
 * "Relationship between total body water and surface area in normal
 * and obese subjects"
 * Journal of Clinical Pathology 24(3):234-238
 * DOI: 10.1136/jcp.24.3.234
 *
 * This formula estimates Total Body Water (TBW) based on height and weight,
 * with different coefficients for males and females due to differences
 * in body composition.
 *
 * Normal body water content:
 * - Males: 50-65% of total body weight
 * - Females: 45-60% of total body weight
 *
 * Factors affecting body water:
 * - Muscle tissue contains ~75% water
 * - Fat tissue contains ~10% water
 * - Therefore, leaner individuals have higher body water percentage
 */

import type { ResolvedUserProfile, RawMeasurement } from '../types';

/**
 * Calculate Total Body Water in liters using Hume-Weyers equation
 *
 * Formula:
 * Male:   TBW (L) = 0.194786 x height (cm) + 0.296785 x weight (kg) - 14.012934
 * Female: TBW (L) = 0.344547 x height (cm) + 0.183809 x weight (kg) - 35.270121
 *
 * @pure - No side effects, no external dependencies
 * @param profile - Resolved user profile with gender and height
 * @param measurement - Raw measurement with weight
 * @returns Total Body Water in liters
 *
 * @example
 * const profile = { gender: 'male', age: 35, heightCm: 178 };
 * const measurement = { weightKg: 75 };
 * const tbw = calculateBodyWaterLiters(profile, measurement);
 * // Returns approximately 42.9 liters
 */
export function calculateBodyWaterLiters(
  profile: ResolvedUserProfile,
  measurement: RawMeasurement
): number {
  if (profile.gender === 'male') {
    return (0.194786 * profile.heightCm) +
           (0.296785 * measurement.weightKg) -
           14.012934;
  } else {
    return (0.344547 * profile.heightCm) +
           (0.183809 * measurement.weightKg) -
           35.270121;
  }
}

/**
 * Calculate Body Water as percentage of total body weight
 *
 * @pure - No side effects, no external dependencies
 * @param profile - Resolved user profile with gender and height
 * @param measurement - Raw measurement with weight
 * @returns Body water percentage (0-100 scale)
 *
 * @example
 * const profile = { gender: 'male', age: 35, heightCm: 178 };
 * const measurement = { weightKg: 75 };
 * const waterPercent = calculateBodyWaterHumeWeyers(profile, measurement);
 * // Returns approximately 57.22%
 */
export function calculateBodyWaterHumeWeyers(
  profile: ResolvedUserProfile,
  measurement: RawMeasurement
): number {
  const totalWaterLiters = calculateBodyWaterLiters(profile, measurement);
  return (totalWaterLiters / measurement.weightKg) * 100;
}

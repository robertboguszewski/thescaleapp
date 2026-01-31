/**
 * Harris-Benedict BMR Formula (Revised 1984)
 *
 * @module domain/calculations/bmr/harris-benedict
 *
 * Original Reference: Harris JA, Benedict FG (1918)
 * "A Biometric Study of Human Basal Metabolism"
 * Carnegie Institution of Washington, Publication No. 279
 *
 * Revised by: Roza AM, Shizgal HM (1984)
 * "The Harris Benedict equation reevaluated: resting energy requirements
 * and the body cell mass"
 * American Journal of Clinical Nutrition 40(1):168-182
 * DOI: 10.1093/ajcn/40.1.168
 *
 * This formula was the standard before Mifflin-St Jeor and is still
 * widely used. The revised (1984) coefficients are used here as they
 * are more accurate for modern populations.
 */

import type { ResolvedUserProfile, RawMeasurement } from '../types';

/**
 * Calculate Basal Metabolic Rate using Harris-Benedict equation (Revised 1984)
 *
 * Formula:
 * Male:   BMR = 88.362 + (13.397 x weight kg) + (4.799 x height cm) - (5.677 x age)
 * Female: BMR = 447.593 + (9.247 x weight kg) + (3.098 x height cm) - (4.330 x age)
 *
 * @pure - No side effects, no external dependencies
 * @param profile - Resolved user profile with gender, age, and height
 * @param measurement - Raw measurement with weight
 * @returns BMR in kcal/day
 *
 * @example
 * const profile = { gender: 'male', age: 35, heightCm: 178 };
 * const measurement = { weightKg: 75 };
 * const bmr = calculateBMR_HarrisBenedict(profile, measurement);
 * // Returns approximately 1748.66 kcal/day
 */
export function calculateBMR_HarrisBenedict(
  profile: ResolvedUserProfile,
  measurement: RawMeasurement
): number {
  if (profile.gender === 'male') {
    return 88.362 +
           (13.397 * measurement.weightKg) +
           (4.799 * profile.heightCm) -
           (5.677 * profile.age);
  } else {
    return 447.593 +
           (9.247 * measurement.weightKg) +
           (3.098 * profile.heightCm) -
           (4.330 * profile.age);
  }
}

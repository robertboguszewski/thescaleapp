/**
 * Mifflin-St Jeor BMR Formula
 *
 * @module domain/calculations/bmr/mifflin-st-jeor
 *
 * Reference: Mifflin MD, St Jeor ST, Hill LA, Scott BJ, Daugherty SA, Koh YO (1990)
 * "A new predictive equation for resting energy expenditure in healthy individuals"
 * American Journal of Clinical Nutrition 51(2):241-247
 * DOI: 10.1093/ajcn/51.2.241
 *
 * This formula is considered the most accurate for the general population
 * and is recommended by the Academy of Nutrition and Dietetics.
 */

import type { ResolvedUserProfile, RawMeasurement } from '../types';

/**
 * Calculate Basal Metabolic Rate using Mifflin-St Jeor equation
 *
 * Formula:
 * Male:   BMR = (10 x weight kg) + (6.25 x height cm) - (5 x age years) + 5
 * Female: BMR = (10 x weight kg) + (6.25 x height cm) - (5 x age years) - 161
 *
 * @pure - No side effects, no external dependencies
 * @param profile - Resolved user profile with gender, age, and height
 * @param measurement - Raw measurement with weight
 * @returns BMR in kcal/day
 *
 * @example
 * const profile = { gender: 'male', age: 35, heightCm: 178 };
 * const measurement = { weightKg: 75 };
 * const bmr = calculateBMR_MifflinStJeor(profile, measurement);
 * // Returns approximately 1692.5 kcal/day
 */
export function calculateBMR_MifflinStJeor(
  profile: ResolvedUserProfile,
  measurement: RawMeasurement
): number {
  const base = (10 * measurement.weightKg) +
               (6.25 * profile.heightCm) -
               (5 * profile.age);

  return profile.gender === 'male' ? base + 5 : base - 161;
}

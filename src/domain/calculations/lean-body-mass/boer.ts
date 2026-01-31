/**
 * Boer Lean Body Mass Formula
 *
 * @module domain/calculations/lean-body-mass/boer
 *
 * Reference: Boer P (1984)
 * "Estimated lean body mass as an index for normalization of body fluid
 * volumes in humans"
 * American Journal of Physiology 247(4 Pt 2):F632-F636
 * DOI: 10.1152/ajprenal.1984.247.4.F632
 *
 * Lean Body Mass (LBM) = Total Body Weight - Fat Mass
 * Also known as Fat-Free Mass (FFM)
 *
 * Components of LBM:
 * - Muscle mass (~45% of LBM)
 * - Bone mass (~15% of LBM)
 * - Organs (~25% of LBM)
 * - Blood, skin, connective tissue (~15% of LBM)
 *
 * Typical LBM as percentage of total weight:
 * - Athletic males: 80-90%
 * - Average males: 75-85%
 * - Athletic females: 75-85%
 * - Average females: 70-80%
 */

import type { ResolvedUserProfile, RawMeasurement } from '../types';

/**
 * Calculate Lean Body Mass using Boer formula
 *
 * Formula:
 * Male:   LBM = (0.407 x weight kg) + (0.267 x height cm) - 19.2
 * Female: LBM = (0.252 x weight kg) + (0.473 x height cm) - 48.3
 *
 * @pure - No side effects, no external dependencies
 * @param profile - Resolved user profile with gender and height
 * @param measurement - Raw measurement with weight
 * @returns Lean Body Mass in kilograms
 *
 * @example
 * const profile = { gender: 'male', age: 35, heightCm: 178 };
 * const measurement = { weightKg: 75 };
 * const lbm = calculateLBM_Boer(profile, measurement);
 * // Returns approximately 58.85 kg
 */
export function calculateLBM_Boer(
  profile: ResolvedUserProfile,
  measurement: RawMeasurement
): number {
  if (profile.gender === 'male') {
    return (0.407 * measurement.weightKg) +
           (0.267 * profile.heightCm) -
           19.2;
  } else {
    return (0.252 * measurement.weightKg) +
           (0.473 * profile.heightCm) -
           48.3;
  }
}

/**
 * Calculate Lean Body Mass from body fat percentage (direct method)
 *
 * Formula: LBM = weight x (1 - bodyFatPercent/100)
 *
 * This is the most accurate method when body fat percentage is known
 * from bioelectrical impedance or other measurement.
 *
 * @pure - No side effects, no external dependencies
 * @param measurement - Raw measurement with weight
 * @param bodyFatPercent - Body fat percentage (0-100 scale)
 * @returns Lean Body Mass in kilograms
 *
 * @example
 * const measurement = { weightKg: 80 };
 * const bodyFatPercent = 20;
 * const lbm = calculateLBM_FromBodyFat(measurement, bodyFatPercent);
 * // Returns 64 kg (80 * 0.80)
 */
export function calculateLBM_FromBodyFat(
  measurement: RawMeasurement,
  bodyFatPercent: number
): number {
  return measurement.weightKg * (1 - bodyFatPercent / 100);
}

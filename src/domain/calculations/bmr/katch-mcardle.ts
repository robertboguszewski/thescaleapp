/**
 * Katch-McArdle BMR Formula
 *
 * @module domain/calculations/bmr/katch-mcardle
 *
 * Reference: Katch F, McArdle WD (1973)
 * "Prediction of Body Density from Simple Anthropometric Measurements
 * in College-age Women"
 * Journal of Applied Physiology 35(6):801-804
 * DOI: 10.1152/jappl.1973.35.6.801
 *
 * Also known as the Cunningham equation in some literature.
 * This formula is considered more accurate than Mifflin-St Jeor or
 * Harris-Benedict for athletes and people with non-typical body composition
 * because it accounts for lean body mass directly.
 *
 * The formula is gender-neutral since it uses LBM, which already
 * accounts for gender differences in body composition.
 */

import type { RawMeasurement } from '../types';

/**
 * Calculate Basal Metabolic Rate using Katch-McArdle equation
 *
 * Formula: BMR = 370 + (21.6 x LBM)
 * where LBM (Lean Body Mass) = weight x (1 - bodyFatPercent/100)
 *
 * @pure - No side effects, no external dependencies
 * @param measurement - Raw measurement with weight
 * @param bodyFatPercent - Body fat percentage (0-100 scale)
 * @returns BMR in kcal/day
 *
 * @example
 * const measurement = { weightKg: 75 };
 * const bodyFatPercent = 12;
 * const bmr = calculateBMR_KatchMcArdle(measurement, bodyFatPercent);
 * // LBM = 75 * 0.88 = 66 kg
 * // BMR = 370 + (21.6 * 66) = 1795.6 kcal/day
 */
export function calculateBMR_KatchMcArdle(
  measurement: RawMeasurement,
  bodyFatPercent: number
): number {
  // Calculate Lean Body Mass (LBM)
  const lbm = measurement.weightKg * (1 - bodyFatPercent / 100);

  // Katch-McArdle formula
  return 370 + (21.6 * lbm);
}

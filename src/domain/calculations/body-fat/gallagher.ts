/**
 * Gallagher Body Fat Percentage Formula
 *
 * This module implements the Gallagher et al. equation for estimating body fat
 * percentage. This formula is notable for including ethnicity as a variable,
 * recognizing that different ethnic groups have different body fat distributions
 * at the same BMI.
 *
 * @module domain/calculations/body-fat/gallagher
 *
 * @remarks
 * The Gallagher formula was developed from a study comparing four-compartment
 * body composition models across different ethnic groups. It accounts for the
 * observation that Asian populations tend to have higher body fat percentages
 * at equivalent BMI values compared to Caucasian/African-American populations.
 *
 * Key findings from the research:
 * - Asians have 3-5% higher body fat at same BMI compared to Caucasians
 * - The relationship between BMI and body fat is not linear
 * - Age and sex significantly affect body fat at any given BMI
 *
 * Note on implementation:
 * The original Gallagher formula uses a complex coefficient structure.
 * This implementation uses a simplified version that captures the key
 * ethnicity adjustment while remaining practical for consumer applications.
 *
 * @see Gallagher D, Heymsfield SB, Heo M, Jebb SA, Murgatroyd PR, Sakamoto Y.
 *      Healthy percentage body fat ranges: an approach for developing guidelines
 *      based on body mass index. Am J Clin Nutr. 2000 Sep;72(3):694-701.
 *      doi: 10.1093/ajcn/72.3.694. PMID: 10966886
 */

import type { ResolvedUserProfile, RawMeasurement } from '../types';
import { calculateBMI } from '../bmi';

/**
 * Validates input parameters for Gallagher formula.
 *
 * @param profile - Resolved user profile with demographic data
 * @param measurement - Raw measurement with weight
 * @throws {Error} If any parameter is invalid
 */
function validateInputs(profile: ResolvedUserProfile, measurement: RawMeasurement): void {
  // Validate weight
  if (measurement.weightKg <= 0 || Number.isNaN(measurement.weightKg)) {
    throw new Error('Weight must be a positive number');
  }

  // Validate height
  if (profile.heightCm <= 0 || Number.isNaN(profile.heightCm)) {
    throw new Error('Height must be a positive number');
  }

  // Validate age
  if (profile.age <= 0 || Number.isNaN(profile.age)) {
    throw new Error('Age must be a positive number');
  }
}

/**
 * Calculates body fat percentage using the Gallagher et al. 2000 formula.
 *
 * This formula accounts for ethnicity differences in body fat distribution,
 * recognizing that Asian populations typically have higher body fat at the
 * same BMI compared to non-Asian populations.
 *
 * Simplified formula based on Gallagher et al. research:
 * For non-Asian:
 *   Men: BF% = (1.20 * BMI) + (0.23 * age) - 16.2
 *   Women: BF% = (1.20 * BMI) + (0.23 * age) - 5.4
 *
 * For Asian (adds ~3-4% to account for ethnic differences):
 *   Men: BF% = (1.20 * BMI) + (0.23 * age) - 12.2
 *   Women: BF% = (1.20 * BMI) + (0.23 * age) - 1.4
 *
 * The ethnicity adjustment of ~4% is based on the findings in the original
 * Gallagher paper showing Asian populations have approximately 3-5% higher
 * body fat at equivalent BMI values.
 *
 * @citation
 * Gallagher D, Heymsfield SB, Heo M, Jebb SA, Murgatroyd PR, Sakamoto Y.
 * Healthy percentage body fat ranges: an approach for developing guidelines
 * based on body mass index. Am J Clin Nutr. 2000 Sep;72(3):694-701.
 * doi: 10.1093/ajcn/72.3.694. PMID: 10966886
 *
 * @param profile - Resolved user profile containing gender, age, height, and optionally ethnicity
 * @param measurement - Raw measurement containing weight
 * @returns Estimated body fat percentage (rounded to 1 decimal place)
 * @throws {Error} If age is not a positive number
 * @throws {Error} If weight or height is not positive
 *
 * @remarks
 * When ethnicity is not specified, the formula defaults to 'non-asian'.
 * This is the most conservative assumption and avoids overestimation
 * for the majority of global populations.
 *
 * @example
 * ```typescript
 * // Non-Asian male
 * const profile1 = { gender: 'male', age: 35, heightCm: 175, ethnicity: 'non-asian' };
 * const bodyFat1 = calculateBodyFatGallagher(profile1, { weightKg: 75 });
 *
 * // Asian female
 * const profile2 = { gender: 'female', age: 30, heightCm: 160, ethnicity: 'asian' };
 * const bodyFat2 = calculateBodyFatGallagher(profile2, { weightKg: 55 });
 * ```
 *
 * @pure This function has no side effects and always returns the same
 *       output for the same inputs.
 */
export function calculateBodyFatGallagher(
  profile: ResolvedUserProfile,
  measurement: RawMeasurement
): number {
  // Validate inputs
  validateInputs(profile, measurement);

  // Calculate BMI
  const bmi = calculateBMI(measurement.weightKg, profile.heightCm);

  // Determine intercept based on gender and ethnicity
  // Base formula: BF% = (1.20 * BMI) + (0.23 * age) + intercept
  // Gender difference: ~10.8% (women have higher body fat)
  // Ethnicity adjustment: ~4% (Asian populations have higher body fat at same BMI)
  let intercept: number;

  if (profile.gender === 'male') {
    // Male baseline intercept
    intercept = profile.ethnicity === 'asian' ? -12.2 : -16.2;
  } else {
    // Female baseline intercept
    intercept = profile.ethnicity === 'asian' ? -1.4 : -5.4;
  }

  // Calculate body fat percentage
  const bodyFatPercent = 1.2 * bmi + 0.23 * profile.age + intercept;

  // Ensure result is not negative (can happen with very low BMI young males)
  const clampedResult = Math.max(bodyFatPercent, 2.0);

  // Round to 1 decimal place
  return Math.round(clampedResult * 10) / 10;
}

/**
 * Gets formula metadata for documentation and display purposes.
 *
 * @returns Object containing formula details and citation
 */
export function getGallagherFormulaInfo(): {
  name: string;
  year: number;
  equation: string;
  citation: string;
  features: string[];
  limitations: string[];
} {
  return {
    name: 'Gallagher 2000 (Simplified)',
    year: 2000,
    equation:
      'BF% = (1.20 x BMI) + (0.23 x age) + intercept (gender/ethnicity dependent)',
    citation:
      'Gallagher D, et al. Am J Clin Nutr. 2000;72(3):694-701. PMID: 10966886',
    features: [
      'Accounts for ethnicity differences (Asian vs non-Asian)',
      'Based on four-compartment body composition model',
      'Validated across multiple ethnic groups',
      'Includes gender-specific adjustments',
    ],
    limitations: [
      'May not be accurate for highly athletic individuals',
      'Limited to Asian vs non-Asian distinction',
      'Based on US and UK populations primarily',
      'BMI-based, does not use impedance data',
    ],
  };
}

/**
 * Explains the ethnicity adjustment in the Gallagher formula.
 *
 * @returns Educational text about why ethnicity matters
 */
export function getEthnicityAdjustmentExplanation(): string {
  return `
The Gallagher formula includes an ethnicity adjustment because research has shown
that Asian populations tend to have higher body fat percentages at equivalent BMI
values compared to Caucasian and African-American populations.

This difference is attributed to:
1. Different body fat distribution patterns
2. Smaller frame sizes on average
3. Different proportions of trunk vs. extremity fat

At the same BMI of 25 kg/m2, for example:
- An Asian individual might have approximately 3-5% more body fat
- This means health risks associated with excess body fat may begin at lower BMI values

The World Health Organization recognizes this and suggests lower BMI cutoffs
for overweight and obesity classifications in Asian populations.

References:
- Gallagher D, et al. Am J Clin Nutr. 2000;72(3):694-701
- WHO Expert Consultation. Lancet. 2004;363(9403):157-163
`.trim();
}

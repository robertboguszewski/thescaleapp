/**
 * Deurenberg Body Fat Percentage Formulas
 *
 * This module implements the Deurenberg equations for estimating body fat
 * percentage from BMI, age, and gender. These are widely validated formulas
 * published in peer-reviewed journals.
 *
 * @module domain/calculations/body-fat/deurenberg
 *
 * @remarks
 * The Deurenberg formulas are BMI-based predictive equations for body fat.
 * They do not require bioelectrical impedance and can estimate body fat
 * from basic anthropometric measurements.
 *
 * Limitations:
 * - Validated for ages 7-80 years
 * - May underestimate body fat in athletes
 * - May overestimate body fat in elderly
 * - Does not account for ethnicity differences
 *
 * @see Deurenberg P, Weststrate JA, Seidell JC. Body mass index as a measure
 *      of body fatness: age- and sex-specific prediction formulas.
 *      Br J Nutr. 1991 Mar;65(2):105-14. doi: 10.1079/bjn19910073
 *
 * @see Deurenberg P, Yap M, van Staveren WA. Body mass index and percent body
 *      fat: a meta analysis among different ethnic groups.
 *      Int J Obes Relat Metab Disord. 1998 Dec;22(12):1164-71.
 */

import type { ResolvedUserProfile, RawMeasurement } from '../types';
import { calculateBMI } from '../bmi';

/**
 * Valid age range for Deurenberg formulas.
 * The formulas were validated for subjects aged 7-80 years.
 */
const DEURENBERG_AGE_RANGE = {
  min: 7,
  max: 80,
} as const;

/**
 * Validates input parameters for Deurenberg calculations.
 *
 * @param profile - User profile with gender, age, and height
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

  // Validate age range for Deurenberg formula
  if (
    profile.age < DEURENBERG_AGE_RANGE.min ||
    profile.age > DEURENBERG_AGE_RANGE.max
  ) {
    throw new Error(
      `Age must be between ${DEURENBERG_AGE_RANGE.min} and ${DEURENBERG_AGE_RANGE.max} for Deurenberg formula`
    );
  }
}

/**
 * Calculates body fat percentage using the Deurenberg 1991 formula.
 *
 * Formula:
 * ```
 * Body Fat % = (1.20 x BMI) + (0.23 x age) - (10.8 x sex) - 5.4
 * ```
 * where sex = 1 for males, 0 for females
 *
 * This formula was developed from a study of 1,229 subjects and has
 * a standard error of estimate (SEE) of 4.0% for body fat.
 *
 * @citation
 * Deurenberg P, Weststrate JA, Seidell JC. Body mass index as a measure
 * of body fatness: age- and sex-specific prediction formulas.
 * Br J Nutr. 1991 Mar;65(2):105-14. doi: 10.1079/bjn19910073
 * PMID: 2043597
 *
 * @param profile - Resolved user profile containing gender, age, and height
 * @param measurement - Raw measurement containing weight
 * @returns Estimated body fat percentage (rounded to 1 decimal place)
 * @throws {Error} If age is outside valid range (7-80 years)
 * @throws {Error} If weight or height is not positive
 *
 * @example
 * ```typescript
 * const profile = { gender: 'male', age: 35, heightCm: 175 };
 * const measurement = { weightKg: 75 };
 * const bodyFat = calculateBodyFatDeurenberg1991(profile, measurement);
 * // Returns ~21.2%
 * ```
 *
 * @pure This function has no side effects and always returns the same
 *       output for the same inputs.
 */
export function calculateBodyFatDeurenberg1991(
  profile: ResolvedUserProfile,
  measurement: RawMeasurement
): number {
  // Validate inputs
  validateInputs(profile, measurement);

  // Calculate BMI
  const bmi = calculateBMI(measurement.weightKg, profile.heightCm);

  // Sex coefficient: 1 for male, 0 for female
  const sexCoefficient = profile.gender === 'male' ? 1 : 0;

  // Deurenberg 1991 formula:
  // BF% = (1.20 x BMI) + (0.23 x age) - (10.8 x sex) - 5.4
  const bodyFatPercent =
    1.2 * bmi + 0.23 * profile.age - 10.8 * sexCoefficient - 5.4;

  // Round to 1 decimal place
  return Math.round(bodyFatPercent * 10) / 10;
}

/**
 * Calculates body fat percentage using the Deurenberg 1992 corrected formula.
 *
 * Formula:
 * ```
 * Body Fat % = (1.29 x BMI) + (0.20 x age) - (11.4 x sex) - 8.0
 * ```
 * where sex = 1 for males, 0 for females
 *
 * This is a refined version of the 1991 formula with adjusted coefficients
 * based on additional validation studies.
 *
 * @citation
 * Deurenberg P, van der Kooy K, Leenen R, Weststrate JA, Seidell JC.
 * Sex and age specific prediction formulas for estimating body composition
 * from bioelectrical impedance: a cross-validation study.
 * Int J Obes. 1991 Jan;15(1):17-25.
 * PMID: 2010255
 *
 * @param profile - Resolved user profile containing gender, age, and height
 * @param measurement - Raw measurement containing weight
 * @returns Estimated body fat percentage (rounded to 1 decimal place)
 * @throws {Error} If age is outside valid range (7-80 years)
 * @throws {Error} If weight or height is not positive
 *
 * @example
 * ```typescript
 * const profile = { gender: 'female', age: 35, heightCm: 165 };
 * const measurement = { weightKg: 60 };
 * const bodyFat = calculateBodyFatDeurenberg1992(profile, measurement);
 * // Returns ~27.4%
 * ```
 *
 * @pure This function has no side effects and always returns the same
 *       output for the same inputs.
 */
export function calculateBodyFatDeurenberg1992(
  profile: ResolvedUserProfile,
  measurement: RawMeasurement
): number {
  // Validate inputs
  validateInputs(profile, measurement);

  // Calculate BMI
  const bmi = calculateBMI(measurement.weightKg, profile.heightCm);

  // Sex coefficient: 1 for male, 0 for female
  const sexCoefficient = profile.gender === 'male' ? 1 : 0;

  // Deurenberg 1992 corrected formula:
  // BF% = (1.29 x BMI) + (0.20 x age) - (11.4 x sex) - 8.0
  const bodyFatPercent =
    1.29 * bmi + 0.2 * profile.age - 11.4 * sexCoefficient - 8.0;

  // Round to 1 decimal place
  return Math.round(bodyFatPercent * 10) / 10;
}

/**
 * Gets formula metadata for documentation and display purposes.
 *
 * @param formula - Which Deurenberg formula variant
 * @returns Object containing formula details and citation
 */
export function getDeurenbergFormulaInfo(
  formula: 'deurenberg1991' | 'deurenberg1992'
): {
  name: string;
  year: number;
  equation: string;
  citation: string;
  validAgeRange: { min: number; max: number };
  standardError: string;
} {
  if (formula === 'deurenberg1991') {
    return {
      name: 'Deurenberg 1991',
      year: 1991,
      equation: 'BF% = (1.20 x BMI) + (0.23 x age) - (10.8 x sex) - 5.4',
      citation:
        'Deurenberg P, Weststrate JA, Seidell JC. Br J Nutr. 1991;65(2):105-14',
      validAgeRange: { ...DEURENBERG_AGE_RANGE },
      standardError: '4.0%',
    };
  }

  return {
    name: 'Deurenberg 1992',
    year: 1992,
    equation: 'BF% = (1.29 x BMI) + (0.20 x age) - (11.4 x sex) - 8.0',
    citation:
      'Deurenberg P, van der Kooy K, et al. Int J Obes. 1991;15(1):17-25',
    validAgeRange: { ...DEURENBERG_AGE_RANGE },
    standardError: '3.8%',
  };
}

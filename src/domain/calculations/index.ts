/**
 * Body Composition Calculations - Main Entry Point
 *
 * Aggregates all calculation modules and provides the main calculateAllMetrics function.
 *
 * @module domain/calculations
 *
 * This module follows Clean Architecture principles:
 * - All functions are PURE (no side effects)
 * - Zero external dependencies
 * - 100% testable
 */

import type {
  UserProfile,
  ResolvedUserProfile,
  RawMeasurement,
  CalculatedMetrics,
  FormulaConfig
} from './types';

import { calculateBMI } from './bmi';
import { calculateBMR_MifflinStJeor, calculateBMR_KatchMcArdle } from './bmr';
import { calculateBodyFatDeurenberg1992, calculateBodyFatGallagher } from './body-fat';
import { calculateBodyWaterHumeWeyers } from './body-water';
import { calculateLBM_Boer } from './lean-body-mass';
import { estimateVisceralFat } from './visceral-fat';
import { calculateBodyScore } from './health-assessment';
import { calculateAge, isValidBirthYear, getValidBirthYearRange } from './age-calculator';

// Re-export all types
export * from './types';

// Re-export individual modules
export * from './bmi';
export * from './bmr';
export * from './body-fat';
export * from './body-water';
export * from './lean-body-mass';
export * from './visceral-fat';
export * from './health-assessment';
export * from './constants';

// Re-export age calculator functions
export { calculateAge, isValidBirthYear, getValidBirthYearRange } from './age-calculator';

/**
 * Default formula configuration
 */
export const DEFAULT_FORMULA_CONFIG: FormulaConfig = {
  bodyFat: 'deurenberg1992',
  bodyWater: 'hume-weyers',
  leanBodyMass: 'boer',
  bmr: 'mifflin-st-jeor'
};

/**
 * Round a number to specified decimal places
 */
function round(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/**
 * Resolve age from UserProfile
 *
 * Supports both legacy `age` field and new `birthYear` field.
 * Priority: birthYear (if valid) > age (if provided)
 *
 * @param profile - User profile with either birthYear or age
 * @returns Resolved age in years
 * @throws Error if neither birthYear nor age is provided/valid
 */
export function resolveAge(profile: UserProfile): number {
  // Prefer birthYear if provided and valid
  if (profile.birthYear !== undefined && isValidBirthYear(profile.birthYear)) {
    return calculateAge(profile.birthYear);
  }

  // Fall back to legacy age field
  if (profile.age !== undefined && profile.age >= 6 && profile.age <= 120) {
    return profile.age;
  }

  throw new Error('Either valid birthYear or age must be provided');
}

/**
 * Convert UserProfile to ResolvedUserProfile with calculated age
 *
 * @param profile - User profile with either birthYear or age
 * @returns Profile with resolved age for calculations
 */
export function resolveProfile(profile: UserProfile): ResolvedUserProfile {
  return {
    gender: profile.gender,
    age: resolveAge(profile),
    heightCm: profile.heightCm,
    ethnicity: profile.ethnicity,
  };
}

/**
 * Calculate all body composition metrics from raw measurement data
 *
 * This is the main entry point for all body composition calculations.
 * It orchestrates all individual calculation modules and returns
 * a complete set of metrics.
 *
 * @pure - No side effects, no external dependencies
 * @param profile - User profile (gender, birthYear or age, height)
 * @param measurement - Raw measurement data (weight, impedance)
 * @param config - Optional formula configuration
 * @returns All calculated body composition metrics
 *
 * @example
 * ```typescript
 * // Using birthYear (preferred)
 * const profile = { gender: 'male', birthYear: 1990, heightCm: 178 };
 * const measurement = { weightKg: 75, impedanceOhm: 485 };
 * const metrics = calculateAllMetrics(profile, measurement);
 * console.log(metrics.bodyFatPercent); // 18.5
 *
 * // Legacy: using age directly
 * const legacyProfile = { gender: 'male', age: 35, heightCm: 178 };
 * const metrics2 = calculateAllMetrics(legacyProfile, measurement);
 * ```
 */
export function calculateAllMetrics(
  profile: UserProfile,
  measurement: RawMeasurement,
  config: Partial<FormulaConfig> = {}
): CalculatedMetrics {
  const finalConfig = { ...DEFAULT_FORMULA_CONFIG, ...config };

  // Resolve profile to get age (from birthYear or legacy age field)
  const resolvedProfile = resolveProfile(profile);

  // 1. Calculate BMI (always the same formula)
  const bmi = calculateBMI(measurement.weightKg, profile.heightCm);

  // 2. Calculate Body Fat % based on selected formula
  let bodyFatPercent: number;
  switch (finalConfig.bodyFat) {
    case 'gallagher':
      bodyFatPercent = calculateBodyFatGallagher(resolvedProfile, measurement);
      break;
    case 'deurenberg1992':
    default:
      bodyFatPercent = calculateBodyFatDeurenberg1992(resolvedProfile, measurement);
  }
  // Clamp to realistic range
  bodyFatPercent = Math.max(3, Math.min(60, bodyFatPercent));

  // 3. Calculate Lean Body Mass
  const leanBodyMassKg = calculateLBM_Boer(resolvedProfile, measurement);

  // 4. Calculate Muscle Mass (approximately 75% of LBM)
  const muscleMassKg = leanBodyMassKg * 0.75;

  // 5. Calculate Body Water
  const bodyWaterPercent = calculateBodyWaterHumeWeyers(resolvedProfile, measurement);

  // 6. Calculate Bone Mass (approximately 3-4% of LBM based on gender)
  const boneRatio = resolvedProfile.gender === 'male' ? 0.04 : 0.03;
  const boneMassKg = leanBodyMassKg * boneRatio;

  // 7. Calculate BMR based on selected formula
  let bmrKcal: number;
  if (finalConfig.bmr === 'katch-mcardle') {
    bmrKcal = calculateBMR_KatchMcArdle(measurement, bodyFatPercent);
  } else {
    bmrKcal = calculateBMR_MifflinStJeor(resolvedProfile, measurement);
  }

  // 8. Estimate Visceral Fat
  const visceralFatLevel = estimateVisceralFat(resolvedProfile, bmi);

  // 9. Estimate Protein % (approximately 22% of muscle mass percentage)
  const musclePercent = (muscleMassKg / measurement.weightKg) * 100;
  const proteinPercent = musclePercent * 0.22;

  // 10. Calculate Body Score
  const bodyScore = calculateBodyScore(
    {
      bmi,
      bodyFatPercent,
      visceralFatLevel,
      muscleMassKg,
      weightKg: measurement.weightKg
    },
    resolvedProfile
  );

  // Return all metrics with appropriate precision
  return {
    bmi: round(bmi, 1),
    bodyFatPercent: round(bodyFatPercent, 1),
    muscleMassKg: round(muscleMassKg, 1),
    bodyWaterPercent: round(bodyWaterPercent, 1),
    boneMassKg: round(boneMassKg, 1),
    visceralFatLevel: Math.round(visceralFatLevel),
    bmrKcal: Math.round(bmrKcal),
    leanBodyMassKg: round(leanBodyMassKg, 1),
    proteinPercent: round(proteinPercent, 1),
    bodyScore: Math.round(bodyScore)
  };
}

/**
 * Validate user profile data
 * @throws Error if profile is invalid
 */
export function validateProfile(profile: UserProfile): void {
  if (!profile.gender || !['male', 'female'].includes(profile.gender)) {
    throw new Error('Gender must be "male" or "female"');
  }

  // Validate age - either from birthYear or legacy age field
  let age: number;
  try {
    age = resolveAge(profile);
  } catch {
    throw new Error('Either valid birthYear or age must be provided');
  }

  if (age < 6 || age > 120) {
    throw new Error('Age must be between 6 and 120');
  }

  if (typeof profile.heightCm !== 'number' || profile.heightCm < 50 || profile.heightCm > 250) {
    throw new Error('Height must be between 50 and 250 cm');
  }
}

/**
 * Validate raw measurement data
 * @throws Error if measurement is invalid
 */
export function validateMeasurement(measurement: RawMeasurement): void {
  if (typeof measurement.weightKg !== 'number' || measurement.weightKg <= 0 || measurement.weightKg > 300) {
    throw new Error('Weight must be between 0 and 300 kg');
  }
  if (measurement.impedanceOhm !== undefined) {
    if (typeof measurement.impedanceOhm !== 'number' || measurement.impedanceOhm < 0) {
      throw new Error('Impedance must be a positive number');
    }
  }
  if (measurement.heartRateBpm !== undefined) {
    if (typeof measurement.heartRateBpm !== 'number' || measurement.heartRateBpm < 30 || measurement.heartRateBpm > 250) {
      throw new Error('Heart rate must be between 30 and 250 bpm');
    }
  }
}

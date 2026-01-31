/**
 * Domain Layer - Health Constants
 *
 * Reference values and healthy ranges for body composition metrics.
 * Based on WHO guidelines and peer-reviewed research.
 *
 * Sources:
 * - WHO BMI Classification: https://www.who.int/topics/obesity/en/
 * - ACE Body Fat Percentage Norms
 * - Gallagher et al. (2000) for age-specific body fat ranges
 */

import type { AgeSpecificRange, GenderSpecificRange, HealthyRange } from './types';

/**
 * BMI classification thresholds according to WHO standards.
 *
 * @see https://www.who.int/news-room/fact-sheets/detail/obesity-and-overweight
 */
export const BMI_THRESHOLDS = {
  /** Severe thinness */
  UNDERWEIGHT_SEVERE: 16.0,
  /** Moderate thinness */
  UNDERWEIGHT_MODERATE: 17.0,
  /** Mild thinness */
  UNDERWEIGHT_MILD: 18.5,
  /** Normal range upper bound */
  NORMAL_MAX: 24.9,
  /** Overweight upper bound */
  OVERWEIGHT_MAX: 29.9,
  /** Obese Class I upper bound */
  OBESE_CLASS_1_MAX: 34.9,
  /** Obese Class II upper bound */
  OBESE_CLASS_2_MAX: 39.9,
  // Obese Class III is >= 40
} as const;

/**
 * Healthy BMI range (WHO recommendation for adults).
 */
export const HEALTHY_BMI_RANGE: HealthyRange = {
  min: 18.5,
  max: 24.9,
  unit: 'kg/m^2',
};

/**
 * Body fat percentage healthy ranges by gender and age.
 * Based on ACE (American Council on Exercise) guidelines.
 *
 * @see Gallagher D, et al. Am J Clin Nutr 2000;72:694-701
 */
export const BODY_FAT_RANGES: AgeSpecificRange[] = [
  {
    ageRange: '20-29',
    minAge: 20,
    maxAge: 29,
    male: { min: 7, max: 17, unit: '%' },
    female: { min: 16, max: 24, unit: '%' },
  },
  {
    ageRange: '30-39',
    minAge: 30,
    maxAge: 39,
    male: { min: 12, max: 21, unit: '%' },
    female: { min: 17, max: 25, unit: '%' },
  },
  {
    ageRange: '40-49',
    minAge: 40,
    maxAge: 49,
    male: { min: 14, max: 23, unit: '%' },
    female: { min: 19, max: 28, unit: '%' },
  },
  {
    ageRange: '50-59',
    minAge: 50,
    maxAge: 59,
    male: { min: 16, max: 24, unit: '%' },
    female: { min: 22, max: 31, unit: '%' },
  },
  {
    ageRange: '60-69',
    minAge: 60,
    maxAge: 69,
    male: { min: 17, max: 25, unit: '%' },
    female: { min: 23, max: 32, unit: '%' },
  },
  {
    ageRange: '70+',
    minAge: 70,
    maxAge: 150,
    male: { min: 18, max: 25, unit: '%' },
    female: { min: 24, max: 33, unit: '%' },
  },
];

/**
 * ACE Body Fat Classification Categories.
 * Used for fitness assessments.
 */
export const BODY_FAT_CATEGORIES = {
  ESSENTIAL: {
    male: { min: 2, max: 5 },
    female: { min: 10, max: 13 },
  },
  ATHLETES: {
    male: { min: 6, max: 13 },
    female: { min: 14, max: 20 },
  },
  FITNESS: {
    male: { min: 14, max: 17 },
    female: { min: 21, max: 24 },
  },
  AVERAGE: {
    male: { min: 18, max: 24 },
    female: { min: 25, max: 31 },
  },
  OBESE: {
    male: { min: 25, max: 100 },
    female: { min: 32, max: 100 },
  },
} as const;

/**
 * Muscle mass ranges by gender.
 * Expressed as percentage of body weight.
 */
export const MUSCLE_MASS_RANGES: GenderSpecificRange = {
  male: { min: 33, max: 39, unit: '%' },
  female: { min: 24, max: 30, unit: '%' },
};

/**
 * Body water percentage healthy ranges by gender.
 *
 * @see Watson PE, et al. Am J Clin Nutr 1980;33:27-39
 */
export const BODY_WATER_RANGES: GenderSpecificRange = {
  male: { min: 50, max: 65, unit: '%' },
  female: { min: 45, max: 60, unit: '%' },
};

/**
 * Bone mass approximate ranges by gender.
 * Based on typical ranges for healthy adults.
 */
export const BONE_MASS_RANGES: GenderSpecificRange = {
  male: { min: 2.5, max: 3.5, unit: 'kg' },
  female: { min: 1.8, max: 2.5, unit: 'kg' },
};

/**
 * Visceral fat level interpretation.
 * Scale used by most body composition scales (1-30+).
 */
export const VISCERAL_FAT_LEVELS = {
  /** Healthy level */
  HEALTHY_MAX: 9,
  /** Elevated, needs attention */
  ELEVATED_MAX: 14,
  /** High, health risk */
  HIGH_MAX: 30,
} as const;

/**
 * Visceral fat level categories with descriptions.
 */
export const VISCERAL_FAT_CATEGORIES = {
  HEALTHY: {
    min: 1,
    max: 9,
    label: 'Healthy',
    description: 'Normal visceral fat level',
  },
  ELEVATED: {
    min: 10,
    max: 14,
    label: 'Elevated',
    description: 'Slightly elevated, consider lifestyle changes',
  },
  HIGH: {
    min: 15,
    max: 30,
    label: 'High',
    description: 'High visceral fat, consult healthcare provider',
  },
} as const;

/**
 * BMR (Basal Metabolic Rate) typical ranges by gender.
 * These are approximate ranges for average adults.
 */
export const BMR_RANGES: GenderSpecificRange = {
  male: { min: 1500, max: 2000, unit: 'kcal/day' },
  female: { min: 1200, max: 1550, unit: 'kcal/day' },
};

/**
 * Protein percentage ranges (as % of body weight).
 * Protein is approximately 16% of lean body mass.
 */
export const PROTEIN_RANGES: GenderSpecificRange = {
  male: { min: 16, max: 20, unit: '%' },
  female: { min: 14, max: 18, unit: '%' },
};

/**
 * Body score interpretation ranges.
 * Overall health score on a 0-100 scale.
 */
export const BODY_SCORE_RANGES = {
  POOR: { min: 0, max: 49, label: 'Poor' },
  BELOW_AVERAGE: { min: 50, max: 59, label: 'Below Average' },
  AVERAGE: { min: 60, max: 69, label: 'Average' },
  GOOD: { min: 70, max: 79, label: 'Good' },
  EXCELLENT: { min: 80, max: 89, label: 'Excellent' },
  SUPERIOR: { min: 90, max: 100, label: 'Superior' },
} as const;

/**
 * Input validation limits.
 * Reasonable bounds for user input validation.
 */
export const INPUT_LIMITS = {
  AGE: { min: 10, max: 120 },
  WEIGHT_KG: { min: 20, max: 300 },
  HEIGHT_CM: { min: 100, max: 250 },
  IMPEDANCE_OHM: { min: 200, max: 1200 },
  HEART_RATE_BPM: { min: 30, max: 220 },
} as const;

/**
 * Precision constants for calculations.
 * Used to ensure consistent rounding across the application.
 */
export const PRECISION = {
  BMI: 1, // 1 decimal place
  BODY_FAT: 1,
  MUSCLE_MASS: 1,
  BODY_WATER: 1,
  BONE_MASS: 1,
  VISCERAL_FAT: 0, // Integer
  BMR: 0, // Integer
  LEAN_BODY_MASS: 1,
  PROTEIN: 1,
  BODY_SCORE: 0, // Integer
} as const;

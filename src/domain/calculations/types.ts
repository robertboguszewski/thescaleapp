/**
 * Domain Layer Types
 * Pure TypeScript interfaces - no external dependencies
 *
 * @module domain/calculations/types
 */

/**
 * User profile data required for body composition calculations
 *
 * Migration Note: This interface supports both legacy `age` field and new `birthYear` field.
 * - New code should use `birthYear` and calculate age dynamically
 * - Legacy code can still use `age` during migration period
 * - Eventually, `age` will be deprecated in favor of `birthYear`
 */
export interface UserProfile {
  /** Biological gender - affects formula coefficients */
  gender: 'male' | 'female';

  /**
   * Year of birth (e.g., 1990) - used to calculate age dynamically
   * Preferred over `age` for new implementations
   */
  birthYear?: number;

  /**
   * Age in years (valid range: 6-80)
   * @deprecated Use `birthYear` instead and calculate age dynamically
   * Kept for backward compatibility during migration
   */
  age?: number;

  /** Height in centimeters (valid range: 90-220) */
  heightCm: number;

  /** Ethnicity - affects some formulas like Gallagher */
  ethnicity?: 'asian' | 'non-asian';
}

/**
 * User profile with resolved age for calculations
 * Used internally by calculation functions
 */
export interface ResolvedUserProfile {
  /** Biological gender - affects formula coefficients */
  gender: 'male' | 'female';
  /** Resolved age in years */
  age: number;
  /** Height in centimeters */
  heightCm: number;
  /** Ethnicity - affects some formulas like Gallagher */
  ethnicity?: 'asian' | 'non-asian';
}

/**
 * Raw measurement data from the scale
 */
export interface RawMeasurement {
  /** Body weight in kilograms (valid range: 0.1-150) */
  weightKg: number;
  /** Bioelectrical impedance in Ohms - high frequency (optional) */
  impedanceOhm?: number;
  /** Bioelectrical impedance in Ohms - low frequency (optional, for S400) */
  impedanceLowOhm?: number;
  /** Heart rate in beats per minute (optional) */
  heartRateBpm?: number;
}

/**
 * All calculated body composition metrics
 */
export interface CalculatedMetrics {
  /** Body Mass Index */
  bmi: number;
  /** Body fat percentage */
  bodyFatPercent: number;
  /** Muscle mass in kilograms */
  muscleMassKg: number;
  /** Body water percentage */
  bodyWaterPercent: number;
  /** Bone mass in kilograms */
  boneMassKg: number;
  /** Visceral fat level (1-30 scale) */
  visceralFatLevel: number;
  /** Basal Metabolic Rate in kcal/day */
  bmrKcal: number;
  /** Lean Body Mass in kilograms */
  leanBodyMassKg: number;
  /** Protein percentage */
  proteinPercent: number;
  /** Overall body composition score (0-100) */
  bodyScore: number;
}

/**
 * Configuration for selecting specific formulas
 */
export interface FormulaConfig {
  /** Body fat calculation formula */
  bodyFat: 'deurenberg1991' | 'deurenberg1992' | 'gallagher' | 'eddy' | 'impedance';
  /** Body water calculation formula */
  bodyWater: 'hume-weyers' | 'lee-song' | 'behnke';
  /** Lean body mass calculation formula */
  leanBodyMass: 'boer' | 'hume' | 'direct';
  /** BMR calculation formula */
  bmr: 'mifflin-st-jeor' | 'harris-benedict' | 'katch-mcardle';
}

/**
 * Visceral fat interpretation result
 */
export interface VisceralFatInterpretation {
  /** Health status category */
  status: 'healthy' | 'elevated' | 'high' | 'very-high';
  /** Associated health risk description */
  risk: string;
}

/**
 * BMI category interpretation
 */
export interface BMIInterpretation {
  /** WHO BMI category */
  category: 'underweight' | 'normal' | 'overweight' | 'obese-class-1' | 'obese-class-2' | 'obese-class-3';
  /** Risk level */
  risk: 'low' | 'moderate' | 'high' | 'very-high';
}

/**
 * A range with minimum and maximum values and a unit
 */
export interface HealthyRange {
  /** Minimum value */
  min: number;
  /** Maximum value */
  max: number;
  /** Unit of measurement */
  unit: string;
}

/**
 * A range specific to gender
 */
export interface GenderSpecificRange {
  /** Range for males */
  male: HealthyRange;
  /** Range for females */
  female: HealthyRange;
}

/**
 * A range specific to age group
 */
export interface AgeSpecificRange {
  /** Display label for the age range (e.g., "20-29") */
  ageRange: string;
  /** Minimum age for this range */
  minAge: number;
  /** Maximum age for this range */
  maxAge: number;
  /** Range for males */
  male: HealthyRange;
  /** Range for females */
  female: HealthyRange;
}

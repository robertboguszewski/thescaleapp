/**
 * Visceral Fat Estimation and Interpretation
 *
 * @module domain/calculations/visceral-fat
 *
 * Visceral fat (also called abdominal fat or intra-abdominal fat) is the
 * fat stored within the abdominal cavity around internal organs.
 *
 * Reference for interpretation: Tanita Body Composition Analyzers
 * Clinical Guidelines and Research Documentation
 *
 * Scale: 1-30 (proprietary Tanita scale, widely adopted)
 * - 1-9:   Healthy level
 * - 10-14: Elevated level (increased health risk)
 * - 15-24: High level (significantly increased health risk)
 * - 25-30: Very High level (critical health risk)
 *
 * Health risks associated with high visceral fat:
 * - Type 2 diabetes
 * - Cardiovascular disease
 * - Metabolic syndrome
 * - Certain cancers
 * - Sleep apnea
 * - Non-alcoholic fatty liver disease
 *
 * Note: True visceral fat measurement requires CT or MRI imaging.
 * This estimation is based on correlations with BMI, age, and gender
 * observed in research studies.
 */

import type { ResolvedUserProfile, VisceralFatInterpretation } from '../types';

/**
 * Estimate visceral fat level based on BMI, age, and gender
 *
 * This is an estimation formula based on correlations observed in
 * body composition research. Factors considered:
 * - BMI: Primary indicator (higher BMI correlates with higher visceral fat)
 * - Age: Visceral fat tends to increase with age
 * - Gender: Males typically accumulate more visceral fat than females
 *
 * @pure - No side effects, no external dependencies
 * @param profile - Resolved user profile with gender and age
 * @param bmi - Body Mass Index
 * @returns Estimated visceral fat level (1-30 scale)
 *
 * @example
 * const profile = { gender: 'male', age: 40, heightCm: 175 };
 * const bmi = 25;
 * const vfLevel = estimateVisceralFat(profile, bmi);
 * // Returns estimated level, e.g., 8
 */
export function estimateVisceralFat(
  profile: ResolvedUserProfile,
  bmi: number
): number {
  // Base calculation from BMI
  // BMI 18.5 is baseline (healthy minimum)
  let level = (bmi - 18.5) * 0.5;

  // Age factor: visceral fat increases with age
  // After age 20, add ~0.1 per year
  level += Math.max(0, (profile.age - 20) * 0.1);

  // Gender factor: males typically have higher visceral fat
  if (profile.gender === 'male') {
    level += 2;
  }

  // Clamp to valid range (1-30)
  level = Math.max(1, Math.min(30, level));

  // Return as integer
  return Math.round(level);
}

/**
 * Interpret visceral fat level according to Tanita guidelines
 *
 * Classification:
 * - 1-9:   Healthy - Low risk of metabolic diseases
 * - 10-14: Elevated - Moderate risk, lifestyle changes recommended
 * - 15-24: High - High risk, medical consultation advised
 * - 25-30: Very High - Serious health risk, urgent intervention needed
 *
 * @pure - No side effects, no external dependencies
 * @param level - Visceral fat level (1-30 scale)
 * @returns Interpretation with status and risk description
 *
 * @example
 * const interpretation = interpretVisceralFat(8);
 * // Returns { status: 'healthy', risk: 'Low risk of metabolic diseases...' }
 */
export function interpretVisceralFat(level: number): VisceralFatInterpretation {
  if (level <= 9) {
    return {
      status: 'healthy',
      risk: 'Low risk of metabolic diseases. Your visceral fat is within healthy range. Continue maintaining a balanced diet and regular physical activity.'
    };
  }

  if (level <= 14) {
    return {
      status: 'elevated',
      risk: 'Moderate risk of metabolic diseases. Consider lifestyle modifications including increased physical activity, reduced caloric intake, and limiting processed foods. Regular monitoring is recommended.'
    };
  }

  if (level <= 24) {
    return {
      status: 'high',
      risk: 'High risk of metabolic diseases including type 2 diabetes, cardiovascular disease, and fatty liver disease. Medical consultation is advised. Significant lifestyle changes are recommended including regular aerobic exercise and dietary modifications.'
    };
  }

  return {
    status: 'very-high',
    risk: 'Serious health risk. Very high visceral fat levels are strongly associated with cardiovascular disease, type 2 diabetes, metabolic syndrome, and certain cancers. Urgent medical consultation and intervention are strongly recommended.'
  };
}

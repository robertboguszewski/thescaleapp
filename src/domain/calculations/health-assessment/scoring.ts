/**
 * Body Score Calculation
 *
 * Calculates an overall health score based on multiple body composition metrics.
 * Score range: 0-100 (higher is better)
 *
 * @module domain/calculations/health-assessment/scoring
 */

import type { ResolvedUserProfile } from '../types';
import { BODY_FAT_CATEGORIES, VISCERAL_FAT_LEVELS, BMI_THRESHOLDS } from '../constants';

/**
 * Input metrics for body score calculation
 */
export interface BodyScoreInput {
  bmi: number;
  bodyFatPercent: number;
  visceralFatLevel: number;
  muscleMassKg: number;
  weightKg: number;
}

/**
 * Calculate overall body composition score
 *
 * Scoring weights:
 * - Body Fat %: 35%
 * - BMI: 25%
 * - Visceral Fat: 25%
 * - Muscle Mass: 15%
 *
 * @pure - No side effects
 * @param input - Body composition metrics
 * @param profile - Resolved user profile for gender-specific ranges
 * @returns Score from 0-100
 */
export function calculateBodyScore(
  input: BodyScoreInput,
  profile: ResolvedUserProfile
): number {
  const { bmi, bodyFatPercent, visceralFatLevel, muscleMassKg, weightKg } = input;

  // Calculate individual component scores (0-100)
  const bmiScore = calculateBMIScore(bmi);
  const bodyFatScore = calculateBodyFatScore(bodyFatPercent, profile.gender);
  const visceralScore = calculateVisceralScore(visceralFatLevel);
  const muscleScore = calculateMuscleScore(muscleMassKg, weightKg, profile.gender);

  // Weighted average
  const totalScore =
    (bodyFatScore * 0.35) +
    (bmiScore * 0.25) +
    (visceralScore * 0.25) +
    (muscleScore * 0.15);

  return Math.round(Math.max(0, Math.min(100, totalScore)));
}

/**
 * Calculate BMI component score
 */
function calculateBMIScore(bmi: number): number {
  // Optimal BMI: 18.5-24.9 (score 100)
  // Underweight: 16-18.5 (score 50-100)
  // Overweight: 25-30 (score 50-100)
  // Obese: >30 (score 0-50)

  if (bmi >= 18.5 && bmi <= 24.9) {
    return 100;
  }

  if (bmi < 18.5) {
    if (bmi < 16) return 30;
    return 50 + ((bmi - 16) / 2.5) * 50;
  }

  if (bmi <= 30) {
    return 100 - ((bmi - 24.9) / 5.1) * 50;
  }

  if (bmi <= 35) {
    return 50 - ((bmi - 30) / 5) * 30;
  }

  return Math.max(0, 20 - (bmi - 35) * 2);
}

/**
 * Calculate body fat component score
 */
function calculateBodyFatScore(
  bodyFatPercent: number,
  gender: 'male' | 'female'
): number {
  const categories = BODY_FAT_CATEGORIES;
  const fitness = gender === 'male' ? categories.FITNESS.male : categories.FITNESS.female;
  const average = gender === 'male' ? categories.AVERAGE.male : categories.AVERAGE.female;

  // In fitness range: score 90-100
  if (bodyFatPercent >= fitness.min && bodyFatPercent <= fitness.max) {
    return 95;
  }

  // In average range: score 70-90
  if (bodyFatPercent >= average.min && bodyFatPercent <= average.max) {
    return 80;
  }

  // Below fitness (athletes): score 80-95
  if (bodyFatPercent < fitness.min) {
    return 85;
  }

  // Above average (overweight/obese): score 20-70
  const overage = bodyFatPercent - average.max;
  return Math.max(20, 70 - overage * 3);
}

/**
 * Calculate visceral fat component score
 */
function calculateVisceralScore(level: number): number {
  if (level <= VISCERAL_FAT_LEVELS.HEALTHY_MAX) {
    return 100 - (level * 1); // 91-100
  }

  if (level <= VISCERAL_FAT_LEVELS.ELEVATED_MAX) {
    return 90 - ((level - 9) * 8); // 50-90
  }

  return Math.max(0, 50 - ((level - 14) * 3));
}

/**
 * Calculate muscle mass component score
 */
function calculateMuscleScore(
  muscleMassKg: number,
  weightKg: number,
  gender: 'male' | 'female'
): number {
  const musclePercent = (muscleMassKg / weightKg) * 100;

  // Target muscle mass percentages
  const targetMin = gender === 'male' ? 33 : 24;
  const targetMax = gender === 'male' ? 39 : 30;

  if (musclePercent >= targetMin && musclePercent <= targetMax) {
    return 95;
  }

  if (musclePercent > targetMax) {
    return 100; // Above average is good
  }

  // Below target
  const deficit = targetMin - musclePercent;
  return Math.max(40, 90 - deficit * 5);
}

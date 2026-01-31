/**
 * Status Helpers for Analysis Module
 *
 * Functions to determine metric status based on health thresholds.
 *
 * @module presentation/components/analysis/status-helpers
 */

import type { MetricStatus, TrendDirection } from '../dashboard/MetricCard';

/**
 * User profile context for status calculations
 */
export interface ProfileContext {
  gender: 'male' | 'female';
  age: number;
}

/**
 * Visceral fat thresholds (scale 1-30)
 */
const VISCERAL_FAT = {
  HEALTHY_MAX: 9,
  ELEVATED_MAX: 14,
};

/**
 * BMI thresholds (WHO)
 */
const BMI = {
  UNDERWEIGHT: 18.5,
  NORMAL_MAX: 24.9,
  OVERWEIGHT_MAX: 29.9,
};

/**
 * Body water percentage thresholds
 */
const BODY_WATER = {
  male: { low: 50, high: 65 },
  female: { low: 45, high: 60 },
};

/**
 * Body fat percentage thresholds by gender and age
 */
const BODY_FAT_THRESHOLDS = {
  male: {
    '20-39': { fitness: 17, average: 24, obese: 25 },
    '40-59': { fitness: 19, average: 26, obese: 27 },
    '60+': { fitness: 21, average: 28, obese: 29 },
  },
  female: {
    '20-39': { fitness: 24, average: 31, obese: 32 },
    '40-59': { fitness: 27, average: 33, obese: 34 },
    '60+': { fitness: 30, average: 35, obese: 36 },
  },
};

/**
 * Get age range key for body fat thresholds
 */
function getAgeRange(age: number): '20-39' | '40-59' | '60+' {
  if (age < 40) return '20-39';
  if (age < 60) return '40-59';
  return '60+';
}

/**
 * Determine body fat status
 */
export function getBodyFatStatus(
  bodyFatPercent: number,
  profile: ProfileContext
): MetricStatus {
  const ageRange = getAgeRange(profile.age);
  const thresholds = BODY_FAT_THRESHOLDS[profile.gender][ageRange];

  if (bodyFatPercent >= thresholds.obese) return 'critical';
  if (bodyFatPercent > thresholds.average) return 'warning';
  if (bodyFatPercent <= thresholds.fitness) return 'good';
  return 'good'; // Normal/average range
}

/**
 * Determine visceral fat status
 */
export function getVisceralFatStatus(level: number): MetricStatus {
  if (level > VISCERAL_FAT.ELEVATED_MAX) return 'critical';
  if (level > VISCERAL_FAT.HEALTHY_MAX) return 'warning';
  return 'good';
}

/**
 * Determine BMI status
 */
export function getBMIStatus(bmi: number): MetricStatus {
  if (bmi < BMI.UNDERWEIGHT) return 'warning';
  if (bmi <= BMI.NORMAL_MAX) return 'good';
  if (bmi <= BMI.OVERWEIGHT_MAX) return 'warning';
  return 'critical';
}

/**
 * Determine body water status
 */
export function getBodyWaterStatus(
  waterPercent: number,
  gender: 'male' | 'female'
): MetricStatus {
  const thresholds = BODY_WATER[gender];
  if (waterPercent < thresholds.low) return 'warning';
  if (waterPercent > thresholds.high) return 'warning';
  return 'good';
}

/**
 * Determine muscle mass status (simplified - based on general healthy ranges)
 */
export function getMuscleMassStatus(
  muscleMassKg: number,
  weightKg: number,
  gender: 'male' | 'female'
): MetricStatus {
  const musclePercent = (muscleMassKg / weightKg) * 100;
  const minHealthy = gender === 'male' ? 32 : 26;

  if (musclePercent < minHealthy) return 'warning';
  return 'good';
}

/**
 * Determine bone mass status (simplified)
 */
export function getBoneMassStatus(
  boneMassKg: number,
  weightKg: number,
  gender: 'male' | 'female'
): MetricStatus {
  // Bone mass typically 2-4% of body weight
  const bonePercent = (boneMassKg / weightKg) * 100;
  const minHealthy = gender === 'male' ? 2.5 : 2.0;

  if (bonePercent < minHealthy) return 'warning';
  return 'good';
}

/**
 * Determine protein percentage status
 */
export function getProteinStatus(proteinPercent: number): MetricStatus {
  // Healthy protein range typically 16-20%
  if (proteinPercent < 14) return 'warning';
  if (proteinPercent < 16) return 'neutral';
  return 'good';
}

/**
 * Determine body score status
 */
export function getBodyScoreStatus(score: number): MetricStatus {
  if (score >= 70) return 'good';
  if (score >= 40) return 'warning';
  return 'critical';
}

/**
 * Calculate trend direction from change value
 */
export function getTrendDirection(change: number, inverted = false): TrendDirection {
  const threshold = 0.1; // Small changes are considered stable

  if (Math.abs(change) < threshold) return 'stable';

  const direction = change > 0 ? 'up' : 'down';

  // For metrics where down is good (e.g., body fat, weight loss goal)
  if (inverted) {
    return direction === 'down' ? 'up' : 'down';
  }

  return direction;
}

/**
 * Format trend value for display
 */
export function formatTrendValue(change: number, unit: string): string {
  const sign = change >= 0 ? '+' : '';
  return `${sign}${change.toFixed(1)} ${unit}`;
}

/**
 * Get overall status from multiple metrics
 */
export function getOverallStatus(statuses: MetricStatus[]): MetricStatus {
  if (statuses.includes('critical')) return 'critical';
  if (statuses.includes('warning')) return 'warning';
  return 'good';
}

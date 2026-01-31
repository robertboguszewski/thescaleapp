/**
 * BMI (Body Mass Index) Calculation Module
 *
 * Provides pure functions for calculating and interpreting BMI
 * according to WHO (World Health Organization) standards.
 *
 * @module domain/calculations/bmi
 *
 * @see WHO BMI Classification: https://www.who.int/news-room/fact-sheets/detail/obesity-and-overweight
 *
 * @example
 * ```typescript
 * const bmi = calculateBMI(70, 175); // 22.9 kg/m^2
 * const interpretation = interpretBMI(bmi);
 * // { category: 'normal', risk: 'low' }
 * ```
 */

import type { BMIInterpretation } from '../types';

/**
 * Calculates Body Mass Index (BMI) from weight and height.
 *
 * Formula: BMI = weight(kg) / height(m)^2
 *
 * This is a pure function with no side effects.
 *
 * @param weightKg - Body weight in kilograms (must be positive)
 * @param heightCm - Height in centimeters (must be positive)
 * @returns BMI value rounded to 1 decimal place
 * @throws {Error} If weight is not a positive finite number
 * @throws {Error} If height is not a positive finite number
 *
 * @example
 * ```typescript
 * calculateBMI(70, 175) // Returns 22.9
 * calculateBMI(85, 180) // Returns 26.2
 * ```
 */
export function calculateBMI(weightKg: number, heightCm: number): number {
  // Validate weight
  if (!Number.isFinite(weightKg)) {
    throw new Error('Weight must be a finite number');
  }
  if (weightKg <= 0 || Number.isNaN(weightKg)) {
    throw new Error('Weight must be a positive number');
  }

  // Validate height
  if (!Number.isFinite(heightCm)) {
    throw new Error('Height must be a finite number');
  }
  if (heightCm <= 0 || Number.isNaN(heightCm)) {
    throw new Error('Height must be a positive number');
  }

  // Convert height from cm to meters
  const heightM = heightCm / 100;

  // Calculate BMI: weight / height^2
  const bmi = weightKg / (heightM * heightM);

  // Round to 1 decimal place
  return Math.round(bmi * 10) / 10;
}

/**
 * Interprets BMI value according to WHO classification.
 *
 * WHO BMI Classification for adults:
 * - Underweight: < 18.5 kg/m^2
 * - Normal: 18.5 - 24.9 kg/m^2
 * - Overweight: 25.0 - 29.9 kg/m^2
 * - Obese Class I: 30.0 - 34.9 kg/m^2
 * - Obese Class II: 35.0 - 39.9 kg/m^2
 * - Obese Class III: >= 40.0 kg/m^2
 *
 * This is a pure function with no side effects.
 *
 * @param bmi - BMI value to interpret (must be positive)
 * @returns BMI interpretation with category and risk level
 * @throws {Error} If BMI is not a positive number
 *
 * @see https://www.who.int/news-room/fact-sheets/detail/obesity-and-overweight
 *
 * @example
 * ```typescript
 * interpretBMI(22.5) // Returns { category: 'normal', risk: 'low' }
 * interpretBMI(32.0) // Returns { category: 'obese-class-1', risk: 'high' }
 * ```
 */
export function interpretBMI(bmi: number): BMIInterpretation {
  // Validate BMI
  if (bmi <= 0 || Number.isNaN(bmi)) {
    throw new Error('BMI must be a positive number');
  }

  // WHO BMI thresholds
  const UNDERWEIGHT_SEVERE = 16.0;
  const UNDERWEIGHT_MODERATE = 18.5;
  const NORMAL_MAX = 25.0;
  const OVERWEIGHT_MAX = 30.0;
  const OBESE_1_MAX = 35.0;
  const OBESE_2_MAX = 40.0;

  // Determine category and risk based on BMI value
  if (bmi < UNDERWEIGHT_SEVERE) {
    return {
      category: 'underweight',
      risk: 'high',
    };
  }

  if (bmi < UNDERWEIGHT_MODERATE) {
    return {
      category: 'underweight',
      risk: 'moderate',
    };
  }

  if (bmi < NORMAL_MAX) {
    return {
      category: 'normal',
      risk: 'low',
    };
  }

  if (bmi < OVERWEIGHT_MAX) {
    return {
      category: 'overweight',
      risk: 'moderate',
    };
  }

  if (bmi < OBESE_1_MAX) {
    return {
      category: 'obese-class-1',
      risk: 'high',
    };
  }

  if (bmi < OBESE_2_MAX) {
    return {
      category: 'obese-class-2',
      risk: 'very-high',
    };
  }

  // BMI >= 40.0
  return {
    category: 'obese-class-3',
    risk: 'very-high',
  };
}

/**
 * Calculates ideal weight range based on height using BMI 18.5-24.9 range.
 *
 * @param heightCm - Height in centimeters
 * @returns Object with minimum and maximum ideal weight in kg
 * @throws {Error} If height is not a positive number
 *
 * @example
 * ```typescript
 * getIdealWeightRange(175)
 * // Returns { minKg: 56.6, maxKg: 76.2 }
 * ```
 */
export function getIdealWeightRange(heightCm: number): {
  minKg: number;
  maxKg: number;
} {
  if (heightCm <= 0 || Number.isNaN(heightCm)) {
    throw new Error('Height must be a positive number');
  }

  const heightM = heightCm / 100;
  const heightSquared = heightM * heightM;

  // Calculate weight at BMI boundaries (18.5 and 24.9)
  const minKg = Math.round(18.5 * heightSquared * 10) / 10;
  const maxKg = Math.round(24.9 * heightSquared * 10) / 10;

  return { minKg, maxKg };
}

/**
 * Calculates the weight change needed to reach a target BMI.
 *
 * @param currentWeightKg - Current weight in kilograms
 * @param heightCm - Height in centimeters
 * @param targetBmi - Target BMI value
 * @returns Weight change needed in kg (negative = weight loss, positive = weight gain)
 * @throws {Error} If any input is invalid
 *
 * @example
 * ```typescript
 * getWeightChangeForTargetBMI(90, 175, 24.9)
 * // Returns -13.8 (need to lose 13.8 kg)
 * ```
 */
export function getWeightChangeForTargetBMI(
  currentWeightKg: number,
  heightCm: number,
  targetBmi: number
): number {
  if (currentWeightKg <= 0 || Number.isNaN(currentWeightKg)) {
    throw new Error('Current weight must be a positive number');
  }
  if (heightCm <= 0 || Number.isNaN(heightCm)) {
    throw new Error('Height must be a positive number');
  }
  if (targetBmi <= 0 || Number.isNaN(targetBmi)) {
    throw new Error('Target BMI must be a positive number');
  }

  const heightM = heightCm / 100;
  const targetWeightKg = targetBmi * heightM * heightM;
  const weightChange = targetWeightKg - currentWeightKg;

  return Math.round(weightChange * 10) / 10;
}

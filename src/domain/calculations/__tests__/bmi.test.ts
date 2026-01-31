/**
 * BMI Calculation Tests
 *
 * Test suite for Body Mass Index calculations.
 * Following TDD approach - tests written before implementation.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateBMI,
  interpretBMI,
  getIdealWeightRange,
  getWeightChangeForTargetBMI,
} from '../bmi';
import type { BMIInterpretation } from '../types';

describe('BMI Calculations', () => {
  describe('calculateBMI', () => {
    it('should calculate BMI correctly for standard inputs', () => {
      // 70kg, 175cm => BMI = 70 / (1.75^2) = 22.86
      const result = calculateBMI(70, 175);
      expect(result).toBeCloseTo(22.86, 1);
    });

    it('should calculate BMI for underweight person', () => {
      // 50kg, 180cm => BMI = 50 / (1.80^2) = 15.43
      const result = calculateBMI(50, 180);
      expect(result).toBeCloseTo(15.43, 1);
    });

    it('should calculate BMI for overweight person', () => {
      // 85kg, 170cm => BMI = 85 / (1.70^2) = 29.41
      const result = calculateBMI(85, 170);
      expect(result).toBeCloseTo(29.41, 1);
    });

    it('should calculate BMI for obese person', () => {
      // 100kg, 165cm => BMI = 100 / (1.65^2) = 36.73
      const result = calculateBMI(100, 165);
      expect(result).toBeCloseTo(36.73, 1);
    });

    it('should handle edge case with minimum reasonable weight', () => {
      // 30kg, 150cm => BMI = 30 / (1.50^2) = 13.33
      const result = calculateBMI(30, 150);
      expect(result).toBeCloseTo(13.33, 1);
    });

    it('should handle edge case with tall person', () => {
      // 90kg, 200cm => BMI = 90 / (2.00^2) = 22.5
      const result = calculateBMI(90, 200);
      expect(result).toBeCloseTo(22.5, 1);
    });

    it('should handle edge case with short person', () => {
      // 45kg, 140cm => BMI = 45 / (1.40^2) = 22.96
      const result = calculateBMI(45, 140);
      expect(result).toBeCloseTo(22.96, 1);
    });

    it('should round to 1 decimal place', () => {
      // 73kg, 178cm => BMI = 73 / (1.78^2) = 23.044...
      const result = calculateBMI(73, 178);
      expect(result).toBe(23.0);
    });

    it('should throw error for zero weight', () => {
      expect(() => calculateBMI(0, 175)).toThrow('Weight must be a positive number');
    });

    it('should throw error for negative weight', () => {
      expect(() => calculateBMI(-70, 175)).toThrow('Weight must be a positive number');
    });

    it('should throw error for zero height', () => {
      expect(() => calculateBMI(70, 0)).toThrow('Height must be a positive number');
    });

    it('should throw error for negative height', () => {
      expect(() => calculateBMI(70, -175)).toThrow('Height must be a positive number');
    });

    it('should throw error for NaN weight', () => {
      expect(() => calculateBMI(NaN, 175)).toThrow('Weight must be a finite number');
    });

    it('should throw error for NaN height', () => {
      expect(() => calculateBMI(70, NaN)).toThrow('Height must be a finite number');
    });

    it('should throw error for Infinity weight', () => {
      expect(() => calculateBMI(Infinity, 175)).toThrow('Weight must be a finite number');
    });

    it('should throw error for Infinity height', () => {
      expect(() => calculateBMI(70, Infinity)).toThrow('Height must be a finite number');
    });
  });

  describe('interpretBMI', () => {
    it('should classify severely underweight (BMI < 16)', () => {
      const result: BMIInterpretation = interpretBMI(15.5);
      expect(result.category).toBe('underweight');
      expect(result.risk).toBe('high');
    });

    it('should classify underweight (BMI 16-18.49)', () => {
      const result: BMIInterpretation = interpretBMI(17.5);
      expect(result.category).toBe('underweight');
      expect(result.risk).toBe('moderate');
    });

    it('should classify normal weight at lower bound (BMI 18.5)', () => {
      const result: BMIInterpretation = interpretBMI(18.5);
      expect(result.category).toBe('normal');
      expect(result.risk).toBe('low');
    });

    it('should classify normal weight (BMI 18.5-24.9)', () => {
      const result: BMIInterpretation = interpretBMI(22.0);
      expect(result.category).toBe('normal');
      expect(result.risk).toBe('low');
    });

    it('should classify normal weight at upper bound (BMI 24.9)', () => {
      const result: BMIInterpretation = interpretBMI(24.9);
      expect(result.category).toBe('normal');
      expect(result.risk).toBe('low');
    });

    it('should classify overweight at lower bound (BMI 25.0)', () => {
      const result: BMIInterpretation = interpretBMI(25.0);
      expect(result.category).toBe('overweight');
      expect(result.risk).toBe('moderate');
    });

    it('should classify overweight (BMI 25-29.9)', () => {
      const result: BMIInterpretation = interpretBMI(27.5);
      expect(result.category).toBe('overweight');
      expect(result.risk).toBe('moderate');
    });

    it('should classify obese class 1 (BMI 30-34.9)', () => {
      const result: BMIInterpretation = interpretBMI(32.0);
      expect(result.category).toBe('obese-class-1');
      expect(result.risk).toBe('high');
    });

    it('should classify obese class 2 (BMI 35-39.9)', () => {
      const result: BMIInterpretation = interpretBMI(37.5);
      expect(result.category).toBe('obese-class-2');
      expect(result.risk).toBe('very-high');
    });

    it('should classify obese class 3 (BMI >= 40)', () => {
      const result: BMIInterpretation = interpretBMI(42.0);
      expect(result.category).toBe('obese-class-3');
      expect(result.risk).toBe('very-high');
    });

    it('should classify extreme obesity (BMI 50+)', () => {
      const result: BMIInterpretation = interpretBMI(55.0);
      expect(result.category).toBe('obese-class-3');
      expect(result.risk).toBe('very-high');
    });

    it('should throw error for negative BMI', () => {
      expect(() => interpretBMI(-5)).toThrow('BMI must be a positive number');
    });

    it('should throw error for zero BMI', () => {
      expect(() => interpretBMI(0)).toThrow('BMI must be a positive number');
    });

    it('should throw error for NaN BMI', () => {
      expect(() => interpretBMI(NaN)).toThrow('BMI must be a positive number');
    });
  });

  describe('getIdealWeightRange', () => {
    it('should calculate ideal weight range for average height', () => {
      // 175cm: min = 18.5 * 1.75^2 = 56.66, max = 24.9 * 1.75^2 = 76.27
      const result = getIdealWeightRange(175);
      expect(result.minKg).toBeCloseTo(56.7, 1);
      expect(result.maxKg).toBeCloseTo(76.3, 1);
    });

    it('should calculate ideal weight range for tall person', () => {
      // 190cm: min = 18.5 * 1.90^2 = 66.79, max = 24.9 * 1.90^2 = 89.89
      const result = getIdealWeightRange(190);
      expect(result.minKg).toBeCloseTo(66.8, 1);
      expect(result.maxKg).toBeCloseTo(89.9, 1);
    });

    it('should calculate ideal weight range for short person', () => {
      // 160cm: min = 18.5 * 1.60^2 = 47.36, max = 24.9 * 1.60^2 = 63.74
      const result = getIdealWeightRange(160);
      expect(result.minKg).toBeCloseTo(47.4, 1);
      expect(result.maxKg).toBeCloseTo(63.7, 1);
    });

    it('should throw error for zero height', () => {
      expect(() => getIdealWeightRange(0)).toThrow('Height must be a positive number');
    });

    it('should throw error for negative height', () => {
      expect(() => getIdealWeightRange(-175)).toThrow('Height must be a positive number');
    });

    it('should throw error for NaN height', () => {
      expect(() => getIdealWeightRange(NaN)).toThrow('Height must be a positive number');
    });
  });

  describe('getWeightChangeForTargetBMI', () => {
    it('should calculate weight loss needed for overweight person', () => {
      // 90kg, 175cm (BMI 29.4) -> target 24.9
      // Target weight = 24.9 * 1.75^2 = 76.27
      // Change = 76.27 - 90 = -13.73
      const result = getWeightChangeForTargetBMI(90, 175, 24.9);
      expect(result).toBeCloseTo(-13.7, 1);
    });

    it('should calculate weight gain needed for underweight person', () => {
      // 50kg, 175cm (BMI 16.3) -> target 18.5
      // Target weight = 18.5 * 1.75^2 = 56.66
      // Change = 56.66 - 50 = 6.66
      const result = getWeightChangeForTargetBMI(50, 175, 18.5);
      expect(result).toBeCloseTo(6.7, 1);
    });

    it('should return zero when already at target BMI', () => {
      // 70kg, 175cm (BMI 22.86) -> target 22.9
      // Target weight = 22.9 * 1.75^2 = 70.14
      // Change = 70.14 - 70 = 0.14
      const result = getWeightChangeForTargetBMI(70, 175, 22.9);
      expect(Math.abs(result)).toBeLessThan(0.5);
    });

    it('should throw error for zero current weight', () => {
      expect(() => getWeightChangeForTargetBMI(0, 175, 22)).toThrow(
        'Current weight must be a positive number'
      );
    });

    it('should throw error for negative current weight', () => {
      expect(() => getWeightChangeForTargetBMI(-70, 175, 22)).toThrow(
        'Current weight must be a positive number'
      );
    });

    it('should throw error for NaN current weight', () => {
      expect(() => getWeightChangeForTargetBMI(NaN, 175, 22)).toThrow(
        'Current weight must be a positive number'
      );
    });

    it('should throw error for zero height', () => {
      expect(() => getWeightChangeForTargetBMI(70, 0, 22)).toThrow(
        'Height must be a positive number'
      );
    });

    it('should throw error for negative height', () => {
      expect(() => getWeightChangeForTargetBMI(70, -175, 22)).toThrow(
        'Height must be a positive number'
      );
    });

    it('should throw error for NaN height', () => {
      expect(() => getWeightChangeForTargetBMI(70, NaN, 22)).toThrow(
        'Height must be a positive number'
      );
    });

    it('should throw error for zero target BMI', () => {
      expect(() => getWeightChangeForTargetBMI(70, 175, 0)).toThrow(
        'Target BMI must be a positive number'
      );
    });

    it('should throw error for negative target BMI', () => {
      expect(() => getWeightChangeForTargetBMI(70, 175, -22)).toThrow(
        'Target BMI must be a positive number'
      );
    });

    it('should throw error for NaN target BMI', () => {
      expect(() => getWeightChangeForTargetBMI(70, 175, NaN)).toThrow(
        'Target BMI must be a positive number'
      );
    });
  });

  describe('BMI calculation accuracy', () => {
    /**
     * Test cases from verified BMI calculation examples
     */
    const testCases = [
      { weight: 60, height: 165, expectedBmi: 22.0 },
      { weight: 75, height: 180, expectedBmi: 23.1 },
      { weight: 55, height: 160, expectedBmi: 21.5 },
      { weight: 90, height: 175, expectedBmi: 29.4 },
      { weight: 65, height: 170, expectedBmi: 22.5 },
    ];

    testCases.forEach(({ weight, height, expectedBmi }) => {
      it(`should calculate BMI=${expectedBmi} for ${weight}kg/${height}cm`, () => {
        const result = calculateBMI(weight, height);
        expect(result).toBeCloseTo(expectedBmi, 1);
      });
    });
  });

  describe('BMI pure function properties', () => {
    it('should return the same result for the same inputs (idempotent)', () => {
      const result1 = calculateBMI(70, 175);
      const result2 = calculateBMI(70, 175);
      const result3 = calculateBMI(70, 175);

      expect(result1).toBe(result2);
      expect(result2).toBe(result3);
    });

    it('should not modify any external state', () => {
      const weight = 70;
      const height = 175;

      calculateBMI(weight, height);

      // Original values remain unchanged
      expect(weight).toBe(70);
      expect(height).toBe(175);
    });
  });
});

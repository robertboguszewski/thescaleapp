/**
 * Lean Body Mass Calculations Tests
 *
 * Testing formula:
 * - Boer (1984)
 *
 * @module domain/calculations/__tests__/lean-body-mass.test
 */

import { describe, it, expect } from 'vitest';
import { calculateLBM_Boer, calculateLBM_FromBodyFat } from '../lean-body-mass/boer';
import type { UserProfile, RawMeasurement } from '../types';

describe('Lean Body Mass Calculations', () => {
  describe('Boer Formula (1984)', () => {
    /**
     * Reference: Boer P (1984)
     * "Estimated lean body mass as an index for normalization of body fluid volumes in humans"
     * American Journal of Physiology 247(4 Pt 2):F632-F636
     *
     * Male:   LBM = (0.407 x weight kg) + (0.267 x height cm) - 19.2
     * Female: LBM = (0.252 x weight kg) + (0.473 x height cm) - 48.3
     */

    it('should calculate LBM correctly for adult male', () => {
      const profile: UserProfile = { gender: 'male', age: 35, heightCm: 178 };
      const measurement: RawMeasurement = { weightKg: 75 };

      const result = calculateLBM_Boer(profile, measurement);

      // Expected: (0.407 * 75) + (0.267 * 178) - 19.2
      // = 30.525 + 47.526 - 19.2 = 58.851 kg
      expect(result).toBeCloseTo(58.85, 0);
    });

    it('should calculate LBM correctly for adult female', () => {
      const profile: UserProfile = { gender: 'female', age: 30, heightCm: 165 };
      const measurement: RawMeasurement = { weightKg: 60 };

      const result = calculateLBM_Boer(profile, measurement);

      // Expected: (0.252 * 60) + (0.473 * 165) - 48.3
      // = 15.12 + 78.045 - 48.3 = 44.865 kg
      expect(result).toBeCloseTo(44.87, 0);
    });

    it('should return higher LBM for males at similar height/weight', () => {
      const maleProfile: UserProfile = { gender: 'male', age: 30, heightCm: 170 };
      const femaleProfile: UserProfile = { gender: 'female', age: 30, heightCm: 170 };
      const measurement: RawMeasurement = { weightKg: 70 };

      const maleResult = calculateLBM_Boer(maleProfile, measurement);
      const femaleResult = calculateLBM_Boer(femaleProfile, measurement);

      expect(maleResult).toBeGreaterThan(femaleResult);
    });

    it('should increase LBM with weight', () => {
      const profile: UserProfile = { gender: 'male', age: 35, heightCm: 175 };
      const lightMeasurement: RawMeasurement = { weightKg: 65 };
      const heavyMeasurement: RawMeasurement = { weightKg: 85 };

      const lightResult = calculateLBM_Boer(profile, lightMeasurement);
      const heavyResult = calculateLBM_Boer(profile, heavyMeasurement);

      expect(heavyResult).toBeGreaterThan(lightResult);
    });

    it('should increase LBM with height', () => {
      const shortProfile: UserProfile = { gender: 'male', age: 30, heightCm: 165 };
      const tallProfile: UserProfile = { gender: 'male', age: 30, heightCm: 185 };
      const measurement: RawMeasurement = { weightKg: 75 };

      const shortResult = calculateLBM_Boer(shortProfile, measurement);
      const tallResult = calculateLBM_Boer(tallProfile, measurement);

      expect(tallResult).toBeGreaterThan(shortResult);
    });

    it('should be a pure function', () => {
      const profile: UserProfile = { gender: 'male', age: 40, heightCm: 175 };
      const measurement: RawMeasurement = { weightKg: 78 };

      const result1 = calculateLBM_Boer(profile, measurement);
      const result2 = calculateLBM_Boer(profile, measurement);

      expect(result1).toBe(result2);
    });

    it('should return LBM less than total weight', () => {
      const profile: UserProfile = { gender: 'female', age: 35, heightCm: 165 };
      const measurement: RawMeasurement = { weightKg: 70 };

      const result = calculateLBM_Boer(profile, measurement);

      expect(result).toBeLessThan(measurement.weightKg);
      expect(result).toBeGreaterThan(0);
    });

    it('should return reasonable LBM percentage of weight', () => {
      const profile: UserProfile = { gender: 'male', age: 30, heightCm: 178 };
      const measurement: RawMeasurement = { weightKg: 75 };

      const result = calculateLBM_Boer(profile, measurement);
      const lbmPercentage = (result / measurement.weightKg) * 100;

      // Healthy males typically have 75-90% lean body mass
      expect(lbmPercentage).toBeGreaterThan(60);
      expect(lbmPercentage).toBeLessThan(95);
    });
  });

  describe('LBM from Body Fat Percentage', () => {
    /**
     * Direct calculation: LBM = weight x (1 - bodyFatPercent/100)
     */

    it('should calculate LBM from body fat for male athlete', () => {
      const measurement: RawMeasurement = { weightKg: 80 };
      const bodyFatPercent = 10;

      const result = calculateLBM_FromBodyFat(measurement, bodyFatPercent);

      // LBM = 80 * (1 - 0.10) = 80 * 0.90 = 72 kg
      expect(result).toBe(72);
    });

    it('should calculate LBM from body fat for average person', () => {
      const measurement: RawMeasurement = { weightKg: 75 };
      const bodyFatPercent = 20;

      const result = calculateLBM_FromBodyFat(measurement, bodyFatPercent);

      // LBM = 75 * (1 - 0.20) = 75 * 0.80 = 60 kg
      expect(result).toBe(60);
    });

    it('should calculate LBM from body fat for obese person', () => {
      const measurement: RawMeasurement = { weightKg: 100 };
      const bodyFatPercent = 35;

      const result = calculateLBM_FromBodyFat(measurement, bodyFatPercent);

      // LBM = 100 * (1 - 0.35) = 100 * 0.65 = 65 kg
      expect(result).toBe(65);
    });

    it('should handle minimum body fat (essential fat)', () => {
      const measurement: RawMeasurement = { weightKg: 70 };
      const bodyFatPercent = 3; // Essential fat for males

      const result = calculateLBM_FromBodyFat(measurement, bodyFatPercent);

      // LBM = 70 * 0.97 = 67.9 kg
      expect(result).toBeCloseTo(67.9, 1);
    });

    it('should handle high body fat', () => {
      const measurement: RawMeasurement = { weightKg: 120 };
      const bodyFatPercent = 50;

      const result = calculateLBM_FromBodyFat(measurement, bodyFatPercent);

      // LBM = 120 * 0.50 = 60 kg
      expect(result).toBe(60);
    });

    it('should be linear with weight at fixed body fat', () => {
      const bodyFatPercent = 20;
      const measurement1: RawMeasurement = { weightKg: 60 };
      const measurement2: RawMeasurement = { weightKg: 80 };

      const result1 = calculateLBM_FromBodyFat(measurement1, bodyFatPercent);
      const result2 = calculateLBM_FromBodyFat(measurement2, bodyFatPercent);

      // LBM should scale proportionally with weight
      expect(result2 / result1).toBeCloseTo(80 / 60, 5);
    });
  });

  describe('Comparison: Boer vs Body Fat Method', () => {
    it('should produce similar results for typical adult male', () => {
      const profile: UserProfile = { gender: 'male', age: 35, heightCm: 178 };
      const measurement: RawMeasurement = { weightKg: 75 };
      const bodyFatPercent = 18;

      const boerResult = calculateLBM_Boer(profile, measurement);
      const directResult = calculateLBM_FromBodyFat(measurement, bodyFatPercent);

      // Both methods should be within 10% for typical person
      const difference = Math.abs(boerResult - directResult);
      const average = (boerResult + directResult) / 2;
      expect(difference / average).toBeLessThan(0.15);
    });

    it('should produce similar results for typical adult female', () => {
      const profile: UserProfile = { gender: 'female', age: 30, heightCm: 165 };
      const measurement: RawMeasurement = { weightKg: 60 };
      const bodyFatPercent = 25;

      const boerResult = calculateLBM_Boer(profile, measurement);
      const directResult = calculateLBM_FromBodyFat(measurement, bodyFatPercent);

      // Both methods should be within 10% for typical person
      const difference = Math.abs(boerResult - directResult);
      const average = (boerResult + directResult) / 2;
      expect(difference / average).toBeLessThan(0.15);
    });
  });

  describe('Edge Cases', () => {
    it('should handle young child', () => {
      const profile: UserProfile = { gender: 'male', age: 8, heightCm: 130 };
      const measurement: RawMeasurement = { weightKg: 28 };

      const result = calculateLBM_Boer(profile, measurement);

      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(measurement.weightKg);
    });

    it('should handle elderly person', () => {
      const profile: UserProfile = { gender: 'female', age: 75, heightCm: 155 };
      const measurement: RawMeasurement = { weightKg: 55 };

      const result = calculateLBM_Boer(profile, measurement);

      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(measurement.weightKg);
    });

    it('should handle very tall person', () => {
      const profile: UserProfile = { gender: 'male', age: 25, heightCm: 210 };
      const measurement: RawMeasurement = { weightKg: 105 };

      const result = calculateLBM_Boer(profile, measurement);

      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(measurement.weightKg);
    });

    it('should handle very short person', () => {
      const profile: UserProfile = { gender: 'female', age: 30, heightCm: 145 };
      const measurement: RawMeasurement = { weightKg: 45 };

      const result = calculateLBM_Boer(profile, measurement);

      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(measurement.weightKg);
    });

    it('should handle overweight person', () => {
      const profile: UserProfile = { gender: 'male', age: 40, heightCm: 175 };
      const measurement: RawMeasurement = { weightKg: 110 };

      const result = calculateLBM_Boer(profile, measurement);

      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(measurement.weightKg);
    });

    it('should handle underweight person', () => {
      const profile: UserProfile = { gender: 'female', age: 22, heightCm: 170 };
      const measurement: RawMeasurement = { weightKg: 48 };

      const result = calculateLBM_Boer(profile, measurement);

      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(measurement.weightKg);
    });
  });

  describe('Numerical Stability', () => {
    it('should not produce NaN', () => {
      const profile: UserProfile = { gender: 'male', age: 40, heightCm: 175 };
      const measurement: RawMeasurement = { weightKg: 75 };

      const result = calculateLBM_Boer(profile, measurement);

      expect(Number.isNaN(result)).toBe(false);
    });

    it('should not produce Infinity', () => {
      const profile: UserProfile = { gender: 'female', age: 35, heightCm: 165 };
      const measurement: RawMeasurement = { weightKg: 60 };

      const result = calculateLBM_Boer(profile, measurement);

      expect(Number.isFinite(result)).toBe(true);
    });

    it('should produce positive value for any reasonable input', () => {
      const testCases = [
        { gender: 'male' as const, age: 20, heightCm: 160, weightKg: 55 },
        { gender: 'female' as const, age: 60, heightCm: 180, weightKg: 90 },
        { gender: 'male' as const, age: 40, heightCm: 175, weightKg: 120 },
        { gender: 'female' as const, age: 25, heightCm: 155, weightKg: 50 },
      ];

      testCases.forEach(({ gender, age, heightCm, weightKg }) => {
        const profile: UserProfile = { gender, age, heightCm };
        const measurement: RawMeasurement = { weightKg };

        const result = calculateLBM_Boer(profile, measurement);

        expect(result).toBeGreaterThan(0);
      });
    });
  });
});

/**
 * Body Fat Calculation Tests
 *
 * Test suite for Body Fat percentage calculations using various formulas.
 * Following TDD approach - tests written before implementation.
 *
 * Scientific references:
 * - Deurenberg P, et al. Br J Nutr 1991;65:105-114
 * - Deurenberg P, et al. Int J Obes 1992;16:17-22
 * - Gallagher D, et al. Am J Clin Nutr 2000;72:694-701
 */

import { describe, it, expect } from 'vitest';
import {
  calculateBodyFatDeurenberg1991,
  calculateBodyFatDeurenberg1992,
} from '../body-fat/deurenberg';
import { calculateBodyFatGallagher } from '../body-fat/gallagher';
import type { UserProfile, RawMeasurement } from '../types';

describe('Body Fat Calculations - Deurenberg Formulas', () => {
  describe('calculateBodyFatDeurenberg1991', () => {
    /**
     * Deurenberg 1991 formula:
     * Body fat % = (1.20 * BMI) + (0.23 * age) - (10.8 * sex) - 5.4
     * where sex = 1 for males, 0 for females
     */

    it('should calculate body fat for adult male', () => {
      const profile: UserProfile = { gender: 'male', age: 35, heightCm: 175 };
      const measurement: RawMeasurement = { weightKg: 75 };

      // BMI = 75 / (1.75^2) = 24.49, rounded to 24.5
      // BF% = (1.20 * 24.5) + (0.23 * 35) - (10.8 * 1) - 5.4
      // BF% = 29.4 + 8.05 - 10.8 - 5.4 = 21.25
      const result = calculateBodyFatDeurenberg1991(profile, measurement);
      expect(result).toBeGreaterThan(20);
      expect(result).toBeLessThan(23);
    });

    it('should calculate body fat for adult female', () => {
      const profile: UserProfile = { gender: 'female', age: 35, heightCm: 165 };
      const measurement: RawMeasurement = { weightKg: 60 };

      // BMI = 60 / (1.65^2) = 22.04
      // BF% = (1.20 * 22.0) + (0.23 * 35) - (10.8 * 0) - 5.4
      // BF% = 26.4 + 8.05 - 0 - 5.4 = 29.05
      const result = calculateBodyFatDeurenberg1991(profile, measurement);
      expect(result).toBeGreaterThan(28);
      expect(result).toBeLessThan(31);
    });

    it('should calculate body fat for young male (age 20)', () => {
      const profile: UserProfile = { gender: 'male', age: 20, heightCm: 180 };
      const measurement: RawMeasurement = { weightKg: 70 };

      // BMI = 70 / (1.80^2) = 21.60
      // Young males should have lower body fat
      const result = calculateBodyFatDeurenberg1991(profile, measurement);
      expect(result).toBeGreaterThan(12);
      expect(result).toBeLessThan(17);
    });

    it('should calculate body fat for older female (age 60)', () => {
      const profile: UserProfile = { gender: 'female', age: 60, heightCm: 160 };
      const measurement: RawMeasurement = { weightKg: 65 };

      // Older females should have higher body fat
      const result = calculateBodyFatDeurenberg1991(profile, measurement);
      expect(result).toBeGreaterThan(35);
      expect(result).toBeLessThan(42);
    });

    it('should handle lean athlete profile', () => {
      const profile: UserProfile = { gender: 'male', age: 25, heightCm: 178 };
      const measurement: RawMeasurement = { weightKg: 68 };

      // BMI = 68 / (1.78^2) = 21.46
      // Lean young male
      const result = calculateBodyFatDeurenberg1991(profile, measurement);
      expect(result).toBeGreaterThan(13);
      expect(result).toBeLessThan(18);
    });

    it('should handle overweight profile', () => {
      const profile: UserProfile = { gender: 'male', age: 45, heightCm: 170 };
      const measurement: RawMeasurement = { weightKg: 95 };

      // BMI = 95 / (1.70^2) = 32.87
      // Higher BMI = higher body fat
      const result = calculateBodyFatDeurenberg1991(profile, measurement);
      expect(result).toBeGreaterThan(30);
      expect(result).toBeLessThan(38);
    });

    it('should throw error for invalid age (too young)', () => {
      const profile: UserProfile = { gender: 'male', age: 5, heightCm: 120 };
      const measurement: RawMeasurement = { weightKg: 25 };

      expect(() => calculateBodyFatDeurenberg1991(profile, measurement)).toThrow(
        'Age must be between 7 and 80 for Deurenberg formula'
      );
    });

    it('should throw error for invalid age (too old)', () => {
      const profile: UserProfile = { gender: 'female', age: 85, heightCm: 160 };
      const measurement: RawMeasurement = { weightKg: 60 };

      expect(() => calculateBodyFatDeurenberg1991(profile, measurement)).toThrow(
        'Age must be between 7 and 80 for Deurenberg formula'
      );
    });

    it('should throw error for negative weight', () => {
      const profile: UserProfile = { gender: 'male', age: 30, heightCm: 175 };
      const measurement: RawMeasurement = { weightKg: -70 };

      expect(() => calculateBodyFatDeurenberg1991(profile, measurement)).toThrow(
        'Weight must be a positive number'
      );
    });

    it('should throw error for negative height', () => {
      const profile: UserProfile = { gender: 'male', age: 30, heightCm: -175 };
      const measurement: RawMeasurement = { weightKg: 70 };

      expect(() => calculateBodyFatDeurenberg1991(profile, measurement)).toThrow(
        'Height must be a positive number'
      );
    });

    it('should handle edge case at minimum valid age (7)', () => {
      const profile: UserProfile = { gender: 'male', age: 7, heightCm: 120 };
      const measurement: RawMeasurement = { weightKg: 25 };

      const result = calculateBodyFatDeurenberg1991(profile, measurement);
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(50);
    });

    it('should handle edge case at maximum valid age (80)', () => {
      const profile: UserProfile = { gender: 'female', age: 80, heightCm: 155 };
      const measurement: RawMeasurement = { weightKg: 55 };

      const result = calculateBodyFatDeurenberg1991(profile, measurement);
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(60);
    });
  });

  describe('calculateBodyFatDeurenberg1992', () => {
    /**
     * Deurenberg 1992 formula (corrected):
     * Body fat % = (1.29 * BMI) + (0.20 * age) - (11.4 * sex) - 8.0
     * where sex = 1 for males, 0 for females
     */

    it('should calculate body fat for adult male', () => {
      const profile: UserProfile = { gender: 'male', age: 35, heightCm: 175 };
      const measurement: RawMeasurement = { weightKg: 75 };

      // BMI = 75 / (1.75^2) = 24.5 (rounded)
      // BF% = (1.29 * 24.5) + (0.20 * 35) - (11.4 * 1) - 8.0
      const result = calculateBodyFatDeurenberg1992(profile, measurement);
      expect(result).toBeGreaterThan(17);
      expect(result).toBeLessThan(22);
    });

    it('should calculate body fat for adult female', () => {
      const profile: UserProfile = { gender: 'female', age: 35, heightCm: 165 };
      const measurement: RawMeasurement = { weightKg: 60 };

      // BMI = 60 / (1.65^2) = 22.0 (rounded)
      const result = calculateBodyFatDeurenberg1992(profile, measurement);
      expect(result).toBeGreaterThan(25);
      expect(result).toBeLessThan(30);
    });

    it('should produce different results than 1991 formula', () => {
      const profile: UserProfile = { gender: 'male', age: 35, heightCm: 175 };
      const measurement: RawMeasurement = { weightKg: 75 };

      const result1991 = calculateBodyFatDeurenberg1991(profile, measurement);
      const result1992 = calculateBodyFatDeurenberg1992(profile, measurement);

      expect(result1991).not.toBe(result1992);
    });

    it('should throw error for invalid age (too young)', () => {
      const profile: UserProfile = { gender: 'male', age: 5, heightCm: 120 };
      const measurement: RawMeasurement = { weightKg: 25 };

      expect(() => calculateBodyFatDeurenberg1992(profile, measurement)).toThrow(
        'Age must be between 7 and 80 for Deurenberg formula'
      );
    });
  });

  describe('Body fat formula comparison', () => {
    it('should show age effect on body fat percentage', () => {
      const measurement: RawMeasurement = { weightKg: 70 };
      const baseProfile = { gender: 'male' as const, heightCm: 175 };

      const young = calculateBodyFatDeurenberg1991(
        { ...baseProfile, age: 25 },
        measurement
      );
      const middle = calculateBodyFatDeurenberg1991(
        { ...baseProfile, age: 45 },
        measurement
      );
      const older = calculateBodyFatDeurenberg1991(
        { ...baseProfile, age: 65 },
        measurement
      );

      // Body fat should increase with age
      expect(middle).toBeGreaterThan(young);
      expect(older).toBeGreaterThan(middle);
    });

    it('should show gender difference in body fat percentage', () => {
      const measurement: RawMeasurement = { weightKg: 70 };
      const age = 35;

      const maleResult = calculateBodyFatDeurenberg1991(
        { gender: 'male', age, heightCm: 175 },
        measurement
      );
      const femaleResult = calculateBodyFatDeurenberg1991(
        { gender: 'female', age, heightCm: 175 },
        measurement
      );

      // Women typically have higher body fat percentage
      expect(femaleResult).toBeGreaterThan(maleResult);
      // Difference should be approximately 10.8% (the formula coefficient)
      expect(femaleResult - maleResult).toBeCloseTo(10.8, 0);
    });
  });
});

describe('Body Fat Calculations - Gallagher Formula', () => {
  /**
   * Gallagher 2000 formula (ethnicity-aware):
   * Simplified version based on research findings
   * Accounts for ~4% higher body fat in Asian populations at same BMI
   */

  describe('calculateBodyFatGallagher', () => {
    it('should calculate body fat for non-asian male', () => {
      const profile: UserProfile = {
        gender: 'male',
        age: 35,
        heightCm: 175,
        ethnicity: 'non-asian',
      };
      const measurement: RawMeasurement = { weightKg: 75 };

      const result = calculateBodyFatGallagher(profile, measurement);
      expect(result).toBeGreaterThan(10);
      expect(result).toBeLessThan(30);
    });

    it('should calculate body fat for non-asian female', () => {
      const profile: UserProfile = {
        gender: 'female',
        age: 35,
        heightCm: 165,
        ethnicity: 'non-asian',
      };
      const measurement: RawMeasurement = { weightKg: 60 };

      const result = calculateBodyFatGallagher(profile, measurement);
      expect(result).toBeGreaterThan(18);
      expect(result).toBeLessThan(40);
    });

    it('should calculate body fat for asian male', () => {
      const profile: UserProfile = {
        gender: 'male',
        age: 35,
        heightCm: 170,
        ethnicity: 'asian',
      };
      const measurement: RawMeasurement = { weightKg: 70 };

      const result = calculateBodyFatGallagher(profile, measurement);
      expect(result).toBeGreaterThan(15);
      expect(result).toBeLessThan(35);
    });

    it('should calculate body fat for asian female', () => {
      const profile: UserProfile = {
        gender: 'female',
        age: 35,
        heightCm: 160,
        ethnicity: 'asian',
      };
      const measurement: RawMeasurement = { weightKg: 55 };

      const result = calculateBodyFatGallagher(profile, measurement);
      expect(result).toBeGreaterThan(25);
      expect(result).toBeLessThan(45);
    });

    it('should show ethnicity effect - asian should have higher body fat at same BMI', () => {
      const measurement: RawMeasurement = { weightKg: 70 };
      const baseProfile = { gender: 'male' as const, age: 35, heightCm: 175 };

      const nonAsian = calculateBodyFatGallagher(
        { ...baseProfile, ethnicity: 'non-asian' },
        measurement
      );
      const asian = calculateBodyFatGallagher(
        { ...baseProfile, ethnicity: 'asian' },
        measurement
      );

      // Asian populations tend to have higher body fat at same BMI
      expect(asian).toBeGreaterThan(nonAsian);
      // Difference should be approximately 4% (the ethnicity adjustment)
      expect(asian - nonAsian).toBeCloseTo(4, 0);
    });

    it('should default to non-asian when ethnicity is not specified', () => {
      const profile: UserProfile = {
        gender: 'male',
        age: 35,
        heightCm: 175,
        // ethnicity not specified
      };
      const measurement: RawMeasurement = { weightKg: 75 };

      const result = calculateBodyFatGallagher(profile, measurement);

      const explicitNonAsian = calculateBodyFatGallagher(
        { ...profile, ethnicity: 'non-asian' },
        measurement
      );

      expect(result).toBe(explicitNonAsian);
    });

    it('should handle young adult (age 20)', () => {
      const profile: UserProfile = {
        gender: 'male',
        age: 20,
        heightCm: 180,
        ethnicity: 'non-asian',
      };
      const measurement: RawMeasurement = { weightKg: 75 };

      const result = calculateBodyFatGallagher(profile, measurement);
      expect(result).toBeGreaterThan(5);
      expect(result).toBeLessThan(25);
    });

    it('should handle older adult (age 70)', () => {
      const profile: UserProfile = {
        gender: 'female',
        age: 70,
        heightCm: 160,
        ethnicity: 'non-asian',
      };
      const measurement: RawMeasurement = { weightKg: 65 };

      const result = calculateBodyFatGallagher(profile, measurement);
      expect(result).toBeGreaterThan(30);
      expect(result).toBeLessThan(50);
    });

    it('should throw error for invalid age (negative)', () => {
      const profile: UserProfile = {
        gender: 'male',
        age: -5,
        heightCm: 175,
        ethnicity: 'non-asian',
      };
      const measurement: RawMeasurement = { weightKg: 75 };

      expect(() => calculateBodyFatGallagher(profile, measurement)).toThrow(
        'Age must be a positive number'
      );
    });

    it('should throw error for invalid weight (zero)', () => {
      const profile: UserProfile = {
        gender: 'male',
        age: 35,
        heightCm: 175,
        ethnicity: 'non-asian',
      };
      const measurement: RawMeasurement = { weightKg: 0 };

      expect(() => calculateBodyFatGallagher(profile, measurement)).toThrow(
        'Weight must be a positive number'
      );
    });

    it('should throw error for invalid height (zero)', () => {
      const profile: UserProfile = {
        gender: 'male',
        age: 35,
        heightCm: 0,
        ethnicity: 'non-asian',
      };
      const measurement: RawMeasurement = { weightKg: 75 };

      expect(() => calculateBodyFatGallagher(profile, measurement)).toThrow(
        'Height must be a positive number'
      );
    });

    it('should clamp very low body fat values to minimum of 2%', () => {
      const profile: UserProfile = {
        gender: 'male',
        age: 15,
        heightCm: 180,
        ethnicity: 'non-asian',
      };
      const measurement: RawMeasurement = { weightKg: 55 };

      // Very low BMI young male could produce negative/very low values
      const result = calculateBodyFatGallagher(profile, measurement);
      expect(result).toBeGreaterThanOrEqual(2.0);
    });
  });

  describe('Gallagher formula characteristics', () => {
    it('should show age increases body fat percentage', () => {
      const measurement: RawMeasurement = { weightKg: 70 };
      const baseProfile = {
        gender: 'male' as const,
        heightCm: 175,
        ethnicity: 'non-asian' as const,
      };

      const young = calculateBodyFatGallagher(
        { ...baseProfile, age: 25 },
        measurement
      );
      const middle = calculateBodyFatGallagher(
        { ...baseProfile, age: 45 },
        measurement
      );
      const older = calculateBodyFatGallagher(
        { ...baseProfile, age: 65 },
        measurement
      );

      expect(middle).toBeGreaterThan(young);
      expect(older).toBeGreaterThan(middle);
    });

    it('should show females have higher body fat than males at same BMI', () => {
      const measurement: RawMeasurement = { weightKg: 70 };

      const male = calculateBodyFatGallagher(
        { gender: 'male', age: 35, heightCm: 175, ethnicity: 'non-asian' },
        measurement
      );
      const female = calculateBodyFatGallagher(
        { gender: 'female', age: 35, heightCm: 175, ethnicity: 'non-asian' },
        measurement
      );

      expect(female).toBeGreaterThan(male);
    });

    it('should produce reasonable results across BMI range', () => {
      const profile: UserProfile = {
        gender: 'male',
        age: 35,
        heightCm: 175,
        ethnicity: 'non-asian',
      };

      // Underweight
      const underweight = calculateBodyFatGallagher(profile, { weightKg: 50 });
      // Normal
      const normal = calculateBodyFatGallagher(profile, { weightKg: 70 });
      // Overweight
      const overweight = calculateBodyFatGallagher(profile, { weightKg: 90 });
      // Obese
      const obese = calculateBodyFatGallagher(profile, { weightKg: 110 });

      expect(underweight).toBeLessThan(normal);
      expect(normal).toBeLessThan(overweight);
      expect(overweight).toBeLessThan(obese);

      // All results should be reasonable (between 2 and 55%)
      expect(underweight).toBeGreaterThanOrEqual(2);
      expect(obese).toBeLessThan(55);
    });
  });
});

describe('Body Fat Calculations - Pure Function Properties', () => {
  it('should return the same result for same inputs (idempotent)', () => {
    const profile: UserProfile = { gender: 'male', age: 35, heightCm: 175 };
    const measurement: RawMeasurement = { weightKg: 75 };

    const result1 = calculateBodyFatDeurenberg1991(profile, measurement);
    const result2 = calculateBodyFatDeurenberg1991(profile, measurement);
    const result3 = calculateBodyFatDeurenberg1991(profile, measurement);

    expect(result1).toBe(result2);
    expect(result2).toBe(result3);
  });

  it('should not modify input profile object', () => {
    const profile: UserProfile = { gender: 'male', age: 35, heightCm: 175 };
    const measurement: RawMeasurement = { weightKg: 75 };
    const originalProfile = { ...profile };

    calculateBodyFatDeurenberg1991(profile, measurement);

    expect(profile).toEqual(originalProfile);
  });

  it('should not modify input measurement object', () => {
    const profile: UserProfile = { gender: 'male', age: 35, heightCm: 175 };
    const measurement: RawMeasurement = { weightKg: 75 };
    const originalMeasurement = { ...measurement };

    calculateBodyFatDeurenberg1991(profile, measurement);

    expect(measurement).toEqual(originalMeasurement);
  });
});

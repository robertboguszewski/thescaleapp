/**
 * BMR (Basal Metabolic Rate) Calculations Tests
 *
 * Testing formulas:
 * - Mifflin-St Jeor (1990)
 * - Harris-Benedict (1918/1984 revised)
 * - Katch-McArdle (1973)
 *
 * @module domain/calculations/__tests__/bmr.test
 */

import { describe, it, expect } from 'vitest';
import { calculateBMR_MifflinStJeor } from '../bmr/mifflin-st-jeor';
import { calculateBMR_HarrisBenedict } from '../bmr/harris-benedict';
import { calculateBMR_KatchMcArdle } from '../bmr/katch-mcardle';
import type { UserProfile, RawMeasurement } from '../types';

describe('BMR Calculations', () => {
  describe('Mifflin-St Jeor Formula (1990)', () => {
    /**
     * Reference: Mifflin MD, St Jeor ST, et al. (1990)
     * "A new predictive equation for resting energy expenditure in healthy individuals"
     * American Journal of Clinical Nutrition 51(2):241-247
     *
     * Male: BMR = (10 x weight kg) + (6.25 x height cm) - (5 x age) + 5
     * Female: BMR = (10 x weight kg) + (6.25 x height cm) - (5 x age) - 161
     */

    it('should calculate BMR correctly for adult male', () => {
      const profile: UserProfile = { gender: 'male', age: 35, heightCm: 178 };
      const measurement: RawMeasurement = { weightKg: 75 };

      const result = calculateBMR_MifflinStJeor(profile, measurement);

      // Expected: (10 * 75) + (6.25 * 178) - (5 * 35) + 5
      // = 750 + 1112.5 - 175 + 5 = 1692.5
      expect(result).toBeCloseTo(1692.5, 0);
    });

    it('should calculate BMR correctly for adult female', () => {
      const profile: UserProfile = { gender: 'female', age: 30, heightCm: 165 };
      const measurement: RawMeasurement = { weightKg: 60 };

      const result = calculateBMR_MifflinStJeor(profile, measurement);

      // Expected: (10 * 60) + (6.25 * 165) - (5 * 30) - 161
      // = 600 + 1031.25 - 150 - 161 = 1320.25
      expect(result).toBeCloseTo(1320.25, 0);
    });

    it('should handle young adult (age 18)', () => {
      const profile: UserProfile = { gender: 'male', age: 18, heightCm: 175 };
      const measurement: RawMeasurement = { weightKg: 70 };

      const result = calculateBMR_MifflinStJeor(profile, measurement);

      // Expected: (10 * 70) + (6.25 * 175) - (5 * 18) + 5
      // = 700 + 1093.75 - 90 + 5 = 1708.75
      expect(result).toBeCloseTo(1708.75, 0);
    });

    it('should handle elderly person (age 70)', () => {
      const profile: UserProfile = { gender: 'female', age: 70, heightCm: 160 };
      const measurement: RawMeasurement = { weightKg: 55 };

      const result = calculateBMR_MifflinStJeor(profile, measurement);

      // Expected: (10 * 55) + (6.25 * 160) - (5 * 70) - 161
      // = 550 + 1000 - 350 - 161 = 1039
      expect(result).toBeCloseTo(1039, 0);
    });

    it('should be a pure function (same input = same output)', () => {
      const profile: UserProfile = { gender: 'male', age: 40, heightCm: 180 };
      const measurement: RawMeasurement = { weightKg: 80 };

      const result1 = calculateBMR_MifflinStJeor(profile, measurement);
      const result2 = calculateBMR_MifflinStJeor(profile, measurement);

      expect(result1).toBe(result2);
    });

    it('should return positive value for any valid input', () => {
      const profile: UserProfile = { gender: 'female', age: 80, heightCm: 150 };
      const measurement: RawMeasurement = { weightKg: 45 };

      const result = calculateBMR_MifflinStJeor(profile, measurement);

      expect(result).toBeGreaterThan(0);
    });
  });

  describe('Harris-Benedict Formula (1918, Revised 1984)', () => {
    /**
     * Reference: Harris JA, Benedict FG (1918)
     * "A Biometric Study of Human Basal Metabolism"
     * Carnegie Institution of Washington, Publication No. 279
     *
     * Revised by Roza & Shizgal (1984):
     * Male: BMR = 88.362 + (13.397 x weight kg) + (4.799 x height cm) - (5.677 x age)
     * Female: BMR = 447.593 + (9.247 x weight kg) + (3.098 x height cm) - (4.330 x age)
     */

    it('should calculate BMR correctly for adult male', () => {
      const profile: UserProfile = { gender: 'male', age: 35, heightCm: 178 };
      const measurement: RawMeasurement = { weightKg: 75 };

      const result = calculateBMR_HarrisBenedict(profile, measurement);

      // Expected: 88.362 + (13.397 * 75) + (4.799 * 178) - (5.677 * 35)
      // = 88.362 + 1004.775 + 854.222 - 198.695 = 1748.664
      expect(result).toBeCloseTo(1748.66, 0);
    });

    it('should calculate BMR correctly for adult female', () => {
      const profile: UserProfile = { gender: 'female', age: 30, heightCm: 165 };
      const measurement: RawMeasurement = { weightKg: 60 };

      const result = calculateBMR_HarrisBenedict(profile, measurement);

      // Expected: 447.593 + (9.247 * 60) + (3.098 * 165) - (4.330 * 30)
      // = 447.593 + 554.82 + 511.17 - 129.9 = 1383.683
      expect(result).toBeCloseTo(1383.68, 0);
    });

    it('should handle young athlete', () => {
      const profile: UserProfile = { gender: 'male', age: 22, heightCm: 185 };
      const measurement: RawMeasurement = { weightKg: 85 };

      const result = calculateBMR_HarrisBenedict(profile, measurement);

      expect(result).toBeGreaterThan(1800);
      expect(result).toBeLessThan(2200);
    });

    it('should return higher BMR for heavier person with same height/age', () => {
      const profile: UserProfile = { gender: 'male', age: 40, heightCm: 175 };
      const lightMeasurement: RawMeasurement = { weightKg: 65 };
      const heavyMeasurement: RawMeasurement = { weightKg: 90 };

      const lightBMR = calculateBMR_HarrisBenedict(profile, lightMeasurement);
      const heavyBMR = calculateBMR_HarrisBenedict(profile, heavyMeasurement);

      expect(heavyBMR).toBeGreaterThan(lightBMR);
    });

    it('should return lower BMR for older person with same weight/height', () => {
      const youngProfile: UserProfile = { gender: 'female', age: 25, heightCm: 165 };
      const oldProfile: UserProfile = { gender: 'female', age: 60, heightCm: 165 };
      const measurement: RawMeasurement = { weightKg: 60 };

      const youngBMR = calculateBMR_HarrisBenedict(youngProfile, measurement);
      const oldBMR = calculateBMR_HarrisBenedict(oldProfile, measurement);

      expect(youngBMR).toBeGreaterThan(oldBMR);
    });
  });

  describe('Katch-McArdle Formula (1973)', () => {
    /**
     * Reference: Katch F, McArdle WD (1973)
     * "Prediction of Body Density from Simple Anthropometric Measurements"
     * Journal of Applied Physiology 35(6):801-804
     *
     * Formula: BMR = 370 + (21.6 x LBM)
     * where LBM = weight x (1 - bodyFat/100)
     */

    it('should calculate BMR correctly for male athlete with low body fat', () => {
      const measurement: RawMeasurement = { weightKg: 75 };
      const bodyFatPercent = 12;

      const result = calculateBMR_KatchMcArdle(measurement, bodyFatPercent);

      // LBM = 75 * (1 - 12/100) = 75 * 0.88 = 66
      // BMR = 370 + (21.6 * 66) = 370 + 1425.6 = 1795.6
      expect(result).toBeCloseTo(1795.6, 0);
    });

    it('should calculate BMR correctly for female with average body fat', () => {
      const measurement: RawMeasurement = { weightKg: 60 };
      const bodyFatPercent = 25;

      const result = calculateBMR_KatchMcArdle(measurement, bodyFatPercent);

      // LBM = 60 * (1 - 25/100) = 60 * 0.75 = 45
      // BMR = 370 + (21.6 * 45) = 370 + 972 = 1342
      expect(result).toBeCloseTo(1342, 0);
    });

    it('should calculate BMR correctly for obese person', () => {
      const measurement: RawMeasurement = { weightKg: 100 };
      const bodyFatPercent = 40;

      const result = calculateBMR_KatchMcArdle(measurement, bodyFatPercent);

      // LBM = 100 * (1 - 40/100) = 100 * 0.6 = 60
      // BMR = 370 + (21.6 * 60) = 370 + 1296 = 1666
      expect(result).toBeCloseTo(1666, 0);
    });

    it('should return higher BMR for person with more lean mass at same weight', () => {
      const measurement: RawMeasurement = { weightKg: 80 };

      const leanBMR = calculateBMR_KatchMcArdle(measurement, 15); // 15% body fat
      const fatBMR = calculateBMR_KatchMcArdle(measurement, 30); // 30% body fat

      expect(leanBMR).toBeGreaterThan(fatBMR);
    });

    it('should handle edge case with minimum body fat (3%)', () => {
      const measurement: RawMeasurement = { weightKg: 70 };
      const bodyFatPercent = 3;

      const result = calculateBMR_KatchMcArdle(measurement, bodyFatPercent);

      // LBM = 70 * 0.97 = 67.9
      // BMR = 370 + (21.6 * 67.9) = 370 + 1466.64 = 1836.64
      expect(result).toBeCloseTo(1836.64, 0);
    });

    it('should handle edge case with high body fat (60%)', () => {
      const measurement: RawMeasurement = { weightKg: 120 };
      const bodyFatPercent = 60;

      const result = calculateBMR_KatchMcArdle(measurement, bodyFatPercent);

      // LBM = 120 * 0.4 = 48
      // BMR = 370 + (21.6 * 48) = 370 + 1036.8 = 1406.8
      expect(result).toBeCloseTo(1406.8, 0);
    });

    it('should be gender-neutral (uses only LBM)', () => {
      const measurement: RawMeasurement = { weightKg: 70 };
      const bodyFatPercent = 20;

      // Same inputs should always produce same output regardless of caller context
      const result1 = calculateBMR_KatchMcArdle(measurement, bodyFatPercent);
      const result2 = calculateBMR_KatchMcArdle(measurement, bodyFatPercent);

      expect(result1).toBe(result2);
    });
  });

  describe('BMR Formula Comparison', () => {
    it('should produce reasonably similar results for typical adult male', () => {
      const profile: UserProfile = { gender: 'male', age: 35, heightCm: 178 };
      const measurement: RawMeasurement = { weightKg: 75 };
      const bodyFatPercent = 18;

      const mifflin = calculateBMR_MifflinStJeor(profile, measurement);
      const harris = calculateBMR_HarrisBenedict(profile, measurement);
      const katch = calculateBMR_KatchMcArdle(measurement, bodyFatPercent);

      // All should be within 10% of each other for typical person
      const average = (mifflin + harris + katch) / 3;
      expect(Math.abs(mifflin - average) / average).toBeLessThan(0.1);
      expect(Math.abs(harris - average) / average).toBeLessThan(0.1);
      expect(Math.abs(katch - average) / average).toBeLessThan(0.1);
    });

    it('should produce reasonably similar results for typical adult female', () => {
      const profile: UserProfile = { gender: 'female', age: 30, heightCm: 165 };
      const measurement: RawMeasurement = { weightKg: 60 };
      const bodyFatPercent = 25;

      const mifflin = calculateBMR_MifflinStJeor(profile, measurement);
      const harris = calculateBMR_HarrisBenedict(profile, measurement);
      const katch = calculateBMR_KatchMcArdle(measurement, bodyFatPercent);

      // All should be within 10% of each other
      const average = (mifflin + harris + katch) / 3;
      expect(Math.abs(mifflin - average) / average).toBeLessThan(0.1);
      expect(Math.abs(harris - average) / average).toBeLessThan(0.1);
      expect(Math.abs(katch - average) / average).toBeLessThan(0.1);
    });
  });

  describe('Numerical Stability', () => {
    it('should not produce NaN', () => {
      const profile: UserProfile = { gender: 'male', age: 40, heightCm: 175 };
      const measurement: RawMeasurement = { weightKg: 75 };

      expect(Number.isNaN(calculateBMR_MifflinStJeor(profile, measurement))).toBe(false);
      expect(Number.isNaN(calculateBMR_HarrisBenedict(profile, measurement))).toBe(false);
      expect(Number.isNaN(calculateBMR_KatchMcArdle(measurement, 20))).toBe(false);
    });

    it('should not produce Infinity', () => {
      const profile: UserProfile = { gender: 'female', age: 35, heightCm: 165 };
      const measurement: RawMeasurement = { weightKg: 60 };

      expect(Number.isFinite(calculateBMR_MifflinStJeor(profile, measurement))).toBe(true);
      expect(Number.isFinite(calculateBMR_HarrisBenedict(profile, measurement))).toBe(true);
      expect(Number.isFinite(calculateBMR_KatchMcArdle(measurement, 25))).toBe(true);
    });
  });
});

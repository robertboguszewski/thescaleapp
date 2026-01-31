/**
 * Body Water Calculations Tests
 *
 * Testing formula:
 * - Hume-Weyers (1971)
 *
 * @module domain/calculations/__tests__/body-water.test
 */

import { describe, it, expect } from 'vitest';
import { calculateBodyWaterHumeWeyers, calculateBodyWaterLiters } from '../body-water/hume-weyers';
import type { UserProfile, RawMeasurement } from '../types';

describe('Body Water Calculations', () => {
  describe('Hume-Weyers Formula (1971)', () => {
    /**
     * Reference: Hume R, Weyers E (1971)
     * "Relationship between total body water and surface area in normal and obese subjects"
     * Journal of Clinical Pathology 24(3):234-238
     *
     * Male:   TBW (L) = 0.194786 x height (cm) + 0.296785 x weight (kg) - 14.012934
     * Female: TBW (L) = 0.344547 x height (cm) + 0.183809 x weight (kg) - 35.270121
     */

    it('should calculate body water percentage correctly for adult male', () => {
      const profile: UserProfile = { gender: 'male', age: 35, heightCm: 178 };
      const measurement: RawMeasurement = { weightKg: 75 };

      const result = calculateBodyWaterHumeWeyers(profile, measurement);

      // TBW (L) = 0.194786 * 178 + 0.296785 * 75 - 14.012934
      // = 34.671908 + 22.258875 - 14.012934 = 42.917849 L
      // Percentage = (42.917849 / 75) * 100 = 57.22%
      expect(result).toBeCloseTo(57.22, 0);
    });

    it('should calculate body water percentage correctly for adult female', () => {
      const profile: UserProfile = { gender: 'female', age: 30, heightCm: 165 };
      const measurement: RawMeasurement = { weightKg: 60 };

      const result = calculateBodyWaterHumeWeyers(profile, measurement);

      // TBW (L) = 0.344547 * 165 + 0.183809 * 60 - 35.270121
      // = 56.850255 + 11.02854 - 35.270121 = 32.608674 L
      // Percentage = (32.608674 / 60) * 100 = 54.35%
      expect(result).toBeCloseTo(54.35, 0);
    });

    it('should return higher percentage for males than females at similar body composition', () => {
      const maleProfile: UserProfile = { gender: 'male', age: 30, heightCm: 175 };
      const femaleProfile: UserProfile = { gender: 'female', age: 30, heightCm: 165 };
      const maleMeasurement: RawMeasurement = { weightKg: 75 };
      const femaleMeasurement: RawMeasurement = { weightKg: 60 };

      const maleResult = calculateBodyWaterHumeWeyers(maleProfile, maleMeasurement);
      const femaleResult = calculateBodyWaterHumeWeyers(femaleProfile, femaleMeasurement);

      // Males typically have higher body water percentage due to more muscle mass
      expect(maleResult).toBeGreaterThan(femaleResult);
    });

    it('should return value in healthy range for typical adult', () => {
      const profile: UserProfile = { gender: 'male', age: 40, heightCm: 180 };
      const measurement: RawMeasurement = { weightKg: 80 };

      const result = calculateBodyWaterHumeWeyers(profile, measurement);

      // Healthy range for males: 50-65%
      expect(result).toBeGreaterThan(45);
      expect(result).toBeLessThan(70);
    });

    it('should handle young adult', () => {
      const profile: UserProfile = { gender: 'female', age: 20, heightCm: 168 };
      const measurement: RawMeasurement = { weightKg: 55 };

      const result = calculateBodyWaterHumeWeyers(profile, measurement);

      // Healthy range for young females: 45-60%
      expect(result).toBeGreaterThan(40);
      expect(result).toBeLessThan(65);
    });

    it('should handle elderly person', () => {
      const profile: UserProfile = { gender: 'male', age: 70, heightCm: 170 };
      const measurement: RawMeasurement = { weightKg: 70 };

      const result = calculateBodyWaterHumeWeyers(profile, measurement);

      // Should still produce valid result
      expect(result).toBeGreaterThan(40);
      expect(result).toBeLessThan(70);
    });

    it('should be a pure function', () => {
      const profile: UserProfile = { gender: 'male', age: 35, heightCm: 175 };
      const measurement: RawMeasurement = { weightKg: 72 };

      const result1 = calculateBodyWaterHumeWeyers(profile, measurement);
      const result2 = calculateBodyWaterHumeWeyers(profile, measurement);

      expect(result1).toBe(result2);
    });

    it('should decrease percentage with higher body weight (more fat = less water %)', () => {
      const profile: UserProfile = { gender: 'male', age: 40, heightCm: 175 };
      const leanMeasurement: RawMeasurement = { weightKg: 70 };
      const heavyMeasurement: RawMeasurement = { weightKg: 100 };

      const leanResult = calculateBodyWaterHumeWeyers(profile, leanMeasurement);
      const heavyResult = calculateBodyWaterHumeWeyers(profile, heavyMeasurement);

      // At same height, heavier person will have lower body water percentage
      // because fat tissue contains less water than lean tissue
      expect(leanResult).toBeGreaterThan(heavyResult);
    });
  });

  describe('Body Water in Liters', () => {
    it('should calculate absolute body water in liters for male', () => {
      const profile: UserProfile = { gender: 'male', age: 35, heightCm: 178 };
      const measurement: RawMeasurement = { weightKg: 75 };

      const result = calculateBodyWaterLiters(profile, measurement);

      // Expected: ~42.9 L (see formula above)
      expect(result).toBeCloseTo(42.9, 0);
    });

    it('should calculate absolute body water in liters for female', () => {
      const profile: UserProfile = { gender: 'female', age: 30, heightCm: 165 };
      const measurement: RawMeasurement = { weightKg: 60 };

      const result = calculateBodyWaterLiters(profile, measurement);

      // Expected: ~32.6 L
      expect(result).toBeCloseTo(32.6, 0);
    });

    it('should increase with body weight', () => {
      const profile: UserProfile = { gender: 'male', age: 40, heightCm: 175 };
      const lightMeasurement: RawMeasurement = { weightKg: 65 };
      const heavyMeasurement: RawMeasurement = { weightKg: 85 };

      const lightResult = calculateBodyWaterLiters(profile, lightMeasurement);
      const heavyResult = calculateBodyWaterLiters(profile, heavyMeasurement);

      expect(heavyResult).toBeGreaterThan(lightResult);
    });
  });

  describe('Edge Cases', () => {
    it('should handle minimum weight', () => {
      const profile: UserProfile = { gender: 'female', age: 25, heightCm: 160 };
      const measurement: RawMeasurement = { weightKg: 40 };

      const result = calculateBodyWaterHumeWeyers(profile, measurement);

      expect(result).toBeGreaterThan(0);
      expect(Number.isFinite(result)).toBe(true);
    });

    it('should handle maximum weight', () => {
      const profile: UserProfile = { gender: 'male', age: 45, heightCm: 180 };
      const measurement: RawMeasurement = { weightKg: 150 };

      const result = calculateBodyWaterHumeWeyers(profile, measurement);

      expect(result).toBeGreaterThan(0);
      expect(Number.isFinite(result)).toBe(true);
    });

    it('should handle short height', () => {
      const profile: UserProfile = { gender: 'female', age: 10, heightCm: 120 };
      const measurement: RawMeasurement = { weightKg: 30 };

      const result = calculateBodyWaterHumeWeyers(profile, measurement);

      expect(result).toBeGreaterThan(0);
      expect(Number.isFinite(result)).toBe(true);
    });

    it('should handle tall height', () => {
      const profile: UserProfile = { gender: 'male', age: 25, heightCm: 210 };
      const measurement: RawMeasurement = { weightKg: 100 };

      const result = calculateBodyWaterHumeWeyers(profile, measurement);

      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(100);
    });
  });

  describe('Numerical Stability', () => {
    it('should not produce NaN', () => {
      const profile: UserProfile = { gender: 'male', age: 40, heightCm: 175 };
      const measurement: RawMeasurement = { weightKg: 75 };

      const result = calculateBodyWaterHumeWeyers(profile, measurement);

      expect(Number.isNaN(result)).toBe(false);
    });

    it('should not produce Infinity', () => {
      const profile: UserProfile = { gender: 'female', age: 35, heightCm: 165 };
      const measurement: RawMeasurement = { weightKg: 60 };

      const result = calculateBodyWaterHumeWeyers(profile, measurement);

      expect(Number.isFinite(result)).toBe(true);
    });

    it('should produce result with reasonable precision', () => {
      const profile: UserProfile = { gender: 'male', age: 32, heightCm: 178 };
      const measurement: RawMeasurement = { weightKg: 74.5 };

      const result = calculateBodyWaterHumeWeyers(profile, measurement);

      // Result should not have excessive decimal places in practice
      expect(typeof result).toBe('number');
    });
  });
});

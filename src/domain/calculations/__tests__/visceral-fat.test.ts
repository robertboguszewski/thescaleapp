/**
 * Visceral Fat Calculations Tests
 *
 * Testing functions:
 * - estimateVisceralFat
 * - interpretVisceralFat
 *
 * @module domain/calculations/__tests__/visceral-fat.test
 */

import { describe, it, expect } from 'vitest';
import { estimateVisceralFat, interpretVisceralFat } from '../visceral-fat/index';
import type { UserProfile, VisceralFatInterpretation } from '../types';

describe('Visceral Fat Calculations', () => {
  describe('estimateVisceralFat', () => {
    /**
     * Visceral fat estimation based on:
     * - BMI (primary factor)
     * - Age (visceral fat tends to increase with age)
     * - Gender (males tend to accumulate more visceral fat)
     *
     * Reference: Tanita scale interpretation guidelines
     * Scale: 1-30 (1-9 healthy, 10-14 elevated, 15-24 high, 25-30 very-high)
     */

    it('should estimate low visceral fat for young healthy male', () => {
      const profile: UserProfile = { gender: 'male', age: 25, heightCm: 178 };
      const bmi = 22; // Normal BMI

      const result = estimateVisceralFat(profile, bmi);

      expect(result).toBeGreaterThanOrEqual(1);
      expect(result).toBeLessThanOrEqual(9);
    });

    it('should estimate low visceral fat for young healthy female', () => {
      const profile: UserProfile = { gender: 'female', age: 25, heightCm: 165 };
      const bmi = 21; // Normal BMI

      const result = estimateVisceralFat(profile, bmi);

      expect(result).toBeGreaterThanOrEqual(1);
      expect(result).toBeLessThanOrEqual(9);
    });

    it('should estimate higher visceral fat for older male', () => {
      const youngProfile: UserProfile = { gender: 'male', age: 25, heightCm: 175 };
      const oldProfile: UserProfile = { gender: 'male', age: 55, heightCm: 175 };
      const bmi = 24;

      const youngResult = estimateVisceralFat(youngProfile, bmi);
      const oldResult = estimateVisceralFat(oldProfile, bmi);

      expect(oldResult).toBeGreaterThan(youngResult);
    });

    it('should estimate higher visceral fat for males than females at same BMI/age', () => {
      const maleProfile: UserProfile = { gender: 'male', age: 40, heightCm: 175 };
      const femaleProfile: UserProfile = { gender: 'female', age: 40, heightCm: 165 };
      const bmi = 25;

      const maleResult = estimateVisceralFat(maleProfile, bmi);
      const femaleResult = estimateVisceralFat(femaleProfile, bmi);

      expect(maleResult).toBeGreaterThan(femaleResult);
    });

    it('should estimate higher visceral fat with higher BMI', () => {
      const profile: UserProfile = { gender: 'male', age: 40, heightCm: 175 };
      const normalBmi = 22;
      const overweightBmi = 28;
      const obeseBmi = 35;

      const normalResult = estimateVisceralFat(profile, normalBmi);
      const overweightResult = estimateVisceralFat(profile, overweightBmi);
      const obeseResult = estimateVisceralFat(profile, obeseBmi);

      expect(overweightResult).toBeGreaterThan(normalResult);
      expect(obeseResult).toBeGreaterThan(overweightResult);
    });

    it('should clamp result to minimum of 1', () => {
      const profile: UserProfile = { gender: 'female', age: 18, heightCm: 170 };
      const lowBmi = 17; // Underweight

      const result = estimateVisceralFat(profile, lowBmi);

      expect(result).toBeGreaterThanOrEqual(1);
    });

    it('should clamp result to maximum of 30', () => {
      const profile: UserProfile = { gender: 'male', age: 70, heightCm: 170 };
      const veryHighBmi = 45; // Severe obesity

      const result = estimateVisceralFat(profile, veryHighBmi);

      expect(result).toBeLessThanOrEqual(30);
    });

    it('should be a pure function', () => {
      const profile: UserProfile = { gender: 'male', age: 35, heightCm: 175 };
      const bmi = 24;

      const result1 = estimateVisceralFat(profile, bmi);
      const result2 = estimateVisceralFat(profile, bmi);

      expect(result1).toBe(result2);
    });

    it('should return integer value', () => {
      const profile: UserProfile = { gender: 'female', age: 42, heightCm: 168 };
      const bmi = 26.3;

      const result = estimateVisceralFat(profile, bmi);

      expect(Number.isInteger(result)).toBe(true);
    });
  });

  describe('interpretVisceralFat', () => {
    /**
     * Tanita visceral fat interpretation:
     * 1-9:   Healthy
     * 10-14: Elevated (increased health risk)
     * 15-24: High (significantly increased health risk)
     * 25-30: Very High (critical health risk)
     *
     * Reference: Tanita Body Composition Analyzers documentation
     */

    describe('Healthy range (1-9)', () => {
      it('should interpret level 1 as healthy', () => {
        const result = interpretVisceralFat(1);

        expect(result.status).toBe('healthy');
        expect(result.risk).toBeDefined();
        expect(result.risk.length).toBeGreaterThan(0);
      });

      it('should interpret level 5 as healthy', () => {
        const result = interpretVisceralFat(5);

        expect(result.status).toBe('healthy');
      });

      it('should interpret level 9 as healthy', () => {
        const result = interpretVisceralFat(9);

        expect(result.status).toBe('healthy');
      });
    });

    describe('Elevated range (10-14)', () => {
      it('should interpret level 10 as elevated', () => {
        const result = interpretVisceralFat(10);

        expect(result.status).toBe('elevated');
        expect(result.risk).toBeDefined();
      });

      it('should interpret level 12 as elevated', () => {
        const result = interpretVisceralFat(12);

        expect(result.status).toBe('elevated');
      });

      it('should interpret level 14 as elevated', () => {
        const result = interpretVisceralFat(14);

        expect(result.status).toBe('elevated');
      });
    });

    describe('High range (15-24)', () => {
      it('should interpret level 15 as high', () => {
        const result = interpretVisceralFat(15);

        expect(result.status).toBe('high');
        expect(result.risk).toBeDefined();
      });

      it('should interpret level 20 as high', () => {
        const result = interpretVisceralFat(20);

        expect(result.status).toBe('high');
      });

      it('should interpret level 24 as high', () => {
        const result = interpretVisceralFat(24);

        expect(result.status).toBe('high');
      });
    });

    describe('Very High range (25-30)', () => {
      it('should interpret level 25 as very-high', () => {
        const result = interpretVisceralFat(25);

        expect(result.status).toBe('very-high');
      });

      it('should interpret level 28 as very-high', () => {
        const result = interpretVisceralFat(28);

        expect(result.status).toBe('very-high');
      });

      it('should interpret level 30 as very-high', () => {
        const result = interpretVisceralFat(30);

        expect(result.status).toBe('very-high');
      });
    });

    describe('Risk descriptions', () => {
      it('should provide reassuring risk for healthy level', () => {
        const result = interpretVisceralFat(5);

        expect(result.risk.toLowerCase()).toContain('low');
      });

      it('should mention monitoring for elevated level', () => {
        const result = interpretVisceralFat(12);

        expect(result.risk.length).toBeGreaterThan(10);
      });

      it('should mention health concerns for high level', () => {
        const result = interpretVisceralFat(18);

        expect(result.risk.length).toBeGreaterThan(10);
      });

      it('should indicate serious concern for very high level', () => {
        const result = interpretVisceralFat(28);

        expect(result.risk.length).toBeGreaterThan(10);
      });
    });

    describe('Return type', () => {
      it('should return VisceralFatInterpretation object', () => {
        const result = interpretVisceralFat(8);

        expect(result).toHaveProperty('status');
        expect(result).toHaveProperty('risk');
        expect(typeof result.status).toBe('string');
        expect(typeof result.risk).toBe('string');
      });
    });
  });

  describe('Edge Cases', () => {
    describe('estimateVisceralFat edge cases', () => {
      it('should handle young age (6 years)', () => {
        const profile: UserProfile = { gender: 'male', age: 6, heightCm: 120 };
        const bmi = 16;

        const result = estimateVisceralFat(profile, bmi);

        expect(result).toBeGreaterThanOrEqual(1);
        expect(result).toBeLessThanOrEqual(30);
      });

      it('should handle old age (80 years)', () => {
        const profile: UserProfile = { gender: 'female', age: 80, heightCm: 155 };
        const bmi = 24;

        const result = estimateVisceralFat(profile, bmi);

        expect(result).toBeGreaterThanOrEqual(1);
        expect(result).toBeLessThanOrEqual(30);
      });

      it('should handle very low BMI', () => {
        const profile: UserProfile = { gender: 'female', age: 25, heightCm: 165 };
        const bmi = 15;

        const result = estimateVisceralFat(profile, bmi);

        expect(result).toBeGreaterThanOrEqual(1);
      });

      it('should handle very high BMI', () => {
        const profile: UserProfile = { gender: 'male', age: 50, heightCm: 175 };
        const bmi = 50;

        const result = estimateVisceralFat(profile, bmi);

        expect(result).toBeLessThanOrEqual(30);
      });
    });

    describe('interpretVisceralFat edge cases', () => {
      it('should handle minimum level (1)', () => {
        const result = interpretVisceralFat(1);

        expect(result.status).toBe('healthy');
        expect(result).toBeDefined();
      });

      it('should handle maximum level (30)', () => {
        const result = interpretVisceralFat(30);

        expect(result.status).toBe('very-high');
        expect(result).toBeDefined();
      });

      it('should handle boundary between healthy and elevated (9 vs 10)', () => {
        const healthy = interpretVisceralFat(9);
        const elevated = interpretVisceralFat(10);

        expect(healthy.status).toBe('healthy');
        expect(elevated.status).toBe('elevated');
      });

      it('should handle boundary between elevated and high (14 vs 15)', () => {
        const elevated = interpretVisceralFat(14);
        const high = interpretVisceralFat(15);

        expect(elevated.status).toBe('elevated');
        expect(high.status).toBe('high');
      });

      it('should handle boundary between high and very-high (24 vs 25)', () => {
        const high = interpretVisceralFat(24);
        const veryHigh = interpretVisceralFat(25);

        expect(high.status).toBe('high');
        expect(veryHigh.status).toBe('very-high');
      });
    });
  });

  describe('Numerical Stability', () => {
    it('should not produce NaN from estimateVisceralFat', () => {
      const profile: UserProfile = { gender: 'male', age: 40, heightCm: 175 };
      const bmi = 25;

      const result = estimateVisceralFat(profile, bmi);

      expect(Number.isNaN(result)).toBe(false);
    });

    it('should not produce Infinity from estimateVisceralFat', () => {
      const profile: UserProfile = { gender: 'female', age: 35, heightCm: 165 };
      const bmi = 22;

      const result = estimateVisceralFat(profile, bmi);

      expect(Number.isFinite(result)).toBe(true);
    });
  });

  describe('Integration with BMI', () => {
    it('should produce consistent results across BMI range', () => {
      const profile: UserProfile = { gender: 'male', age: 40, heightCm: 175 };

      const bmiValues = [18.5, 20, 22, 24, 26, 28, 30, 32, 35];
      const results = bmiValues.map(bmi => estimateVisceralFat(profile, bmi));

      // Results should be monotonically increasing (higher BMI = higher visceral fat)
      for (let i = 1; i < results.length; i++) {
        expect(results[i]).toBeGreaterThanOrEqual(results[i - 1]);
      }
    });
  });
});

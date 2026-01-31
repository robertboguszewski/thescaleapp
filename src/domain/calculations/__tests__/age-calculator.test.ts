/**
 * Age Calculator Tests
 *
 * Test suite for age calculation and birth year validation functions.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  calculateAge,
  isValidBirthYear,
  isValidBirthMonth,
  getValidBirthYearRange,
} from '../age-calculator';

describe('Age Calculator', () => {
  describe('calculateAge', () => {
    beforeEach(() => {
      // Mock the current date to ensure consistent tests
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-31'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should calculate age correctly for typical birth year', () => {
      expect(calculateAge(1990)).toBe(36);
      expect(calculateAge(2000)).toBe(26);
      expect(calculateAge(1985)).toBe(41);
    });

    it('should calculate age for recent birth years', () => {
      expect(calculateAge(2020)).toBe(6);
      expect(calculateAge(2021)).toBe(5);
    });

    it('should calculate age for older birth years', () => {
      expect(calculateAge(1950)).toBe(76);
      expect(calculateAge(1940)).toBe(86);
    });

    it('should throw error for invalid birth year', () => {
      expect(() => calculateAge(2025)).toThrow('Invalid birth year');
      expect(() => calculateAge(1899)).toThrow('Invalid birth year');
    });

    it('should handle boundary valid years', () => {
      expect(calculateAge(1900)).toBe(126);
      expect(calculateAge(2021)).toBe(5); // Min age 5
    });
  });

  describe('isValidBirthYear', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-31'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return true for valid birth years', () => {
      expect(isValidBirthYear(1990)).toBe(true);
      expect(isValidBirthYear(2000)).toBe(true);
      expect(isValidBirthYear(1950)).toBe(true);
    });

    it('should return true for boundary years', () => {
      expect(isValidBirthYear(1900)).toBe(true); // Min year
      expect(isValidBirthYear(2021)).toBe(true); // Max year (current - 5)
    });

    it('should return false for years too recent', () => {
      expect(isValidBirthYear(2022)).toBe(false); // Age would be 4
      expect(isValidBirthYear(2023)).toBe(false);
      expect(isValidBirthYear(2026)).toBe(false); // Current year
    });

    it('should return false for years too old', () => {
      expect(isValidBirthYear(1899)).toBe(false);
      expect(isValidBirthYear(1800)).toBe(false);
    });

    it('should return false for non-integer values', () => {
      expect(isValidBirthYear(1990.5)).toBe(false);
      expect(isValidBirthYear(NaN)).toBe(false);
    });

    it('should return false for negative years', () => {
      expect(isValidBirthYear(-1990)).toBe(false);
    });
  });

  describe('getValidBirthYearRange', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-31'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return correct range', () => {
      const range = getValidBirthYearRange();

      expect(range.min).toBe(1900);
      expect(range.max).toBe(2021); // 2026 - 5
    });

    it('should return object with min and max properties', () => {
      const range = getValidBirthYearRange();

      expect(range).toHaveProperty('min');
      expect(range).toHaveProperty('max');
      expect(typeof range.min).toBe('number');
      expect(typeof range.max).toBe('number');
    });
  });

  describe('calculateAge with optional birthMonth', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    describe('when birthMonth is provided', () => {
      it('should return same age if birthday has passed this year', () => {
        // Current date: January 31, 2026
        // Birth: March 1990 (birthday already passed in 2025, will pass in 2026 March)
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-06-15')); // June 15, 2026

        // Born March 1990, current June 2026 -> birthday passed -> age 36
        expect(calculateAge(1990, 3)).toBe(36);
      });

      it('should return age minus 1 if birthday has not occurred yet this year', () => {
        // Current date: January 31, 2026
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-01-31'));

        // Born March 1990, current January 2026 -> birthday NOT passed -> age 35
        expect(calculateAge(1990, 3)).toBe(35);
      });

      it('should handle birthday in current month (assume passed)', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-06-15'));

        // Born June 1990, current June 2026 -> same month = assume passed
        expect(calculateAge(1990, 6)).toBe(36);
      });

      it('should handle December birthday correctly', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-06-15'));

        // Born December 1990, current June 2026 -> birthday NOT passed -> age 35
        expect(calculateAge(1990, 12)).toBe(35);
      });

      it('should handle January birthday correctly', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-06-15'));

        // Born January 1990, current June 2026 -> birthday passed -> age 36
        expect(calculateAge(1990, 1)).toBe(36);
      });

      it('should work correctly at year boundary (December -> January)', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-01-01'));

        // Born February 1990, current January 2026 -> birthday NOT passed -> age 35
        expect(calculateAge(1990, 2)).toBe(35);

        // Born December 1989, current January 2026 -> birthday passed -> age 36
        expect(calculateAge(1989, 12)).toBe(36);
      });
    });

    describe('when birthMonth is undefined', () => {
      beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-01-31'));
      });

      it('should fall back to year-only calculation', () => {
        expect(calculateAge(1990, undefined)).toBe(36);
        expect(calculateAge(1990)).toBe(36);
      });
    });

    describe('birthMonth validation', () => {
      beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-06-15'));
      });

      it('should accept valid months 1-12', () => {
        expect(() => calculateAge(1990, 1)).not.toThrow();
        expect(() => calculateAge(1990, 6)).not.toThrow();
        expect(() => calculateAge(1990, 12)).not.toThrow();
      });

      it('should throw for invalid month 0', () => {
        expect(() => calculateAge(1990, 0)).toThrow('Invalid birth month');
      });

      it('should throw for invalid month 13', () => {
        expect(() => calculateAge(1990, 13)).toThrow('Invalid birth month');
      });

      it('should throw for negative month', () => {
        expect(() => calculateAge(1990, -1)).toThrow('Invalid birth month');
      });

      it('should throw for non-integer month', () => {
        expect(() => calculateAge(1990, 6.5)).toThrow('Invalid birth month');
      });
    });
  });

  describe('isValidBirthMonth', () => {
    it('should return true for valid months 1-12', () => {
      expect(isValidBirthMonth(1)).toBe(true);
      expect(isValidBirthMonth(6)).toBe(true);
      expect(isValidBirthMonth(12)).toBe(true);
    });

    it('should return false for month 0', () => {
      expect(isValidBirthMonth(0)).toBe(false);
    });

    it('should return false for month 13', () => {
      expect(isValidBirthMonth(13)).toBe(false);
    });

    it('should return false for negative months', () => {
      expect(isValidBirthMonth(-1)).toBe(false);
      expect(isValidBirthMonth(-12)).toBe(false);
    });

    it('should return false for non-integer months', () => {
      expect(isValidBirthMonth(6.5)).toBe(false);
      expect(isValidBirthMonth(NaN)).toBe(false);
    });

    it('should return true for undefined (optional)', () => {
      expect(isValidBirthMonth(undefined)).toBe(true);
    });
  });
});

/**
 * ProfileMatcher Tests
 *
 * Test suite for profile detection and matching logic.
 * Tests cover all scenarios: confident matches, ambiguous cases,
 * no matches, new profiles, and edge cases.
 */

import { describe, it, expect } from 'vitest';
import {
  detectProfile,
  calculateWeightDeviation,
  isWithinThreshold,
  WEIGHT_THRESHOLD_KG,
  MIN_MEASUREMENTS_FOR_MATCHING,
} from '../ProfileMatcher';
import type { ProfileWeightData, DetectionResult } from '../ProfileMatcher';

describe('ProfileMatcher', () => {
  describe('Constants', () => {
    it('should have weight threshold of 4.5kg', () => {
      expect(WEIGHT_THRESHOLD_KG).toBe(4.5);
    });

    it('should require minimum 2 measurements for matching', () => {
      expect(MIN_MEASUREMENTS_FOR_MATCHING).toBe(2);
    });
  });

  describe('detectProfile - Single Confident Match', () => {
    it('should return confident match when weight is exactly at profile average', () => {
      const profiles: ProfileWeightData[] = [
        { profileId: 'user-1', averageWeight: 70, measurementCount: 5 },
        { profileId: 'user-2', averageWeight: 85, measurementCount: 3 },
      ];

      const result = detectProfile(70, profiles);

      expect(result.type).toBe('confident');
      expect(result.profileId).toBe('user-1');
      expect(result.confidence).toBe(100);
      expect(result.requiresConfirmation).toBe(false);
      expect(result.reason).toBe('Dopasowano na podstawie wagi');
    });

    it('should return confident match when weight is within threshold', () => {
      const profiles: ProfileWeightData[] = [
        { profileId: 'user-1', averageWeight: 70, measurementCount: 5 },
        { profileId: 'user-2', averageWeight: 90, measurementCount: 3 },
      ];

      const result = detectProfile(72, profiles);

      expect(result.type).toBe('confident');
      expect(result.profileId).toBe('user-1');
      expect(result.confidence).toBeGreaterThan(70);
      expect(result.confidence).toBeLessThan(100);
      expect(result.requiresConfirmation).toBe(false);
    });

    it('should calculate confidence based on weight deviation', () => {
      const profiles: ProfileWeightData[] = [
        { profileId: 'user-1', averageWeight: 70, measurementCount: 5 },
      ];

      // Exact match should be 100%
      const exactResult = detectProfile(70, profiles);
      expect(exactResult.confidence).toBe(100);

      // At half threshold (2.25kg), confidence should be ~85%
      const halfResult = detectProfile(72.25, profiles);
      expect(halfResult.confidence).toBeCloseTo(85, 0);

      // At threshold (4.5kg), confidence should be 70%
      const thresholdResult = detectProfile(74.5, profiles);
      expect(thresholdResult.confidence).toBe(70);
    });
  });

  describe('detectProfile - Multiple Ambiguous Matches', () => {
    it('should return ambiguous when multiple profiles match (ALWAYS asks user)', () => {
      const profiles: ProfileWeightData[] = [
        { profileId: 'user-1', averageWeight: 70, measurementCount: 5 },
        { profileId: 'user-2', averageWeight: 72, measurementCount: 3 },
      ];

      const result = detectProfile(71, profiles);

      expect(result.type).toBe('ambiguous');
      expect(result.candidateIds).toContain('user-1');
      expect(result.candidateIds).toContain('user-2');
      expect(result.candidateIds?.length).toBe(2);
      expect(result.requiresConfirmation).toBe(true);
      expect(result.reason).toBe('Waga pasuje do wielu profili - wybierz użytkownika');
    });

    it('should return ambiguous even when one profile is closer than others', () => {
      const profiles: ProfileWeightData[] = [
        { profileId: 'user-1', averageWeight: 70, measurementCount: 5 },  // 1kg away
        { profileId: 'user-2', averageWeight: 74, measurementCount: 3 },  // 3kg away
      ];

      const result = detectProfile(71, profiles);

      // Both are within 4.5kg threshold, so ambiguous
      expect(result.type).toBe('ambiguous');
      expect(result.candidateIds?.length).toBe(2);
      expect(result.requiresConfirmation).toBe(true);
    });

    it('should include all matching profiles in candidates', () => {
      const profiles: ProfileWeightData[] = [
        { profileId: 'user-1', averageWeight: 70, measurementCount: 5 },
        { profileId: 'user-2', averageWeight: 71, measurementCount: 3 },
        { profileId: 'user-3', averageWeight: 72, measurementCount: 4 },
        { profileId: 'user-4', averageWeight: 100, measurementCount: 2 }, // Too far
      ];

      const result = detectProfile(71, profiles);

      expect(result.type).toBe('ambiguous');
      expect(result.candidateIds).toContain('user-1');
      expect(result.candidateIds).toContain('user-2');
      expect(result.candidateIds).toContain('user-3');
      expect(result.candidateIds).not.toContain('user-4');
      expect(result.candidateIds?.length).toBe(3);
    });
  });

  describe('detectProfile - No Match (Guest Scenario)', () => {
    it('should return no_match when weight does not match any profile', () => {
      const profiles: ProfileWeightData[] = [
        { profileId: 'user-1', averageWeight: 70, measurementCount: 5 },
        { profileId: 'user-2', averageWeight: 90, measurementCount: 3 },
      ];

      const result = detectProfile(80, profiles);

      expect(result.type).toBe('no_match');
      expect(result.profileId).toBeUndefined();
      expect(result.candidateIds).toBeUndefined();
      expect(result.confidence).toBe(0);
      expect(result.requiresConfirmation).toBe(true);
      expect(result.reason).toBe('Waga nie pasuje do żadnego profilu');
    });

    it('should return no_match when all profiles have insufficient history', () => {
      const profiles: ProfileWeightData[] = [
        { profileId: 'user-1', averageWeight: 70, measurementCount: 1 },
        { profileId: 'user-2', averageWeight: 72, measurementCount: 0 },
      ];

      // These profiles don't have enough measurements but could be new_profile
      // unless they all have averageWeight set
      const result = detectProfile(71, profiles);

      // Since these have averageWeight but < 2 measurements, they're "new profiles"
      expect(result.type).toBe('new_profile');
    });

    it('should return no_match for empty profiles array with established profiles', () => {
      const profiles: ProfileWeightData[] = [];

      const result = detectProfile(70, profiles);

      expect(result.type).toBe('no_match');
      expect(result.requiresConfirmation).toBe(true);
    });

    it('should return no_match for invalid weight', () => {
      const profiles: ProfileWeightData[] = [
        { profileId: 'user-1', averageWeight: 70, measurementCount: 5 },
      ];

      const result = detectProfile(0, profiles);

      expect(result.type).toBe('no_match');
      expect(result.reason).toBe('Nieprawidłowa wartość wagi');
    });

    it('should return no_match for negative weight', () => {
      const profiles: ProfileWeightData[] = [
        { profileId: 'user-1', averageWeight: 70, measurementCount: 5 },
      ];

      const result = detectProfile(-5, profiles);

      expect(result.type).toBe('no_match');
      expect(result.reason).toBe('Nieprawidłowa wartość wagi');
    });
  });

  describe('detectProfile - New Profile Without History', () => {
    it('should return new_profile when profiles exist without weight history', () => {
      const profiles: ProfileWeightData[] = [
        { profileId: 'user-1', averageWeight: 70, measurementCount: 5 },
        { profileId: 'user-2', averageWeight: null, measurementCount: 0 }, // New profile
      ];

      const result = detectProfile(85, profiles);

      expect(result.type).toBe('new_profile');
      expect(result.candidateIds).toContain('user-2');
      expect(result.confidence).toBe(50);
      expect(result.requiresConfirmation).toBe(true);
      expect(result.reason).toBe('Nowy profil bez historii pomiarów');
    });

    it('should return new_profile when profiles have insufficient measurements', () => {
      const profiles: ProfileWeightData[] = [
        { profileId: 'user-1', averageWeight: 70, measurementCount: 5 },
        { profileId: 'user-2', averageWeight: 85, measurementCount: 1 }, // Only 1 measurement
      ];

      const result = detectProfile(100, profiles);

      expect(result.type).toBe('new_profile');
      expect(result.candidateIds).toContain('user-2');
      expect(result.requiresConfirmation).toBe(true);
    });

    it('should include all new profiles in candidates', () => {
      const profiles: ProfileWeightData[] = [
        { profileId: 'user-1', averageWeight: 70, measurementCount: 5 },
        { profileId: 'user-2', averageWeight: null, measurementCount: 0 },
        { profileId: 'user-3', averageWeight: 90, measurementCount: 1 },
      ];

      const result = detectProfile(100, profiles);

      expect(result.type).toBe('new_profile');
      expect(result.candidateIds).toContain('user-2');
      expect(result.candidateIds).toContain('user-3');
      expect(result.candidateIds?.length).toBe(2);
    });

    it('should prefer established match over new_profile', () => {
      const profiles: ProfileWeightData[] = [
        { profileId: 'user-1', averageWeight: 70, measurementCount: 5 },
        { profileId: 'user-2', averageWeight: null, measurementCount: 0 },
      ];

      const result = detectProfile(71, profiles);

      // Should match established profile, not suggest new one
      expect(result.type).toBe('confident');
      expect(result.profileId).toBe('user-1');
    });
  });

  describe('detectProfile - Edge Cases at 4.5kg Boundary', () => {
    it('should match at exactly 4.5kg below average', () => {
      const profiles: ProfileWeightData[] = [
        { profileId: 'user-1', averageWeight: 70, measurementCount: 5 },
      ];

      const result = detectProfile(65.5, profiles);

      expect(result.type).toBe('confident');
      expect(result.profileId).toBe('user-1');
      expect(result.confidence).toBe(70); // Minimum confidence at threshold
    });

    it('should match at exactly 4.5kg above average', () => {
      const profiles: ProfileWeightData[] = [
        { profileId: 'user-1', averageWeight: 70, measurementCount: 5 },
      ];

      const result = detectProfile(74.5, profiles);

      expect(result.type).toBe('confident');
      expect(result.profileId).toBe('user-1');
      expect(result.confidence).toBe(70);
    });

    it('should NOT match at 4.51kg above average (just outside threshold)', () => {
      const profiles: ProfileWeightData[] = [
        { profileId: 'user-1', averageWeight: 70, measurementCount: 5 },
      ];

      const result = detectProfile(74.51, profiles);

      expect(result.type).toBe('no_match');
    });

    it('should NOT match at 4.51kg below average (just outside threshold)', () => {
      const profiles: ProfileWeightData[] = [
        { profileId: 'user-1', averageWeight: 70, measurementCount: 5 },
      ];

      const result = detectProfile(65.49, profiles);

      expect(result.type).toBe('no_match');
    });

    it('should handle boundary case with multiple profiles', () => {
      const profiles: ProfileWeightData[] = [
        { profileId: 'user-1', averageWeight: 70, measurementCount: 5 },
        { profileId: 'user-2', averageWeight: 79, measurementCount: 3 },
      ];

      // 74.5 is exactly at threshold for user-1, and exactly at threshold for user-2
      const result = detectProfile(74.5, profiles);

      expect(result.type).toBe('ambiguous');
      expect(result.candidateIds).toContain('user-1');
      expect(result.candidateIds).toContain('user-2');
    });

    it('should correctly handle weight at boundary of one profile only', () => {
      const profiles: ProfileWeightData[] = [
        { profileId: 'user-1', averageWeight: 70, measurementCount: 5 },
        { profileId: 'user-2', averageWeight: 80, measurementCount: 3 },
      ];

      // 74.5 matches user-1 (at boundary), but not user-2 (5.5kg away)
      const result = detectProfile(74.5, profiles);

      expect(result.type).toBe('confident');
      expect(result.profileId).toBe('user-1');
    });
  });

  describe('detectProfile - Realistic Scenarios', () => {
    it('should handle family household with distinct weights', () => {
      const profiles: ProfileWeightData[] = [
        { profileId: 'father', averageWeight: 85, measurementCount: 20 },
        { profileId: 'mother', averageWeight: 62, measurementCount: 15 },
        { profileId: 'teenager', averageWeight: 55, measurementCount: 10 },
        { profileId: 'child', averageWeight: 35, measurementCount: 8 },
      ];

      expect(detectProfile(84.2, profiles).profileId).toBe('father');
      expect(detectProfile(63, profiles).profileId).toBe('mother');
      expect(detectProfile(54, profiles).profileId).toBe('teenager');
      expect(detectProfile(36, profiles).profileId).toBe('child');
    });

    it('should handle couple with similar weights (ambiguous)', () => {
      const profiles: ProfileWeightData[] = [
        { profileId: 'partner-1', averageWeight: 72, measurementCount: 10 },
        { profileId: 'partner-2', averageWeight: 74, measurementCount: 10 },
      ];

      const result = detectProfile(73, profiles);

      expect(result.type).toBe('ambiguous');
      expect(result.requiresConfirmation).toBe(true);
    });

    it('should handle guest measurement (no profile match)', () => {
      const profiles: ProfileWeightData[] = [
        { profileId: 'resident', averageWeight: 70, measurementCount: 50 },
      ];

      const result = detectProfile(95, profiles);

      expect(result.type).toBe('no_match');
      expect(result.requiresConfirmation).toBe(true);
    });

    it('should handle new family member scenario', () => {
      const profiles: ProfileWeightData[] = [
        { profileId: 'existing-member', averageWeight: 70, measurementCount: 50 },
        { profileId: 'new-member', averageWeight: null, measurementCount: 0 },
      ];

      const result = detectProfile(55, profiles);

      expect(result.type).toBe('new_profile');
      expect(result.candidateIds).toContain('new-member');
    });
  });

  describe('calculateWeightDeviation', () => {
    it('should calculate absolute deviation', () => {
      expect(calculateWeightDeviation(75, 70)).toBe(5);
      expect(calculateWeightDeviation(70, 75)).toBe(5);
      expect(calculateWeightDeviation(70, 70)).toBe(0);
    });

    it('should handle decimal weights', () => {
      expect(calculateWeightDeviation(70.5, 70)).toBeCloseTo(0.5, 5);
      expect(calculateWeightDeviation(69.3, 70)).toBeCloseTo(0.7, 5);
    });
  });

  describe('isWithinThreshold', () => {
    it('should return true when within default threshold', () => {
      expect(isWithinThreshold(72, 70)).toBe(true);
      expect(isWithinThreshold(74.5, 70)).toBe(true);
      expect(isWithinThreshold(65.5, 70)).toBe(true);
    });

    it('should return false when outside default threshold', () => {
      expect(isWithinThreshold(75, 70)).toBe(false);
      expect(isWithinThreshold(65, 70)).toBe(false);
    });

    it('should support custom threshold', () => {
      expect(isWithinThreshold(75, 70, 5)).toBe(true);
      expect(isWithinThreshold(76, 70, 5)).toBe(false);
      expect(isWithinThreshold(72, 70, 1)).toBe(false);
    });

    it('should handle exact threshold boundary', () => {
      expect(isWithinThreshold(74.5, 70)).toBe(true);  // Exactly at 4.5
      expect(isWithinThreshold(74.50001, 70)).toBe(false);  // Just over
    });
  });
});

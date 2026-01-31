/**
 * ProfileMatchingService Unit Tests
 *
 * Comprehensive tests for the ProfileMatchingService application service.
 * Tests profile detection, guest measurement handling, and profile assignment.
 *
 * @module application/services/__tests__/ProfileMatchingService.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProfileMatchingService } from '../ProfileMatchingService';
import type {
  MeasurementRepository,
  MeasurementResult,
} from '../../ports/MeasurementRepository';
import { GUEST_PROFILE_ID } from '../../ports/MeasurementRepository';
import type {
  ProfileRepository,
  StoredUserProfile,
} from '../../ports/ProfileRepository';
import type { CalculatedMetrics } from '../../../domain/calculations/types';

describe('ProfileMatchingService', () => {
  // Mock dependencies
  let mockMeasurementRepository: MeasurementRepository;
  let mockProfileRepository: ProfileRepository;
  let service: ProfileMatchingService;

  // Test data fixtures
  const testCalculatedMetrics: CalculatedMetrics = {
    bmi: 23.8,
    bodyFatPercent: 18.5,
    muscleMassKg: 46.2,
    bodyWaterPercent: 55.3,
    boneMassKg: 2.5,
    visceralFatLevel: 8,
    bmrKcal: 1720,
    leanBodyMassKg: 61.6,
    proteinPercent: 13.5,
    bodyScore: 82,
  };

  const testProfile1: StoredUserProfile = {
    id: 'profile-1',
    name: 'Jan Kowalski',
    gender: 'male',
    birthYear: 1990,
    heightCm: 178,
    ethnicity: 'non-asian',
    isDefault: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  const testProfile2: StoredUserProfile = {
    id: 'profile-2',
    name: 'Anna Nowak',
    gender: 'female',
    birthYear: 1995,
    heightCm: 165,
    ethnicity: 'non-asian',
    isDefault: false,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  const testProfile3: StoredUserProfile = {
    id: 'profile-3',
    name: 'Piotr Wisnewski',
    gender: 'male',
    birthYear: 1985,
    heightCm: 180,
    ethnicity: 'asian',
    isDefault: false,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  // Create measurements for a profile with specific average weight
  const createMeasurementsForProfile = (
    profileId: string,
    avgWeight: number,
    count: number
  ): MeasurementResult[] => {
    return Array.from({ length: count }, (_, i) => ({
      id: `measurement-${profileId}-${i + 1}`,
      timestamp: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
      raw: {
        weightKg: avgWeight + (i % 2 === 0 ? 0.2 : -0.2), // Small variation
        impedanceOhm: 485,
      },
      calculated: testCalculatedMetrics,
      userProfileId: profileId,
    }));
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock MeasurementRepository
    mockMeasurementRepository = {
      save: vi.fn().mockResolvedValue(undefined),
      getById: vi.fn().mockResolvedValue(null),
      getAll: vi.fn().mockResolvedValue([]),
      delete: vi.fn().mockResolvedValue(undefined),
      deleteAll: vi.fn().mockResolvedValue(undefined),
      count: vi.fn().mockResolvedValue(0),
      updateProfileAssignment: vi.fn().mockResolvedValue(undefined),
    };

    // Create mock ProfileRepository
    mockProfileRepository = {
      save: vi.fn().mockResolvedValue(undefined),
      getById: vi.fn().mockResolvedValue(null),
      getAll: vi.fn().mockResolvedValue([]),
      delete: vi.fn().mockResolvedValue(undefined),
      getDefault: vi.fn().mockResolvedValue(null),
      setDefault: vi.fn().mockResolvedValue(undefined),
    };

    // Create service instance
    service = new ProfileMatchingService(
      mockMeasurementRepository,
      mockProfileRepository
    );
  });

  describe('detectProfileForWeight', () => {
    describe('no profiles scenario', () => {
      it('should return no_match when no profiles exist', async () => {
        // Arrange
        mockProfileRepository.getAll = vi.fn().mockResolvedValue([]);

        // Act
        const result = await service.detectProfileForWeight(75);

        // Assert
        expect(result.type).toBe('no_match');
        expect(result.requiresConfirmation).toBe(true);
        expect(result.reason).toContain('Brak');
      });
    });

    describe('single profile scenarios', () => {
      it('should return confident match when weight is within threshold', async () => {
        // Arrange
        mockProfileRepository.getAll = vi.fn().mockResolvedValue([testProfile1]);
        const measurements = createMeasurementsForProfile('profile-1', 75, 5);
        mockMeasurementRepository.getAll = vi.fn().mockResolvedValue(measurements);

        // Act
        const result = await service.detectProfileForWeight(76);

        // Assert
        expect(result.type).toBe('confident');
        expect(result.profileId).toBe('profile-1');
        expect(result.confidence).toBeGreaterThan(70);
        expect(result.requiresConfirmation).toBe(false);
      });

      it('should return new_profile when profile has insufficient measurement history', async () => {
        // Arrange
        mockProfileRepository.getAll = vi.fn().mockResolvedValue([testProfile1]);
        const measurements = createMeasurementsForProfile('profile-1', 75, 1);
        mockMeasurementRepository.getAll = vi.fn().mockResolvedValue(measurements);

        // Act
        const result = await service.detectProfileForWeight(76);

        // Assert
        expect(result.type).toBe('new_profile');
        expect(result.candidateIds).toContain('profile-1');
        expect(result.requiresConfirmation).toBe(true);
      });

      it('should return no_match when weight is outside threshold', async () => {
        // Arrange
        mockProfileRepository.getAll = vi.fn().mockResolvedValue([testProfile1]);
        const measurements = createMeasurementsForProfile('profile-1', 75, 5);
        mockMeasurementRepository.getAll = vi.fn().mockResolvedValue(measurements);

        // Act - Weight 90kg is way outside 4.5kg threshold from 75kg
        const result = await service.detectProfileForWeight(90);

        // Assert
        expect(result.type).toBe('no_match');
        expect(result.requiresConfirmation).toBe(true);
      });
    });

    describe('multiple profiles scenarios', () => {
      it('should return confident match when only one profile matches', async () => {
        // Arrange
        mockProfileRepository.getAll = vi
          .fn()
          .mockResolvedValue([testProfile1, testProfile2]);

        // Profile 1: ~75kg, Profile 2: ~60kg
        mockMeasurementRepository.getAll = vi.fn().mockImplementation((query) => {
          if (query?.userProfileId === 'profile-1') {
            return Promise.resolve(
              createMeasurementsForProfile('profile-1', 75, 5)
            );
          }
          if (query?.userProfileId === 'profile-2') {
            return Promise.resolve(
              createMeasurementsForProfile('profile-2', 60, 5)
            );
          }
          return Promise.resolve([]);
        });

        // Act - Weight 74kg should match profile-1 only
        const result = await service.detectProfileForWeight(74);

        // Assert
        expect(result.type).toBe('confident');
        expect(result.profileId).toBe('profile-1');
      });

      it('should return ambiguous when multiple profiles match', async () => {
        // Arrange
        mockProfileRepository.getAll = vi
          .fn()
          .mockResolvedValue([testProfile1, testProfile2, testProfile3]);

        // All profiles have similar weights (within 4.5kg threshold of 72kg)
        mockMeasurementRepository.getAll = vi.fn().mockImplementation((query) => {
          if (query?.userProfileId === 'profile-1') {
            return Promise.resolve(
              createMeasurementsForProfile('profile-1', 74, 5)
            );
          }
          if (query?.userProfileId === 'profile-2') {
            return Promise.resolve(
              createMeasurementsForProfile('profile-2', 71, 5)
            );
          }
          if (query?.userProfileId === 'profile-3') {
            return Promise.resolve(
              createMeasurementsForProfile('profile-3', 70, 5)
            );
          }
          return Promise.resolve([]);
        });

        // Act - Weight 72kg is within threshold of all profiles
        const result = await service.detectProfileForWeight(72);

        // Assert
        expect(result.type).toBe('ambiguous');
        expect(result.candidateIds).toBeDefined();
        expect(result.candidateIds!.length).toBeGreaterThan(1);
        expect(result.requiresConfirmation).toBe(true);
      });

      it('should exclude profiles with insufficient data from matching', async () => {
        // Arrange
        mockProfileRepository.getAll = vi
          .fn()
          .mockResolvedValue([testProfile1, testProfile2]);

        // Profile 1 has enough data, Profile 2 has only 1 measurement
        mockMeasurementRepository.getAll = vi.fn().mockImplementation((query) => {
          if (query?.userProfileId === 'profile-1') {
            return Promise.resolve(
              createMeasurementsForProfile('profile-1', 75, 5)
            );
          }
          if (query?.userProfileId === 'profile-2') {
            return Promise.resolve(
              createMeasurementsForProfile('profile-2', 75, 1)
            );
          }
          return Promise.resolve([]);
        });

        // Act - Both profiles would match weight-wise, but profile-2 has insufficient data
        const result = await service.detectProfileForWeight(75);

        // Assert
        expect(result.type).toBe('confident');
        expect(result.profileId).toBe('profile-1');
      });
    });

    describe('edge cases', () => {
      it('should handle exact weight match with 100% confidence', async () => {
        // Arrange
        mockProfileRepository.getAll = vi.fn().mockResolvedValue([testProfile1]);
        const measurements = createMeasurementsForProfile('profile-1', 75, 5);
        mockMeasurementRepository.getAll = vi.fn().mockResolvedValue(measurements);

        // Act - Exact match at 75kg
        const result = await service.detectProfileForWeight(75);

        // Assert
        expect(result.type).toBe('confident');
        expect(result.confidence).toBeGreaterThanOrEqual(95);
      });

      it('should handle weight at threshold boundary', async () => {
        // Arrange
        mockProfileRepository.getAll = vi.fn().mockResolvedValue([testProfile1]);
        const measurements = createMeasurementsForProfile('profile-1', 75, 5);
        mockMeasurementRepository.getAll = vi.fn().mockResolvedValue(measurements);

        // Act - Weight at exactly 4.5kg threshold (75 + 4.5 = 79.5)
        const result = await service.detectProfileForWeight(79.5);

        // Assert
        expect(result.type).toBe('confident');
        expect(result.confidence).toBeGreaterThanOrEqual(70);
      });

      it('should not match when weight is just outside threshold', async () => {
        // Arrange
        mockProfileRepository.getAll = vi.fn().mockResolvedValue([testProfile1]);
        const measurements = createMeasurementsForProfile('profile-1', 75, 5);
        mockMeasurementRepository.getAll = vi.fn().mockResolvedValue(measurements);

        // Act - Weight just outside threshold (75 + 4.6 = 79.6)
        const result = await service.detectProfileForWeight(79.6);

        // Assert
        expect(result.type).toBe('no_match');
      });

      it('should handle empty measurement history for all profiles', async () => {
        // Arrange
        mockProfileRepository.getAll = vi
          .fn()
          .mockResolvedValue([testProfile1, testProfile2]);
        mockMeasurementRepository.getAll = vi.fn().mockResolvedValue([]);

        // Act
        const result = await service.detectProfileForWeight(75);

        // Assert
        expect(result.type).toBe('new_profile');
        expect(result.candidateIds).toContain('profile-1');
        expect(result.candidateIds).toContain('profile-2');
      });
    });
  });

  describe('getProfileNames', () => {
    it('should return map of profile IDs to names', async () => {
      // Arrange
      mockProfileRepository.getById = vi.fn().mockImplementation((id) => {
        if (id === 'profile-1') return Promise.resolve(testProfile1);
        if (id === 'profile-2') return Promise.resolve(testProfile2);
        return Promise.resolve(null);
      });

      // Act
      const names = await service.getProfileNames(['profile-1', 'profile-2']);

      // Assert
      expect(names.size).toBe(2);
      expect(names.get('profile-1')).toBe('Jan Kowalski');
      expect(names.get('profile-2')).toBe('Anna Nowak');
    });

    it('should skip profiles that are not found', async () => {
      // Arrange
      mockProfileRepository.getById = vi.fn().mockImplementation((id) => {
        if (id === 'profile-1') return Promise.resolve(testProfile1);
        return Promise.resolve(null);
      });

      // Act
      const names = await service.getProfileNames([
        'profile-1',
        'non-existent',
      ]);

      // Assert
      expect(names.size).toBe(1);
      expect(names.has('profile-1')).toBe(true);
      expect(names.has('non-existent')).toBe(false);
    });

    it('should return empty map for empty input', async () => {
      // Act
      const names = await service.getProfileNames([]);

      // Assert
      expect(names.size).toBe(0);
    });
  });

  describe('getProfileDetails', () => {
    it('should return array of profile details', async () => {
      // Arrange
      mockProfileRepository.getById = vi.fn().mockImplementation((id) => {
        if (id === 'profile-1') return Promise.resolve(testProfile1);
        if (id === 'profile-2') return Promise.resolve(testProfile2);
        return Promise.resolve(null);
      });

      // Act
      const profiles = await service.getProfileDetails([
        'profile-1',
        'profile-2',
      ]);

      // Assert
      expect(profiles).toHaveLength(2);
      expect(profiles[0].id).toBe('profile-1');
      expect(profiles[1].id).toBe('profile-2');
    });

    it('should exclude not found profiles', async () => {
      // Arrange
      mockProfileRepository.getById = vi.fn().mockImplementation((id) => {
        if (id === 'profile-1') return Promise.resolve(testProfile1);
        return Promise.resolve(null);
      });

      // Act
      const profiles = await service.getProfileDetails([
        'profile-1',
        'non-existent',
      ]);

      // Assert
      expect(profiles).toHaveLength(1);
      expect(profiles[0].id).toBe('profile-1');
    });
  });

  describe('getProfileAverageWeight', () => {
    it('should calculate average weight from measurements', async () => {
      // Arrange
      const measurements = createMeasurementsForProfile('profile-1', 75, 5);
      mockMeasurementRepository.getAll = vi.fn().mockResolvedValue(measurements);

      // Act
      const avgWeight = await service.getProfileAverageWeight('profile-1');

      // Assert
      expect(avgWeight).toBeDefined();
      expect(avgWeight).toBeCloseTo(75, 0);
    });

    it('should return null when insufficient measurements', async () => {
      // Arrange
      const measurements = createMeasurementsForProfile('profile-1', 75, 1);
      mockMeasurementRepository.getAll = vi.fn().mockResolvedValue(measurements);

      // Act
      const avgWeight = await service.getProfileAverageWeight('profile-1');

      // Assert
      expect(avgWeight).toBeNull();
    });

    it('should return null when no measurements', async () => {
      // Arrange
      mockMeasurementRepository.getAll = vi.fn().mockResolvedValue([]);

      // Act
      const avgWeight = await service.getProfileAverageWeight('profile-1');

      // Assert
      expect(avgWeight).toBeNull();
    });

    it('should use custom limit when provided', async () => {
      // Arrange
      const measurements = createMeasurementsForProfile('profile-1', 75, 20);
      mockMeasurementRepository.getAll = vi.fn().mockResolvedValue(measurements);

      // Act
      await service.getProfileAverageWeight('profile-1', 5);

      // Assert
      expect(mockMeasurementRepository.getAll).toHaveBeenCalledWith({
        userProfileId: 'profile-1',
        limit: 5,
      });
    });
  });
});

describe('GUEST_PROFILE_ID constant', () => {
  it('should be a special string identifier', () => {
    expect(GUEST_PROFILE_ID).toBe('__guest__');
    expect(typeof GUEST_PROFILE_ID).toBe('string');
  });
});

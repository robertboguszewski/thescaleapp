/**
 * CaptureMeasurementUseCase Unit Tests
 *
 * Tests for the CaptureMeasurementUseCase with mocked dependencies.
 *
 * @module application/use-cases/__tests__/CaptureMeasurementUseCase.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CaptureMeasurementUseCase,
  ProfileNotFoundError,
} from '../CaptureMeasurementUseCase';
import type { MeasurementService } from '../../services/MeasurementService';
import type { ProfileRepository, StoredUserProfile } from '../../ports/ProfileRepository';
import type { MeasurementResult } from '../../ports/MeasurementRepository';
import type { CalculatedMetrics, RawMeasurement } from '../../../domain/calculations/types';

describe('CaptureMeasurementUseCase', () => {
  // Mock dependencies
  let mockMeasurementService: MeasurementService;
  let mockProfileRepository: ProfileRepository;
  let useCase: CaptureMeasurementUseCase;

  // Test data
  const testProfile: StoredUserProfile = {
    id: 'profile-123',
    name: 'Test User',
    gender: 'male',
    age: 35,
    heightCm: 178,
    isDefault: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  const testRawMeasurement: RawMeasurement = {
    weightKg: 75.5,
    impedanceOhm: 485,
  };

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

  const testMeasurementResult: MeasurementResult = {
    id: 'measurement-001',
    timestamp: new Date('2024-01-15T10:30:00Z'),
    raw: testRawMeasurement,
    calculated: testCalculatedMetrics,
    userProfileId: 'profile-123',
  };

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();

    // Create mock MeasurementService
    mockMeasurementService = {
      captureMeasurement: vi.fn().mockResolvedValue(testMeasurementResult),
      getMeasurementHistory: vi.fn(),
      getLatestMeasurement: vi.fn(),
      getMeasurement: vi.fn(),
      deleteMeasurement: vi.fn(),
      deleteAllMeasurements: vi.fn(),
      countMeasurements: vi.fn(),
    } as unknown as MeasurementService;

    // Create mock ProfileRepository
    mockProfileRepository = {
      save: vi.fn().mockResolvedValue(undefined),
      getById: vi.fn().mockResolvedValue(testProfile),
      getAll: vi.fn().mockResolvedValue([testProfile]),
      delete: vi.fn().mockResolvedValue(undefined),
      getDefault: vi.fn().mockResolvedValue(testProfile),
      setDefault: vi.fn().mockResolvedValue(undefined),
    };

    // Create use case instance with mocked dependencies
    useCase = new CaptureMeasurementUseCase(
      mockMeasurementService,
      mockProfileRepository
    );
  });

  describe('execute', () => {
    it('should successfully capture a measurement and return recommendations', async () => {
      // Act
      const result = await useCase.execute({ profileId: 'profile-123' });

      // Assert
      expect(mockMeasurementService.captureMeasurement).toHaveBeenCalledWith(
        'profile-123'
      );
      expect(mockProfileRepository.getById).toHaveBeenCalledWith('profile-123');

      // Verify output structure
      expect(result).toHaveProperty('measurement');
      expect(result).toHaveProperty('recommendations');
      expect(result.measurement).toEqual(testMeasurementResult);
      expect(Array.isArray(result.recommendations)).toBe(true);
    });

    it('should return the measurement from the service', async () => {
      // Act
      const result = await useCase.execute({ profileId: 'profile-123' });

      // Assert
      expect(result.measurement).toEqual(testMeasurementResult);
      expect(result.measurement.id).toBe('measurement-001');
      expect(result.measurement.raw).toEqual(testRawMeasurement);
      expect(result.measurement.calculated).toEqual(testCalculatedMetrics);
    });

    it('should generate recommendations based on calculated metrics', async () => {
      // Act
      const result = await useCase.execute({ profileId: 'profile-123' });

      // Assert - recommendations should be an array with proper structure
      expect(result.recommendations.length).toBeGreaterThan(0);
      result.recommendations.forEach((rec) => {
        expect(rec).toHaveProperty('type');
        expect(rec).toHaveProperty('category');
        expect(rec).toHaveProperty('title');
        expect(rec).toHaveProperty('message');
        expect(rec).toHaveProperty('actions');
        expect(['info', 'warning', 'critical']).toContain(rec.type);
      });
    });

    it('should throw ProfileNotFoundError when profile is not found after measurement', async () => {
      // Arrange
      mockProfileRepository.getById = vi.fn().mockResolvedValue(null);

      // Act & Assert
      await expect(useCase.execute({ profileId: 'profile-123' })).rejects.toThrow(
        ProfileNotFoundError
      );
      await expect(useCase.execute({ profileId: 'profile-123' })).rejects.toThrow(
        'Profile not found: profile-123'
      );
    });

    it('should propagate MeasurementService errors', async () => {
      // Arrange
      const serviceError = new Error('BLE connection failed');
      mockMeasurementService.captureMeasurement = vi
        .fn()
        .mockRejectedValue(serviceError);

      // Act & Assert
      await expect(useCase.execute({ profileId: 'profile-123' })).rejects.toThrow(
        'BLE connection failed'
      );
    });

    it('should propagate ProfileNotFoundError from MeasurementService', async () => {
      // Arrange
      const profileError = new Error('Profile not found: non-existent');
      profileError.name = 'ProfileNotFoundError';
      mockMeasurementService.captureMeasurement = vi
        .fn()
        .mockRejectedValue(profileError);

      // Act & Assert
      await expect(
        useCase.execute({ profileId: 'non-existent' })
      ).rejects.toThrow('Profile not found: non-existent');
    });

    it('should generate different recommendations based on profile gender', async () => {
      // Arrange - female profile with different thresholds
      const femaleProfile: StoredUserProfile = {
        ...testProfile,
        id: 'profile-female',
        gender: 'female',
      };

      mockProfileRepository.getById = vi.fn().mockResolvedValue(femaleProfile);
      mockMeasurementService.captureMeasurement = vi.fn().mockResolvedValue({
        ...testMeasurementResult,
        userProfileId: 'profile-female',
        calculated: {
          ...testCalculatedMetrics,
          bodyFatPercent: 28, // Normal for female, but would be high for male
        },
      });

      // Act
      const result = await useCase.execute({ profileId: 'profile-female' });

      // Assert - should have recommendations
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('should generate critical recommendations for high visceral fat', async () => {
      // Arrange - measurement with high visceral fat
      mockMeasurementService.captureMeasurement = vi.fn().mockResolvedValue({
        ...testMeasurementResult,
        calculated: {
          ...testCalculatedMetrics,
          visceralFatLevel: 16, // High level
        },
      });

      // Act
      const result = await useCase.execute({ profileId: 'profile-123' });

      // Assert - should have critical recommendation for visceral fat
      const criticalRecs = result.recommendations.filter(
        (rec) => rec.type === 'critical' && rec.category === 'visceral'
      );
      expect(criticalRecs.length).toBeGreaterThan(0);
    });

    it('should handle profile with ethnicity for recommendations', async () => {
      // Arrange
      const asianProfile: StoredUserProfile = {
        ...testProfile,
        ethnicity: 'asian',
      };
      mockProfileRepository.getById = vi.fn().mockResolvedValue(asianProfile);

      // Act
      const result = await useCase.execute({ profileId: 'profile-123' });

      // Assert
      expect(mockProfileRepository.getById).toHaveBeenCalledWith('profile-123');
      expect(result.recommendations).toBeDefined();
    });

    it('should call services in correct order', async () => {
      // Arrange
      const callOrder: string[] = [];
      mockMeasurementService.captureMeasurement = vi.fn().mockImplementation(async () => {
        callOrder.push('captureMeasurement');
        return testMeasurementResult;
      });
      mockProfileRepository.getById = vi.fn().mockImplementation(async () => {
        callOrder.push('getProfile');
        return testProfile;
      });

      // Act
      await useCase.execute({ profileId: 'profile-123' });

      // Assert - measurement should be captured before getting profile
      expect(callOrder).toEqual(['captureMeasurement', 'getProfile']);
    });
  });

  describe('input validation', () => {
    it('should accept valid profileId', async () => {
      // Act & Assert
      await expect(
        useCase.execute({ profileId: 'valid-profile-id' })
      ).resolves.toBeDefined();
    });

    it('should pass profileId to MeasurementService', async () => {
      // Arrange
      const customProfileId = 'custom-profile-12345';
      mockProfileRepository.getById = vi.fn().mockResolvedValue({
        ...testProfile,
        id: customProfileId,
      });

      // Act
      await useCase.execute({ profileId: customProfileId });

      // Assert
      expect(mockMeasurementService.captureMeasurement).toHaveBeenCalledWith(
        customProfileId
      );
    });
  });

  describe('output structure', () => {
    it('should return CaptureMeasurementOutput with correct shape', async () => {
      // Act
      const result = await useCase.execute({ profileId: 'profile-123' });

      // Assert
      expect(Object.keys(result)).toHaveLength(2);
      expect(result).toHaveProperty('measurement');
      expect(result).toHaveProperty('recommendations');
    });

    it('should include all measurement properties', async () => {
      // Act
      const result = await useCase.execute({ profileId: 'profile-123' });

      // Assert
      expect(result.measurement).toHaveProperty('id');
      expect(result.measurement).toHaveProperty('timestamp');
      expect(result.measurement).toHaveProperty('raw');
      expect(result.measurement).toHaveProperty('calculated');
      expect(result.measurement).toHaveProperty('userProfileId');
    });

    it('should include recommendations array with action items', async () => {
      // Act
      const result = await useCase.execute({ profileId: 'profile-123' });

      // Assert
      expect(Array.isArray(result.recommendations)).toBe(true);
      result.recommendations.forEach((rec) => {
        expect(Array.isArray(rec.actions)).toBe(true);
        expect(rec.actions.length).toBeGreaterThan(0);
      });
    });
  });
});

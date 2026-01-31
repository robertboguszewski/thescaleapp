/**
 * MeasurementService Unit Tests
 *
 * Comprehensive tests for the MeasurementService application service.
 * Uses vitest for testing with mocked dependencies following TDD approach.
 *
 * @module application/services/__tests__/MeasurementService.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  MeasurementService,
  ProfileNotFoundError,
  MeasurementReadError,
  MeasurementNotFoundError,
  GUEST_PROFILE_ID,
} from '../MeasurementService';
import type { BLEPort } from '../../ports/BLEPort';
import type {
  MeasurementRepository,
  MeasurementResult,
  MeasurementQuery,
} from '../../ports/MeasurementRepository';
import type {
  ProfileRepository,
  StoredUserProfile,
} from '../../ports/ProfileRepository';
import type {
  RawMeasurement,
  CalculatedMetrics,
} from '../../../domain/calculations/types';

// Mock crypto.randomUUID
vi.stubGlobal('crypto', {
  randomUUID: vi.fn(() => 'test-uuid-12345'),
});

describe('MeasurementService', () => {
  // Mock dependencies
  let mockBLEPort: BLEPort;
  let mockMeasurementRepository: MeasurementRepository;
  let mockProfileRepository: ProfileRepository;
  let service: MeasurementService;

  // Test data fixtures
  const testProfile: StoredUserProfile = {
    id: 'profile-123',
    name: 'Test User',
    gender: 'male',
    birthYear: 1989, // ~35 years old
    heightCm: 178,
    ethnicity: 'non-asian',
    isDefault: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  const testFemaleProfile: StoredUserProfile = {
    id: 'profile-456',
    name: 'Female User',
    gender: 'female',
    birthYear: 1996, // ~28 years old
    heightCm: 165,
    ethnicity: 'asian',
    isDefault: false,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  const testRawMeasurement: RawMeasurement = {
    weightKg: 75.5,
    impedanceOhm: 485,
  };

  const testRawMeasurementWithHeartRate: RawMeasurement = {
    weightKg: 75.5,
    impedanceOhm: 485,
    heartRateBpm: 72,
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

  const testGuestMeasurement: MeasurementResult = {
    id: 'guest-measurement-001',
    timestamp: new Date('2024-01-15T10:30:00Z'),
    raw: testRawMeasurement,
    calculated: testCalculatedMetrics,
    userProfileId: GUEST_PROFILE_ID,
  };

  const createMultipleMeasurements = (count: number): MeasurementResult[] => {
    return Array.from({ length: count }, (_, i) => ({
      id: `measurement-${String(i + 1).padStart(3, '0')}`,
      timestamp: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
      raw: { ...testRawMeasurement, weightKg: 75 + i * 0.1 },
      calculated: { ...testCalculatedMetrics, bmi: 23.8 + i * 0.05 },
      userProfileId: 'profile-123',
    }));
  };

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();

    // Create mock BLEPort
    mockBLEPort = {
      getState: vi.fn().mockReturnValue('connected'),
      onStateChange: vi.fn().mockReturnValue(() => {}),
      onError: vi.fn().mockReturnValue(() => {}),
      onDeviceDiscovered: vi.fn().mockReturnValue(() => {}),
      scan: vi.fn().mockResolvedValue(undefined),
      scanForDevices: vi.fn().mockResolvedValue([{ mac: 'AA:BB:CC:DD:EE:FF', name: 'MIBFS', rssi: -65 }]),
      stopScan: vi.fn(),
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      readMeasurement: vi.fn().mockResolvedValue(testRawMeasurement),
      isDeviceAvailable: vi.fn().mockResolvedValue(true),
    };

    // Create mock MeasurementRepository
    mockMeasurementRepository = {
      save: vi.fn().mockResolvedValue(undefined),
      getById: vi.fn().mockResolvedValue(testMeasurementResult),
      getAll: vi.fn().mockResolvedValue([testMeasurementResult]),
      delete: vi.fn().mockResolvedValue(undefined),
      deleteAll: vi.fn().mockResolvedValue(undefined),
      count: vi.fn().mockResolvedValue(1),
      updateProfileAssignment: vi.fn().mockResolvedValue(undefined),
    };

    // Create mock ProfileRepository
    mockProfileRepository = {
      save: vi.fn().mockResolvedValue(undefined),
      getById: vi.fn().mockResolvedValue(testProfile),
      getAll: vi.fn().mockResolvedValue([testProfile]),
      delete: vi.fn().mockResolvedValue(undefined),
      getDefault: vi.fn().mockResolvedValue(testProfile),
      setDefault: vi.fn().mockResolvedValue(undefined),
    };

    // Create service instance with mocked dependencies
    service = new MeasurementService(
      mockBLEPort,
      mockMeasurementRepository,
      mockProfileRepository
    );
  });

  describe('captureMeasurement', () => {
    describe('success flow', () => {
      it('should return MeasurementResult with calculated metrics for valid profile', async () => {
        // Act
        const result = await service.captureMeasurement('profile-123');

        // Assert - verify orchestration
        expect(mockProfileRepository.getById).toHaveBeenCalledWith(
          'profile-123'
        );
        expect(mockBLEPort.readMeasurement).toHaveBeenCalled();
        expect(mockMeasurementRepository.save).toHaveBeenCalled();

        // Verify result structure
        expect(result).toHaveProperty('id', 'test-uuid-12345');
        expect(result).toHaveProperty('timestamp');
        expect(result).toHaveProperty('raw');
        expect(result).toHaveProperty('calculated');
        expect(result).toHaveProperty('userProfileId', 'profile-123');

        // Verify raw measurement is included
        expect(result.raw).toEqual(testRawMeasurement);
      });

      it('should calculate body composition metrics based on profile data', async () => {
        // Act
        const result = await service.captureMeasurement('profile-123');

        // Assert - verify calculated metrics are present and reasonable
        expect(result.calculated).toHaveProperty('bmi');
        expect(result.calculated.bmi).toBeGreaterThan(15);
        expect(result.calculated.bmi).toBeLessThan(50);

        expect(result.calculated).toHaveProperty('bodyFatPercent');
        expect(result.calculated.bodyFatPercent).toBeGreaterThan(0);
        expect(result.calculated.bodyFatPercent).toBeLessThan(100);

        expect(result.calculated).toHaveProperty('muscleMassKg');
        expect(result.calculated.muscleMassKg).toBeGreaterThan(0);

        expect(result.calculated).toHaveProperty('bodyWaterPercent');
        expect(result.calculated).toHaveProperty('boneMassKg');
        expect(result.calculated).toHaveProperty('visceralFatLevel');
        expect(result.calculated).toHaveProperty('bmrKcal');
        expect(result.calculated).toHaveProperty('leanBodyMassKg');
        expect(result.calculated).toHaveProperty('proteinPercent');
        expect(result.calculated).toHaveProperty('bodyScore');
      });

      it('should generate unique UUID for each measurement', async () => {
        // Act
        const result = await service.captureMeasurement('profile-123');

        // Assert
        expect(result.id).toBe('test-uuid-12345');
        expect(crypto.randomUUID).toHaveBeenCalled();
      });

      it('should set timestamp to current time', async () => {
        // Arrange
        const beforeTime = new Date();

        // Act
        const result = await service.captureMeasurement('profile-123');

        // Assert
        const afterTime = new Date();
        expect(result.timestamp.getTime()).toBeGreaterThanOrEqual(
          beforeTime.getTime()
        );
        expect(result.timestamp.getTime()).toBeLessThanOrEqual(
          afterTime.getTime()
        );
      });

      it('should save measurement result to repository', async () => {
        // Act
        const result = await service.captureMeasurement('profile-123');

        // Assert
        expect(mockMeasurementRepository.save).toHaveBeenCalledWith(result);
        expect(mockMeasurementRepository.save).toHaveBeenCalledTimes(1);
      });

      it('should handle measurement with heart rate data', async () => {
        // Arrange
        mockBLEPort.readMeasurement = vi
          .fn()
          .mockResolvedValue(testRawMeasurementWithHeartRate);

        // Act
        const result = await service.captureMeasurement('profile-123');

        // Assert
        expect(result.raw.heartRateBpm).toBe(72);
      });

      it('should use profile ethnicity for calculations if provided', async () => {
        // Arrange
        mockProfileRepository.getById = vi
          .fn()
          .mockResolvedValue(testFemaleProfile);

        // Act
        const result = await service.captureMeasurement('profile-456');

        // Assert
        expect(mockProfileRepository.getById).toHaveBeenCalledWith(
          'profile-456'
        );
        expect(result.userProfileId).toBe('profile-456');
        expect(result.calculated).toBeDefined();
      });
    });

    describe('error handling', () => {
      it('should throw ProfileNotFoundError when profile is missing', async () => {
        // Arrange
        mockProfileRepository.getById = vi.fn().mockResolvedValue(null);

        // Act & Assert
        await expect(
          service.captureMeasurement('non-existent-profile')
        ).rejects.toThrow(ProfileNotFoundError);

        await expect(
          service.captureMeasurement('non-existent-profile')
        ).rejects.toThrow('Profile not found: non-existent-profile');
      });

      it('should throw MeasurementReadError when BLE read fails', async () => {
        // Arrange
        const bleError = new Error('BLE connection lost');
        mockBLEPort.readMeasurement = vi.fn().mockRejectedValue(bleError);

        // Act & Assert
        await expect(
          service.captureMeasurement('profile-123')
        ).rejects.toThrow(MeasurementReadError);

        await expect(
          service.captureMeasurement('profile-123')
        ).rejects.toThrow('Failed to read measurement from scale');
      });

      it('should include original error as cause in MeasurementReadError', async () => {
        // Arrange
        const originalError = new Error('Connection timeout');
        mockBLEPort.readMeasurement = vi.fn().mockRejectedValue(originalError);

        // Act & Assert
        try {
          await service.captureMeasurement('profile-123');
          expect.fail('Should have thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(MeasurementReadError);
          expect((error as MeasurementReadError).cause).toBe(originalError);
        }
      });

      it('should handle non-Error BLE failures gracefully', async () => {
        // Arrange
        mockBLEPort.readMeasurement = vi.fn().mockRejectedValue('string error');

        // Act & Assert
        await expect(
          service.captureMeasurement('profile-123')
        ).rejects.toThrow(MeasurementReadError);
      });

      it('should propagate repository save errors', async () => {
        // Arrange
        const saveError = new Error('Database write failed');
        mockMeasurementRepository.save = vi.fn().mockRejectedValue(saveError);

        // Act & Assert
        await expect(
          service.captureMeasurement('profile-123')
        ).rejects.toThrow('Database write failed');
      });

      it('should not save measurement when BLE read fails', async () => {
        // Arrange
        mockBLEPort.readMeasurement = vi
          .fn()
          .mockRejectedValue(new Error('BLE error'));

        // Act & Assert
        try {
          await service.captureMeasurement('profile-123');
        } catch {
          // Expected
        }
        expect(mockMeasurementRepository.save).not.toHaveBeenCalled();
      });

      it('should not call BLE when profile not found', async () => {
        // Arrange
        mockProfileRepository.getById = vi.fn().mockResolvedValue(null);

        // Act & Assert
        try {
          await service.captureMeasurement('invalid-profile');
        } catch {
          // Expected
        }
        expect(mockBLEPort.readMeasurement).not.toHaveBeenCalled();
      });
    });
  });

  describe('saveMeasurementAsGuest', () => {
    it('should save measurement with GUEST_PROFILE_ID', async () => {
      // Act
      const result = await service.saveMeasurementAsGuest(testRawMeasurement);

      // Assert
      expect(result.userProfileId).toBe(GUEST_PROFILE_ID);
      expect(mockMeasurementRepository.save).toHaveBeenCalledWith(result);
    });

    it('should generate UUID for guest measurement', async () => {
      // Act
      const result = await service.saveMeasurementAsGuest(testRawMeasurement);

      // Assert
      expect(result.id).toBe('test-uuid-12345');
    });

    it('should calculate basic metrics using default values', async () => {
      // Act
      const result = await service.saveMeasurementAsGuest(testRawMeasurement);

      // Assert
      expect(result.calculated).toBeDefined();
      expect(result.calculated.bmi).toBeGreaterThan(0);
    });

    it('should preserve raw measurement data', async () => {
      // Act
      const result = await service.saveMeasurementAsGuest(testRawMeasurement);

      // Assert
      expect(result.raw).toEqual(testRawMeasurement);
    });
  });

  describe('assignGuestMeasurement', () => {
    beforeEach(() => {
      mockMeasurementRepository.getById = vi
        .fn()
        .mockResolvedValue(testGuestMeasurement);
    });

    it('should reassign measurement to specified profile', async () => {
      // Act
      const result = await service.assignGuestMeasurement(
        'guest-measurement-001',
        'profile-123'
      );

      // Assert
      expect(result.userProfileId).toBe('profile-123');
      expect(mockMeasurementRepository.save).toHaveBeenCalled();
    });

    it('should recalculate metrics with profile data', async () => {
      // Act
      const result = await service.assignGuestMeasurement(
        'guest-measurement-001',
        'profile-123'
      );

      // Assert
      expect(result.calculated).toBeDefined();
      expect(result.calculated.bmi).toBeGreaterThan(0);
    });

    it('should throw MeasurementNotFoundError when measurement does not exist', async () => {
      // Arrange
      mockMeasurementRepository.getById = vi.fn().mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.assignGuestMeasurement('non-existent', 'profile-123')
      ).rejects.toThrow(MeasurementNotFoundError);
    });

    it('should throw ProfileNotFoundError when profile does not exist', async () => {
      // Arrange
      mockProfileRepository.getById = vi.fn().mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.assignGuestMeasurement('guest-measurement-001', 'non-existent')
      ).rejects.toThrow(ProfileNotFoundError);
    });

    it('should preserve original timestamp', async () => {
      // Act
      const result = await service.assignGuestMeasurement(
        'guest-measurement-001',
        'profile-123'
      );

      // Assert
      expect(result.timestamp.getTime()).toBe(
        testGuestMeasurement.timestamp.getTime()
      );
    });

    it('should preserve original raw measurement', async () => {
      // Act
      const result = await service.assignGuestMeasurement(
        'guest-measurement-001',
        'profile-123'
      );

      // Assert
      expect(result.raw).toEqual(testGuestMeasurement.raw);
    });
  });

  describe('getGuestMeasurements', () => {
    it('should query measurements with GUEST_PROFILE_ID', async () => {
      // Arrange
      mockMeasurementRepository.getAll = vi
        .fn()
        .mockResolvedValue([testGuestMeasurement]);

      // Act
      const results = await service.getGuestMeasurements();

      // Assert
      expect(mockMeasurementRepository.getAll).toHaveBeenCalledWith({
        userProfileId: GUEST_PROFILE_ID,
      });
      expect(results).toHaveLength(1);
      expect(results[0].userProfileId).toBe(GUEST_PROFILE_ID);
    });

    it('should return empty array when no guest measurements', async () => {
      // Arrange
      mockMeasurementRepository.getAll = vi.fn().mockResolvedValue([]);

      // Act
      const results = await service.getGuestMeasurements();

      // Assert
      expect(results).toEqual([]);
    });
  });

  describe('getMeasurementHistory', () => {
    it('should call repository getAll with query parameters', async () => {
      // Arrange
      const query: MeasurementQuery = {
        userProfileId: 'profile-123',
        limit: 10,
      };

      // Act
      const results = await service.getMeasurementHistory(query);

      // Assert
      expect(mockMeasurementRepository.getAll).toHaveBeenCalledWith(query);
      expect(results).toEqual([testMeasurementResult]);
    });

    it('should return empty array when no measurements found', async () => {
      // Arrange
      mockMeasurementRepository.getAll = vi.fn().mockResolvedValue([]);
      const query: MeasurementQuery = { userProfileId: 'profile-123' };

      // Act
      const results = await service.getMeasurementHistory(query);

      // Assert
      expect(results).toEqual([]);
      expect(results).toHaveLength(0);
    });

    it('should support date range filtering', async () => {
      // Arrange
      const fromDate = new Date('2024-01-01');
      const toDate = new Date('2024-01-31');
      const query: MeasurementQuery = {
        userProfileId: 'profile-123',
        fromDate,
        toDate,
      };

      // Act
      await service.getMeasurementHistory(query);

      // Assert
      expect(mockMeasurementRepository.getAll).toHaveBeenCalledWith({
        userProfileId: 'profile-123',
        fromDate,
        toDate,
      });
    });

    it('should support pagination with limit and offset', async () => {
      // Arrange
      const query: MeasurementQuery = {
        userProfileId: 'profile-123',
        limit: 10,
        offset: 20,
      };

      // Act
      await service.getMeasurementHistory(query);

      // Assert
      expect(mockMeasurementRepository.getAll).toHaveBeenCalledWith(query);
    });

    it('should return multiple measurements in order', async () => {
      // Arrange
      const multipleMeasurements = createMultipleMeasurements(5);
      mockMeasurementRepository.getAll = vi
        .fn()
        .mockResolvedValue(multipleMeasurements);

      // Act
      const results = await service.getMeasurementHistory({
        userProfileId: 'profile-123',
      });

      // Assert
      expect(results).toHaveLength(5);
      expect(results[0].id).toBe('measurement-001');
    });

    it('should accept query without any filters', async () => {
      // Act
      await service.getMeasurementHistory({});

      // Assert
      expect(mockMeasurementRepository.getAll).toHaveBeenCalledWith({});
    });
  });

  describe('getLatestMeasurement', () => {
    it('should return first measurement from limit=1 query', async () => {
      // Arrange
      mockMeasurementRepository.getAll = vi
        .fn()
        .mockResolvedValue([testMeasurementResult]);

      // Act
      const result = await service.getLatestMeasurement('profile-123');

      // Assert
      expect(mockMeasurementRepository.getAll).toHaveBeenCalledWith({
        userProfileId: 'profile-123',
        limit: 1,
      });
      expect(result).toEqual(testMeasurementResult);
    });

    it('should return null when no measurements exist for profile', async () => {
      // Arrange
      mockMeasurementRepository.getAll = vi.fn().mockResolvedValue([]);

      // Act
      const result = await service.getLatestMeasurement('profile-123');

      // Assert
      expect(result).toBeNull();
    });

    it('should return only the latest measurement even if repository returns more', async () => {
      // Arrange
      const multipleMeasurements = createMultipleMeasurements(3);
      mockMeasurementRepository.getAll = vi
        .fn()
        .mockResolvedValue(multipleMeasurements);

      // Act
      const result = await service.getLatestMeasurement('profile-123');

      // Assert
      expect(result).toEqual(multipleMeasurements[0]);
    });
  });

  describe('getMeasurement', () => {
    it('should return measurement by ID', async () => {
      // Act
      const result = await service.getMeasurement('measurement-001');

      // Assert
      expect(mockMeasurementRepository.getById).toHaveBeenCalledWith(
        'measurement-001'
      );
      expect(result).toEqual(testMeasurementResult);
    });

    it('should return null for non-existent measurement', async () => {
      // Arrange
      mockMeasurementRepository.getById = vi.fn().mockResolvedValue(null);

      // Act
      const result = await service.getMeasurement('non-existent');

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('deleteMeasurement', () => {
    it('should call repository delete with correct ID', async () => {
      // Act
      await service.deleteMeasurement('measurement-001');

      // Assert
      expect(mockMeasurementRepository.delete).toHaveBeenCalledWith(
        'measurement-001'
      );
      expect(mockMeasurementRepository.delete).toHaveBeenCalledTimes(1);
    });

    it('should not throw when deleting non-existent measurement', async () => {
      // Arrange
      mockMeasurementRepository.delete = vi.fn().mockResolvedValue(undefined);

      // Act & Assert
      await expect(
        service.deleteMeasurement('non-existent')
      ).resolves.not.toThrow();
    });

    it('should propagate repository delete errors', async () => {
      // Arrange
      const deleteError = new Error('Delete failed');
      mockMeasurementRepository.delete = vi.fn().mockRejectedValue(deleteError);

      // Act & Assert
      await expect(service.deleteMeasurement('measurement-001')).rejects.toThrow(
        'Delete failed'
      );
    });
  });

  describe('deleteAllMeasurements', () => {
    it('should call repository deleteAll with profileId', async () => {
      // Act
      await service.deleteAllMeasurements('profile-123');

      // Assert
      expect(mockMeasurementRepository.deleteAll).toHaveBeenCalledWith(
        'profile-123'
      );
    });

    it('should not throw when profile has no measurements', async () => {
      // Act & Assert
      await expect(
        service.deleteAllMeasurements('profile-with-no-measurements')
      ).resolves.not.toThrow();
    });
  });

  describe('countMeasurements', () => {
    it('should return count from repository', async () => {
      // Arrange
      mockMeasurementRepository.count = vi.fn().mockResolvedValue(42);

      // Act
      const count = await service.countMeasurements('profile-123');

      // Assert
      expect(mockMeasurementRepository.count).toHaveBeenCalledWith({
        userProfileId: 'profile-123',
      });
      expect(count).toBe(42);
    });

    it('should return 0 for profile with no measurements', async () => {
      // Arrange
      mockMeasurementRepository.count = vi.fn().mockResolvedValue(0);

      // Act
      const count = await service.countMeasurements('new-profile');

      // Assert
      expect(count).toBe(0);
    });
  });

  describe('GUEST_PROFILE_ID constant', () => {
    it('should be exported and have correct value', () => {
      expect(GUEST_PROFILE_ID).toBe('__guest__');
    });
  });
});

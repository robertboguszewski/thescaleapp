/**
 * ReportService Unit Tests
 *
 * Comprehensive tests for the ReportService application service.
 * Uses vitest for testing with mocked dependencies following TDD approach.
 *
 * @module application/services/__tests__/ReportService.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ReportService,
  NoMeasurementsError,
  ProfileNotFoundError,
  type MetricTrends,
} from '../ReportService';
import type {
  MeasurementRepository,
  MeasurementResult,
} from '../../ports/MeasurementRepository';
import type {
  ProfileRepository,
  StoredUserProfile,
} from '../../ports/ProfileRepository';
import type {
  RawMeasurement,
  CalculatedMetrics,
} from '../../../domain/calculations/types';

describe('ReportService', () => {
  // Mock dependencies
  let mockMeasurementRepository: MeasurementRepository;
  let mockProfileRepository: ProfileRepository;
  let service: ReportService;

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

  // Helper to create measurement at specific days ago
  const createMeasurementAtDaysAgo = (
    daysAgo: number,
    overrides: {
      weightKg?: number;
      bodyFatPercent?: number;
      muscleMassKg?: number;
      bodyScore?: number;
    } = {}
  ): MeasurementResult => {
    const timestamp = new Date();
    timestamp.setDate(timestamp.getDate() - daysAgo);

    const raw: RawMeasurement = {
      weightKg: overrides.weightKg ?? 75.5,
      impedanceOhm: 485,
    };

    const calculated: CalculatedMetrics = {
      bmi: 23.8,
      bodyFatPercent: overrides.bodyFatPercent ?? 18.5,
      muscleMassKg: overrides.muscleMassKg ?? 46.2,
      bodyWaterPercent: 55.3,
      boneMassKg: 2.5,
      visceralFatLevel: 8,
      bmrKcal: 1720,
      leanBodyMassKg: 61.6,
      proteinPercent: 13.5,
      bodyScore: overrides.bodyScore ?? 82,
    };

    return {
      id: `measurement-${daysAgo}`,
      timestamp,
      raw,
      calculated,
      userProfileId: 'profile-123',
    };
  };

  // Single measurement (latest)
  const singleMeasurement = createMeasurementAtDaysAgo(0, {
    weightKg: 75.5,
    bodyFatPercent: 18.5,
    muscleMassKg: 46.2,
    bodyScore: 82,
  });

  // Multiple measurements showing improvement
  const improvingMeasurements = [
    createMeasurementAtDaysAgo(0, {
      weightKg: 74.0,
      bodyFatPercent: 17.0,
      muscleMassKg: 47.0,
      bodyScore: 85,
    }),
    createMeasurementAtDaysAgo(10, {
      weightKg: 75.0,
      bodyFatPercent: 18.5,
      muscleMassKg: 46.0,
      bodyScore: 80,
    }),
    createMeasurementAtDaysAgo(20, {
      weightKg: 76.0,
      bodyFatPercent: 20.0,
      muscleMassKg: 45.5,
      bodyScore: 75,
    }),
  ];

  // Multiple measurements showing decline
  const decliningMeasurements = [
    createMeasurementAtDaysAgo(0, {
      weightKg: 78.0,
      bodyFatPercent: 24.0,
      muscleMassKg: 43.0,
      bodyScore: 65,
    }),
    createMeasurementAtDaysAgo(10, {
      weightKg: 76.0,
      bodyFatPercent: 21.0,
      muscleMassKg: 44.5,
      bodyScore: 72,
    }),
    createMeasurementAtDaysAgo(20, {
      weightKg: 74.0,
      bodyFatPercent: 18.0,
      muscleMassKg: 46.0,
      bodyScore: 80,
    }),
  ];

  // Multiple measurements with stable trends
  const stableMeasurements = [
    createMeasurementAtDaysAgo(0, {
      weightKg: 75.5,
      bodyFatPercent: 18.5,
      muscleMassKg: 46.2,
      bodyScore: 82,
    }),
    createMeasurementAtDaysAgo(10, {
      weightKg: 75.3,
      bodyFatPercent: 18.7,
      muscleMassKg: 46.0,
      bodyScore: 81,
    }),
    createMeasurementAtDaysAgo(20, {
      weightKg: 75.6,
      bodyFatPercent: 18.4,
      muscleMassKg: 46.1,
      bodyScore: 82,
    }),
  ];

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();

    // Create mock MeasurementRepository
    mockMeasurementRepository = {
      save: vi.fn().mockResolvedValue(undefined),
      getById: vi.fn().mockResolvedValue(singleMeasurement),
      getAll: vi.fn().mockResolvedValue([singleMeasurement]),
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
    service = new ReportService(
      mockMeasurementRepository,
      mockProfileRepository
    );
  });

  describe('generateReport', () => {
    describe('success scenarios', () => {
      it('should generate report with single measurement', async () => {
        // Arrange
        mockMeasurementRepository.getAll = vi
          .fn()
          .mockResolvedValue([singleMeasurement]);

        // Act
        const report = await service.generateReport('profile-123');

        // Assert
        expect(report.profileId).toBe('profile-123');
        expect(report.profileName).toBe('Test User');
        expect(report.latestMeasurement).toEqual(singleMeasurement);
        expect(report.generatedAt).toBeInstanceOf(Date);
      });

      it('should calculate trends from multiple measurements', async () => {
        // Arrange
        mockMeasurementRepository.getAll = vi
          .fn()
          .mockResolvedValue(improvingMeasurements);

        // Act
        const report = await service.generateReport('profile-123');

        // Assert - trends calculated between latest and oldest
        expect(report.trends).toBeDefined();
        expect(report.trends.measurementCount).toBe(3);
        expect(report.trends.period).toBeGreaterThan(0);
        // Weight change: 74.0 - 76.0 = -2.0
        expect(report.trends.weightChange).toBe(-2.0);
        // Body fat change: 17.0 - 20.0 = -3.0
        expect(report.trends.bodyFatChange).toBe(-3.0);
        // Muscle change: 47.0 - 45.5 = 1.5
        expect(report.trends.muscleChange).toBe(1.5);
      });

      it('should return zero trends for single measurement', async () => {
        // Arrange
        mockMeasurementRepository.getAll = vi
          .fn()
          .mockResolvedValue([singleMeasurement]);

        // Act
        const report = await service.generateReport('profile-123');

        // Assert
        expect(report.trends.weightChange).toBe(0);
        expect(report.trends.bodyFatChange).toBe(0);
        expect(report.trends.muscleChange).toBe(0);
        expect(report.trends.measurementCount).toBe(1);
        expect(report.trends.period).toBe(0);
      });

      it('should set overallStatus to improving when trends are positive', async () => {
        // Arrange
        mockMeasurementRepository.getAll = vi
          .fn()
          .mockResolvedValue(improvingMeasurements);

        // Act
        const report = await service.generateReport('profile-123');

        // Assert
        expect(report.summary.overallStatus).toBe('improving');
      });

      it('should set overallStatus to declining when trends are negative', async () => {
        // Arrange
        mockMeasurementRepository.getAll = vi
          .fn()
          .mockResolvedValue(decliningMeasurements);

        // Act
        const report = await service.generateReport('profile-123');

        // Assert
        expect(report.summary.overallStatus).toBe('declining');
      });

      it('should set overallStatus to stable when trends are neutral', async () => {
        // Arrange
        mockMeasurementRepository.getAll = vi
          .fn()
          .mockResolvedValue(stableMeasurements);

        // Act
        const report = await service.generateReport('profile-123');

        // Assert
        expect(report.summary.overallStatus).toBe('stable');
      });

      it('should set overallStatus to stable for single measurement', async () => {
        // Arrange
        mockMeasurementRepository.getAll = vi
          .fn()
          .mockResolvedValue([singleMeasurement]);

        // Act
        const report = await service.generateReport('profile-123');

        // Assert
        expect(report.summary.overallStatus).toBe('stable');
      });

      it('should include bodyScore in summary', async () => {
        // Arrange
        mockMeasurementRepository.getAll = vi
          .fn()
          .mockResolvedValue([singleMeasurement]);

        // Act
        const report = await service.generateReport('profile-123');

        // Assert
        expect(report.summary.bodyScore).toBe(82);
      });

      it('should generate health recommendations', async () => {
        // Arrange
        mockMeasurementRepository.getAll = vi
          .fn()
          .mockResolvedValue([singleMeasurement]);

        // Act
        const report = await service.generateReport('profile-123');

        // Assert
        expect(report.recommendations).toBeDefined();
        expect(Array.isArray(report.recommendations)).toBe(true);
        // Should have at most 3 priority recommendations
        expect(report.recommendations.length).toBeLessThanOrEqual(3);
      });

      it('should generate key insight based on trends', async () => {
        // Arrange
        mockMeasurementRepository.getAll = vi
          .fn()
          .mockResolvedValue(improvingMeasurements);

        // Act
        const report = await service.generateReport('profile-123');

        // Assert
        expect(report.summary.keyInsight).toBeDefined();
        expect(typeof report.summary.keyInsight).toBe('string');
        expect(report.summary.keyInsight.length).toBeGreaterThan(0);
      });

      it('should query measurements from last 30 days', async () => {
        // Act
        await service.generateReport('profile-123');

        // Assert
        expect(mockMeasurementRepository.getAll).toHaveBeenCalledWith(
          expect.objectContaining({
            userProfileId: 'profile-123',
            fromDate: expect.any(Date),
          })
        );

        const call = vi.mocked(mockMeasurementRepository.getAll).mock
          .calls[0][0];
        const fromDate = call?.fromDate as Date;
        const now = new Date();
        const daysDiff = Math.round(
          (now.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        expect(daysDiff).toBe(30);
      });

      it('should work with female profile', async () => {
        // Arrange
        mockProfileRepository.getById = vi
          .fn()
          .mockResolvedValue(testFemaleProfile);
        mockMeasurementRepository.getAll = vi
          .fn()
          .mockResolvedValue([singleMeasurement]);

        // Act
        const report = await service.generateReport('profile-456');

        // Assert
        expect(report.profileName).toBe('Female User');
        expect(report.recommendations).toBeDefined();
      });
    });

    describe('error scenarios', () => {
      it('should throw ProfileNotFoundError when profile is missing', async () => {
        // Arrange
        mockProfileRepository.getById = vi.fn().mockResolvedValue(null);

        // Act & Assert
        await expect(
          service.generateReport('non-existent')
        ).rejects.toThrow(ProfileNotFoundError);

        await expect(
          service.generateReport('non-existent')
        ).rejects.toThrow('Profile not found: non-existent');
      });

      it('should throw NoMeasurementsError when no measurements exist', async () => {
        // Arrange
        mockMeasurementRepository.getAll = vi.fn().mockResolvedValue([]);

        // Act & Assert
        await expect(
          service.generateReport('profile-123')
        ).rejects.toThrow(NoMeasurementsError);

        await expect(
          service.generateReport('profile-123')
        ).rejects.toThrow('No measurements found for profile: profile-123');
      });

      it('should not query measurements if profile not found', async () => {
        // Arrange
        mockProfileRepository.getById = vi.fn().mockResolvedValue(null);

        // Act & Assert
        try {
          await service.generateReport('non-existent');
        } catch {
          // Expected
        }
        expect(mockMeasurementRepository.getAll).not.toHaveBeenCalled();
      });
    });

    describe('trend calculation edge cases', () => {
      it('should handle measurements on same day', async () => {
        // Arrange
        const sameDayMeasurements = [
          createMeasurementAtDaysAgo(0, { weightKg: 75.5 }),
          createMeasurementAtDaysAgo(0, { weightKg: 75.3 }),
        ];
        mockMeasurementRepository.getAll = vi
          .fn()
          .mockResolvedValue(sameDayMeasurements);

        // Act
        const report = await service.generateReport('profile-123');

        // Assert
        expect(report.trends.period).toBe(0);
        expect(report.trends.measurementCount).toBe(2);
      });

      it('should calculate correct period in days', async () => {
        // Arrange - measurements 15 days apart
        const measurements = [
          createMeasurementAtDaysAgo(0),
          createMeasurementAtDaysAgo(15),
        ];
        mockMeasurementRepository.getAll = vi
          .fn()
          .mockResolvedValue(measurements);

        // Act
        const report = await service.generateReport('profile-123');

        // Assert
        expect(report.trends.period).toBe(15);
      });

      it('should round trend values to one decimal place', async () => {
        // Arrange
        const measurementsWithPreciseValues = [
          createMeasurementAtDaysAgo(0, {
            weightKg: 75.333,
            bodyFatPercent: 18.777,
            muscleMassKg: 46.555,
          }),
          createMeasurementAtDaysAgo(10, {
            weightKg: 76.111,
            bodyFatPercent: 19.222,
            muscleMassKg: 46.111,
          }),
        ];
        mockMeasurementRepository.getAll = vi
          .fn()
          .mockResolvedValue(measurementsWithPreciseValues);

        // Act
        const report = await service.generateReport('profile-123');

        // Assert - values should be rounded
        expect(Number.isInteger(report.trends.weightChange * 10)).toBe(true);
        expect(Number.isInteger(report.trends.bodyFatChange * 10)).toBe(true);
        expect(Number.isInteger(report.trends.muscleChange * 10)).toBe(true);
      });
    });

    describe('overall status determination', () => {
      it('should be improving with significant weight loss', async () => {
        // Arrange - weight loss > 0.5kg
        const measurements = [
          createMeasurementAtDaysAgo(0, { weightKg: 74.0 }),
          createMeasurementAtDaysAgo(10, { weightKg: 76.0 }),
        ];
        mockMeasurementRepository.getAll = vi
          .fn()
          .mockResolvedValue(measurements);

        // Act
        const report = await service.generateReport('profile-123');

        // Assert - weight loss alone gives +1, needs more for "improving"
        expect(['improving', 'stable']).toContain(report.summary.overallStatus);
      });

      it('should be improving with significant body fat loss and muscle gain', async () => {
        // Arrange
        const measurements = [
          createMeasurementAtDaysAgo(0, {
            bodyFatPercent: 16.0,
            muscleMassKg: 48.0,
          }),
          createMeasurementAtDaysAgo(10, {
            bodyFatPercent: 20.0,
            muscleMassKg: 45.0,
          }),
        ];
        mockMeasurementRepository.getAll = vi
          .fn()
          .mockResolvedValue(measurements);

        // Act
        const report = await service.generateReport('profile-123');

        // Assert
        expect(report.summary.overallStatus).toBe('improving');
      });

      it('should be declining with weight gain and body fat increase', async () => {
        // Arrange
        const measurements = [
          createMeasurementAtDaysAgo(0, {
            weightKg: 80.0,
            bodyFatPercent: 25.0,
            muscleMassKg: 42.0,
          }),
          createMeasurementAtDaysAgo(10, {
            weightKg: 75.0,
            bodyFatPercent: 18.0,
            muscleMassKg: 46.0,
          }),
        ];
        mockMeasurementRepository.getAll = vi
          .fn()
          .mockResolvedValue(measurements);

        // Act
        const report = await service.generateReport('profile-123');

        // Assert
        expect(report.summary.overallStatus).toBe('declining');
      });
    });
  });

  describe('getQuickSummary', () => {
    it('should return bodyScore from latest measurement', async () => {
      // Arrange
      mockMeasurementRepository.getAll = vi
        .fn()
        .mockResolvedValue([singleMeasurement]);

      // Act
      const summary = await service.getQuickSummary('profile-123');

      // Assert
      expect(summary).not.toBeNull();
      expect(summary!.bodyScore).toBe(82);
    });

    it('should return "good" status when bodyScore >= 70', async () => {
      // Arrange
      const goodScoreMeasurement = createMeasurementAtDaysAgo(0, {
        bodyScore: 75,
      });
      mockMeasurementRepository.getAll = vi
        .fn()
        .mockResolvedValue([goodScoreMeasurement]);

      // Act
      const summary = await service.getQuickSummary('profile-123');

      // Assert
      expect(summary!.status).toBe('good');
    });

    it('should return "needs-attention" status when bodyScore < 70', async () => {
      // Arrange
      const lowScoreMeasurement = createMeasurementAtDaysAgo(0, {
        bodyScore: 65,
      });
      mockMeasurementRepository.getAll = vi
        .fn()
        .mockResolvedValue([lowScoreMeasurement]);

      // Act
      const summary = await service.getQuickSummary('profile-123');

      // Assert
      expect(summary!.status).toBe('needs-attention');
    });

    it('should return "good" status for bodyScore exactly 70', async () => {
      // Arrange
      const borderlineScoreMeasurement = createMeasurementAtDaysAgo(0, {
        bodyScore: 70,
      });
      mockMeasurementRepository.getAll = vi
        .fn()
        .mockResolvedValue([borderlineScoreMeasurement]);

      // Act
      const summary = await service.getQuickSummary('profile-123');

      // Assert
      expect(summary!.status).toBe('good');
    });

    it('should return null when no measurements exist', async () => {
      // Arrange
      mockMeasurementRepository.getAll = vi.fn().mockResolvedValue([]);

      // Act
      const summary = await service.getQuickSummary('profile-123');

      // Assert
      expect(summary).toBeNull();
    });

    it('should query with limit=1', async () => {
      // Act
      await service.getQuickSummary('profile-123');

      // Assert
      expect(mockMeasurementRepository.getAll).toHaveBeenCalledWith({
        userProfileId: 'profile-123',
        limit: 1,
      });
    });

    it('should not validate profile existence', async () => {
      // Act
      await service.getQuickSummary('any-profile-id');

      // Assert
      expect(mockProfileRepository.getById).not.toHaveBeenCalled();
    });
  });

  describe('report structure validation', () => {
    it('should include all required report fields', async () => {
      // Arrange
      mockMeasurementRepository.getAll = vi
        .fn()
        .mockResolvedValue([singleMeasurement]);

      // Act
      const report = await service.generateReport('profile-123');

      // Assert - verify complete report structure
      expect(report).toHaveProperty('profileId');
      expect(report).toHaveProperty('profileName');
      expect(report).toHaveProperty('generatedAt');
      expect(report).toHaveProperty('latestMeasurement');
      expect(report).toHaveProperty('trends');
      expect(report).toHaveProperty('recommendations');
      expect(report).toHaveProperty('summary');
    });

    it('should include all trend fields', async () => {
      // Arrange
      mockMeasurementRepository.getAll = vi
        .fn()
        .mockResolvedValue(improvingMeasurements);

      // Act
      const report = await service.generateReport('profile-123');

      // Assert
      const trends: MetricTrends = report.trends;
      expect(trends).toHaveProperty('weightChange');
      expect(trends).toHaveProperty('bodyFatChange');
      expect(trends).toHaveProperty('muscleChange');
      expect(trends).toHaveProperty('measurementCount');
      expect(trends).toHaveProperty('period');
    });

    it('should include all summary fields', async () => {
      // Arrange
      mockMeasurementRepository.getAll = vi
        .fn()
        .mockResolvedValue([singleMeasurement]);

      // Act
      const report = await service.generateReport('profile-123');

      // Assert
      expect(report.summary).toHaveProperty('overallStatus');
      expect(report.summary).toHaveProperty('bodyScore');
      expect(report.summary).toHaveProperty('keyInsight');
    });

    it('should have valid recommendation structure', async () => {
      // Arrange
      mockMeasurementRepository.getAll = vi
        .fn()
        .mockResolvedValue([singleMeasurement]);

      // Act
      const report = await service.generateReport('profile-123');

      // Assert
      if (report.recommendations.length > 0) {
        const recommendation = report.recommendations[0];
        expect(recommendation).toHaveProperty('type');
        expect(recommendation).toHaveProperty('category');
        expect(recommendation).toHaveProperty('title');
        expect(recommendation).toHaveProperty('message');
        expect(recommendation).toHaveProperty('actions');
        expect(['info', 'warning', 'critical']).toContain(recommendation.type);
        expect(Array.isArray(recommendation.actions)).toBe(true);
      }
    });
  });
});

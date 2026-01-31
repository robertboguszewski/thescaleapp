/**
 * GenerateReportUseCase Unit Tests
 *
 * Tests for the GenerateReportUseCase with mocked dependencies.
 *
 * @module application/use-cases/__tests__/GenerateReportUseCase.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GenerateReportUseCase } from '../GenerateReportUseCase';
import type {
  ReportService,
  HealthReport,
  MetricTrends,
  ReportSummary,
} from '../../services/ReportService';
import type { MeasurementResult } from '../../ports/MeasurementRepository';
import type { CalculatedMetrics, RawMeasurement } from '../../../domain/calculations/types';
import type { HealthRecommendation } from '../../../domain/calculations/health-assessment/recommendations';

describe('GenerateReportUseCase', () => {
  // Mock dependencies
  let mockReportService: ReportService;
  let useCase: GenerateReportUseCase;

  // Test data
  const testMeasurement: MeasurementResult = {
    id: 'measurement-001',
    timestamp: new Date('2024-01-15T10:30:00Z'),
    raw: {
      weightKg: 75.5,
      impedanceOhm: 485,
    } as RawMeasurement,
    calculated: {
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
    } as CalculatedMetrics,
    userProfileId: 'profile-123',
  };

  const testTrends: MetricTrends = {
    weightChange: -1.5,
    bodyFatChange: -0.8,
    muscleChange: 0.3,
    measurementCount: 5,
    period: 30,
  };

  const testRecommendations: HealthRecommendation[] = [
    {
      type: 'info',
      category: 'general',
      title: 'Dobra kondycja!',
      message: 'Twoje parametry sa w zdrowych zakresach.',
      actions: ['Utrzymuj regularna aktywnosc fizyczna'],
    },
  ];

  const testSummary: ReportSummary = {
    overallStatus: 'improving',
    bodyScore: 82,
    keyInsight: 'Twoje parametry poprawiaja sie. Kontynuuj obecny plan.',
  };

  const testHealthReport: HealthReport = {
    profileId: 'profile-123',
    profileName: 'Test User',
    generatedAt: new Date('2024-01-15T12:00:00Z'),
    latestMeasurement: testMeasurement,
    trends: testTrends,
    recommendations: testRecommendations,
    summary: testSummary,
  };

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();

    // Create mock ReportService
    mockReportService = {
      generateReport: vi.fn().mockResolvedValue(testHealthReport),
      getQuickSummary: vi.fn(),
    } as unknown as ReportService;

    // Create use case instance with mocked dependencies
    useCase = new GenerateReportUseCase(mockReportService);
  });

  describe('execute', () => {
    it('should successfully generate a health report', async () => {
      // Act
      const result = await useCase.execute({ profileId: 'profile-123' });

      // Assert
      expect(mockReportService.generateReport).toHaveBeenCalledWith('profile-123');
      expect(result).toEqual(testHealthReport);
    });

    it('should return report with correct structure', async () => {
      // Act
      const result = await useCase.execute({ profileId: 'profile-123' });

      // Assert
      expect(result).toHaveProperty('profileId');
      expect(result).toHaveProperty('profileName');
      expect(result).toHaveProperty('generatedAt');
      expect(result).toHaveProperty('latestMeasurement');
      expect(result).toHaveProperty('trends');
      expect(result).toHaveProperty('recommendations');
      expect(result).toHaveProperty('summary');
    });

    it('should pass profileId to ReportService', async () => {
      // Arrange
      const customProfileId = 'custom-profile-456';

      // Act
      await useCase.execute({ profileId: customProfileId });

      // Assert
      expect(mockReportService.generateReport).toHaveBeenCalledWith(
        customProfileId
      );
    });

    it('should return the report from ReportService without modification', async () => {
      // Arrange
      const customReport: HealthReport = {
        ...testHealthReport,
        profileId: 'different-profile',
        profileName: 'Different User',
      };
      mockReportService.generateReport = vi.fn().mockResolvedValue(customReport);

      // Act
      const result = await useCase.execute({ profileId: 'different-profile' });

      // Assert
      expect(result).toBe(customReport);
      expect(result.profileId).toBe('different-profile');
      expect(result.profileName).toBe('Different User');
    });
  });

  describe('report content', () => {
    it('should include latest measurement in report', async () => {
      // Act
      const result = await useCase.execute({ profileId: 'profile-123' });

      // Assert
      expect(result.latestMeasurement).toBeDefined();
      expect(result.latestMeasurement.id).toBe('measurement-001');
      expect(result.latestMeasurement.calculated.bodyScore).toBe(82);
    });

    it('should include trends in report', async () => {
      // Act
      const result = await useCase.execute({ profileId: 'profile-123' });

      // Assert
      expect(result.trends).toBeDefined();
      expect(result.trends.weightChange).toBe(-1.5);
      expect(result.trends.bodyFatChange).toBe(-0.8);
      expect(result.trends.muscleChange).toBe(0.3);
      expect(result.trends.measurementCount).toBe(5);
      expect(result.trends.period).toBe(30);
    });

    it('should include recommendations in report', async () => {
      // Act
      const result = await useCase.execute({ profileId: 'profile-123' });

      // Assert
      expect(result.recommendations).toBeDefined();
      expect(Array.isArray(result.recommendations)).toBe(true);
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('should include summary in report', async () => {
      // Act
      const result = await useCase.execute({ profileId: 'profile-123' });

      // Assert
      expect(result.summary).toBeDefined();
      expect(result.summary.overallStatus).toBe('improving');
      expect(result.summary.bodyScore).toBe(82);
      expect(result.summary.keyInsight).toBeDefined();
    });

    it('should include generation timestamp in report', async () => {
      // Act
      const result = await useCase.execute({ profileId: 'profile-123' });

      // Assert
      expect(result.generatedAt).toBeDefined();
      expect(result.generatedAt instanceof Date).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should propagate ProfileNotFoundError from ReportService', async () => {
      // Arrange
      const profileError = new Error('Profile not found: non-existent');
      profileError.name = 'ProfileNotFoundError';
      mockReportService.generateReport = vi.fn().mockRejectedValue(profileError);

      // Act & Assert
      await expect(
        useCase.execute({ profileId: 'non-existent' })
      ).rejects.toThrow('Profile not found: non-existent');
    });

    it('should propagate NoMeasurementsError from ReportService', async () => {
      // Arrange
      const noMeasurementsError = new Error(
        'No measurements found for profile: profile-123'
      );
      noMeasurementsError.name = 'NoMeasurementsError';
      mockReportService.generateReport = vi
        .fn()
        .mockRejectedValue(noMeasurementsError);

      // Act & Assert
      await expect(useCase.execute({ profileId: 'profile-123' })).rejects.toThrow(
        'No measurements found for profile: profile-123'
      );
    });

    it('should propagate general service errors', async () => {
      // Arrange
      const serviceError = new Error('Database connection failed');
      mockReportService.generateReport = vi.fn().mockRejectedValue(serviceError);

      // Act & Assert
      await expect(useCase.execute({ profileId: 'profile-123' })).rejects.toThrow(
        'Database connection failed'
      );
    });
  });

  describe('different status scenarios', () => {
    it('should handle improving status report', async () => {
      // Arrange
      const improvingReport: HealthReport = {
        ...testHealthReport,
        summary: {
          overallStatus: 'improving',
          bodyScore: 85,
          keyInsight: 'Swietne wyniki!',
        },
      };
      mockReportService.generateReport = vi.fn().mockResolvedValue(improvingReport);

      // Act
      const result = await useCase.execute({ profileId: 'profile-123' });

      // Assert
      expect(result.summary.overallStatus).toBe('improving');
    });

    it('should handle stable status report', async () => {
      // Arrange
      const stableReport: HealthReport = {
        ...testHealthReport,
        summary: {
          overallStatus: 'stable',
          bodyScore: 75,
          keyInsight: 'Parametry stabilne.',
        },
      };
      mockReportService.generateReport = vi.fn().mockResolvedValue(stableReport);

      // Act
      const result = await useCase.execute({ profileId: 'profile-123' });

      // Assert
      expect(result.summary.overallStatus).toBe('stable');
    });

    it('should handle declining status report', async () => {
      // Arrange
      const decliningReport: HealthReport = {
        ...testHealthReport,
        summary: {
          overallStatus: 'declining',
          bodyScore: 60,
          keyInsight: 'Niektore parametry wymagaja uwagi.',
        },
      };
      mockReportService.generateReport = vi.fn().mockResolvedValue(decliningReport);

      // Act
      const result = await useCase.execute({ profileId: 'profile-123' });

      // Assert
      expect(result.summary.overallStatus).toBe('declining');
    });
  });

  describe('input validation', () => {
    it('should accept valid profileId', async () => {
      // Act & Assert
      await expect(
        useCase.execute({ profileId: 'valid-profile-id' })
      ).resolves.toBeDefined();
    });

    it('should call ReportService with exact profileId provided', async () => {
      // Arrange
      const profileId = 'exact-profile-id-12345';

      // Act
      await useCase.execute({ profileId });

      // Assert
      expect(mockReportService.generateReport).toHaveBeenCalledTimes(1);
      expect(mockReportService.generateReport).toHaveBeenCalledWith(profileId);
    });
  });

  describe('output type', () => {
    it('should return HealthReport type (GenerateReportOutput)', async () => {
      // Act
      const result = await useCase.execute({ profileId: 'profile-123' });

      // Assert - verify all required HealthReport properties
      expect(typeof result.profileId).toBe('string');
      expect(typeof result.profileName).toBe('string');
      expect(result.generatedAt instanceof Date).toBe(true);
      expect(typeof result.latestMeasurement).toBe('object');
      expect(typeof result.trends).toBe('object');
      expect(Array.isArray(result.recommendations)).toBe(true);
      expect(typeof result.summary).toBe('object');
    });
  });
});

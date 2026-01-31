/**
 * ViewHistoryUseCase Unit Tests
 *
 * Tests for the ViewHistoryUseCase with mocked dependencies.
 *
 * @module application/use-cases/__tests__/ViewHistoryUseCase.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ViewHistoryUseCase } from '../ViewHistoryUseCase';
import type {
  MeasurementRepository,
  MeasurementResult,
} from '../../ports/MeasurementRepository';
import type { CalculatedMetrics, RawMeasurement } from '../../../domain/calculations/types';

describe('ViewHistoryUseCase', () => {
  // Mock dependencies
  let mockMeasurementRepository: MeasurementRepository;
  let useCase: ViewHistoryUseCase;

  // Test data factory
  const createMeasurement = (
    id: string,
    timestamp: Date = new Date()
  ): MeasurementResult => ({
    id,
    timestamp,
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
  });

  // Generate test measurements
  const testMeasurements: MeasurementResult[] = [
    createMeasurement('m-1', new Date('2024-01-15T10:00:00Z')),
    createMeasurement('m-2', new Date('2024-01-14T10:00:00Z')),
    createMeasurement('m-3', new Date('2024-01-13T10:00:00Z')),
    createMeasurement('m-4', new Date('2024-01-12T10:00:00Z')),
    createMeasurement('m-5', new Date('2024-01-11T10:00:00Z')),
  ];

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();

    // Create mock MeasurementRepository
    mockMeasurementRepository = {
      save: vi.fn().mockResolvedValue(undefined),
      getById: vi.fn().mockResolvedValue(testMeasurements[0]),
      getAll: vi.fn().mockResolvedValue(testMeasurements),
      delete: vi.fn().mockResolvedValue(undefined),
      deleteAll: vi.fn().mockResolvedValue(undefined),
      count: vi.fn().mockResolvedValue(testMeasurements.length),
    };

    // Create use case instance with mocked dependencies
    useCase = new ViewHistoryUseCase(mockMeasurementRepository);
  });

  describe('execute', () => {
    it('should return measurements for a profile', async () => {
      // Act
      const result = await useCase.execute({ profileId: 'profile-123' });

      // Assert
      expect(result.measurements).toEqual(testMeasurements);
      expect(mockMeasurementRepository.getAll).toHaveBeenCalled();
    });

    it('should return correct output structure', async () => {
      // Act
      const result = await useCase.execute({ profileId: 'profile-123' });

      // Assert
      expect(result).toHaveProperty('measurements');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('page');
      expect(result).toHaveProperty('pageSize');
      expect(result).toHaveProperty('hasMore');
    });

    it('should apply default pagination values', async () => {
      // Act
      const result = await useCase.execute({ profileId: 'profile-123' });

      // Assert
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
    });

    it('should pass correct query to repository', async () => {
      // Act
      await useCase.execute({ profileId: 'profile-123' });

      // Assert
      expect(mockMeasurementRepository.getAll).toHaveBeenCalledWith({
        userProfileId: 'profile-123',
        fromDate: undefined,
        toDate: undefined,
        limit: 20,
        offset: 0,
      });
    });

    it('should return empty array when no measurements exist', async () => {
      // Arrange
      mockMeasurementRepository.getAll = vi.fn().mockResolvedValue([]);
      mockMeasurementRepository.count = vi.fn().mockResolvedValue(0);

      // Act
      const result = await useCase.execute({ profileId: 'profile-123' });

      // Assert
      expect(result.measurements).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.hasMore).toBe(false);
    });
  });

  describe('pagination', () => {
    it('should apply custom page number', async () => {
      // Act
      const result = await useCase.execute({
        profileId: 'profile-123',
        page: 2,
      });

      // Assert
      expect(result.page).toBe(2);
      expect(mockMeasurementRepository.getAll).toHaveBeenCalledWith(
        expect.objectContaining({
          offset: 20, // (2 - 1) * 20
        })
      );
    });

    it('should apply custom page size', async () => {
      // Act
      const result = await useCase.execute({
        profileId: 'profile-123',
        pageSize: 10,
      });

      // Assert
      expect(result.pageSize).toBe(10);
      expect(mockMeasurementRepository.getAll).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 10,
        })
      );
    });

    it('should calculate correct offset for page 3 with pageSize 10', async () => {
      // Act
      await useCase.execute({
        profileId: 'profile-123',
        page: 3,
        pageSize: 10,
      });

      // Assert
      expect(mockMeasurementRepository.getAll).toHaveBeenCalledWith(
        expect.objectContaining({
          offset: 20, // (3 - 1) * 10
          limit: 10,
        })
      );
    });

    it('should return correct total count', async () => {
      // Arrange
      mockMeasurementRepository.count = vi.fn().mockResolvedValue(50);

      // Act
      const result = await useCase.execute({ profileId: 'profile-123' });

      // Assert
      expect(result.total).toBe(50);
    });

    it('should correctly calculate hasMore when more pages exist', async () => {
      // Arrange - 50 total, page 1 with 20 items
      mockMeasurementRepository.count = vi.fn().mockResolvedValue(50);
      mockMeasurementRepository.getAll = vi
        .fn()
        .mockResolvedValue(testMeasurements.slice(0, 5)); // Return 5 items

      // Act
      const result = await useCase.execute({
        profileId: 'profile-123',
        pageSize: 20,
      });

      // Assert - 0 + 5 < 50
      expect(result.hasMore).toBe(true);
    });

    it('should correctly calculate hasMore when on last page', async () => {
      // Arrange - exactly enough items to fill last page
      mockMeasurementRepository.count = vi.fn().mockResolvedValue(5);
      mockMeasurementRepository.getAll = vi.fn().mockResolvedValue(testMeasurements);

      // Act
      const result = await useCase.execute({
        profileId: 'profile-123',
        page: 1,
        pageSize: 20,
      });

      // Assert - 0 + 5 >= 5
      expect(result.hasMore).toBe(false);
    });

    it('should throw error for page less than 1', async () => {
      // Act & Assert
      await expect(
        useCase.execute({ profileId: 'profile-123', page: 0 })
      ).rejects.toThrow('Page number must be at least 1');
    });

    it('should throw error for negative page number', async () => {
      // Act & Assert
      await expect(
        useCase.execute({ profileId: 'profile-123', page: -1 })
      ).rejects.toThrow('Page number must be at least 1');
    });

    it('should throw error for pageSize less than 1', async () => {
      // Act & Assert
      await expect(
        useCase.execute({ profileId: 'profile-123', pageSize: 0 })
      ).rejects.toThrow('Page size must be between 1 and 100');
    });

    it('should throw error for pageSize greater than 100', async () => {
      // Act & Assert
      await expect(
        useCase.execute({ profileId: 'profile-123', pageSize: 101 })
      ).rejects.toThrow('Page size must be between 1 and 100');
    });
  });

  describe('date filtering', () => {
    it('should pass fromDate filter to repository', async () => {
      // Arrange
      const fromDate = new Date('2024-01-10');

      // Act
      await useCase.execute({
        profileId: 'profile-123',
        fromDate,
      });

      // Assert
      expect(mockMeasurementRepository.getAll).toHaveBeenCalledWith(
        expect.objectContaining({
          fromDate,
        })
      );
      expect(mockMeasurementRepository.count).toHaveBeenCalledWith(
        expect.objectContaining({
          fromDate,
        })
      );
    });

    it('should pass toDate filter to repository', async () => {
      // Arrange
      const toDate = new Date('2024-01-15');

      // Act
      await useCase.execute({
        profileId: 'profile-123',
        toDate,
      });

      // Assert
      expect(mockMeasurementRepository.getAll).toHaveBeenCalledWith(
        expect.objectContaining({
          toDate,
        })
      );
      expect(mockMeasurementRepository.count).toHaveBeenCalledWith(
        expect.objectContaining({
          toDate,
        })
      );
    });

    it('should pass both date filters to repository', async () => {
      // Arrange
      const fromDate = new Date('2024-01-01');
      const toDate = new Date('2024-01-31');

      // Act
      await useCase.execute({
        profileId: 'profile-123',
        fromDate,
        toDate,
      });

      // Assert
      expect(mockMeasurementRepository.getAll).toHaveBeenCalledWith(
        expect.objectContaining({
          fromDate,
          toDate,
        })
      );
    });

    it('should combine date filters with pagination', async () => {
      // Arrange
      const fromDate = new Date('2024-01-01');
      const toDate = new Date('2024-01-31');

      // Act
      await useCase.execute({
        profileId: 'profile-123',
        page: 2,
        pageSize: 10,
        fromDate,
        toDate,
      });

      // Assert
      expect(mockMeasurementRepository.getAll).toHaveBeenCalledWith({
        userProfileId: 'profile-123',
        fromDate,
        toDate,
        limit: 10,
        offset: 10,
      });
    });
  });

  describe('parallel fetching', () => {
    it('should fetch measurements and count in parallel', async () => {
      // Arrange
      const fetchOrder: string[] = [];

      mockMeasurementRepository.getAll = vi.fn().mockImplementation(async () => {
        fetchOrder.push('getAll-start');
        await new Promise((resolve) => setTimeout(resolve, 10));
        fetchOrder.push('getAll-end');
        return testMeasurements;
      });

      mockMeasurementRepository.count = vi.fn().mockImplementation(async () => {
        fetchOrder.push('count-start');
        await new Promise((resolve) => setTimeout(resolve, 10));
        fetchOrder.push('count-end');
        return 5;
      });

      // Act
      await useCase.execute({ profileId: 'profile-123' });

      // Assert - both should start before either ends (parallel execution)
      expect(fetchOrder[0]).toContain('start');
      expect(fetchOrder[1]).toContain('start');
    });
  });

  describe('output structure', () => {
    it('should return ViewHistoryOutput with all required fields', async () => {
      // Act
      const result = await useCase.execute({ profileId: 'profile-123' });

      // Assert
      expect(Object.keys(result)).toHaveLength(5);
      expect(typeof result.measurements).toBe('object');
      expect(typeof result.total).toBe('number');
      expect(typeof result.page).toBe('number');
      expect(typeof result.pageSize).toBe('number');
      expect(typeof result.hasMore).toBe('boolean');
    });

    it('should return measurements array with correct structure', async () => {
      // Act
      const result = await useCase.execute({ profileId: 'profile-123' });

      // Assert
      expect(Array.isArray(result.measurements)).toBe(true);
      result.measurements.forEach((m) => {
        expect(m).toHaveProperty('id');
        expect(m).toHaveProperty('timestamp');
        expect(m).toHaveProperty('raw');
        expect(m).toHaveProperty('calculated');
        expect(m).toHaveProperty('userProfileId');
      });
    });
  });

  describe('error handling', () => {
    it('should propagate repository getAll errors', async () => {
      // Arrange
      const repoError = new Error('Database connection failed');
      mockMeasurementRepository.getAll = vi.fn().mockRejectedValue(repoError);

      // Act & Assert
      await expect(useCase.execute({ profileId: 'profile-123' })).rejects.toThrow(
        'Database connection failed'
      );
    });

    it('should propagate repository count errors', async () => {
      // Arrange
      const repoError = new Error('Count query failed');
      mockMeasurementRepository.count = vi.fn().mockRejectedValue(repoError);

      // Act & Assert
      await expect(useCase.execute({ profileId: 'profile-123' })).rejects.toThrow(
        'Count query failed'
      );
    });
  });
});

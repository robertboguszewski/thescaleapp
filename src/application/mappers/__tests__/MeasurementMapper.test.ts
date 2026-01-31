/**
 * MeasurementMapper Tests
 *
 * TDD tests for mapping between domain MeasurementResult and IPC DTOs.
 * Tests written BEFORE implementation.
 *
 * @module application/mappers/__tests__/MeasurementMapper.test
 */

import { describe, it, expect } from 'vitest';
import { MeasurementMapper } from '../MeasurementMapper';
import type { MeasurementResult } from '../../ports/MeasurementRepository';

describe('MeasurementMapper', () => {
  const createMockMeasurement = (overrides?: Partial<MeasurementResult>): MeasurementResult => ({
    id: 'measurement-123',
    timestamp: new Date('2026-01-15T10:30:00Z'),
    raw: {
      weightKg: 70.5,
      impedanceOhm: 450,
      heartRateBpm: 72,
    },
    calculated: {
      bmi: 23.5,
      bodyFatPercent: 18.2,
      muscleMassKg: 55.3,
      bodyWaterPercent: 58.1,
      boneMassKg: 3.2,
      visceralFatLevel: 8,
      bmrKcal: 1680,
      leanBodyMassKg: 57.7,
      proteinPercent: 17.5,
      bodyScore: 85,
    },
    userProfileId: 'profile-456',
    ...overrides,
  });

  describe('toDTO', () => {
    it('should convert MeasurementResult to DTO', () => {
      const measurement = createMockMeasurement();

      const dto = MeasurementMapper.toDTO(measurement);

      expect(dto.id).toBe('measurement-123');
      expect(dto.userProfileId).toBe('profile-456');
    });

    it('should serialize Date to ISO string', () => {
      const measurement = createMockMeasurement({
        timestamp: new Date('2026-01-15T10:30:00Z'),
      });

      const dto = MeasurementMapper.toDTO(measurement);

      expect(dto.timestamp).toBe('2026-01-15T10:30:00.000Z');
      expect(typeof dto.timestamp).toBe('string');
    });

    it('should preserve raw measurement data', () => {
      const measurement = createMockMeasurement();

      const dto = MeasurementMapper.toDTO(measurement);

      expect(dto.raw.weightKg).toBe(70.5);
      expect(dto.raw.impedanceOhm).toBe(450);
      expect(dto.raw.heartRateBpm).toBe(72);
    });

    it('should preserve calculated metrics', () => {
      const measurement = createMockMeasurement();

      const dto = MeasurementMapper.toDTO(measurement);

      expect(dto.calculated.bmi).toBe(23.5);
      expect(dto.calculated.bodyFatPercent).toBe(18.2);
      expect(dto.calculated.bodyScore).toBe(85);
    });

    it('should handle optional fields in raw measurement', () => {
      const measurement = createMockMeasurement({
        raw: { weightKg: 70.5 },
      });

      const dto = MeasurementMapper.toDTO(measurement);

      expect(dto.raw.weightKg).toBe(70.5);
      expect(dto.raw.impedanceOhm).toBeUndefined();
      expect(dto.raw.heartRateBpm).toBeUndefined();
    });
  });

  describe('toDomain', () => {
    it('should convert DTO back to domain object', () => {
      const dto = {
        id: 'measurement-123',
        timestamp: '2026-01-15T10:30:00.000Z',
        raw: { weightKg: 70.5, impedanceOhm: 450 },
        calculated: {
          bmi: 23.5,
          bodyFatPercent: 18.2,
          muscleMassKg: 55.3,
          bodyWaterPercent: 58.1,
          boneMassKg: 3.2,
          visceralFatLevel: 8,
          bmrKcal: 1680,
          leanBodyMassKg: 57.7,
          proteinPercent: 17.5,
          bodyScore: 85,
        },
        userProfileId: 'profile-456',
      };

      const domain = MeasurementMapper.toDomain(dto);

      expect(domain.id).toBe('measurement-123');
      expect(domain.userProfileId).toBe('profile-456');
    });

    it('should parse ISO string to Date', () => {
      const dto = {
        id: 'measurement-123',
        timestamp: '2026-01-15T10:30:00.000Z',
        raw: { weightKg: 70.5 },
        calculated: {
          bmi: 23.5,
          bodyFatPercent: 18.2,
          muscleMassKg: 55.3,
          bodyWaterPercent: 58.1,
          boneMassKg: 3.2,
          visceralFatLevel: 8,
          bmrKcal: 1680,
          leanBodyMassKg: 57.7,
          proteinPercent: 17.5,
          bodyScore: 85,
        },
        userProfileId: 'profile-456',
      };

      const domain = MeasurementMapper.toDomain(dto);

      expect(domain.timestamp).toBeInstanceOf(Date);
      expect(domain.timestamp.toISOString()).toBe('2026-01-15T10:30:00.000Z');
    });
  });

  describe('toDTOList', () => {
    it('should convert array of MeasurementResult to DTOs', () => {
      const measurements = [
        createMockMeasurement({ id: 'measurement-1' }),
        createMockMeasurement({ id: 'measurement-2' }),
      ];

      const dtos = MeasurementMapper.toDTOList(measurements);

      expect(dtos).toHaveLength(2);
      expect(dtos[0].id).toBe('measurement-1');
      expect(dtos[1].id).toBe('measurement-2');
    });

    it('should handle empty array', () => {
      const dtos = MeasurementMapper.toDTOList([]);

      expect(dtos).toEqual([]);
    });
  });

  describe('roundtrip', () => {
    it('should preserve data after toDTO -> toDomain', () => {
      const original = createMockMeasurement();

      const dto = MeasurementMapper.toDTO(original);
      const restored = MeasurementMapper.toDomain(dto);

      expect(restored.id).toBe(original.id);
      expect(restored.userProfileId).toBe(original.userProfileId);
      expect(restored.raw.weightKg).toBe(original.raw.weightKg);
      expect(restored.calculated.bmi).toBe(original.calculated.bmi);
      expect(restored.timestamp.getTime()).toBe(original.timestamp.getTime());
    });
  });
});

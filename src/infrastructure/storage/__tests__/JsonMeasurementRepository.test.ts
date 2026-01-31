/**
 * JsonMeasurementRepository Tests
 *
 * TDD tests for JSON-based measurement repository implementation.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { JsonMeasurementRepository } from '../JsonMeasurementRepository';
import type { MeasurementResult } from '../../../application/ports/MeasurementRepository';

const TEST_DIR = path.join(process.cwd(), 'test-data', 'measurements-test');

// Helper to generate valid UUIDs for tests
function uuid(index: number): string {
  const hex = index.toString(16).padStart(12, '0');
  return `550e8400-e29b-41d4-a716-${hex}`;
}

// Helper function to create a valid measurement
function createMeasurement(overrides: Partial<MeasurementResult> = {}): MeasurementResult {
  return {
    id: uuid(0),
    timestamp: new Date('2025-01-30T10:00:00Z'),
    raw: {
      weightKg: 75.5,
      impedanceOhm: 500,
    },
    calculated: {
      bmi: 23.5,
      bodyFatPercent: 18.5,
      muscleMassKg: 35.2,
      bodyWaterPercent: 55.0,
      boneMassKg: 3.2,
      visceralFatLevel: 8,
      bmrKcal: 1750,
      leanBodyMassKg: 61.5,
      proteinPercent: 16.5,
      bodyScore: 82,
    },
    userProfileId: uuid(100),
    ...overrides,
  };
}

describe('JsonMeasurementRepository', () => {
  let repository: JsonMeasurementRepository;

  beforeEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(TEST_DIR, { recursive: true, force: true });
    } catch {
      // Directory might not exist
    }

    repository = new JsonMeasurementRepository(TEST_DIR);
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(TEST_DIR, { recursive: true, force: true });
    } catch {
      // Directory might not exist
    }
  });

  describe('save', () => {
    it('should save a measurement to a JSON file', async () => {
      const measurement = createMeasurement();

      await repository.save(measurement);

      // Verify file exists
      const files = await fs.readdir(TEST_DIR);
      expect(files).toHaveLength(1);
      expect(files[0]).toMatch(/\.json$/);
    });

    it('should use timestamp_id format for filename', async () => {
      const measurement = createMeasurement({
        id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        timestamp: new Date('2025-01-30T15:30:45Z'),
      });

      await repository.save(measurement);

      const files = await fs.readdir(TEST_DIR);
      // Filename format: {timestamp}_{id}.json
      expect(files[0]).toMatch(/^2025-01-30T15-30-45.*_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee\.json$/);
    });

    it('should overwrite existing measurement with same ID', async () => {
      const measurement = createMeasurement();
      await repository.save(measurement);

      const updated = createMeasurement({
        ...measurement,
        raw: { weightKg: 80.0 },
      });
      await repository.save(updated);

      const files = await fs.readdir(TEST_DIR);
      expect(files).toHaveLength(1);

      const retrieved = await repository.getById(measurement.id);
      expect(retrieved?.raw.weightKg).toBe(80.0);
    });

    it('should create directory if it does not exist', async () => {
      const nestedDir = path.join(TEST_DIR, 'nested', 'measurements');
      const repo = new JsonMeasurementRepository(nestedDir);

      await repo.save(createMeasurement());

      const exists = await fs.access(nestedDir).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });
  });

  describe('getById', () => {
    it('should retrieve a measurement by ID', async () => {
      const measurement = createMeasurement();
      await repository.save(measurement);

      const retrieved = await repository.getById(measurement.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(measurement.id);
      expect(retrieved?.raw.weightKg).toBe(measurement.raw.weightKg);
      expect(retrieved?.calculated.bmi).toBe(measurement.calculated.bmi);
    });

    it('should return null for non-existent ID', async () => {
      const retrieved = await repository.getById('non-existent-id');

      expect(retrieved).toBeNull();
    });

    it('should correctly parse dates', async () => {
      const measurement = createMeasurement({
        timestamp: new Date('2025-01-15T12:30:00Z'),
      });
      await repository.save(measurement);

      const retrieved = await repository.getById(measurement.id);

      expect(retrieved?.timestamp).toBeInstanceOf(Date);
      expect(retrieved?.timestamp.toISOString()).toBe('2025-01-15T12:30:00.000Z');
    });
  });

  describe('getAll', () => {
    it('should return all measurements sorted by timestamp descending', async () => {
      const measurements = [
        createMeasurement({ id: uuid(1), timestamp: new Date('2025-01-01T10:00:00Z') }),
        createMeasurement({ id: uuid(2), timestamp: new Date('2025-01-03T10:00:00Z') }),
        createMeasurement({ id: uuid(3), timestamp: new Date('2025-01-02T10:00:00Z') }),
      ];

      for (const m of measurements) {
        await repository.save(m);
      }

      const all = await repository.getAll();

      expect(all).toHaveLength(3);
      expect(all[0].id).toBe(uuid(2)); // Most recent first
      expect(all[1].id).toBe(uuid(3));
      expect(all[2].id).toBe(uuid(1)); // Oldest last
    });

    it('should return empty array when no measurements exist', async () => {
      const all = await repository.getAll();

      expect(all).toEqual([]);
    });

    it('should filter by userProfileId', async () => {
      const user1 = uuid(201);
      const user2 = uuid(202);

      await repository.save(createMeasurement({ id: uuid(1), userProfileId: user1 }));
      await repository.save(createMeasurement({ id: uuid(2), userProfileId: user2 }));
      await repository.save(createMeasurement({ id: uuid(3), userProfileId: user1 }));

      const user1Measurements = await repository.getAll({ userProfileId: user1 });

      expect(user1Measurements).toHaveLength(2);
      expect(user1Measurements.every(m => m.userProfileId === user1)).toBe(true);
    });

    it('should filter by date range', async () => {
      await repository.save(createMeasurement({ id: uuid(1), timestamp: new Date('2025-01-10T10:00:00Z') }));
      await repository.save(createMeasurement({ id: uuid(2), timestamp: new Date('2025-01-15T10:00:00Z') }));
      await repository.save(createMeasurement({ id: uuid(3), timestamp: new Date('2025-01-20T10:00:00Z') }));

      const filtered = await repository.getAll({
        fromDate: new Date('2025-01-12T00:00:00Z'),
        toDate: new Date('2025-01-18T23:59:59Z'),
      });

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe(uuid(2));
    });

    it('should apply limit', async () => {
      for (let i = 0; i < 5; i++) {
        await repository.save(createMeasurement({
          id: uuid(i),
          timestamp: new Date(2025, 0, i + 1),
        }));
      }

      const limited = await repository.getAll({ limit: 3 });

      expect(limited).toHaveLength(3);
    });

    it('should apply offset', async () => {
      for (let i = 0; i < 5; i++) {
        await repository.save(createMeasurement({
          id: uuid(i),
          timestamp: new Date(2025, 0, 5 - i), // 5, 4, 3, 2, 1
        }));
      }

      const offset = await repository.getAll({ offset: 2 });

      expect(offset).toHaveLength(3);
      // After offset 2, we should get the 3rd, 4th, 5th items
      expect(offset[0].timestamp.getDate()).toBe(3);
    });

    it('should apply limit and offset together', async () => {
      for (let i = 0; i < 10; i++) {
        await repository.save(createMeasurement({
          id: uuid(i),
          timestamp: new Date(2025, 0, 10 - i),
        }));
      }

      const page = await repository.getAll({ limit: 3, offset: 3 });

      expect(page).toHaveLength(3);
    });

    it('should combine multiple filters', async () => {
      const user1 = uuid(201);

      await repository.save(createMeasurement({ id: uuid(1), userProfileId: user1, timestamp: new Date('2025-01-05') }));
      await repository.save(createMeasurement({ id: uuid(2), userProfileId: user1, timestamp: new Date('2025-01-15') }));
      await repository.save(createMeasurement({ id: uuid(3), userProfileId: user1, timestamp: new Date('2025-01-25') }));
      await repository.save(createMeasurement({ id: uuid(4), userProfileId: uuid(202), timestamp: new Date('2025-01-15') }));

      const filtered = await repository.getAll({
        userProfileId: user1,
        fromDate: new Date('2025-01-10'),
        toDate: new Date('2025-01-20'),
      });

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe(uuid(2));
    });
  });

  describe('delete', () => {
    it('should delete a measurement by ID', async () => {
      const measurement = createMeasurement();
      await repository.save(measurement);

      await repository.delete(measurement.id);

      const retrieved = await repository.getById(measurement.id);
      expect(retrieved).toBeNull();
    });

    it('should not throw when deleting non-existent measurement', async () => {
      await expect(repository.delete('non-existent-id')).resolves.not.toThrow();
    });
  });

  describe('deleteAll', () => {
    it('should delete all measurements for a user profile', async () => {
      const user1 = uuid(201);
      const user2 = uuid(202);

      await repository.save(createMeasurement({ id: uuid(1), userProfileId: user1 }));
      await repository.save(createMeasurement({ id: uuid(2), userProfileId: user1 }));
      await repository.save(createMeasurement({ id: uuid(3), userProfileId: user2 }));

      await repository.deleteAll(user1);

      const all = await repository.getAll();
      expect(all).toHaveLength(1);
      expect(all[0].userProfileId).toBe(user2);
    });

    it('should not throw when no measurements exist for user', async () => {
      await expect(repository.deleteAll('non-existent-user')).resolves.not.toThrow();
    });
  });

  describe('count', () => {
    it('should return total count of measurements', async () => {
      await repository.save(createMeasurement({ id: uuid(1) }));
      await repository.save(createMeasurement({ id: uuid(2) }));
      await repository.save(createMeasurement({ id: uuid(3) }));

      const count = await repository.count();

      expect(count).toBe(3);
    });

    it('should return 0 when no measurements exist', async () => {
      const count = await repository.count();

      expect(count).toBe(0);
    });

    it('should count with filters', async () => {
      const user1 = uuid(201);

      await repository.save(createMeasurement({ id: uuid(1), userProfileId: user1 }));
      await repository.save(createMeasurement({ id: uuid(2), userProfileId: user1 }));
      await repository.save(createMeasurement({ id: uuid(3), userProfileId: uuid(202) }));

      const count = await repository.count({ userProfileId: user1 });

      expect(count).toBe(2);
    });
  });

  describe('data validation', () => {
    it('should validate measurement data on save', async () => {
      const invalidMeasurement = {
        ...createMeasurement(),
        raw: { weightKg: -10 }, // Invalid: negative weight
      };

      await expect(repository.save(invalidMeasurement)).rejects.toThrow();
    });

    it('should validate measurement data on read', async () => {
      // Manually write invalid JSON to simulate corrupted file
      await fs.mkdir(TEST_DIR, { recursive: true });
      const filePath = path.join(TEST_DIR, '2025-01-30T10-00-00-000Z_test-id.json');
      await fs.writeFile(filePath, JSON.stringify({
        id: 'test-id',
        timestamp: 'invalid-date',
        raw: { weightKg: 'not-a-number' },
        calculated: {},
        userProfileId: 'user-id',
      }));

      // getById should handle invalid data gracefully
      const result = await repository.getById('test-id');
      expect(result).toBeNull(); // Invalid data should be treated as not found
    });
  });
});

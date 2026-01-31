/**
 * JsonProfileRepository Tests
 *
 * TDD tests for JSON-based profile repository implementation.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { JsonProfileRepository } from '../JsonProfileRepository';
import type { StoredUserProfile } from '../../../application/ports/ProfileRepository';

const TEST_DIR = path.join(process.cwd(), 'test-data', 'profiles-test');

// Helper to generate valid UUIDs for tests
function uuid(index: number): string {
  const hex = index.toString(16).padStart(12, '0');
  return `660e8400-e29b-41d4-a716-${hex}`;
}

// Helper function to create a valid profile
function createProfile(overrides: Partial<StoredUserProfile> = {}): StoredUserProfile {
  return {
    id: uuid(0),
    name: 'Test User',
    gender: 'male',
    birthYear: 1991,
    heightCm: 178,
    ethnicity: 'non-asian',
    isDefault: false,
    createdAt: new Date('2025-01-01T10:00:00Z'),
    updatedAt: new Date('2025-01-01T10:00:00Z'),
    ...overrides,
  };
}

describe('JsonProfileRepository', () => {
  let repository: JsonProfileRepository;

  beforeEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(TEST_DIR, { recursive: true, force: true });
    } catch {
      // Directory might not exist
    }

    repository = new JsonProfileRepository(TEST_DIR);
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
    it('should save a profile to a JSON file', async () => {
      const profile = createProfile();

      await repository.save(profile);

      // Verify file exists
      const files = await fs.readdir(TEST_DIR);
      expect(files).toHaveLength(1);
      expect(files[0]).toBe(`${profile.id}.json`);
    });

    it('should update updatedAt timestamp on save', async () => {
      const profile = createProfile({
        updatedAt: new Date('2020-01-01T00:00:00Z'),
      });

      const beforeSave = new Date();
      await repository.save(profile);
      const afterSave = new Date();

      const retrieved = await repository.getById(profile.id);
      expect(retrieved?.updatedAt.getTime()).toBeGreaterThanOrEqual(beforeSave.getTime());
      expect(retrieved?.updatedAt.getTime()).toBeLessThanOrEqual(afterSave.getTime());
    });

    it('should overwrite existing profile with same ID', async () => {
      const profile = createProfile();
      await repository.save(profile);

      const updated = createProfile({
        ...profile,
        name: 'Updated Name',
        birthYear: 1986,
      });
      await repository.save(updated);

      const files = await fs.readdir(TEST_DIR);
      expect(files).toHaveLength(1);

      const retrieved = await repository.getById(profile.id);
      expect(retrieved?.name).toBe('Updated Name');
      expect(retrieved?.birthYear).toBe(1986);
    });

    it('should create directory if it does not exist', async () => {
      const nestedDir = path.join(TEST_DIR, 'nested', 'profiles');
      const repo = new JsonProfileRepository(nestedDir);

      await repo.save(createProfile());

      const exists = await fs.access(nestedDir).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });
  });

  describe('getById', () => {
    it('should retrieve a profile by ID', async () => {
      const profile = createProfile();
      await repository.save(profile);

      const retrieved = await repository.getById(profile.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(profile.id);
      expect(retrieved?.name).toBe(profile.name);
      expect(retrieved?.gender).toBe(profile.gender);
      expect(retrieved?.birthYear).toBe(profile.birthYear);
      expect(retrieved?.heightCm).toBe(profile.heightCm);
    });

    it('should return null for non-existent ID', async () => {
      const retrieved = await repository.getById('non-existent-id');

      expect(retrieved).toBeNull();
    });

    it('should correctly parse dates', async () => {
      const profile = createProfile({
        createdAt: new Date('2025-01-15T12:30:00Z'),
      });
      await repository.save(profile);

      const retrieved = await repository.getById(profile.id);

      expect(retrieved?.createdAt).toBeInstanceOf(Date);
      expect(retrieved?.createdAt.toISOString()).toBe('2025-01-15T12:30:00.000Z');
    });
  });

  describe('getAll', () => {
    it('should return all profiles sorted by name ascending', async () => {
      const profiles = [
        createProfile({ id: uuid(1), name: 'Zebra' }),
        createProfile({ id: uuid(2), name: 'Apple' }),
        createProfile({ id: uuid(3), name: 'Mango' }),
      ];

      for (const p of profiles) {
        await repository.save(p);
      }

      const all = await repository.getAll();

      expect(all).toHaveLength(3);
      expect(all[0].name).toBe('Apple');
      expect(all[1].name).toBe('Mango');
      expect(all[2].name).toBe('Zebra');
    });

    it('should return empty array when no profiles exist', async () => {
      const all = await repository.getAll();

      expect(all).toEqual([]);
    });
  });

  describe('delete', () => {
    it('should delete a profile by ID', async () => {
      const profile = createProfile();
      await repository.save(profile);

      await repository.delete(profile.id);

      const retrieved = await repository.getById(profile.id);
      expect(retrieved).toBeNull();
    });

    it('should not throw when deleting non-existent profile', async () => {
      await expect(repository.delete('non-existent-id')).resolves.not.toThrow();
    });
  });

  describe('getDefault', () => {
    it('should return the default profile', async () => {
      await repository.save(createProfile({ id: uuid(1), name: 'User 1', isDefault: false }));
      await repository.save(createProfile({ id: uuid(2), name: 'User 2', isDefault: true }));
      await repository.save(createProfile({ id: uuid(3), name: 'User 3', isDefault: false }));

      const defaultProfile = await repository.getDefault();

      expect(defaultProfile).not.toBeNull();
      expect(defaultProfile?.id).toBe(uuid(2));
      expect(defaultProfile?.isDefault).toBe(true);
    });

    it('should return null when no default profile exists', async () => {
      await repository.save(createProfile({ id: uuid(1), isDefault: false }));
      await repository.save(createProfile({ id: uuid(2), isDefault: false }));

      const defaultProfile = await repository.getDefault();

      expect(defaultProfile).toBeNull();
    });

    it('should return null when no profiles exist', async () => {
      const defaultProfile = await repository.getDefault();

      expect(defaultProfile).toBeNull();
    });
  });

  describe('setDefault', () => {
    it('should set a profile as default', async () => {
      await repository.save(createProfile({ id: uuid(1), isDefault: false }));
      await repository.save(createProfile({ id: uuid(2), isDefault: false }));

      await repository.setDefault(uuid(1));

      const profile = await repository.getById(uuid(1));
      expect(profile?.isDefault).toBe(true);
    });

    it('should remove default from other profiles', async () => {
      await repository.save(createProfile({ id: uuid(1), isDefault: true }));
      await repository.save(createProfile({ id: uuid(2), isDefault: false }));

      await repository.setDefault(uuid(2));

      const profile1 = await repository.getById(uuid(1));
      const profile2 = await repository.getById(uuid(2));

      expect(profile1?.isDefault).toBe(false);
      expect(profile2?.isDefault).toBe(true);
    });

    it('should throw error for non-existent profile', async () => {
      await expect(repository.setDefault('non-existent-id')).rejects.toThrow();
    });

    it('should ensure only one default profile exists', async () => {
      await repository.save(createProfile({ id: uuid(1), isDefault: true }));
      await repository.save(createProfile({ id: uuid(2), isDefault: true })); // This shouldn't happen but let's be safe
      await repository.save(createProfile({ id: uuid(3), isDefault: false }));

      await repository.setDefault(uuid(3));

      const all = await repository.getAll();
      const defaults = all.filter(p => p.isDefault);

      expect(defaults).toHaveLength(1);
      expect(defaults[0].id).toBe(uuid(3));
    });
  });

  describe('data validation', () => {
    it('should validate profile data on save', async () => {
      const currentYear = new Date().getFullYear();
      const invalidProfile = {
        ...createProfile(),
        birthYear: currentYear - 2, // Invalid: only 2 years old (below minimum age of 5)
      };

      await expect(repository.save(invalidProfile)).rejects.toThrow();
    });

    it('should reject birthYear before 1900', async () => {
      const invalidProfile = {
        ...createProfile(),
        birthYear: 1899, // Invalid: before 1900
      };

      await expect(repository.save(invalidProfile)).rejects.toThrow();
    });

    it('should validate profile data on read', async () => {
      // Manually write invalid JSON to simulate corrupted file
      await fs.mkdir(TEST_DIR, { recursive: true });
      const filePath = path.join(TEST_DIR, 'invalid-id.json');
      await fs.writeFile(filePath, JSON.stringify({
        id: 'invalid-id',
        name: '', // Invalid: empty name
        gender: 'unknown', // Invalid: not male or female
        birthYear: 3000, // Invalid: future year
        heightCm: 30, // Invalid: below min height
        isDefault: 'yes', // Invalid: not boolean
        createdAt: 'not-a-date',
        updatedAt: 'not-a-date',
      }));

      // getById should handle invalid data gracefully
      const result = await repository.getById('invalid-id');
      expect(result).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('should handle profile with optional ethnicity undefined', async () => {
      const profile = createProfile({
        ethnicity: undefined,
      });

      await repository.save(profile);
      const retrieved = await repository.getById(profile.id);

      expect(retrieved?.ethnicity).toBeUndefined();
    });

    it('should handle profile with minimal required fields', async () => {
      const minimalProfile: StoredUserProfile = {
        id: uuid(999),
        name: 'Minimal',
        gender: 'female',
        birthYear: 2001,
        heightCm: 165,
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await repository.save(minimalProfile);
      const retrieved = await repository.getById(minimalProfile.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(uuid(999));
    });
  });
});

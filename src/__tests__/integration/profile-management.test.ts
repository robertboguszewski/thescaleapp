/**
 * Integration Tests: Profile Management
 *
 * Tests profile CRUD operations end-to-end:
 * 1. Create multiple profiles
 * 2. Set default profile
 * 3. Update profile
 * 4. Delete profile and verify cascade behavior
 *
 * Uses real repositories with temp directories for realistic testing.
 *
 * Note: Domain constraints:
 * - Age: 6-80 (schema and Deurenberg formula limit)
 * - Height: 90-220cm (schema limit)
 *
 * @module __tests__/integration/profile-management.test
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import {
  ProfileService,
  ValidationError,
  ProfileNotFoundError,
  type CreateProfileInput,
  type UpdateProfileInput,
} from '../../application/services/ProfileService';
import { MeasurementService } from '../../application/services/MeasurementService';
import { JsonProfileRepository } from '../../infrastructure/storage/JsonProfileRepository';
import { JsonMeasurementRepository } from '../../infrastructure/storage/JsonMeasurementRepository';
import type { BLEPort, BLEConnectionState, StateChangeCallback, ErrorCallback, Unsubscribe } from '../../application/ports/BLEPort';
import type { RawMeasurement } from '../../domain/calculations/types';
import type { StoredUserProfile } from '../../application/ports/ProfileRepository';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

/**
 * Generate a valid UUID v4 for testing
 */
function generateTestUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Mock crypto.randomUUID to return valid UUIDs
vi.stubGlobal('crypto', {
  randomUUID: vi.fn(() => generateTestUUID()),
});

/**
 * Create a simple mock BLEPort for measurement tests
 */
function createMockBLEPort(): BLEPort {
  return {
    getState: () => 'connected' as BLEConnectionState,
    onStateChange: (_callback: StateChangeCallback): Unsubscribe => () => {},
    onError: (_callback: ErrorCallback): Unsubscribe => () => {},
    onDeviceDiscovered: (_callback): Unsubscribe => () => {},
    scan: async () => {},
    scanForDevices: async () => [{ mac: 'AA:BB:CC:DD:EE:FF', name: 'MIBFS', rssi: -65 }],
    stopScan: () => {},
    connect: async () => {},
    disconnect: async () => {},
    readMeasurement: async (): Promise<RawMeasurement> => ({
      weightKg: 70,
      impedanceOhm: 500,
    }),
    isDeviceAvailable: async () => true,
  };
}

describe('Integration: Profile Management', () => {
  let tempDir: string;
  let profilesDir: string;
  let measurementsDir: string;
  let profileRepository: JsonProfileRepository;
  let measurementRepository: JsonMeasurementRepository;
  let profileService: ProfileService;
  let measurementService: MeasurementService;

  beforeAll(async () => {
    // Create temp directories for test data
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'thescale-profile-integration-'));
    profilesDir = path.join(tempDir, 'profiles');
    measurementsDir = path.join(tempDir, 'measurements');

    await fs.mkdir(profilesDir, { recursive: true });
    await fs.mkdir(measurementsDir, { recursive: true });
  });

  afterAll(async () => {
    // Clean up temp directories
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to clean up temp directory:', error);
    }
  });

  beforeEach(async () => {
    // Clean directories before each test
    const profileFiles = await fs.readdir(profilesDir).catch(() => []);
    for (const file of profileFiles) {
      await fs.unlink(path.join(profilesDir, file)).catch(() => {});
    }

    const measurementFiles = await fs.readdir(measurementsDir).catch(() => []);
    for (const file of measurementFiles) {
      await fs.unlink(path.join(measurementsDir, file)).catch(() => {});
    }

    // Create fresh repository and service instances
    profileRepository = new JsonProfileRepository(profilesDir);
    measurementRepository = new JsonMeasurementRepository(measurementsDir);
    profileService = new ProfileService(profileRepository);
    measurementService = new MeasurementService(
      createMockBLEPort(),
      measurementRepository,
      profileRepository
    );
  });

  describe('Profile creation', () => {
    it('should create a profile with all required fields', async () => {
      const input: CreateProfileInput = {
        name: 'Jan Kowalski',
        gender: 'male',
        birthYear: 1991,
        heightCm: 178,
      };

      const profile = await profileService.createProfile(input);

      expect(profile.id).toBeDefined();
      expect(profile.name).toBe('Jan Kowalski');
      expect(profile.gender).toBe('male');
      expect(profile.birthYear).toBe(1991);
      expect(profile.heightCm).toBe(178);
      expect(profile.createdAt).toBeInstanceOf(Date);
      expect(profile.updatedAt).toBeInstanceOf(Date);
    });

    it('should create a profile with optional ethnicity field', async () => {
      const input: CreateProfileInput = {
        name: 'Yuki Tanaka',
        gender: 'female',
        birthYear: 1998,
        heightCm: 160,
        ethnicity: 'asian',
      };

      const profile = await profileService.createProfile(input);

      expect(profile.ethnicity).toBe('asian');
    });

    it('should set first profile as default', async () => {
      const profile = await profileService.createProfile({
        name: 'First User',
        gender: 'male',
        birthYear: 1996,
        heightCm: 175,
      });

      expect(profile.isDefault).toBe(true);

      const defaultProfile = await profileService.getDefaultProfile();
      expect(defaultProfile).not.toBeNull();
      expect(defaultProfile!.id).toBe(profile.id);
    });

    it('should not set subsequent profiles as default', async () => {
      await profileService.createProfile({
        name: 'First User',
        gender: 'male',
        birthYear: 1996,
        heightCm: 175,
      });

      const secondProfile = await profileService.createProfile({
        name: 'Second User',
        gender: 'female',
        birthYear: 2001,
        heightCm: 165,
      });

      expect(secondProfile.isDefault).toBe(false);
    });

    it('should trim whitespace from name', async () => {
      const profile = await profileService.createProfile({
        name: '  Anna Nowak  ',
        gender: 'female',
        birthYear: 1994,
        heightCm: 168,
      });

      expect(profile.name).toBe('Anna Nowak');
    });

    it('should persist profile to disk', async () => {
      const profile = await profileService.createProfile({
        name: 'Persistence Test',
        gender: 'male',
        birthYear: 1986,
        heightCm: 180,
      });

      // Create new repository to verify persistence
      const newProfileRepo = new JsonProfileRepository(profilesDir);
      const retrieved = await newProfileRepo.getById(profile.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.name).toBe('Persistence Test');
    });
  });

  describe('Profile creation validation', () => {
    it('should throw ValidationError for empty name', async () => {
      await expect(
        profileService.createProfile({
          name: '',
          gender: 'male',
          birthYear: 1996,
          heightCm: 175,
        })
      ).rejects.toThrow(ValidationError);

      await expect(
        profileService.createProfile({
          name: '   ',
          gender: 'male',
          birthYear: 1996,
          heightCm: 175,
        })
      ).rejects.toThrow('Name is required and cannot be empty');
    });

    it('should throw ValidationError for birthYear too recent (less than 5 years ago)', async () => {
      await expect(
        profileService.createProfile({
          name: 'Young Child',
          gender: 'male',
          birthYear: 2022,
          heightCm: 100,
        })
      ).rejects.toThrow(ValidationError);

      await expect(
        profileService.createProfile({
          name: 'Young Child',
          gender: 'male',
          birthYear: 2022,
          heightCm: 100,
        })
      ).rejects.toThrow('Birth year must be between 1900');
    });

    it('should throw ValidationError for birthYear before 1900', async () => {
      await expect(
        profileService.createProfile({
          name: 'Very Old',
          gender: 'female',
          birthYear: 1899,
          heightCm: 160,
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for height below minimum (50cm)', async () => {
      await expect(
        profileService.createProfile({
          name: 'Short Person',
          gender: 'male',
          birthYear: 1996,
          heightCm: 49,
        })
      ).rejects.toThrow(ValidationError);

      await expect(
        profileService.createProfile({
          name: 'Short Person',
          gender: 'male',
          birthYear: 1996,
          heightCm: 49,
        })
      ).rejects.toThrow('Height must be between 50 and 250 cm');
    });

    it('should throw ValidationError for height above maximum (250cm)', async () => {
      await expect(
        profileService.createProfile({
          name: 'Very Tall',
          gender: 'male',
          birthYear: 2001,
          heightCm: 251,
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should accept boundary values within all constraints', async () => {
      // Note: Schema limits are stricter than service validation
      // Schema: age 6-80, height 90-220
      // Service: age 6-120, height 50-250
      // We test with schema-valid values

      // Minimum age (schema allows 6, but Deurenberg needs 7 for calculations)
      const minAge = await profileService.createProfile({
        name: 'Min Age',
        gender: 'male',
        birthYear: 2019,
        heightCm: 120,
      });
      expect(minAge.birthYear).toBe(2019);

      // Maximum age (schema limits to 80)
      const maxAge = await profileService.createProfile({
        name: 'Max Age',
        gender: 'female',
        birthYear: 1946,
        heightCm: 160,
      });
      expect(maxAge.birthYear).toBe(1946);

      // Minimum height (schema limits to 90)
      const minHeight = await profileService.createProfile({
        name: 'Min Height',
        gender: 'male',
        birthYear: 1996,
        heightCm: 90,
      });
      expect(minHeight.heightCm).toBe(90);

      // Maximum height (schema limits to 220)
      const maxHeight = await profileService.createProfile({
        name: 'Max Height',
        gender: 'male',
        birthYear: 1996,
        heightCm: 220,
      });
      expect(maxHeight.heightCm).toBe(220);
    });
  });

  describe('Multiple profiles management', () => {
    it('should create and retrieve multiple profiles', async () => {
      const profiles: StoredUserProfile[] = [];

      for (let i = 1; i <= 5; i++) {
        const profile = await profileService.createProfile({
          name: `User ${i}`,
          gender: i % 2 === 0 ? 'female' : 'male',
          birthYear: 2006 - i * 5,
          heightCm: 160 + i * 5,
        });
        profiles.push(profile);
      }

      const allProfiles = await profileService.getAllProfiles();

      expect(allProfiles).toHaveLength(5);
    });

    it('should return profiles sorted by name', async () => {
      await profileService.createProfile({ name: 'Zofia', gender: 'female', birthYear: 1996, heightCm: 165 });
      await profileService.createProfile({ name: 'Adam', gender: 'male', birthYear: 1991, heightCm: 180 });
      await profileService.createProfile({ name: 'Maria', gender: 'female', birthYear: 1998, heightCm: 160 });

      const allProfiles = await profileService.getAllProfiles();

      expect(allProfiles[0].name).toBe('Adam');
      expect(allProfiles[1].name).toBe('Maria');
      expect(allProfiles[2].name).toBe('Zofia');
    });

    it('should handle case-insensitive name sorting', async () => {
      await profileService.createProfile({ name: 'zofia', gender: 'female', birthYear: 1996, heightCm: 165 });
      await profileService.createProfile({ name: 'Adam', gender: 'male', birthYear: 1991, heightCm: 180 });
      await profileService.createProfile({ name: 'MARIA', gender: 'female', birthYear: 1998, heightCm: 160 });

      const allProfiles = await profileService.getAllProfiles();

      expect(allProfiles[0].name).toBe('Adam');
      expect(allProfiles[1].name).toBe('MARIA');
      expect(allProfiles[2].name).toBe('zofia');
    });
  });

  describe('Default profile management', () => {
    it('should change default profile', async () => {
      const profile1 = await profileService.createProfile({
        name: 'First Default',
        gender: 'male',
        birthYear: 1996,
        heightCm: 175,
      });

      const profile2 = await profileService.createProfile({
        name: 'Second User',
        gender: 'female',
        birthYear: 2001,
        heightCm: 165,
      });

      expect(profile1.isDefault).toBe(true);
      expect(profile2.isDefault).toBe(false);

      // Change default
      await profileService.setDefaultProfile(profile2.id);

      const defaultProfile = await profileService.getDefaultProfile();
      expect(defaultProfile!.id).toBe(profile2.id);

      // Verify previous default is no longer default
      const updatedProfile1 = await profileService.getProfile(profile1.id);
      expect(updatedProfile1!.isDefault).toBe(false);
    });

    it('should throw ProfileNotFoundError when setting non-existent profile as default', async () => {
      await expect(
        profileService.setDefaultProfile(generateTestUUID())
      ).rejects.toThrow(ProfileNotFoundError);
    });

    it('should handle setting already default profile as default', async () => {
      const profile = await profileService.createProfile({
        name: 'Only Profile',
        gender: 'male',
        birthYear: 1996,
        heightCm: 175,
      });

      // Should not throw
      await profileService.setDefaultProfile(profile.id);

      const defaultProfile = await profileService.getDefaultProfile();
      expect(defaultProfile!.id).toBe(profile.id);
    });

    it('should return null when no default profile exists', async () => {
      // No profiles created
      const defaultProfile = await profileService.getDefaultProfile();
      expect(defaultProfile).toBeNull();
    });
  });

  describe('Profile updates', () => {
    it('should update profile name', async () => {
      const profile = await profileService.createProfile({
        name: 'Original Name',
        gender: 'male',
        birthYear: 1996,
        heightCm: 175,
      });

      const updated = await profileService.updateProfile(profile.id, {
        name: 'Updated Name',
      });

      expect(updated.name).toBe('Updated Name');
      expect(updated.gender).toBe('male'); // Unchanged
      expect(updated.birthYear).toBe(1996); // Unchanged
    });

    it('should update multiple fields at once', async () => {
      const profile = await profileService.createProfile({
        name: 'Multi Update',
        gender: 'male',
        birthYear: 1996,
        heightCm: 175,
      });

      const updated = await profileService.updateProfile(profile.id, {
        name: 'New Name',
        birthYear: 1991,
        heightCm: 180,
        ethnicity: 'asian',
      });

      expect(updated.name).toBe('New Name');
      expect(updated.birthYear).toBe(1991);
      expect(updated.heightCm).toBe(180);
      expect(updated.ethnicity).toBe('asian');
    });

    it('should update updatedAt timestamp', async () => {
      const profile = await profileService.createProfile({
        name: 'Timestamp Test',
        gender: 'female',
        birthYear: 2001,
        heightCm: 160,
      });

      const originalUpdatedAt = profile.updatedAt;

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 50));

      const updated = await profileService.updateProfile(profile.id, {
        name: 'New Name',
      });

      expect(updated.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
      expect(updated.createdAt.getTime()).toBe(profile.createdAt.getTime()); // createdAt unchanged
    });

    it('should throw ProfileNotFoundError when updating non-existent profile', async () => {
      await expect(
        profileService.updateProfile(generateTestUUID(), { name: 'New Name' })
      ).rejects.toThrow(ProfileNotFoundError);
    });

    it('should validate updated fields', async () => {
      const profile = await profileService.createProfile({
        name: 'Validation Test',
        gender: 'male',
        birthYear: 1996,
        heightCm: 175,
      });

      await expect(
        profileService.updateProfile(profile.id, { birthYear: 2030 })
      ).rejects.toThrow(ValidationError);

      await expect(
        profileService.updateProfile(profile.id, { heightCm: 300 })
      ).rejects.toThrow(ValidationError);
    });

    it('should allow partial updates without affecting other fields', async () => {
      const profile = await profileService.createProfile({
        name: 'Partial Update',
        gender: 'female',
        birthYear: 1998,
        heightCm: 165,
        ethnicity: 'non-asian',
      });

      const updated = await profileService.updateProfile(profile.id, {
        birthYear: 1997,
      });

      expect(updated.name).toBe('Partial Update');
      expect(updated.gender).toBe('female');
      expect(updated.birthYear).toBe(1997);
      expect(updated.heightCm).toBe(165);
      expect(updated.ethnicity).toBe('non-asian');
    });
  });

  describe('Profile deletion', () => {
    it('should delete a profile', async () => {
      const profile = await profileService.createProfile({
        name: 'To Delete',
        gender: 'male',
        birthYear: 1996,
        heightCm: 175,
      });

      await profileService.deleteProfile(profile.id);

      const retrieved = await profileService.getProfile(profile.id);
      expect(retrieved).toBeNull();
    });

    it('should throw ProfileNotFoundError when deleting non-existent profile', async () => {
      await expect(
        profileService.deleteProfile(generateTestUUID())
      ).rejects.toThrow(ProfileNotFoundError);
    });

    it('should not affect other profiles when deleting one', async () => {
      const profile1 = await profileService.createProfile({
        name: 'Keep This',
        gender: 'male',
        birthYear: 1996,
        heightCm: 175,
      });

      const profile2 = await profileService.createProfile({
        name: 'Delete This',
        gender: 'female',
        birthYear: 2001,
        heightCm: 165,
      });

      await profileService.deleteProfile(profile2.id);

      const allProfiles = await profileService.getAllProfiles();
      expect(allProfiles).toHaveLength(1);
      expect(allProfiles[0].id).toBe(profile1.id);
    });
  });

  describe('Cascade behavior: Profile with measurements', () => {
    it('should capture measurements for a profile', async () => {
      const profile = await profileService.createProfile({
        name: 'With Measurements',
        gender: 'male',
        birthYear: 1991,
        heightCm: 180,
      });

      // Capture some measurements
      await measurementService.captureMeasurement(profile.id);
      await measurementService.captureMeasurement(profile.id);

      const count = await measurementService.countMeasurements(profile.id);
      expect(count).toBe(2);
    });

    it('should allow deleting measurements before profile deletion', async () => {
      const profile = await profileService.createProfile({
        name: 'Cascade Test',
        gender: 'female',
        birthYear: 1998,
        heightCm: 165,
      });

      // Capture measurements
      await measurementService.captureMeasurement(profile.id);
      await measurementService.captureMeasurement(profile.id);

      // Delete all measurements first
      await measurementService.deleteAllMeasurements(profile.id);

      // Now delete profile
      await profileService.deleteProfile(profile.id);

      // Verify both are gone
      const retrievedProfile = await profileService.getProfile(profile.id);
      const measurementCount = await measurementService.countMeasurements(profile.id);

      expect(retrievedProfile).toBeNull();
      expect(measurementCount).toBe(0);
    });

    it('should orphan measurements if profile is deleted without cleaning up', async () => {
      const profile = await profileService.createProfile({
        name: 'Orphan Test',
        gender: 'male',
        birthYear: 1986,
        heightCm: 175,
      });

      // Capture measurements
      const measurement = await measurementService.captureMeasurement(profile.id);

      // Delete profile without deleting measurements
      await profileService.deleteProfile(profile.id);

      // Measurement still exists but is orphaned
      const retrieved = await measurementService.getMeasurement(measurement.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.userProfileId).toBe(profile.id);

      // Profile no longer exists
      const retrievedProfile = await profileService.getProfile(profile.id);
      expect(retrievedProfile).toBeNull();
    });
  });

  describe('Concurrent operations', () => {
    it('should handle concurrent profile creation', async () => {
      const createPromises = Array.from({ length: 5 }, (_, i) =>
        profileService.createProfile({
          name: `Concurrent User ${i}`,
          gender: i % 2 === 0 ? 'male' : 'female',
          birthYear: 2006 - i * 2,
          heightCm: 160 + i * 5,
        })
      );

      const profiles = await Promise.all(createPromises);

      expect(profiles).toHaveLength(5);
      expect(new Set(profiles.map(p => p.id)).size).toBe(5); // All unique IDs
    });

    it('should handle concurrent updates to different profiles', async () => {
      const profile1 = await profileService.createProfile({
        name: 'Concurrent 1',
        gender: 'male',
        birthYear: 1996,
        heightCm: 175,
      });

      const profile2 = await profileService.createProfile({
        name: 'Concurrent 2',
        gender: 'female',
        birthYear: 2001,
        heightCm: 165,
      });

      const [updated1, updated2] = await Promise.all([
        profileService.updateProfile(profile1.id, { name: 'Updated 1' }),
        profileService.updateProfile(profile2.id, { name: 'Updated 2' }),
      ]);

      expect(updated1.name).toBe('Updated 1');
      expect(updated2.name).toBe('Updated 2');
    });
  });

  describe('Data integrity', () => {
    it('should preserve profile data across service restarts', async () => {
      const profile = await profileService.createProfile({
        name: 'Persistence Check',
        gender: 'male',
        birthYear: 1981,
        heightCm: 182,
        ethnicity: 'non-asian',
      });

      // Simulate service restart by creating new instances
      const newProfileRepo = new JsonProfileRepository(profilesDir);
      const newProfileService = new ProfileService(newProfileRepo);

      const retrieved = await newProfileService.getProfile(profile.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.name).toBe('Persistence Check');
      expect(retrieved!.gender).toBe('male');
      expect(retrieved!.birthYear).toBe(1981);
      expect(retrieved!.heightCm).toBe(182);
      expect(retrieved!.ethnicity).toBe('non-asian');
      expect(retrieved!.isDefault).toBe(true);
    });

    it('should maintain default status after restart', async () => {
      const profile1 = await profileService.createProfile({
        name: 'First',
        gender: 'male',
        birthYear: 1996,
        heightCm: 175,
      });

      const profile2 = await profileService.createProfile({
        name: 'Second',
        gender: 'female',
        birthYear: 2001,
        heightCm: 165,
      });

      await profileService.setDefaultProfile(profile2.id);

      // Simulate restart
      const newProfileRepo = new JsonProfileRepository(profilesDir);
      const newProfileService = new ProfileService(newProfileRepo);

      const defaultProfile = await newProfileService.getDefaultProfile();
      expect(defaultProfile!.id).toBe(profile2.id);
    });
  });
});

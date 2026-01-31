/**
 * Integration Tests: Measurement Flow
 *
 * Tests the complete measurement capture flow end-to-end:
 * 1. Create a profile
 * 2. Capture a measurement (using mock BLE)
 * 3. Verify measurement is saved with correct calculated metrics
 * 4. Retrieve measurement from history
 * 5. Delete measurement
 *
 * Uses real repositories with temp directories for realistic testing.
 *
 * @module __tests__/integration/measurement-flow.test
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { MeasurementService, ProfileNotFoundError, MeasurementReadError } from '../../application/services/MeasurementService';
import { ProfileService } from '../../application/services/ProfileService';
import { JsonMeasurementRepository } from '../../infrastructure/storage/JsonMeasurementRepository';
import { JsonProfileRepository } from '../../infrastructure/storage/JsonProfileRepository';
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
 * Create a mock BLEPort that returns realistic measurement data
 */
function createMockBLEPort(measurementData: RawMeasurement): BLEPort {
  let currentState: BLEConnectionState = 'disconnected';
  const stateCallbacks: StateChangeCallback[] = [];
  const errorCallbacks: ErrorCallback[] = [];
  const deviceDiscoveredCallbacks: ((device: { mac: string; name: string; rssi: number }) => void)[] = [];

  return {
    getState: () => currentState,

    onStateChange: (callback: StateChangeCallback): Unsubscribe => {
      stateCallbacks.push(callback);
      return () => {
        const index = stateCallbacks.indexOf(callback);
        if (index > -1) stateCallbacks.splice(index, 1);
      };
    },

    onError: (callback: ErrorCallback): Unsubscribe => {
      errorCallbacks.push(callback);
      return () => {
        const index = errorCallbacks.indexOf(callback);
        if (index > -1) errorCallbacks.splice(index, 1);
      };
    },

    onDeviceDiscovered: (callback): Unsubscribe => {
      deviceDiscoveredCallbacks.push(callback);
      return () => {
        const index = deviceDiscoveredCallbacks.indexOf(callback);
        if (index > -1) deviceDiscoveredCallbacks.splice(index, 1);
      };
    },

    scan: async (_timeoutMs?: number): Promise<void> => {
      currentState = 'scanning';
      stateCallbacks.forEach(cb => cb(currentState));
      // Simulate scan time
      await new Promise(resolve => setTimeout(resolve, 10));
      currentState = 'disconnected';
      stateCallbacks.forEach(cb => cb(currentState));
    },

    scanForDevices: async (_timeoutMs?: number): Promise<{ mac: string; name: string; rssi: number }[]> => {
      currentState = 'scanning';
      stateCallbacks.forEach(cb => cb(currentState));
      await new Promise(resolve => setTimeout(resolve, 10));
      currentState = 'disconnected';
      stateCallbacks.forEach(cb => cb(currentState));
      return [{ mac: 'AA:BB:CC:DD:EE:FF', name: 'MIBFS', rssi: -65 }];
    },

    stopScan: (): void => {
      currentState = 'disconnected';
      stateCallbacks.forEach(cb => cb(currentState));
    },

    connect: async (_deviceMac: string, _bleKey: string): Promise<void> => {
      currentState = 'connecting';
      stateCallbacks.forEach(cb => cb(currentState));
      await new Promise(resolve => setTimeout(resolve, 10));
      currentState = 'connected';
      stateCallbacks.forEach(cb => cb(currentState));
    },

    disconnect: async (): Promise<void> => {
      currentState = 'disconnected';
      stateCallbacks.forEach(cb => cb(currentState));
    },

    readMeasurement: async (): Promise<RawMeasurement> => {
      currentState = 'reading';
      stateCallbacks.forEach(cb => cb(currentState));
      await new Promise(resolve => setTimeout(resolve, 10));
      currentState = 'connected';
      stateCallbacks.forEach(cb => cb(currentState));
      return measurementData;
    },

    isDeviceAvailable: async (): Promise<boolean> => {
      return true;
    },
  };
}

/**
 * Create a mock BLEPort that fails on readMeasurement
 */
function createFailingBLEPort(errorMessage: string): BLEPort {
  const baseMock = createMockBLEPort({ weightKg: 0 });
  return {
    ...baseMock,
    readMeasurement: async (): Promise<RawMeasurement> => {
      throw new Error(errorMessage);
    },
  };
}

describe('Integration: Measurement Flow', () => {
  let tempDir: string;
  let profilesDir: string;
  let measurementsDir: string;
  let profileRepository: JsonProfileRepository;
  let measurementRepository: JsonMeasurementRepository;
  let profileService: ProfileService;
  let measurementService: MeasurementService;
  let mockBLEPort: BLEPort;

  // Realistic test measurement data (Xiaomi Mi Scale S400 typical values)
  const realisticMeasurement: RawMeasurement = {
    weightKg: 75.5,
    impedanceOhm: 485,
  };

  const measurementWithHeartRate: RawMeasurement = {
    weightKg: 72.3,
    impedanceOhm: 510,
    heartRateBpm: 68,
  };

  beforeAll(async () => {
    // Create temp directories for test data
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'thescale-integration-'));
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
    mockBLEPort = createMockBLEPort(realisticMeasurement);
    measurementService = new MeasurementService(
      mockBLEPort,
      measurementRepository,
      profileRepository
    );
  });

  describe('Complete measurement capture flow', () => {
    it('should complete full measurement flow: create profile -> capture -> retrieve -> delete', async () => {
      // Step 1: Create a profile
      const profileInput = {
        name: 'Jan Kowalski',
        gender: 'male' as const,
        birthYear: 1991,
        heightCm: 178,
        ethnicity: 'non-asian' as const,
      };

      const createdProfile = await profileService.createProfile(profileInput);

      expect(createdProfile.id).toBeDefined();
      expect(createdProfile.name).toBe('Jan Kowalski');
      expect(createdProfile.isDefault).toBe(true); // First profile is default

      // Verify profile is persisted
      const retrievedProfile = await profileService.getProfile(createdProfile.id);
      expect(retrievedProfile).not.toBeNull();
      expect(retrievedProfile?.name).toBe('Jan Kowalski');

      // Step 2: Capture a measurement
      const measurement = await measurementService.captureMeasurement(createdProfile.id);

      expect(measurement.id).toBeDefined();
      expect(measurement.userProfileId).toBe(createdProfile.id);
      expect(measurement.raw.weightKg).toBe(75.5);
      expect(measurement.raw.impedanceOhm).toBe(485);

      // Step 3: Verify calculated metrics are correct
      expect(measurement.calculated.bmi).toBeGreaterThan(20);
      expect(measurement.calculated.bmi).toBeLessThan(30);
      expect(measurement.calculated.bodyFatPercent).toBeGreaterThan(5);
      expect(measurement.calculated.bodyFatPercent).toBeLessThan(40);
      expect(measurement.calculated.muscleMassKg).toBeGreaterThan(30);
      expect(measurement.calculated.bodyWaterPercent).toBeGreaterThan(40);
      expect(measurement.calculated.boneMassKg).toBeGreaterThan(1);
      expect(measurement.calculated.visceralFatLevel).toBeGreaterThanOrEqual(1);
      expect(measurement.calculated.visceralFatLevel).toBeLessThanOrEqual(30);
      expect(measurement.calculated.bmrKcal).toBeGreaterThan(1000);
      expect(measurement.calculated.leanBodyMassKg).toBeGreaterThan(40);
      expect(measurement.calculated.bodyScore).toBeGreaterThanOrEqual(0);
      expect(measurement.calculated.bodyScore).toBeLessThanOrEqual(100);

      // Step 4: Retrieve measurement from history
      const history = await measurementService.getMeasurementHistory({
        userProfileId: createdProfile.id,
      });

      expect(history).toHaveLength(1);
      expect(history[0].id).toBe(measurement.id);
      expect(history[0].raw.weightKg).toBe(75.5);

      // Step 5: Delete measurement
      await measurementService.deleteMeasurement(measurement.id);

      // Verify deletion
      const deletedMeasurement = await measurementService.getMeasurement(measurement.id);
      expect(deletedMeasurement).toBeNull();

      const historyAfterDelete = await measurementService.getMeasurementHistory({
        userProfileId: createdProfile.id,
      });
      expect(historyAfterDelete).toHaveLength(0);
    });

    it('should capture multiple measurements for the same profile', async () => {
      // Create profile
      const profile = await profileService.createProfile({
        name: 'Anna Nowak',
        gender: 'female',
        birthYear: 1998,
        heightCm: 165,
        ethnicity: 'asian',
      });

      // Capture first measurement
      const measurement1 = await measurementService.captureMeasurement(profile.id);

      // Update BLE mock for second measurement (slightly different weight)
      const secondMeasurement: RawMeasurement = {
        weightKg: 74.8,
        impedanceOhm: 495,
      };
      mockBLEPort = createMockBLEPort(secondMeasurement);
      measurementService = new MeasurementService(
        mockBLEPort,
        measurementRepository,
        profileRepository
      );

      // Add small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 50));

      // Capture second measurement
      const measurement2 = await measurementService.captureMeasurement(profile.id);

      // Verify both measurements exist
      const history = await measurementService.getMeasurementHistory({
        userProfileId: profile.id,
      });

      expect(history).toHaveLength(2);
      // Newest first (sorted by timestamp desc)
      expect(history[0].id).toBe(measurement2.id);
      expect(history[1].id).toBe(measurement1.id);

      // Verify count
      const count = await measurementService.countMeasurements(profile.id);
      expect(count).toBe(2);
    });

    it('should calculate different metrics for male and female profiles', async () => {
      // Create male profile
      const maleProfile = await profileService.createProfile({
        name: 'Adam Test',
        gender: 'male',
        birthYear: 1986,
        heightCm: 180,
      });

      // Create female profile
      const femaleProfile = await profileService.createProfile({
        name: 'Ewa Test',
        gender: 'female',
        birthYear: 1986,
        heightCm: 165,
      });

      // Same raw measurement for both
      const measurement: RawMeasurement = { weightKg: 70, impedanceOhm: 500 };
      mockBLEPort = createMockBLEPort(measurement);
      measurementService = new MeasurementService(
        mockBLEPort,
        measurementRepository,
        profileRepository
      );

      // Capture for male
      const maleMeasurement = await measurementService.captureMeasurement(maleProfile.id);

      // Capture for female
      const femaleMeasurement = await measurementService.captureMeasurement(femaleProfile.id);

      // BMI should be different due to different heights
      expect(maleMeasurement.calculated.bmi).not.toBe(femaleMeasurement.calculated.bmi);

      // Body fat calculation uses gender-specific formulas
      expect(maleMeasurement.calculated.bodyFatPercent).not.toBe(femaleMeasurement.calculated.bodyFatPercent);

      // BMR should be different
      expect(maleMeasurement.calculated.bmrKcal).not.toBe(femaleMeasurement.calculated.bmrKcal);
    });

    it('should handle measurement with heart rate data', async () => {
      const profile = await profileService.createProfile({
        name: 'Piotr HR Test',
        gender: 'male',
        birthYear: 1996,
        heightCm: 175,
      });

      mockBLEPort = createMockBLEPort(measurementWithHeartRate);
      measurementService = new MeasurementService(
        mockBLEPort,
        measurementRepository,
        profileRepository
      );

      const measurement = await measurementService.captureMeasurement(profile.id);

      expect(measurement.raw.heartRateBpm).toBe(68);
      expect(measurement.raw.weightKg).toBe(72.3);
      expect(measurement.raw.impedanceOhm).toBe(510);

      // Verify all metrics are still calculated
      expect(measurement.calculated.bmi).toBeDefined();
      expect(measurement.calculated.bodyScore).toBeDefined();
    });

    it('should get latest measurement correctly', async () => {
      const profile = await profileService.createProfile({
        name: 'Latest Test',
        gender: 'male',
        birthYear: 2001,
        heightCm: 170,
      });

      // Capture three measurements with different weights
      const weights = [70, 71, 72];

      for (const weight of weights) {
        mockBLEPort = createMockBLEPort({ weightKg: weight, impedanceOhm: 500 });
        measurementService = new MeasurementService(
          mockBLEPort,
          measurementRepository,
          profileRepository
        );
        await measurementService.captureMeasurement(profile.id);
        await new Promise(resolve => setTimeout(resolve, 20)); // Ensure different timestamps
      }

      const latest = await measurementService.getLatestMeasurement(profile.id);

      expect(latest).not.toBeNull();
      expect(latest!.raw.weightKg).toBe(72); // Last captured
    });
  });

  describe('Error handling in measurement flow', () => {
    it('should throw ProfileNotFoundError when capturing for non-existent profile', async () => {
      const fakeUUID = generateTestUUID();
      await expect(
        measurementService.captureMeasurement(fakeUUID)
      ).rejects.toThrow(ProfileNotFoundError);

      await expect(
        measurementService.captureMeasurement(fakeUUID)
      ).rejects.toThrow(`Profile not found: ${fakeUUID}`);
    });

    it('should throw MeasurementReadError when BLE read fails', async () => {
      const profile = await profileService.createProfile({
        name: 'BLE Error Test',
        gender: 'male',
        birthYear: 1996,
        heightCm: 175,
      });

      const failingBLE = createFailingBLEPort('Bluetooth connection lost');
      const failingService = new MeasurementService(
        failingBLE,
        measurementRepository,
        profileRepository
      );

      await expect(
        failingService.captureMeasurement(profile.id)
      ).rejects.toThrow(MeasurementReadError);

      await expect(
        failingService.captureMeasurement(profile.id)
      ).rejects.toThrow('Failed to read measurement from scale');
    });

    it('should not save measurement when BLE read fails', async () => {
      const profile = await profileService.createProfile({
        name: 'No Save Test',
        gender: 'female',
        birthYear: 2001,
        heightCm: 160,
      });

      const failingBLE = createFailingBLEPort('Read timeout');
      const failingService = new MeasurementService(
        failingBLE,
        measurementRepository,
        profileRepository
      );

      try {
        await failingService.captureMeasurement(profile.id);
      } catch {
        // Expected to fail
      }

      // Verify no measurement was saved
      const history = await measurementService.getMeasurementHistory({
        userProfileId: profile.id,
      });
      expect(history).toHaveLength(0);
    });

    it('should return null for non-existent measurement ID', async () => {
      const result = await measurementService.getMeasurement(generateTestUUID());
      expect(result).toBeNull();
    });

    it('should return null for latest measurement when no measurements exist', async () => {
      const profile = await profileService.createProfile({
        name: 'Empty Profile',
        gender: 'male',
        birthYear: 1996,
        heightCm: 175,
      });

      const latest = await measurementService.getLatestMeasurement(profile.id);
      expect(latest).toBeNull();
    });

    it('should handle delete of non-existent measurement gracefully', async () => {
      // Should not throw
      await expect(
        measurementService.deleteMeasurement(generateTestUUID())
      ).resolves.not.toThrow();
    });
  });

  describe('Data persistence verification', () => {
    it('should persist measurement data to disk', async () => {
      const profile = await profileService.createProfile({
        name: 'Persistence Test',
        gender: 'male',
        birthYear: 1991,
        heightCm: 180,
      });

      const measurement = await measurementService.captureMeasurement(profile.id);

      // Create new repository instance to verify persistence
      const newMeasurementRepo = new JsonMeasurementRepository(measurementsDir);
      const retrieved = await newMeasurementRepo.getById(measurement.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(measurement.id);
      expect(retrieved!.raw.weightKg).toBe(75.5);
      expect(retrieved!.calculated.bmi).toBe(measurement.calculated.bmi);
    });

    it('should handle repository query with date filters', async () => {
      const profile = await profileService.createProfile({
        name: 'Date Filter Test',
        gender: 'female',
        birthYear: 1998,
        heightCm: 165,
      });

      // Create measurements
      await measurementService.captureMeasurement(profile.id);
      await new Promise(resolve => setTimeout(resolve, 50));
      await measurementService.captureMeasurement(profile.id);

      // Query with date filter (from now)
      const futureDate = new Date(Date.now() + 1000 * 60 * 60); // 1 hour in future
      const history = await measurementService.getMeasurementHistory({
        userProfileId: profile.id,
        fromDate: futureDate,
      });

      expect(history).toHaveLength(0);
    });

    it('should delete all measurements for a profile', async () => {
      const profile = await profileService.createProfile({
        name: 'Delete All Test',
        gender: 'male',
        birthYear: 1986,
        heightCm: 175,
      });

      // Create multiple measurements
      await measurementService.captureMeasurement(profile.id);
      await measurementService.captureMeasurement(profile.id);
      await measurementService.captureMeasurement(profile.id);

      expect(await measurementService.countMeasurements(profile.id)).toBe(3);

      // Delete all
      await measurementService.deleteAllMeasurements(profile.id);

      expect(await measurementService.countMeasurements(profile.id)).toBe(0);
    });
  });

  describe('Edge cases and boundary values', () => {
    it('should handle minimum valid weight', async () => {
      const profile = await profileService.createProfile({
        name: 'Min Weight Test',
        gender: 'female',
        birthYear: 2006,
        heightCm: 150,
      });

      // Minimum realistic weight for scale
      mockBLEPort = createMockBLEPort({ weightKg: 20, impedanceOhm: 600 });
      measurementService = new MeasurementService(
        mockBLEPort,
        measurementRepository,
        profileRepository
      );

      const measurement = await measurementService.captureMeasurement(profile.id);

      expect(measurement.raw.weightKg).toBe(20);
      expect(measurement.calculated.bmi).toBeGreaterThan(0);
    });

    it('should handle maximum valid weight', async () => {
      const profile = await profileService.createProfile({
        name: 'Max Weight Test',
        gender: 'male',
        birthYear: 1976,
        heightCm: 200,
      });

      // Maximum scale capacity
      mockBLEPort = createMockBLEPort({ weightKg: 150, impedanceOhm: 300 });
      measurementService = new MeasurementService(
        mockBLEPort,
        measurementRepository,
        profileRepository
      );

      const measurement = await measurementService.captureMeasurement(profile.id);

      expect(measurement.raw.weightKg).toBe(150);
      expect(measurement.calculated.bmi).toBeGreaterThan(30);
    });

    it('should handle measurement without impedance', async () => {
      const profile = await profileService.createProfile({
        name: 'No Impedance Test',
        gender: 'male',
        birthYear: 1996,
        heightCm: 175,
      });

      // Weight-only measurement (no bioimpedance)
      mockBLEPort = createMockBLEPort({ weightKg: 80 });
      measurementService = new MeasurementService(
        mockBLEPort,
        measurementRepository,
        profileRepository
      );

      const measurement = await measurementService.captureMeasurement(profile.id);

      expect(measurement.raw.weightKg).toBe(80);
      expect(measurement.raw.impedanceOhm).toBeUndefined();
      // Metrics should still be calculated using weight-based formulas
      expect(measurement.calculated.bmi).toBeDefined();
      expect(measurement.calculated.bodyFatPercent).toBeDefined();
    });

    it('should handle elderly profile (age at upper bound - 80)', async () => {
      // Schema and Deurenberg formula both limit age to 80
      const profile = await profileService.createProfile({
        name: 'Elderly Test',
        gender: 'female',
        birthYear: 1946,
        heightCm: 160,
      });

      const measurement = await measurementService.captureMeasurement(profile.id);

      expect(measurement.calculated.bmi).toBeDefined();
      expect(measurement.calculated.bodyScore).toBeDefined();
      expect(measurement.calculated.bmrKcal).toBeGreaterThan(0);
    });

    it('should handle young profile (age at lower bound for Deurenberg - 7)', async () => {
      // Deurenberg formula requires age >= 7
      const profile = await profileService.createProfile({
        name: 'Young Test',
        gender: 'male',
        birthYear: 2019,
        heightCm: 120,
      });

      mockBLEPort = createMockBLEPort({ weightKg: 25, impedanceOhm: 650 });
      measurementService = new MeasurementService(
        mockBLEPort,
        measurementRepository,
        profileRepository
      );

      const measurement = await measurementService.captureMeasurement(profile.id);

      expect(measurement.calculated.bmi).toBeDefined();
      expect(measurement.calculated.bodyScore).toBeDefined();
    });

    it('should handle short profile (height at lower bound - 90cm)', async () => {
      // Schema limits height to 90-220cm
      const profile = await profileService.createProfile({
        name: 'Short Test',
        gender: 'female',
        birthYear: 2016,
        heightCm: 90,
      });

      mockBLEPort = createMockBLEPort({ weightKg: 25, impedanceOhm: 600 });
      measurementService = new MeasurementService(
        mockBLEPort,
        measurementRepository,
        profileRepository
      );

      const measurement = await measurementService.captureMeasurement(profile.id);

      expect(measurement.calculated.bmi).toBeDefined();
      expect(measurement.calculated.bmi).toBeGreaterThan(20); // Short height, reasonable weight
    });

    it('should handle tall profile (height at upper bound - 220cm)', async () => {
      // Schema limits height to 90-220cm
      const profile = await profileService.createProfile({
        name: 'Tall Test',
        gender: 'male',
        birthYear: 1996,
        heightCm: 220,
      });

      mockBLEPort = createMockBLEPort({ weightKg: 100, impedanceOhm: 400 });
      measurementService = new MeasurementService(
        mockBLEPort,
        measurementRepository,
        profileRepository
      );

      const measurement = await measurementService.captureMeasurement(profile.id);

      expect(measurement.calculated.bmi).toBeDefined();
      expect(measurement.calculated.bmi).toBeLessThan(25); // Tall height, moderate weight
    });
  });
});

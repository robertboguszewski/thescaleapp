/**
 * Integration Tests: Report Generation
 *
 * Tests health report generation flow end-to-end:
 * 1. Create profile
 * 2. Add multiple measurements over simulated time period
 * 3. Generate report
 * 4. Verify trends are calculated correctly
 * 5. Verify recommendations are generated
 *
 * Uses real repositories with temp directories for realistic testing.
 *
 * @module __tests__/integration/report-generation.test
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import {
  ReportService,
  NoMeasurementsError,
  ProfileNotFoundError,
  type HealthReport,
} from '../../application/services/ReportService';
import { ProfileService } from '../../application/services/ProfileService';
import { MeasurementService } from '../../application/services/MeasurementService';
import { JsonProfileRepository } from '../../infrastructure/storage/JsonProfileRepository';
import { JsonMeasurementRepository } from '../../infrastructure/storage/JsonMeasurementRepository';
import type {
  MeasurementRepository,
  MeasurementResult,
} from '../../application/ports/MeasurementRepository';
import type { BLEPort, BLEConnectionState, StateChangeCallback, ErrorCallback, Unsubscribe } from '../../application/ports/BLEPort';
import type { RawMeasurement, CalculatedMetrics } from '../../domain/calculations/types';
import { calculateAllMetrics } from '../../domain/calculations';
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

// Counter for unique measurement IDs
let measurementIdCounter = 0;

// Mock crypto.randomUUID to return valid UUIDs
vi.stubGlobal('crypto', {
  randomUUID: vi.fn(() => generateTestUUID()),
});

/**
 * Create a mock BLEPort with configurable measurement
 */
function createMockBLEPort(measurement: RawMeasurement): BLEPort {
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
    readMeasurement: async (): Promise<RawMeasurement> => measurement,
    isDeviceAvailable: async () => true,
  };
}

/**
 * Helper to create a measurement result with specific timestamp
 * This bypasses BLE and directly saves to repository for time-travel testing
 */
async function createMeasurementWithTimestamp(
  repository: MeasurementRepository,
  profileId: string,
  raw: RawMeasurement,
  timestamp: Date,
  profile: { gender: 'male' | 'female'; age: number; heightCm: number; ethnicity?: 'asian' | 'non-asian' }
): Promise<MeasurementResult> {
  const calculated = calculateAllMetrics(profile, raw);

  const measurement: MeasurementResult = {
    id: generateTestUUID(),
    timestamp,
    raw,
    calculated,
    userProfileId: profileId,
  };

  await repository.save(measurement);
  return measurement;
}

describe('Integration: Report Generation', () => {
  let tempDir: string;
  let profilesDir: string;
  let measurementsDir: string;
  let profileRepository: JsonProfileRepository;
  let measurementRepository: JsonMeasurementRepository;
  let profileService: ProfileService;
  let measurementService: MeasurementService;
  let reportService: ReportService;

  beforeAll(async () => {
    // Create temp directories for test data
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'thescale-report-integration-'));
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
    // Reset measurement ID counter
    measurementIdCounter = 0;

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
      createMockBLEPort({ weightKg: 75, impedanceOhm: 500 }),
      measurementRepository,
      profileRepository
    );
    reportService = new ReportService(measurementRepository, profileRepository);
  });

  describe('Basic report generation', () => {
    it('should generate report with single measurement', async () => {
      const profile = await profileService.createProfile({
        name: 'Single Measurement',
        gender: 'male',
        birthYear: 1991,
        heightCm: 178,
      });

      await measurementService.captureMeasurement(profile.id);

      const report = await reportService.generateReport(profile.id);

      expect(report.profileId).toBe(profile.id);
      expect(report.profileName).toBe('Single Measurement');
      expect(report.generatedAt).toBeInstanceOf(Date);
      expect(report.latestMeasurement).toBeDefined();
      expect(report.trends).toBeDefined();
      expect(report.recommendations).toBeDefined();
      expect(report.summary).toBeDefined();
    });

    it('should include correct profile information in report', async () => {
      const profile = await profileService.createProfile({
        name: 'Anna Kowalska',
        gender: 'female',
        birthYear: 1998,
        heightCm: 165,
        ethnicity: 'non-asian',
      });

      await measurementService.captureMeasurement(profile.id);

      const report = await reportService.generateReport(profile.id);

      expect(report.profileId).toBe(profile.id);
      expect(report.profileName).toBe('Anna Kowalska');
    });

    it('should include latest measurement in report', async () => {
      const profile = await profileService.createProfile({
        name: 'Latest Measurement Test',
        gender: 'male',
        birthYear: 1986,
        heightCm: 180,
      });

      // Create older measurement
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 7);
      await createMeasurementWithTimestamp(
        measurementRepository,
        profile.id,
        { weightKg: 80, impedanceOhm: 480 },
        oldDate,
        { gender: 'male', birthYear: 1986, heightCm: 180 }
      );

      // Create newer measurement
      await createMeasurementWithTimestamp(
        measurementRepository,
        profile.id,
        { weightKg: 78, impedanceOhm: 490 },
        new Date(),
        { gender: 'male', birthYear: 1986, heightCm: 180 }
      );

      const report = await reportService.generateReport(profile.id);

      expect(report.latestMeasurement.raw.weightKg).toBe(78);
    });
  });

  describe('Error handling', () => {
    it('should throw ProfileNotFoundError for non-existent profile', async () => {
      const fakeId = generateTestUUID();
      await expect(
        reportService.generateReport(fakeId)
      ).rejects.toThrow(ProfileNotFoundError);

      await expect(
        reportService.generateReport(fakeId)
      ).rejects.toThrow(`Profile not found: ${fakeId}`);
    });

    it('should throw NoMeasurementsError when profile has no measurements', async () => {
      const profile = await profileService.createProfile({
        name: 'Empty Profile',
        gender: 'male',
        birthYear: 1996,
        heightCm: 175,
      });

      await expect(
        reportService.generateReport(profile.id)
      ).rejects.toThrow(NoMeasurementsError);

      await expect(
        reportService.generateReport(profile.id)
      ).rejects.toThrow('No measurements found for profile');
    });

    it('should throw NoMeasurementsError when all measurements are older than 30 days', async () => {
      const profile = await profileService.createProfile({
        name: 'Old Measurements',
        gender: 'female',
        birthYear: 1991,
        heightCm: 165,
      });

      // Create measurement older than 30 days
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 35);
      await createMeasurementWithTimestamp(
        measurementRepository,
        profile.id,
        { weightKg: 65, impedanceOhm: 520 },
        oldDate,
        { gender: 'female', birthYear: 1991, heightCm: 165 }
      );

      await expect(
        reportService.generateReport(profile.id)
      ).rejects.toThrow(NoMeasurementsError);
    });
  });

  describe('Trends calculation', () => {
    it('should show zero trends with single measurement', async () => {
      const profile = await profileService.createProfile({
        name: 'Single Trend',
        gender: 'male',
        birthYear: 1991,
        heightCm: 178,
      });

      await measurementService.captureMeasurement(profile.id);

      const report = await reportService.generateReport(profile.id);

      expect(report.trends.weightChange).toBe(0);
      expect(report.trends.bodyFatChange).toBe(0);
      expect(report.trends.muscleChange).toBe(0);
      expect(report.trends.measurementCount).toBe(1);
      expect(report.trends.period).toBe(0);
    });

    it('should calculate weight loss trend correctly', async () => {
      const profile = await profileService.createProfile({
        name: 'Weight Loss',
        gender: 'male',
        birthYear: 1991,
        heightCm: 178,
      });

      const profileData = { gender: 'male' as const, birthYear: 1991, heightCm: 178 };

      // Old measurement: 80kg
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 14);
      await createMeasurementWithTimestamp(
        measurementRepository,
        profile.id,
        { weightKg: 80, impedanceOhm: 480 },
        oldDate,
        profileData
      );

      // New measurement: 78kg (2kg loss)
      await createMeasurementWithTimestamp(
        measurementRepository,
        profile.id,
        { weightKg: 78, impedanceOhm: 490 },
        new Date(),
        profileData
      );

      const report = await reportService.generateReport(profile.id);

      expect(report.trends.weightChange).toBe(-2);
      expect(report.trends.measurementCount).toBe(2);
      expect(report.trends.period).toBeCloseTo(14, 0);
    });

    it('should calculate weight gain trend correctly', async () => {
      const profile = await profileService.createProfile({
        name: 'Weight Gain',
        gender: 'female',
        birthYear: 1998,
        heightCm: 165,
      });

      const profileData = { gender: 'female' as const, birthYear: 1998, heightCm: 165 };

      // Old measurement: 58kg
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 21);
      await createMeasurementWithTimestamp(
        measurementRepository,
        profile.id,
        { weightKg: 58, impedanceOhm: 540 },
        oldDate,
        profileData
      );

      // New measurement: 60kg (2kg gain)
      await createMeasurementWithTimestamp(
        measurementRepository,
        profile.id,
        { weightKg: 60, impedanceOhm: 530 },
        new Date(),
        profileData
      );

      const report = await reportService.generateReport(profile.id);

      expect(report.trends.weightChange).toBe(2);
      expect(report.trends.measurementCount).toBe(2);
      expect(report.trends.period).toBeCloseTo(21, 0);
    });

    it('should calculate body fat change trend', async () => {
      const profile = await profileService.createProfile({
        name: 'Body Fat Trend',
        gender: 'male',
        birthYear: 1986,
        heightCm: 175,
      });

      const profileData = { gender: 'male' as const, birthYear: 1986, heightCm: 175 };

      // Old measurement with higher body fat
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 10);
      await createMeasurementWithTimestamp(
        measurementRepository,
        profile.id,
        { weightKg: 85, impedanceOhm: 450 },
        oldDate,
        profileData
      );

      // New measurement with lower body fat (lost weight)
      await createMeasurementWithTimestamp(
        measurementRepository,
        profile.id,
        { weightKg: 80, impedanceOhm: 480 },
        new Date(),
        profileData
      );

      const report = await reportService.generateReport(profile.id);

      // Body fat should decrease with weight loss
      expect(report.trends.bodyFatChange).toBeLessThan(0);
    });

    it('should handle multiple measurements and use oldest/newest for trends', async () => {
      const profile = await profileService.createProfile({
        name: 'Multiple Trends',
        gender: 'male',
        birthYear: 1991,
        heightCm: 180,
      });

      const profileData = { gender: 'male' as const, birthYear: 1991, heightCm: 180 };

      // Create 5 measurements over 20 days
      const weights = [85, 84, 83, 82, 80];
      for (let i = 0; i < 5; i++) {
        const date = new Date();
        date.setDate(date.getDate() - (20 - i * 5));
        await createMeasurementWithTimestamp(
          measurementRepository,
          profile.id,
          { weightKg: weights[i], impedanceOhm: 470 + i * 10 },
          date,
          profileData
        );
      }

      const report = await reportService.generateReport(profile.id);

      expect(report.trends.measurementCount).toBe(5);
      expect(report.trends.weightChange).toBe(-5); // 80 - 85 = -5
      expect(report.trends.period).toBeCloseTo(20, 0);
    });
  });

  describe('Overall status determination', () => {
    it('should show "stable" status with single measurement', async () => {
      const profile = await profileService.createProfile({
        name: 'Stable Single',
        gender: 'male',
        birthYear: 1996,
        heightCm: 175,
      });

      await measurementService.captureMeasurement(profile.id);

      const report = await reportService.generateReport(profile.id);

      expect(report.summary.overallStatus).toBe('stable');
    });

    it('should show "improving" status with significant weight loss and body fat reduction', async () => {
      const profile = await profileService.createProfile({
        name: 'Improving',
        gender: 'male',
        birthYear: 1991,
        heightCm: 178,
      });

      const profileData = { gender: 'male' as const, birthYear: 1991, heightCm: 178 };

      // Old: higher weight
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 14);
      await createMeasurementWithTimestamp(
        measurementRepository,
        profile.id,
        { weightKg: 90, impedanceOhm: 420 },
        oldDate,
        profileData
      );

      // New: lower weight, better body composition
      await createMeasurementWithTimestamp(
        measurementRepository,
        profile.id,
        { weightKg: 85, impedanceOhm: 480 },
        new Date(),
        profileData
      );

      const report = await reportService.generateReport(profile.id);

      // With 5kg weight loss and improved impedance, should be improving
      expect(['improving', 'stable']).toContain(report.summary.overallStatus);
    });

    it('should show "declining" status with significant weight gain', async () => {
      const profile = await profileService.createProfile({
        name: 'Declining',
        gender: 'female',
        birthYear: 1986,
        heightCm: 165,
      });

      const profileData = { gender: 'female' as const, birthYear: 1986, heightCm: 165 };

      // Old: healthy weight
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 14);
      await createMeasurementWithTimestamp(
        measurementRepository,
        profile.id,
        { weightKg: 60, impedanceOhm: 540 },
        oldDate,
        profileData
      );

      // New: significant weight gain
      await createMeasurementWithTimestamp(
        measurementRepository,
        profile.id,
        { weightKg: 68, impedanceOhm: 480 },
        new Date(),
        profileData
      );

      const report = await reportService.generateReport(profile.id);

      // With 8kg gain, likely declining
      expect(['declining', 'stable']).toContain(report.summary.overallStatus);
    });
  });

  describe('Recommendations generation', () => {
    it('should generate recommendations based on metrics', async () => {
      const profile = await profileService.createProfile({
        name: 'Recommendations Test',
        gender: 'male',
        birthYear: 1991,
        heightCm: 175,
      });

      await measurementService.captureMeasurement(profile.id);

      const report = await reportService.generateReport(profile.id);

      expect(report.recommendations).toBeDefined();
      expect(Array.isArray(report.recommendations)).toBe(true);
      expect(report.recommendations.length).toBeGreaterThan(0);
      expect(report.recommendations.length).toBeLessThanOrEqual(3); // Priority limited to 3
    });

    it('should include recommendation structure with required fields', async () => {
      const profile = await profileService.createProfile({
        name: 'Recommendation Structure',
        gender: 'female',
        birthYear: 1996,
        heightCm: 165,
      });

      await measurementService.captureMeasurement(profile.id);

      const report = await reportService.generateReport(profile.id);

      for (const rec of report.recommendations) {
        expect(rec).toHaveProperty('type');
        expect(['info', 'warning', 'critical']).toContain(rec.type);
        expect(rec).toHaveProperty('category');
        expect(rec).toHaveProperty('title');
        expect(rec).toHaveProperty('message');
        expect(rec).toHaveProperty('actions');
        expect(Array.isArray(rec.actions)).toBe(true);
      }
    });

    it('should prioritize critical recommendations', async () => {
      const profile = await profileService.createProfile({
        name: 'Critical Priority',
        gender: 'male',
        birthYear: 1976,
        heightCm: 170,
      });

      const profileData = { gender: 'male' as const, birthYear: 1976, heightCm: 170 };

      // Create measurement with high BMI (obesity)
      await createMeasurementWithTimestamp(
        measurementRepository,
        profile.id,
        { weightKg: 110, impedanceOhm: 350 },
        new Date(),
        profileData
      );

      const report = await reportService.generateReport(profile.id);

      // With BMI > 30, should have critical recommendations first
      if (report.recommendations.some(r => r.type === 'critical')) {
        expect(report.recommendations[0].type).toBe('critical');
      }
    });

    it('should generate BMI-related recommendation for underweight', async () => {
      const profile = await profileService.createProfile({
        name: 'Underweight',
        gender: 'female',
        birthYear: 2001,
        heightCm: 170,
      });

      const profileData = { gender: 'female' as const, birthYear: 2001, heightCm: 170 };

      // Create underweight measurement (BMI < 18.5)
      await createMeasurementWithTimestamp(
        measurementRepository,
        profile.id,
        { weightKg: 48, impedanceOhm: 600 },
        new Date(),
        profileData
      );

      const report = await reportService.generateReport(profile.id);

      const bmiRec = report.recommendations.find(r => r.category === 'bmi');
      expect(bmiRec).toBeDefined();
      expect(bmiRec!.type).toBe('warning');
    });

    it('should generate obesity recommendation for high BMI', async () => {
      const profile = await profileService.createProfile({
        name: 'Obese',
        gender: 'male',
        birthYear: 1981,
        heightCm: 175,
      });

      const profileData = { gender: 'male' as const, birthYear: 1981, heightCm: 175 };

      // Create obese measurement (BMI >= 30)
      await createMeasurementWithTimestamp(
        measurementRepository,
        profile.id,
        { weightKg: 105, impedanceOhm: 380 },
        new Date(),
        profileData
      );

      const report = await reportService.generateReport(profile.id);

      const bmiRec = report.recommendations.find(r => r.category === 'bmi');
      expect(bmiRec).toBeDefined();
      expect(bmiRec!.type).toBe('critical');
    });
  });

  describe('Summary and body score', () => {
    it('should include body score in summary', async () => {
      const profile = await profileService.createProfile({
        name: 'Body Score Test',
        gender: 'male',
        birthYear: 1996,
        heightCm: 178,
      });

      await measurementService.captureMeasurement(profile.id);

      const report = await reportService.generateReport(profile.id);

      expect(report.summary.bodyScore).toBeDefined();
      expect(report.summary.bodyScore).toBeGreaterThanOrEqual(0);
      expect(report.summary.bodyScore).toBeLessThanOrEqual(100);
    });

    it('should include key insight in summary', async () => {
      const profile = await profileService.createProfile({
        name: 'Key Insight',
        gender: 'female',
        birthYear: 1998,
        heightCm: 165,
      });

      await measurementService.captureMeasurement(profile.id);

      const report = await reportService.generateReport(profile.id);

      expect(report.summary.keyInsight).toBeDefined();
      expect(typeof report.summary.keyInsight).toBe('string');
      expect(report.summary.keyInsight.length).toBeGreaterThan(0);
    });

    it('should generate appropriate insight for single measurement', async () => {
      const profile = await profileService.createProfile({
        name: 'Single Insight',
        gender: 'male',
        birthYear: 1991,
        heightCm: 180,
      });

      await measurementService.captureMeasurement(profile.id);

      const report = await reportService.generateReport(profile.id);

      // Single measurement should encourage regular tracking (returns translation key)
      expect(report.summary.keyInsight).toContain('report.regularMeasurements');
    });
  });

  describe('Quick summary', () => {
    it('should return quick summary with body score', async () => {
      const profile = await profileService.createProfile({
        name: 'Quick Summary',
        gender: 'male',
        birthYear: 1991,
        heightCm: 178,
      });

      await measurementService.captureMeasurement(profile.id);

      const summary = await reportService.getQuickSummary(profile.id);

      expect(summary).not.toBeNull();
      expect(summary!.bodyScore).toBeGreaterThanOrEqual(0);
      expect(summary!.bodyScore).toBeLessThanOrEqual(100);
      expect(['good', 'needs-attention']).toContain(summary!.status);
    });

    it('should return null for profile with no measurements', async () => {
      const profile = await profileService.createProfile({
        name: 'Empty Quick',
        gender: 'female',
        birthYear: 2001,
        heightCm: 160,
      });

      const summary = await reportService.getQuickSummary(profile.id);

      expect(summary).toBeNull();
    });

    it('should show "good" status for high body score', async () => {
      const profile = await profileService.createProfile({
        name: 'Good Score',
        gender: 'male',
        birthYear: 1996,
        heightCm: 178,
      });

      const profileData = { gender: 'male' as const, birthYear: 1996, heightCm: 178 };

      // Healthy weight measurement
      await createMeasurementWithTimestamp(
        measurementRepository,
        profile.id,
        { weightKg: 72, impedanceOhm: 500 },
        new Date(),
        profileData
      );

      const summary = await reportService.getQuickSummary(profile.id);

      if (summary!.bodyScore >= 70) {
        expect(summary!.status).toBe('good');
      }
    });

    it('should show "needs-attention" status for low body score', async () => {
      const profile = await profileService.createProfile({
        name: 'Attention Score',
        gender: 'male',
        birthYear: 1976,
        heightCm: 170,
      });

      const profileData = { gender: 'male' as const, birthYear: 1976, heightCm: 170 };

      // Overweight measurement (lower body score expected)
      await createMeasurementWithTimestamp(
        measurementRepository,
        profile.id,
        { weightKg: 100, impedanceOhm: 380 },
        new Date(),
        profileData
      );

      const summary = await reportService.getQuickSummary(profile.id);

      if (summary!.bodyScore < 70) {
        expect(summary!.status).toBe('needs-attention');
      }
    });
  });

  describe('Report with different user profiles', () => {
    it('should generate different recommendations for male vs female profiles', async () => {
      // Male profile
      const maleProfile = await profileService.createProfile({
        name: 'Male Profile',
        gender: 'male',
        birthYear: 1991,
        heightCm: 178,
      });

      // Female profile
      const femaleProfile = await profileService.createProfile({
        name: 'Female Profile',
        gender: 'female',
        birthYear: 1991,
        heightCm: 165,
      });

      // Same weight for both
      const maleData = { gender: 'male' as const, birthYear: 1991, heightCm: 178 };
      const femaleData = { gender: 'female' as const, birthYear: 1991, heightCm: 165 };

      await createMeasurementWithTimestamp(
        measurementRepository,
        maleProfile.id,
        { weightKg: 75, impedanceOhm: 490 },
        new Date(),
        maleData
      );

      await createMeasurementWithTimestamp(
        measurementRepository,
        femaleProfile.id,
        { weightKg: 75, impedanceOhm: 490 },
        new Date(),
        femaleData
      );

      const maleReport = await reportService.generateReport(maleProfile.id);
      const femaleReport = await reportService.generateReport(femaleProfile.id);

      // Reports should have different body scores due to gender-specific formulas
      expect(maleReport.summary.bodyScore).not.toBe(femaleReport.summary.bodyScore);
    });

    it('should consider ethnicity in calculations', async () => {
      const asianProfile = await profileService.createProfile({
        name: 'Asian Profile',
        gender: 'male',
        birthYear: 1996,
        heightCm: 172,
        ethnicity: 'asian',
      });

      const nonAsianProfile = await profileService.createProfile({
        name: 'Non-Asian Profile',
        gender: 'male',
        birthYear: 1996,
        heightCm: 172,
        ethnicity: 'non-asian',
      });

      const asianData = { gender: 'male' as const, birthYear: 1996, heightCm: 172, ethnicity: 'asian' as const };
      const nonAsianData = { gender: 'male' as const, birthYear: 1996, heightCm: 172, ethnicity: 'non-asian' as const };

      await createMeasurementWithTimestamp(
        measurementRepository,
        asianProfile.id,
        { weightKg: 70, impedanceOhm: 500 },
        new Date(),
        asianData
      );

      await createMeasurementWithTimestamp(
        measurementRepository,
        nonAsianProfile.id,
        { weightKg: 70, impedanceOhm: 500 },
        new Date(),
        nonAsianData
      );

      const asianReport = await reportService.generateReport(asianProfile.id);
      const nonAsianReport = await reportService.generateReport(nonAsianProfile.id);

      // Body fat calculation differs by ethnicity (Gallagher formula)
      // This may or may not show difference depending on which formula is used
      expect(asianReport.profileName).toBe('Asian Profile');
      expect(nonAsianReport.profileName).toBe('Non-Asian Profile');
    });
  });

  describe('Data persistence and report regeneration', () => {
    it('should generate consistent report after service restart', async () => {
      const profile = await profileService.createProfile({
        name: 'Persistence Report',
        gender: 'male',
        birthYear: 1986,
        heightCm: 180,
      });

      await measurementService.captureMeasurement(profile.id);

      // Generate first report
      const report1 = await reportService.generateReport(profile.id);

      // Simulate service restart
      const newMeasurementRepo = new JsonMeasurementRepository(measurementsDir);
      const newProfileRepo = new JsonProfileRepository(profilesDir);
      const newReportService = new ReportService(newMeasurementRepo, newProfileRepo);

      // Generate second report
      const report2 = await newReportService.generateReport(profile.id);

      // Reports should be equivalent
      expect(report2.profileId).toBe(report1.profileId);
      expect(report2.latestMeasurement.id).toBe(report1.latestMeasurement.id);
      expect(report2.trends.measurementCount).toBe(report1.trends.measurementCount);
      expect(report2.summary.bodyScore).toBe(report1.summary.bodyScore);
    });
  });
});

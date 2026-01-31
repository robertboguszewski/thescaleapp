/**
 * BackupService Tests (TDD)
 *
 * Tests for complete application data backup and restore functionality.
 * Written BEFORE implementation following TDD approach.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock repositories
const mockProfileRepository = {
  getAll: vi.fn(),
  save: vi.fn(),
  delete: vi.fn(),
};

const mockMeasurementRepository = {
  getAll: vi.fn(),
  save: vi.fn(),
  delete: vi.fn(),
  deleteAll: vi.fn(),
};

// Mock AppConfigStore
const mockConfigStore = {
  getBLEConfig: vi.fn(),
  setBLEConfig: vi.fn(),
  getAppSettings: vi.fn(),
  setAppSettings: vi.fn(),
  exportConfig: vi.fn(),
  importConfig: vi.fn(),
};

import { BackupService, type BackupData, type BackupMetadata } from '../BackupService';

describe('BackupService', () => {
  let backupService: BackupService;

  // Sample test data
  const sampleProfiles = [
    {
      id: 'profile-1',
      name: 'Jan Kowalski',
      birthYear: 1985,
      birthMonth: 6,
      gender: 'male' as const,
      heightCm: 180,
      ethnicity: 'caucasian' as const,
      isDefault: true,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    },
    {
      id: 'profile-2',
      name: 'Anna Nowak',
      birthYear: 1990,
      gender: 'female' as const,
      heightCm: 165,
      ethnicity: 'caucasian' as const,
      isDefault: false,
      createdAt: new Date('2024-01-02'),
      updatedAt: new Date('2024-01-02'),
    },
  ];

  const sampleMeasurements = [
    {
      id: 'meas-1',
      userProfileId: 'profile-1',
      timestamp: new Date('2024-01-15T10:00:00Z'),
      raw: { weightKg: 75.5, impedanceOhm: 450 },
      calculated: {
        bmi: 23.3,
        bodyFatPercent: 18.5,
        muscleMassKg: 35.2,
        boneMassKg: 3.1,
        bodyWaterPercent: 55.0,
        visceralFatLevel: 8,
        bmrKcal: 1750,
        proteinPercent: 17.5,
        leanBodyMassKg: 61.5,
        bodyScore: 82,
      },
    },
    {
      id: 'meas-2',
      userProfileId: 'profile-1',
      timestamp: new Date('2024-01-16T10:00:00Z'),
      raw: { weightKg: 75.2, impedanceOhm: 448 },
      calculated: {
        bmi: 23.2,
        bodyFatPercent: 18.3,
        muscleMassKg: 35.3,
        boneMassKg: 3.1,
        bodyWaterPercent: 55.2,
        visceralFatLevel: 8,
        bmrKcal: 1755,
        proteinPercent: 17.6,
        leanBodyMassKg: 61.4,
        bodyScore: 83,
      },
    },
  ];

  const sampleBLEConfig = {
    deviceMac: 'AA:BB:CC:DD:EE:FF',
    bleKey: 'test-ble-key',
    autoConnect: true,
    scanTimeout: 30000,
  };

  const sampleAppSettings = {
    theme: 'dark' as const,
    language: 'pl',
    dataVersion: '1.0.0',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock returns
    mockProfileRepository.getAll.mockResolvedValue(sampleProfiles);
    mockMeasurementRepository.getAll.mockResolvedValue(sampleMeasurements);
    mockConfigStore.getBLEConfig.mockReturnValue(sampleBLEConfig);
    mockConfigStore.getAppSettings.mockReturnValue(sampleAppSettings);
    mockConfigStore.exportConfig.mockReturnValue({
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      ble: sampleBLEConfig,
      settings: sampleAppSettings,
    });

    backupService = new BackupService(
      mockProfileRepository as any,
      mockMeasurementRepository as any,
      mockConfigStore as any
    );
  });

  describe('createBackup', () => {
    it('should create complete backup with all data', async () => {
      const backup = await backupService.createBackup();

      expect(backup).toHaveProperty('metadata');
      expect(backup).toHaveProperty('profiles');
      expect(backup).toHaveProperty('measurements');
      expect(backup).toHaveProperty('config');
    });

    it('should include correct metadata', async () => {
      const backup = await backupService.createBackup();

      expect(backup.metadata.version).toBe('1.0.0');
      expect(backup.metadata.appName).toBe('TheScale');
      expect(backup.metadata.createdAt).toBeDefined();
      expect(backup.metadata.profileCount).toBe(2);
      expect(backup.metadata.measurementCount).toBe(2);
    });

    it('should include all profiles', async () => {
      const backup = await backupService.createBackup();

      expect(backup.profiles).toHaveLength(2);
      expect(backup.profiles[0].id).toBe('profile-1');
      expect(backup.profiles[1].id).toBe('profile-2');
    });

    it('should include all measurements', async () => {
      const backup = await backupService.createBackup();

      expect(backup.measurements).toHaveLength(2);
      expect(backup.measurements[0].id).toBe('meas-1');
    });

    it('should include BLE config', async () => {
      const backup = await backupService.createBackup();

      expect(backup.config.ble.deviceMac).toBe('AA:BB:CC:DD:EE:FF');
      expect(backup.config.ble.bleKey).toBe('test-ble-key');
    });

    it('should serialize dates as ISO strings', async () => {
      const backup = await backupService.createBackup();

      // Dates should be serializable (ISO strings)
      const json = JSON.stringify(backup);
      expect(json).toBeDefined();

      const parsed = JSON.parse(json);
      expect(typeof parsed.metadata.createdAt).toBe('string');
    });
  });

  describe('restoreBackup', () => {
    let validBackup: BackupData;

    beforeEach(async () => {
      validBackup = await backupService.createBackup();
    });

    it('should restore profiles from backup', async () => {
      mockProfileRepository.getAll.mockResolvedValue([]);

      await backupService.restoreBackup(validBackup);

      expect(mockProfileRepository.save).toHaveBeenCalledTimes(2);
    });

    it('should restore measurements from backup', async () => {
      mockMeasurementRepository.getAll.mockResolvedValue([]);

      await backupService.restoreBackup(validBackup);

      expect(mockMeasurementRepository.save).toHaveBeenCalledTimes(2);
    });

    it('should restore config from backup', async () => {
      await backupService.restoreBackup(validBackup);

      expect(mockConfigStore.importConfig).toHaveBeenCalled();
    });

    it('should reject incompatible backup version', async () => {
      const incompatibleBackup = {
        ...validBackup,
        metadata: {
          ...validBackup.metadata,
          version: '99.0.0',
        },
      };

      await expect(backupService.restoreBackup(incompatibleBackup)).rejects.toThrow(
        /incompatible.*version/i
      );
    });

    it('should provide restore options for merge vs replace', async () => {
      await backupService.restoreBackup(validBackup, { mode: 'replace' });

      // In replace mode, should clear existing data first
      expect(mockMeasurementRepository.deleteAll).toHaveBeenCalled();
    });

    it('should merge data in merge mode (default)', async () => {
      await backupService.restoreBackup(validBackup, { mode: 'merge' });

      // In merge mode, should not delete existing data
      expect(mockMeasurementRepository.deleteAll).not.toHaveBeenCalled();
    });
  });

  describe('validateBackup', () => {
    it('should validate correct backup structure', async () => {
      const backup = await backupService.createBackup();
      const result = backupService.validateBackup(backup);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing metadata', () => {
      const invalidBackup = {
        profiles: [],
        measurements: [],
        config: {},
      } as any;

      const result = backupService.validateBackup(invalidBackup);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing metadata');
    });

    it('should detect missing profiles array', () => {
      const invalidBackup = {
        metadata: { version: '1.0.0' },
        measurements: [],
        config: {},
      } as any;

      const result = backupService.validateBackup(invalidBackup);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing profiles');
    });

    it('should detect incompatible version', () => {
      const futureBackup = {
        metadata: { version: '99.0.0', appName: 'TheScale', createdAt: new Date().toISOString(), profileCount: 0, measurementCount: 0 },
        profiles: [],
        measurements: [],
        config: { ble: {}, settings: {} },
      } as any;

      const result = backupService.validateBackup(futureBackup);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('version'))).toBe(true);
    });
  });

  describe('getBackupInfo', () => {
    it('should return summary of backup contents', async () => {
      const backup = await backupService.createBackup();
      const info = backupService.getBackupInfo(backup);

      expect(info.profileCount).toBe(2);
      expect(info.measurementCount).toBe(2);
      expect(info.version).toBe('1.0.0');
      expect(info.createdAt).toBeDefined();
      expect(info.hasConfig).toBe(true);
    });
  });
});

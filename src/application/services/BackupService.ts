/**
 * BackupService
 *
 * Complete application data backup and restore functionality.
 * Handles exporting and importing all user data including:
 * - User profiles
 * - Measurement history
 * - App configuration (BLE settings, preferences)
 *
 * @module application/services/BackupService
 */

import type { ProfileRepository, StoredUserProfile } from '../ports/ProfileRepository';
import type { MeasurementRepository, MeasurementResult } from '../ports/MeasurementRepository';
import type { AppConfigStore, BLEConfig, AppSettings, ConfigExport } from '../../infrastructure/storage/AppConfigStore';

/**
 * Backup metadata
 */
export interface BackupMetadata {
  version: string;
  appName: string;
  createdAt: string;
  profileCount: number;
  measurementCount: number;
}

/**
 * Serialized profile (dates as ISO strings)
 */
export interface SerializedProfile {
  id: string;
  name: string;
  birthYear: number;
  birthMonth?: number;
  gender: 'male' | 'female';
  heightCm: number;
  ethnicity?: 'asian' | 'non-asian';
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Serialized measurement (dates as ISO strings)
 */
export interface SerializedMeasurement {
  id: string;
  userProfileId: string;
  timestamp: string;
  raw: {
    weightKg: number;
    impedanceOhm?: number;
    heartRateBpm?: number;
  };
  calculated: {
    bmi: number;
    bodyFatPercent: number;
    muscleMassKg: number;
    boneMassKg: number;
    bodyWaterPercent: number;
    visceralFatLevel: number;
    bmrKcal: number;
    proteinPercent: number;
    leanBodyMassKg: number;
    bodyScore: number;
  };
}

/**
 * Complete backup data structure
 */
export interface BackupData {
  metadata: BackupMetadata;
  profiles: SerializedProfile[];
  measurements: SerializedMeasurement[];
  config: ConfigExport;
}

/**
 * Backup validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Restore options
 */
export interface RestoreOptions {
  mode: 'merge' | 'replace';
  skipConfig?: boolean;
}

/**
 * Backup info summary
 */
export interface BackupInfo {
  version: string;
  createdAt: string;
  profileCount: number;
  measurementCount: number;
  hasConfig: boolean;
}

/**
 * Current backup format version
 */
const BACKUP_VERSION = '1.0.0';

/**
 * Application name for backup identification
 */
const APP_NAME = 'TheScale';

/**
 * Compare semantic versions
 */
function compareVersions(a: string, b: string): number {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);

  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const numA = partsA[i] || 0;
    const numB = partsB[i] || 0;

    if (numA < numB) return -1;
    if (numA > numB) return 1;
  }

  return 0;
}

/**
 * Serialize profile for backup (convert dates to ISO strings)
 */
function serializeProfile(profile: StoredUserProfile): SerializedProfile {
  return {
    ...profile,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  };
}

/**
 * Deserialize profile from backup (convert ISO strings to dates)
 */
function deserializeProfile(profile: SerializedProfile): StoredUserProfile {
  return {
    ...profile,
    createdAt: new Date(profile.createdAt),
    updatedAt: new Date(profile.updatedAt),
  };
}

/**
 * Serialize measurement for backup
 */
function serializeMeasurement(measurement: MeasurementResult): SerializedMeasurement {
  return {
    ...measurement,
    timestamp: measurement.timestamp.toISOString(),
  };
}

/**
 * Deserialize measurement from backup
 */
function deserializeMeasurement(measurement: SerializedMeasurement): MeasurementResult {
  return {
    ...measurement,
    timestamp: new Date(measurement.timestamp),
  };
}

/**
 * BackupService - handles complete application data backup and restore
 */
export class BackupService {
  constructor(
    private readonly profileRepository: ProfileRepository,
    private readonly measurementRepository: MeasurementRepository,
    private readonly configStore: AppConfigStore
  ) {}

  /**
   * Create a complete backup of all application data
   */
  async createBackup(): Promise<BackupData> {
    // Fetch all data
    const [profiles, measurements] = await Promise.all([
      this.profileRepository.getAll(),
      this.measurementRepository.getAll(),
    ]);

    // Get config
    const config = this.configStore.exportConfig();

    // Create backup
    const backup: BackupData = {
      metadata: {
        version: BACKUP_VERSION,
        appName: APP_NAME,
        createdAt: new Date().toISOString(),
        profileCount: profiles.length,
        measurementCount: measurements.length,
      },
      profiles: profiles.map(serializeProfile),
      measurements: measurements.map(serializeMeasurement),
      config,
    };

    return backup;
  }

  /**
   * Restore data from a backup
   */
  async restoreBackup(backup: BackupData, options: RestoreOptions = { mode: 'merge' }): Promise<void> {
    // Validate backup first
    const validation = this.validateBackup(backup);
    if (!validation.valid) {
      throw new Error(`Invalid backup: ${validation.errors.join(', ')}`);
    }

    // Check version compatibility
    if (compareVersions(backup.metadata.version, BACKUP_VERSION) > 0) {
      throw new Error(
        `Incompatible backup version: ${backup.metadata.version}. Current version is ${BACKUP_VERSION}`
      );
    }

    // In replace mode, clear existing data first
    if (options.mode === 'replace') {
      // Delete all measurements for all profiles
      const existingProfiles = await this.profileRepository.getAll();
      for (const profile of existingProfiles) {
        await this.measurementRepository.deleteAll(profile.id);
      }

      // Delete all profiles
      for (const profile of existingProfiles) {
        await this.profileRepository.delete(profile.id);
      }
    }

    // Restore profiles
    for (const serializedProfile of backup.profiles) {
      const profile = deserializeProfile(serializedProfile);
      await this.profileRepository.save(profile);
    }

    // Restore measurements
    for (const serializedMeasurement of backup.measurements) {
      const measurement = deserializeMeasurement(serializedMeasurement);
      await this.measurementRepository.save(measurement);
    }

    // Restore config (unless skipped)
    if (!options.skipConfig) {
      this.configStore.importConfig(backup.config);
    }
  }

  /**
   * Validate backup structure and compatibility
   */
  validateBackup(backup: unknown): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Type guard
    const data = backup as Partial<BackupData>;

    // Check metadata
    if (!data.metadata) {
      errors.push('Missing metadata');
    } else {
      if (!data.metadata.version) {
        errors.push('Missing version in metadata');
      } else if (compareVersions(data.metadata.version, BACKUP_VERSION) > 0) {
        errors.push(`Incompatible backup version: ${data.metadata.version}`);
      }

      if (!data.metadata.appName) {
        warnings.push('Missing appName in metadata');
      } else if (data.metadata.appName !== APP_NAME) {
        warnings.push(`Backup from different app: ${data.metadata.appName}`);
      }
    }

    // Check profiles
    if (!data.profiles) {
      errors.push('Missing profiles');
    } else if (!Array.isArray(data.profiles)) {
      errors.push('Profiles must be an array');
    }

    // Check measurements
    if (!data.measurements) {
      errors.push('Missing measurements');
    } else if (!Array.isArray(data.measurements)) {
      errors.push('Measurements must be an array');
    }

    // Check config
    if (!data.config) {
      warnings.push('Missing config (will use current settings)');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Get summary information about a backup
   */
  getBackupInfo(backup: BackupData): BackupInfo {
    return {
      version: backup.metadata.version,
      createdAt: backup.metadata.createdAt,
      profileCount: backup.profiles.length,
      measurementCount: backup.measurements.length,
      hasConfig: !!backup.config,
    };
  }
}

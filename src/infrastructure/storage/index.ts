/**
 * Storage Infrastructure Module
 *
 * Exports all storage-related implementations.
 *
 * @module infrastructure/storage
 */

// File utilities
export {
  ensureDir,
  readJSON,
  writeJSON,
  atomicWriteJSON,
  deleteFile,
  fileExists,
  listFiles,
  readJSONOrDefault,
  StorageError,
} from './file-utils';

// Repository implementations
export { JsonMeasurementRepository } from './JsonMeasurementRepository';
export { JsonProfileRepository } from './JsonProfileRepository';

// Schemas for validation
export {
  StoredMeasurementSchema,
  StoredUserProfileSchema,
  RawMeasurementSchema,
  CalculatedMetricsSchema,
  UserProfileSchema,
  toStoredMeasurement,
  fromStoredMeasurement,
  toStoredProfile,
  fromStoredProfile,
} from './schemas';

// Re-export types
export type {
  StoredMeasurement,
  StoredProfile,
} from './schemas';

// Config store (electron-store based)
export {
  AppConfigStore,
  getAppConfigStore,
  type BLEConfig,
  type AppSettings,
  type ConfigExport,
} from './AppConfigStore';

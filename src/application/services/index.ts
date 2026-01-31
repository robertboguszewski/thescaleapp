/**
 * Application Services Module
 *
 * Exports all application services that orchestrate business operations.
 *
 * @module application/services
 */

export {
  MeasurementService,
  ProfileNotFoundError as MeasurementProfileNotFoundError,
  MeasurementReadError,
  MeasurementNotFoundError,
  GUEST_PROFILE_ID,
} from './MeasurementService';

export {
  ProfileService,
  ProfileNotFoundError,
  ValidationError,
  type CreateProfileInput,
  type UpdateProfileInput,
} from './ProfileService';

export {
  ReportService,
  NoMeasurementsError,
  ProfileNotFoundError as ReportProfileNotFoundError,
  type HealthReport,
  type MetricTrends,
  type ReportSummary,
} from './ReportService';

export { ProfileMatchingService } from './ProfileMatchingService';

export {
  BackupService,
  type BackupData,
  type BackupMetadata,
  type BackupInfo,
  type RestoreOptions,
  type ValidationResult,
} from './BackupService';

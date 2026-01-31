/**
 * Stores Index
 *
 * Central export for all Zustand stores.
 *
 * @module presentation/stores
 */

export { useAppStore, createNotificationHelpers } from './appStore';
export type { Tab, NotificationType, Notification } from './appStore';

export {
  useMeasurementStore,
  useLatestMeasurement,
  usePaginatedMeasurements,
  useFilteredMeasurements,
  useSelectedMeasurement,
} from './measurementStore';
export type { DateRange, MetricType, CurrentMeasurement } from './measurementStore';

export {
  useProfileStore,
  useCurrentProfile,
  useEditingProfile,
  useDefaultProfile,
  validateProfileData,
  hasValidationErrors,
} from './profileStore';
export type { ProfileFormData, ProfileValidationErrors } from './profileStore';

export {
  useBLEStore,
  useIsConnected,
  useIsBusy,
  useHasError,
  useIsDeviceConfigured,
  useCanRetry,
  getStatusMessage,
  getStatusColor,
} from './bleStore';

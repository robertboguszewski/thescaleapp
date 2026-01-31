/**
 * Domain Errors
 *
 * Centralized error hierarchy for the domain layer.
 * All domain-specific errors extend DomainError base class.
 *
 * Benefits:
 * - Single source of truth for error definitions
 * - Consistent error codes across the application
 * - Type-safe error handling
 * - Easy serialization for IPC
 *
 * @module domain/errors
 */

/**
 * Base class for all domain errors.
 * All application-specific errors should extend this class.
 */
export abstract class DomainError extends Error {
  /**
   * Unique error code for programmatic handling.
   * Used for IPC error mapping and error handling decisions.
   */
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    // Maintains proper stack trace in V8 environments
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

// ====== Profile Errors ======

/**
 * Error thrown when a profile cannot be found by ID.
 */
export class ProfileNotFoundError extends DomainError {
  readonly code = 'PROFILE_NOT_FOUND';

  constructor(public readonly profileId: string) {
    super(`Profile not found: ${profileId}`);
  }
}

// ====== Measurement Errors ======

/**
 * Error thrown when a measurement cannot be found by ID.
 */
export class MeasurementNotFoundError extends DomainError {
  readonly code = 'MEASUREMENT_NOT_FOUND';

  constructor(public readonly measurementId: string) {
    super(`Measurement not found: ${measurementId}`);
  }
}

/**
 * Error thrown when reading a measurement from the scale fails.
 */
export class MeasurementReadError extends DomainError {
  readonly code = 'MEASUREMENT_READ_ERROR';

  constructor(
    message: string,
    public readonly cause?: Error
  ) {
    super(message);
  }
}

/**
 * Error thrown when no measurements exist for a profile.
 */
export class NoMeasurementsError extends DomainError {
  readonly code = 'NO_MEASUREMENTS';

  constructor(public readonly profileId: string) {
    super(`No measurements found for profile: ${profileId}`);
  }
}

// ====== Validation Errors ======

/**
 * Error thrown when validation fails.
 */
export class ValidationError extends DomainError {
  readonly code = 'VALIDATION_ERROR';

  constructor(
    message: string,
    public readonly field: string,
    public readonly constraint?: string
  ) {
    super(message);
  }
}

// ====== BLE Errors ======

/**
 * Possible BLE error codes.
 */
export type BLEErrorCode =
  | 'BLUETOOTH_OFF'
  | 'DEVICE_NOT_FOUND'
  | 'CONNECTION_TIMEOUT'
  | 'READ_FAILED'
  | 'DECRYPTION_FAILED'
  | 'INVALID_DATA'
  | 'BLE_ERROR';

/**
 * Error thrown for BLE-related failures.
 */
export class BLEError extends DomainError {
  readonly code: BLEErrorCode;

  constructor(
    code: BLEErrorCode,
    message: string,
    public readonly recoverable: boolean = false,
    public readonly suggestion?: string
  ) {
    super(message);
    this.code = code;
  }
}

// ====== Storage Errors ======

/**
 * Possible storage error codes.
 */
export type StorageErrorCode =
  | 'READ_ERROR'
  | 'WRITE_ERROR'
  | 'DELETE_ERROR'
  | 'DIR_ERROR'
  | 'PARSE_ERROR'
  | 'VALIDATION_ERROR';

/**
 * Error thrown for storage/persistence failures.
 */
export class StorageError extends DomainError {
  readonly code: StorageErrorCode;

  constructor(
    code: StorageErrorCode,
    message: string,
    public readonly cause?: Error,
    public readonly filePath?: string
  ) {
    super(message);
    this.code = code;
  }
}

// ====== Type Guards and Utilities ======

/**
 * Type guard to check if an error is a DomainError.
 *
 * @param error - Value to check
 * @returns True if the error is a DomainError instance
 */
export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}

/**
 * Get the error code from any error.
 * Returns 'UNKNOWN_ERROR' for non-DomainError values.
 *
 * @param error - Error to get code from
 * @returns Error code string
 */
export function getErrorCode(error: unknown): string {
  if (isDomainError(error)) {
    return error.code;
  }
  return 'UNKNOWN_ERROR';
}

/**
 * Serialize a DomainError for IPC transmission.
 *
 * @param error - Domain error to serialize
 * @returns Serializable error object
 */
export function serializeDomainError(error: DomainError): {
  code: string;
  message: string;
  name: string;
  details?: Record<string, unknown>;
} {
  const serialized: {
    code: string;
    message: string;
    name: string;
    details?: Record<string, unknown>;
  } = {
    code: error.code,
    message: error.message,
    name: error.name,
  };

  // Add specific error details
  if (error instanceof ProfileNotFoundError) {
    serialized.details = { profileId: error.profileId };
  } else if (error instanceof MeasurementNotFoundError) {
    serialized.details = { measurementId: error.measurementId };
  } else if (error instanceof NoMeasurementsError) {
    serialized.details = { profileId: error.profileId };
  } else if (error instanceof ValidationError) {
    serialized.details = { field: error.field, constraint: error.constraint };
  } else if (error instanceof BLEError) {
    serialized.details = { recoverable: error.recoverable, suggestion: error.suggestion };
  } else if (error instanceof StorageError) {
    serialized.details = { filePath: error.filePath };
  }

  return serialized;
}

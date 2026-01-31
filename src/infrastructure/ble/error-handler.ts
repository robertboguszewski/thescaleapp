/**
 * BLE Error Handler
 * Predefined errors with recovery suggestions for BLE operations
 *
 * All error messages and suggestions are in Polish as per project requirements.
 *
 * @module infrastructure/ble/error-handler
 */

import { BLEError, BLEErrorCode } from '../../application/ports/BLEPort';

/**
 * Predefined BLE errors with recovery suggestions
 * Each error includes:
 * - code: Programmatic identifier
 * - message: Short error description
 * - recoverable: Whether retry might help
 * - suggestion: User-friendly steps to resolve
 */
export const BLE_ERRORS: Record<BLEErrorCode, BLEError> = {
  BLUETOOTH_OFF: {
    code: 'BLUETOOTH_OFF',
    message: 'ble:errors.BLUETOOTH_OFF.message',
    recoverable: true,
    suggestion: 'ble:errors.BLUETOOTH_OFF.suggestion'
  },
  DEVICE_NOT_FOUND: {
    code: 'DEVICE_NOT_FOUND',
    message: 'ble:errors.DEVICE_NOT_FOUND.message',
    recoverable: true,
    suggestion: 'ble:errors.DEVICE_NOT_FOUND.suggestion'
  },
  CONNECTION_TIMEOUT: {
    code: 'CONNECTION_TIMEOUT',
    message: 'ble:errors.CONNECTION_TIMEOUT.message',
    recoverable: true,
    suggestion: 'ble:errors.CONNECTION_TIMEOUT.suggestion'
  },
  READ_FAILED: {
    code: 'READ_FAILED',
    message: 'ble:errors.READ_FAILED.message',
    recoverable: true,
    suggestion: 'ble:errors.READ_FAILED.suggestion'
  },
  DECRYPTION_FAILED: {
    code: 'DECRYPTION_FAILED',
    message: 'ble:errors.DECRYPTION_FAILED.message',
    recoverable: false,
    suggestion: 'ble:errors.DECRYPTION_FAILED.suggestion'
  },
  INVALID_DATA: {
    code: 'INVALID_DATA',
    message: 'ble:errors.INVALID_DATA.message',
    recoverable: true,
    suggestion: 'ble:errors.INVALID_DATA.suggestion'
  }
};

/**
 * Create a BLE error from an error code
 * @param code - Error code
 * @returns Structured BLE error
 */
export function createBLEError(code: BLEErrorCode): BLEError {
  return { ...BLE_ERRORS[code] };
}

/**
 * Create a custom BLE error with a specific message
 * @param code - Error code
 * @param customMessage - Custom error message
 * @returns Structured BLE error with custom message
 */
export function createBLEErrorWithMessage(
  code: BLEErrorCode,
  customMessage: string
): BLEError {
  return {
    ...BLE_ERRORS[code],
    message: customMessage
  };
}

/**
 * Type guard to check if an error is a BLEError
 * @param error - Unknown error
 * @returns True if error is a BLEError
 */
export function isBLEError(error: unknown): error is BLEError {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const obj = error as Record<string, unknown>;
  return (
    typeof obj.code === 'string' &&
    typeof obj.message === 'string' &&
    typeof obj.recoverable === 'boolean' &&
    typeof obj.suggestion === 'string'
  );
}

/**
 * Convert a native error to a BLE error
 * @param error - Native error or unknown
 * @param defaultCode - Default error code if mapping fails
 * @returns Structured BLE error
 */
export function toBLEError(
  error: unknown,
  defaultCode: BLEErrorCode = 'READ_FAILED'
): BLEError {
  if (isBLEError(error)) {
    return error;
  }

  // Map common native errors to BLE errors
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes('bluetooth') && message.includes('off')) {
      return createBLEError('BLUETOOTH_OFF');
    }
    if (message.includes('not found') || message.includes('no device')) {
      return createBLEError('DEVICE_NOT_FOUND');
    }
    if (message.includes('timeout')) {
      return createBLEError('CONNECTION_TIMEOUT');
    }
    if (message.includes('decrypt')) {
      return createBLEError('DECRYPTION_FAILED');
    }

    return createBLEErrorWithMessage(defaultCode, error.message);
  }

  return createBLEError(defaultCode);
}

/**
 * Format BLE error for logging
 * @param error - BLE error
 * @returns Formatted string for logging
 */
export function formatBLEErrorForLog(error: BLEError): string {
  return `[BLE Error] ${error.code}: ${error.message} (recoverable: ${error.recoverable})`;
}

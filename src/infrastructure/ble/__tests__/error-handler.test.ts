/**
 * Tests for BLE Error Handler
 * @module infrastructure/ble/__tests__/error-handler.test
 */

import { describe, it, expect } from 'vitest';
import {
  BLE_ERRORS,
  createBLEError,
  createBLEErrorWithMessage,
  isBLEError,
  toBLEError,
  formatBLEErrorForLog
} from '../error-handler';
import { BLEErrorCode } from '../../../application/ports/BLEPort';

describe('BLE Error Handler', () => {
  describe('BLE_ERRORS', () => {
    it('should have all required error codes defined', () => {
      const expectedCodes: BLEErrorCode[] = [
        'BLUETOOTH_OFF',
        'DEVICE_NOT_FOUND',
        'CONNECTION_TIMEOUT',
        'READ_FAILED',
        'DECRYPTION_FAILED',
        'INVALID_DATA'
      ];

      expectedCodes.forEach(code => {
        expect(BLE_ERRORS[code]).toBeDefined();
        expect(BLE_ERRORS[code].code).toBe(code);
      });
    });

    it('should have valid structure for all errors', () => {
      Object.values(BLE_ERRORS).forEach(error => {
        expect(typeof error.code).toBe('string');
        expect(typeof error.message).toBe('string');
        expect(typeof error.recoverable).toBe('boolean');
        expect(typeof error.suggestion).toBe('string');
        expect(error.message.length).toBeGreaterThan(0);
        expect(error.suggestion.length).toBeGreaterThan(0);
      });
    });

    it('should mark DECRYPTION_FAILED as non-recoverable', () => {
      expect(BLE_ERRORS.DECRYPTION_FAILED.recoverable).toBe(false);
    });

    it('should mark transient errors as recoverable', () => {
      expect(BLE_ERRORS.BLUETOOTH_OFF.recoverable).toBe(true);
      expect(BLE_ERRORS.DEVICE_NOT_FOUND.recoverable).toBe(true);
      expect(BLE_ERRORS.CONNECTION_TIMEOUT.recoverable).toBe(true);
      expect(BLE_ERRORS.READ_FAILED.recoverable).toBe(true);
      expect(BLE_ERRORS.INVALID_DATA.recoverable).toBe(true);
    });
  });

  describe('createBLEError', () => {
    it('should create error from code', () => {
      const error = createBLEError('BLUETOOTH_OFF');

      expect(error.code).toBe('BLUETOOTH_OFF');
      expect(error.message).toBe(BLE_ERRORS.BLUETOOTH_OFF.message);
      expect(error.recoverable).toBe(BLE_ERRORS.BLUETOOTH_OFF.recoverable);
      expect(error.suggestion).toBe(BLE_ERRORS.BLUETOOTH_OFF.suggestion);
    });

    it('should create a copy, not reference', () => {
      const error = createBLEError('READ_FAILED');
      error.message = 'Modified';

      expect(BLE_ERRORS.READ_FAILED.message).not.toBe('Modified');
    });
  });

  describe('createBLEErrorWithMessage', () => {
    it('should create error with custom message', () => {
      const customMessage = 'Custom error description';
      const error = createBLEErrorWithMessage('READ_FAILED', customMessage);

      expect(error.code).toBe('READ_FAILED');
      expect(error.message).toBe(customMessage);
      expect(error.recoverable).toBe(BLE_ERRORS.READ_FAILED.recoverable);
      expect(error.suggestion).toBe(BLE_ERRORS.READ_FAILED.suggestion);
    });
  });

  describe('isBLEError', () => {
    it('should return true for valid BLE error', () => {
      const error = createBLEError('DEVICE_NOT_FOUND');
      expect(isBLEError(error)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isBLEError(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isBLEError(undefined)).toBe(false);
    });

    it('should return false for native Error', () => {
      expect(isBLEError(new Error('test'))).toBe(false);
    });

    it('should return false for incomplete object', () => {
      expect(isBLEError({ code: 'TEST' })).toBe(false);
      expect(isBLEError({ code: 'TEST', message: 'msg' })).toBe(false);
      expect(isBLEError({ code: 'TEST', message: 'msg', recoverable: true })).toBe(false);
    });

    it('should return true for manually constructed valid object', () => {
      const manualError = {
        code: 'CUSTOM',
        message: 'Custom error',
        recoverable: true,
        suggestion: 'Try again'
      };
      expect(isBLEError(manualError)).toBe(true);
    });
  });

  describe('toBLEError', () => {
    it('should pass through existing BLE error', () => {
      const original = createBLEError('CONNECTION_TIMEOUT');
      const result = toBLEError(original);

      expect(result).toEqual(original);
    });

    it('should convert Error with "bluetooth off" message', () => {
      const error = new Error('Bluetooth is off');
      const result = toBLEError(error);

      expect(result.code).toBe('BLUETOOTH_OFF');
    });

    it('should convert Error with "not found" message', () => {
      const error = new Error('Device not found');
      const result = toBLEError(error);

      expect(result.code).toBe('DEVICE_NOT_FOUND');
    });

    it('should convert Error with "no device" message', () => {
      const error = new Error('No device available');
      const result = toBLEError(error);

      expect(result.code).toBe('DEVICE_NOT_FOUND');
    });

    it('should convert Error with "timeout" message', () => {
      const error = new Error('Connection timeout occurred');
      const result = toBLEError(error);

      expect(result.code).toBe('CONNECTION_TIMEOUT');
    });

    it('should convert Error with "decrypt" message', () => {
      const error = new Error('Failed to decrypt payload');
      const result = toBLEError(error);

      expect(result.code).toBe('DECRYPTION_FAILED');
    });

    it('should use default code for unknown errors', () => {
      const error = new Error('Unknown error occurred');
      const result = toBLEError(error);

      expect(result.code).toBe('READ_FAILED');
      expect(result.message).toBe('Unknown error occurred');
    });

    it('should use custom default code', () => {
      const error = new Error('Unknown error');
      const result = toBLEError(error, 'INVALID_DATA');

      expect(result.code).toBe('INVALID_DATA');
    });

    it('should handle non-Error objects', () => {
      const result = toBLEError('string error');

      expect(result.code).toBe('READ_FAILED');
    });

    it('should handle numbers', () => {
      const result = toBLEError(42);

      expect(result.code).toBe('READ_FAILED');
    });
  });

  describe('formatBLEErrorForLog', () => {
    it('should format error for logging', () => {
      const error = createBLEError('DEVICE_NOT_FOUND');
      const formatted = formatBLEErrorForLog(error);

      expect(formatted).toContain('[BLE Error]');
      expect(formatted).toContain('DEVICE_NOT_FOUND');
      expect(formatted).toContain(error.message);
      expect(formatted).toContain('recoverable: true');
    });

    it('should include recoverable status', () => {
      const recoverableError = createBLEError('READ_FAILED');
      const nonRecoverableError = createBLEError('DECRYPTION_FAILED');

      expect(formatBLEErrorForLog(recoverableError)).toContain('recoverable: true');
      expect(formatBLEErrorForLog(nonRecoverableError)).toContain('recoverable: false');
    });
  });
});

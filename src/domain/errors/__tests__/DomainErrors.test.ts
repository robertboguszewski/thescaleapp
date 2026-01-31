/**
 * Domain Errors Tests
 *
 * TDD tests for the centralized domain error hierarchy.
 * Tests written BEFORE implementation.
 *
 * @module domain/errors/__tests__/DomainErrors.test
 */

import { describe, it, expect } from 'vitest';
import {
  DomainError,
  ProfileNotFoundError,
  MeasurementNotFoundError,
  MeasurementReadError,
  NoMeasurementsError,
  ValidationError,
  BLEError,
  StorageError,
  isDomainError,
  getErrorCode,
} from '../index';

describe('DomainError', () => {
  describe('base class', () => {
    it('should be an instance of Error', () => {
      class TestError extends DomainError {
        readonly code = 'TEST_ERROR';
      }
      const error = new TestError('test message');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(DomainError);
    });

    it('should have a code property', () => {
      class TestError extends DomainError {
        readonly code = 'TEST_ERROR';
      }
      const error = new TestError('test message');

      expect(error.code).toBe('TEST_ERROR');
    });

    it('should preserve the error message', () => {
      class TestError extends DomainError {
        readonly code = 'TEST_ERROR';
      }
      const error = new TestError('custom message');

      expect(error.message).toBe('custom message');
    });

    it('should set the correct name', () => {
      class TestError extends DomainError {
        readonly code = 'TEST_ERROR';
      }
      const error = new TestError('test');

      expect(error.name).toBe('TestError');
    });
  });
});

describe('ProfileNotFoundError', () => {
  it('should be a DomainError', () => {
    const error = new ProfileNotFoundError('profile-123');

    expect(error).toBeInstanceOf(DomainError);
    expect(error).toBeInstanceOf(ProfileNotFoundError);
  });

  it('should have PROFILE_NOT_FOUND code', () => {
    const error = new ProfileNotFoundError('profile-123');

    expect(error.code).toBe('PROFILE_NOT_FOUND');
  });

  it('should include profile ID in message', () => {
    const error = new ProfileNotFoundError('profile-123');

    expect(error.message).toContain('profile-123');
  });

  it('should expose the profile ID', () => {
    const error = new ProfileNotFoundError('profile-123');

    expect(error.profileId).toBe('profile-123');
  });

  it('should set correct name', () => {
    const error = new ProfileNotFoundError('profile-123');

    expect(error.name).toBe('ProfileNotFoundError');
  });
});

describe('MeasurementNotFoundError', () => {
  it('should be a DomainError', () => {
    const error = new MeasurementNotFoundError('measurement-456');

    expect(error).toBeInstanceOf(DomainError);
  });

  it('should have MEASUREMENT_NOT_FOUND code', () => {
    const error = new MeasurementNotFoundError('measurement-456');

    expect(error.code).toBe('MEASUREMENT_NOT_FOUND');
  });

  it('should include measurement ID in message', () => {
    const error = new MeasurementNotFoundError('measurement-456');

    expect(error.message).toContain('measurement-456');
  });

  it('should expose the measurement ID', () => {
    const error = new MeasurementNotFoundError('measurement-456');

    expect(error.measurementId).toBe('measurement-456');
  });
});

describe('MeasurementReadError', () => {
  it('should be a DomainError', () => {
    const error = new MeasurementReadError('Failed to read');

    expect(error).toBeInstanceOf(DomainError);
  });

  it('should have MEASUREMENT_READ_ERROR code', () => {
    const error = new MeasurementReadError('Failed to read');

    expect(error.code).toBe('MEASUREMENT_READ_ERROR');
  });

  it('should preserve the message', () => {
    const error = new MeasurementReadError('Custom read error');

    expect(error.message).toBe('Custom read error');
  });

  it('should support cause chaining', () => {
    const cause = new Error('Original error');
    const error = new MeasurementReadError('Failed to read', cause);

    expect(error.cause).toBe(cause);
  });

  it('should work without cause', () => {
    const error = new MeasurementReadError('Failed to read');

    expect(error.cause).toBeUndefined();
  });
});

describe('NoMeasurementsError', () => {
  it('should be a DomainError', () => {
    const error = new NoMeasurementsError('profile-789');

    expect(error).toBeInstanceOf(DomainError);
  });

  it('should have NO_MEASUREMENTS code', () => {
    const error = new NoMeasurementsError('profile-789');

    expect(error.code).toBe('NO_MEASUREMENTS');
  });

  it('should include profile ID in message', () => {
    const error = new NoMeasurementsError('profile-789');

    expect(error.message).toContain('profile-789');
  });

  it('should expose the profile ID', () => {
    const error = new NoMeasurementsError('profile-789');

    expect(error.profileId).toBe('profile-789');
  });
});

describe('ValidationError', () => {
  it('should be a DomainError', () => {
    const error = new ValidationError('Invalid value', 'email');

    expect(error).toBeInstanceOf(DomainError);
  });

  it('should have VALIDATION_ERROR code', () => {
    const error = new ValidationError('Invalid value', 'email');

    expect(error.code).toBe('VALIDATION_ERROR');
  });

  it('should expose the field name', () => {
    const error = new ValidationError('Invalid value', 'email');

    expect(error.field).toBe('email');
  });

  it('should preserve the message', () => {
    const error = new ValidationError('Email is required', 'email');

    expect(error.message).toBe('Email is required');
  });

  it('should work with multiple fields (constraint key)', () => {
    const error = new ValidationError('Age must be between 6 and 80', 'age', 'range');

    expect(error.field).toBe('age');
    expect(error.constraint).toBe('range');
  });
});

describe('BLEError', () => {
  it('should be a DomainError', () => {
    const error = new BLEError('BLUETOOTH_OFF', 'Bluetooth is off');

    expect(error).toBeInstanceOf(DomainError);
  });

  it('should use the provided BLE error code', () => {
    const error = new BLEError('DEVICE_NOT_FOUND', 'Device not found');

    expect(error.code).toBe('DEVICE_NOT_FOUND');
  });

  it('should support recoverable flag', () => {
    const error = new BLEError('CONNECTION_TIMEOUT', 'Timeout', true);

    expect(error.recoverable).toBe(true);
  });

  it('should support suggestion', () => {
    const error = new BLEError('BLUETOOTH_OFF', 'Bluetooth is off', true, 'Turn on Bluetooth');

    expect(error.suggestion).toBe('Turn on Bluetooth');
  });

  it('should default recoverable to false', () => {
    const error = new BLEError('DECRYPTION_FAILED', 'Decryption failed');

    expect(error.recoverable).toBe(false);
  });
});

describe('StorageError', () => {
  it('should be a DomainError', () => {
    const error = new StorageError('READ_ERROR', 'Failed to read file');

    expect(error).toBeInstanceOf(DomainError);
  });

  it('should use the provided storage error code', () => {
    const error = new StorageError('WRITE_ERROR', 'Failed to write');

    expect(error.code).toBe('WRITE_ERROR');
  });

  it('should support cause chaining', () => {
    const cause = new Error('ENOENT');
    const error = new StorageError('READ_ERROR', 'File not found', cause);

    expect(error.cause).toBe(cause);
  });

  it('should support file path', () => {
    const error = new StorageError('READ_ERROR', 'File not found', undefined, '/path/to/file.json');

    expect(error.filePath).toBe('/path/to/file.json');
  });
});

describe('isDomainError', () => {
  it('should return true for DomainError instances', () => {
    const error = new ProfileNotFoundError('profile-123');

    expect(isDomainError(error)).toBe(true);
  });

  it('should return false for regular Error instances', () => {
    const error = new Error('Regular error');

    expect(isDomainError(error)).toBe(false);
  });

  it('should return false for non-error values', () => {
    expect(isDomainError('string')).toBe(false);
    expect(isDomainError(null)).toBe(false);
    expect(isDomainError(undefined)).toBe(false);
    expect(isDomainError({})).toBe(false);
  });
});

describe('getErrorCode', () => {
  it('should return the code for DomainError', () => {
    const error = new ProfileNotFoundError('profile-123');

    expect(getErrorCode(error)).toBe('PROFILE_NOT_FOUND');
  });

  it('should return UNKNOWN_ERROR for regular Error', () => {
    const error = new Error('Regular error');

    expect(getErrorCode(error)).toBe('UNKNOWN_ERROR');
  });

  it('should return UNKNOWN_ERROR for non-error values', () => {
    expect(getErrorCode('string')).toBe('UNKNOWN_ERROR');
    expect(getErrorCode(null)).toBe('UNKNOWN_ERROR');
  });
});

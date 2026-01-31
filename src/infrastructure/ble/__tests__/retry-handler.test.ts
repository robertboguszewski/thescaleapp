/**
 * Tests for Retry Handler
 * @module infrastructure/ble/__tests__/retry-handler.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  withRetry,
  withConditionalRetry,
  calculateDelay,
  createRetryWrapper,
  isRetryableError,
  DEFAULT_RETRY_CONFIG,
  RetryConfig
} from '../retry-handler';

describe('Retry Handler', () => {
  describe('DEFAULT_RETRY_CONFIG', () => {
    it('should have sensible default values', () => {
      expect(DEFAULT_RETRY_CONFIG.maxAttempts).toBe(3);
      expect(DEFAULT_RETRY_CONFIG.baseDelayMs).toBe(1000);
      expect(DEFAULT_RETRY_CONFIG.maxDelayMs).toBe(10000);
      expect(DEFAULT_RETRY_CONFIG.backoffMultiplier).toBe(2);
    });
  });

  describe('calculateDelay', () => {
    it('should return base delay for first attempt', () => {
      const delay = calculateDelay(1, DEFAULT_RETRY_CONFIG);
      expect(delay).toBe(1000);
    });

    it('should double delay for second attempt', () => {
      const delay = calculateDelay(2, DEFAULT_RETRY_CONFIG);
      expect(delay).toBe(2000);
    });

    it('should quadruple delay for third attempt', () => {
      const delay = calculateDelay(3, DEFAULT_RETRY_CONFIG);
      expect(delay).toBe(4000);
    });

    it('should cap delay at maxDelayMs', () => {
      const config: RetryConfig = {
        maxAttempts: 10,
        baseDelayMs: 1000,
        maxDelayMs: 5000,
        backoffMultiplier: 2
      };

      const delay = calculateDelay(10, config);
      expect(delay).toBe(5000);
    });

    it('should work with custom multiplier', () => {
      const config: RetryConfig = {
        maxAttempts: 3,
        baseDelayMs: 100,
        maxDelayMs: 10000,
        backoffMultiplier: 3
      };

      expect(calculateDelay(1, config)).toBe(100);
      expect(calculateDelay(2, config)).toBe(300);
      expect(calculateDelay(3, config)).toBe(900);
    });
  });

  describe('withRetry', () => {
    // Use minimal delays for tests
    const fastConfig: RetryConfig = {
      maxAttempts: 3,
      baseDelayMs: 1,
      maxDelayMs: 10,
      backoffMultiplier: 2
    };

    it('should return result on first success', async () => {
      const operation = vi.fn().mockResolvedValue('success');

      const result = await withRetry(operation, undefined, fastConfig);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and succeed', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockResolvedValue('success');

      const result = await withRetry(operation, undefined, fastConfig);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should throw after max attempts', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Always fails'));

      await expect(withRetry(operation, undefined, fastConfig)).rejects.toThrow('Always fails');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should call onRetry callback on each retry', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValue('success');

      const onRetry = vi.fn();

      await withRetry(operation, onRetry, fastConfig);

      expect(onRetry).toHaveBeenCalledTimes(2);
      expect(onRetry).toHaveBeenNthCalledWith(1, 1, expect.any(Error), expect.any(Number));
      expect(onRetry).toHaveBeenNthCalledWith(2, 2, expect.any(Error), expect.any(Number));
    });

    it('should use custom config', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Fail'));

      const config: RetryConfig = {
        maxAttempts: 5,
        baseDelayMs: 1,
        maxDelayMs: 10,
        backoffMultiplier: 2
      };

      await expect(withRetry(operation, undefined, config)).rejects.toThrow();
      expect(operation).toHaveBeenCalledTimes(5);
    });

    it('should convert non-Error throws to Error', async () => {
      const operation = vi.fn().mockRejectedValue('string error');
      const onRetry = vi.fn();

      await expect(withRetry(operation, onRetry, fastConfig)).rejects.toThrow();

      // Check that the callback received an Error instance
      if (onRetry.mock.calls.length > 0) {
        expect(onRetry.mock.calls[0][1]).toBeInstanceOf(Error);
      }
    });
  });

  describe('createRetryWrapper', () => {
    const fastConfig: RetryConfig = {
      maxAttempts: 2,
      baseDelayMs: 1,
      maxDelayMs: 10,
      backoffMultiplier: 2
    };

    it('should create wrapper with custom config', async () => {
      const retry = createRetryWrapper(fastConfig);
      const operation = vi.fn().mockResolvedValue('success');

      const result = await retry(operation);

      expect(result).toBe('success');
    });

    it('should use default onRetry from wrapper', async () => {
      const defaultOnRetry = vi.fn();
      const retry = createRetryWrapper(fastConfig, defaultOnRetry);

      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('Fail'))
        .mockResolvedValue('success');

      await retry(operation);

      expect(defaultOnRetry).toHaveBeenCalled();
    });

    it('should allow operation-specific onRetry', async () => {
      const defaultOnRetry = vi.fn();
      const operationOnRetry = vi.fn();
      const retry = createRetryWrapper(fastConfig, defaultOnRetry);

      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('Fail'))
        .mockResolvedValue('success');

      await retry(operation, operationOnRetry);

      expect(operationOnRetry).toHaveBeenCalled();
      expect(defaultOnRetry).not.toHaveBeenCalled();
    });
  });

  describe('isRetryableError', () => {
    it('should return true for timeout errors', () => {
      expect(isRetryableError(new Error('Connection timeout'))).toBe(true);
      expect(isRetryableError(new Error('Request timeout occurred'))).toBe(true);
    });

    it('should return true for connection errors', () => {
      expect(isRetryableError(new Error('Connection failed'))).toBe(true);
      expect(isRetryableError(new Error('Lost connection'))).toBe(true);
    });

    it('should return true for network errors', () => {
      expect(isRetryableError(new Error('Network error'))).toBe(true);
    });

    it('should return true for temporary errors', () => {
      expect(isRetryableError(new Error('Temporary failure'))).toBe(true);
    });

    it('should return true for busy errors', () => {
      expect(isRetryableError(new Error('Device busy'))).toBe(true);
    });

    it('should return true for "try again" errors', () => {
      expect(isRetryableError(new Error('Please try again'))).toBe(true);
    });

    it('should return true for unavailable errors', () => {
      expect(isRetryableError(new Error('Service unavailable'))).toBe(true);
    });

    it('should return false for other errors', () => {
      expect(isRetryableError(new Error('Invalid input'))).toBe(false);
      expect(isRetryableError(new Error('Permission denied'))).toBe(false);
      expect(isRetryableError(new Error('Not found'))).toBe(false);
    });
  });

  describe('withConditionalRetry', () => {
    const fastConfig: RetryConfig = {
      maxAttempts: 3,
      baseDelayMs: 1,
      maxDelayMs: 10,
      backoffMultiplier: 2
    };

    it('should retry only retryable errors', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('Connection failed'))
        .mockResolvedValue('success');

      const result = await withConditionalRetry(operation, isRetryableError, undefined, fastConfig);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should throw immediately for non-retryable errors', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Invalid key'));

      await expect(
        withConditionalRetry(operation, isRetryableError, undefined, fastConfig)
      ).rejects.toThrow('Invalid key');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should use custom shouldRetry function', async () => {
      const shouldRetry = (error: Error) => error.message.includes('retry me');

      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('retry me please'))
        .mockResolvedValue('success');

      const result = await withConditionalRetry(operation, shouldRetry, undefined, fastConfig);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should throw immediately with custom shouldRetry returning false', async () => {
      const shouldRetry = () => false;

      const operation = vi.fn().mockRejectedValue(new Error('Any error'));

      await expect(
        withConditionalRetry(operation, shouldRetry, undefined, fastConfig)
      ).rejects.toThrow('Any error');
      expect(operation).toHaveBeenCalledTimes(1);
    });
  });
});

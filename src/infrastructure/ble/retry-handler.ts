/**
 * Retry Handler with Exponential Backoff
 * Provides retry logic for BLE operations that may fail transiently
 *
 * @module infrastructure/ble/retry-handler
 */

/**
 * Configuration for retry behavior
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxAttempts: number;
  /** Initial delay between retries in milliseconds */
  baseDelayMs: number;
  /** Maximum delay between retries in milliseconds */
  maxDelayMs: number;
  /** Multiplier for exponential backoff */
  backoffMultiplier: number;
}

/**
 * Default retry configuration
 * - 3 attempts total
 * - Starting at 1 second delay
 * - Max 10 seconds delay
 * - Doubles each time
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2
};

/**
 * Callback invoked on each retry attempt
 * @param attempt - Current attempt number (1-based)
 * @param error - Error that caused the retry
 * @param nextDelayMs - Delay before next attempt
 */
export type RetryCallback = (
  attempt: number,
  error: Error,
  nextDelayMs: number
) => void;

/**
 * Sleep for a specified duration
 * @param ms - Duration in milliseconds
 * @returns Promise that resolves after the duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate delay for a specific attempt using exponential backoff
 * @param attempt - Current attempt number (1-based)
 * @param config - Retry configuration
 * @returns Delay in milliseconds
 */
export function calculateDelay(attempt: number, config: RetryConfig): number {
  const delay = config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt - 1);
  return Math.min(delay, config.maxDelayMs);
}

/**
 * Execute an operation with retry logic and exponential backoff
 *
 * @typeParam T - Return type of the operation
 * @param operation - Async function to execute
 * @param onRetry - Optional callback invoked on each retry
 * @param config - Retry configuration (defaults to DEFAULT_RETRY_CONFIG)
 * @returns Result of the operation
 * @throws The last error if all attempts fail
 *
 * @example
 * ```typescript
 * const result = await withRetry(
 *   () => blePort.connect(mac, key),
 *   (attempt, error, delay) => {
 *     console.log(`Attempt ${attempt} failed, retrying in ${delay}ms`);
 *   }
 * );
 * ```
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  onRetry?: RetryCallback,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<T> {
  let lastError: Error = new Error('No attempts made');

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // If this was the last attempt, throw immediately
      if (attempt === config.maxAttempts) {
        throw lastError;
      }

      // Calculate delay for next attempt
      const delay = calculateDelay(attempt, config);

      // Notify callback about retry
      onRetry?.(attempt, lastError, delay);

      // Wait before next attempt
      await sleep(delay);
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError;
}

/**
 * Create a retry wrapper with pre-configured settings
 *
 * @param config - Retry configuration
 * @param onRetry - Optional default retry callback
 * @returns Function that wraps operations with retry logic
 *
 * @example
 * ```typescript
 * const retryBLE = createRetryWrapper({
 *   maxAttempts: 5,
 *   baseDelayMs: 500,
 *   maxDelayMs: 5000,
 *   backoffMultiplier: 2
 * });
 *
 * const result = await retryBLE(() => blePort.scan());
 * ```
 */
export function createRetryWrapper(
  config: RetryConfig,
  onRetry?: RetryCallback
): <T>(operation: () => Promise<T>, operationOnRetry?: RetryCallback) => Promise<T> {
  return <T>(
    operation: () => Promise<T>,
    operationOnRetry?: RetryCallback
  ): Promise<T> => {
    return withRetry(operation, operationOnRetry ?? onRetry, config);
  };
}

/**
 * Check if an error is likely to be resolved by retrying
 * @param error - Error to check
 * @returns True if retry might help
 */
export function isRetryableError(error: Error): boolean {
  const message = error.message.toLowerCase();
  const retryablePatterns = [
    'timeout',
    'connection',
    'network',
    'busy',
    'temporary',
    'try again',
    'unavailable'
  ];

  return retryablePatterns.some(pattern => message.includes(pattern));
}

/**
 * Execute operation with conditional retry based on error type
 *
 * @typeParam T - Return type of the operation
 * @param operation - Async function to execute
 * @param shouldRetry - Function to determine if error is retryable
 * @param onRetry - Optional callback invoked on each retry
 * @param config - Retry configuration
 * @returns Result of the operation
 * @throws The last error if all attempts fail or error is not retryable
 */
export async function withConditionalRetry<T>(
  operation: () => Promise<T>,
  shouldRetry: (error: Error) => boolean = isRetryableError,
  onRetry?: RetryCallback,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<T> {
  let lastError: Error = new Error('No attempts made');

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // If error is not retryable, throw immediately
      if (!shouldRetry(lastError)) {
        throw lastError;
      }

      // If this was the last attempt, throw
      if (attempt === config.maxAttempts) {
        throw lastError;
      }

      const delay = calculateDelay(attempt, config);
      onRetry?.(attempt, lastError, delay);
      await sleep(delay);
    }
  }

  throw lastError;
}

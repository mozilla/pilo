/**
 * Configuration for navigation retry behavior.
 * See NavigationTimeoutException in errors.ts for the error thrown on timeout.
 */
export interface NavigationRetryConfig {
  /** Base timeout in milliseconds (default: 15000) */
  baseTimeoutMs: number;
  /** Maximum timeout in milliseconds to prevent runaway values (default: 60000) */
  maxTimeoutMs: number;
  /** Maximum total attempts including initial (default: 3, meaning 15s → 30s → 60s) */
  maxAttempts: number;
  /** Timeout multiplier for each subsequent attempt (default: 2) */
  timeoutMultiplier: number;
  /** Callback for retry events */
  onRetry?: (attempt: number, error: Error, nextTimeoutMs: number) => void;
}

/**
 * Default navigation retry configuration
 */
export const DEFAULT_NAVIGATION_RETRY_CONFIG: NavigationRetryConfig = {
  baseTimeoutMs: 15000,
  maxTimeoutMs: 60000,
  maxAttempts: 3,
  timeoutMultiplier: 2,
};

/**
 * Calculate timeout for a given retry attempt.
 * Uses exponential backoff: base * multiplier^(attempt-1), capped at maxTimeoutMs.
 *
 * With defaults (base: 15s, multiplier: 2, max: 60s):
 * - Attempt 1: 15,000ms
 * - Attempt 2: 30,000ms
 * - Attempt 3: 60,000ms (capped)
 */
export function calculateTimeout(attempt: number, config: NavigationRetryConfig): number {
  const calculated = Math.round(
    config.baseTimeoutMs * Math.pow(config.timeoutMultiplier, attempt - 1),
  );
  return Math.min(calculated, config.maxTimeoutMs);
}

/**
 * Configuration for navigation retry behavior.
 * See NavigationTimeoutException in errors.ts for the error thrown on timeout.
 */
export interface NavigationRetryConfig {
  /** Base timeout in milliseconds (default: 30000) */
  baseTimeoutMs: number;
  /** Maximum timeout in milliseconds to prevent runaway values (default: 120000) */
  maxTimeoutMs: number;
  /** Maximum total attempts including initial (default: 3, meaning 30s → 60s → 120s) */
  maxAttempts: number;
  /** Timeout multiplier for each subsequent attempt (default: 2) */
  timeoutMultiplier: number;
  /** Callback for retry events */
  onRetry?: (attempt: number, error: Error, nextTimeoutMs: number) => void;
}

// Re-export from centralized defaults for backward compatibility
export { DEFAULT_NAVIGATION_RETRY_CONFIG } from "../defaults.js";

/**
 * Calculate timeout for a given retry attempt.
 * Uses exponential backoff: base * multiplier^(attempt-1), capped at maxTimeoutMs.
 *
 * With defaults (base: 30s, multiplier: 2, max: 120s):
 * - Attempt 1: 30,000ms
 * - Attempt 2: 60,000ms
 * - Attempt 3: 120,000ms (capped)
 */
export function calculateTimeout(attempt: number, config: NavigationRetryConfig): number {
  const calculated = Math.round(
    config.baseTimeoutMs * Math.pow(config.timeoutMultiplier, attempt - 1),
  );
  return Math.min(calculated, config.maxTimeoutMs);
}

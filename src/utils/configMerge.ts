/**
 * Safe configuration merging utilities.
 *
 * These functions handle undefined/null values correctly, avoiding the
 * common pitfall of using || which treats 0, false, and "" as falsy.
 */

import type { NavigationRetryConfig } from "../browser/navigationRetry.js";
import { getConfigDefaults } from "../config/schema.js";

/**
 * Merge configuration with defaults, only overriding with defined values.
 * Filters out null/undefined values before merging.
 *
 * @example
 * mergeWithDefaults(
 *   { a: 1, b: 2 },
 *   { a: undefined, b: 3, c: 4 }
 * )
 * // Returns: { a: 1, b: 3, c: 4 }
 */
export function mergeWithDefaults<T extends object>(
  defaults: T,
  overrides: Partial<T> | undefined | null,
): T {
  if (!overrides) {
    return { ...defaults };
  }

  // Use for-loop approach for better type safety
  const result = { ...defaults };
  for (const key of Object.keys(overrides) as Array<keyof T>) {
    if (overrides[key] != null) {
      result[key] = overrides[key] as T[keyof T];
    }
  }
  return result;
}

/**
 * Create a navigation retry config with defaults applied.
 * Handles undefined values safely using nullish coalescing.
 * All fields are overridable including maxTimeoutMs.
 */
export function createNavigationRetryConfig(
  overrides?: Partial<NavigationRetryConfig> | null,
): NavigationRetryConfig {
  const defaults = getConfigDefaults();
  return {
    baseTimeoutMs: overrides?.baseTimeoutMs ?? defaults.navigation_timeout_ms,
    maxTimeoutMs: overrides?.maxTimeoutMs ?? defaults.navigation_max_timeout_ms,
    maxAttempts: overrides?.maxAttempts ?? defaults.navigation_max_attempts,
    timeoutMultiplier: overrides?.timeoutMultiplier ?? defaults.navigation_timeout_multiplier,
    ...(overrides?.onRetry && { onRetry: overrides.onRetry }),
  };
}

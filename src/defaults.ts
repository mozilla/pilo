/**
 * Centralized configuration defaults for Spark.
 *
 * This file is the single source of truth for all default values.
 * All consumers should import from here rather than defining their own defaults.
 */

import type { NavigationRetryConfig } from "./browser/navigationRetry.js";

// ============================================================================
// Navigation Configuration Defaults
// ============================================================================

/** Default base timeout for navigation operations (30 seconds) */
export const DEFAULT_NAVIGATION_BASE_TIMEOUT_MS = 30000;

/** Default maximum timeout to prevent runaway values (120 seconds) */
export const DEFAULT_NAVIGATION_MAX_TIMEOUT_MS = 120000;

/** Default maximum navigation attempts (initial + 2 retries) */
export const DEFAULT_NAVIGATION_MAX_ATTEMPTS = 3;

/** Default timeout multiplier for exponential backoff */
export const DEFAULT_NAVIGATION_TIMEOUT_MULTIPLIER = 2;

// ============================================================================
// Browser Configuration Defaults
// ============================================================================

/** Default browser type */
export const DEFAULT_BROWSER = "firefox" as const;

/** Default action timeout for page load and element actions (30 seconds) */
export const DEFAULT_ACTION_TIMEOUT_MS = 30000;

/** Default headless mode setting */
export const DEFAULT_HEADLESS = false;

/** Default ad blocking setting */
export const DEFAULT_BLOCK_ADS = true;

/** Default resources to block */
export const DEFAULT_BLOCK_RESOURCES = "media,manifest";

/** Default bypass CSP setting */
export const DEFAULT_BYPASS_CSP = true;

// ============================================================================
// WebAgent Configuration Defaults
// ============================================================================

/** Default maximum iterations for task execution */
export const DEFAULT_MAX_ITERATIONS = 50;

/** Default maximum consecutive errors before failing */
export const DEFAULT_MAX_CONSECUTIVE_ERRORS = 5;

/** Default maximum total errors before failing */
export const DEFAULT_MAX_TOTAL_ERRORS = 15;

/** Default maximum validation attempts */
export const DEFAULT_MAX_VALIDATION_ATTEMPTS = 3;

/** Default maximum times an action can be repeated before warning */
export const DEFAULT_MAX_REPEATED_ACTIONS = 2;

/** Default debug mode setting */
export const DEFAULT_DEBUG = false;

/** Default vision mode setting */
export const DEFAULT_VISION = false;

// ============================================================================
// AI Provider Configuration Defaults
// ============================================================================

/** Default AI provider */
export const DEFAULT_PROVIDER = "openai" as const;

/** Default reasoning effort level */
export const DEFAULT_REASONING_EFFORT = "none" as const;

/** Default max tokens for generation */
export const DEFAULT_GENERATION_MAX_TOKENS = 3000;

/** Default max tokens for planning */
export const DEFAULT_PLANNING_MAX_TOKENS = 1500;

/** Default max tokens for validation */
export const DEFAULT_VALIDATION_MAX_TOKENS = 1000;

// ============================================================================
// Retry Configuration Defaults
// ============================================================================

/** Default maximum retry attempts for AI calls */
export const DEFAULT_RETRY_MAX_ATTEMPTS = 3;

/** Default initial delay between retries (1 second) */
export const DEFAULT_RETRY_INITIAL_DELAY_MS = 1000;

/** Default maximum delay between retries (10 seconds) */
export const DEFAULT_RETRY_MAX_DELAY_MS = 10000;

/** Default backoff factor for exponential backoff */
export const DEFAULT_RETRY_BACKOFF_FACTOR = 2;

// ============================================================================
// Logging Configuration Defaults
// ============================================================================

/** Default logger type */
export const DEFAULT_LOGGER = "console" as const;

/** Default metrics incremental setting */
export const DEFAULT_METRICS_INCREMENTAL = false;

// ============================================================================
// Composite Default Objects
// ============================================================================

/**
 * Complete default navigation retry configuration.
 * Use this when you need the full config object.
 */
export const DEFAULT_NAVIGATION_RETRY_CONFIG: NavigationRetryConfig = {
  baseTimeoutMs: DEFAULT_NAVIGATION_BASE_TIMEOUT_MS,
  maxTimeoutMs: DEFAULT_NAVIGATION_MAX_TIMEOUT_MS,
  maxAttempts: DEFAULT_NAVIGATION_MAX_ATTEMPTS,
  timeoutMultiplier: DEFAULT_NAVIGATION_TIMEOUT_MULTIPLIER,
};

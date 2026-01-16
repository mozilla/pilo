/**
 * Internal constants that are not part of the config schema.
 *
 * These are implementation details used internally but not configurable
 * via environment variables or CLI options.
 *
 * For configurable defaults, see config.ts (FIELDS is the single source of truth).
 */

// ============================================================================
// WebAgent Error Handling
// ============================================================================

/** Maximum consecutive errors before failing */
export const DEFAULT_MAX_CONSECUTIVE_ERRORS = 5;

/** Maximum total errors before failing */
export const DEFAULT_MAX_TOTAL_ERRORS = 15;

// ============================================================================
// AI Generation Token Limits
// ============================================================================

/** Max tokens for generation */
export const DEFAULT_GENERATION_MAX_TOKENS = 3000;

/** Max tokens for planning */
export const DEFAULT_PLANNING_MAX_TOKENS = 1500;

/** Max tokens for validation */
export const DEFAULT_VALIDATION_MAX_TOKENS = 1000;

// ============================================================================
// AI Retry Configuration
// ============================================================================

/** Maximum retry attempts for AI calls */
export const DEFAULT_RETRY_MAX_ATTEMPTS = 3;

/** Initial delay between retries (1 second) */
export const DEFAULT_RETRY_INITIAL_DELAY_MS = 1000;

/** Maximum delay between retries (10 seconds) */
export const DEFAULT_RETRY_MAX_DELAY_MS = 10000;

/** Backoff factor for exponential backoff */
export const DEFAULT_RETRY_BACKOFF_FACTOR = 2;

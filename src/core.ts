/**
 * Spark - Core exports
 *
 * Platform-agnostic core functionality.
 */

export { WebAgent } from "./webAgent.js";
export type { AriaBrowser } from "./browser/ariaBrowser.js";
export { PageAction, LoadState } from "./browser/ariaBrowser.js";
export type { TaskExecutionResult, TaskError, WebAgentOptions } from "./webAgent.js";
export { TaskErrorCode } from "./webAgent.js";
export { WebAgentEventEmitter, WebAgentEventType } from "./events.js";
export type {
  WebAgentEvent,
  TaskStartEventData,
  TaskCompleteEventData,
  PageNavigationEventData,
  AgentStepEventData,
  ReasoningEventData,
  ExtractedDataEventData,
  ProcessingEventData,
  ActionExecutionEventData,
  ActionResultEventData,
  TaskValidationEventData,
  StatusMessageEventData,
  WaitingEventData,
  ScreenshotCapturedEventData,
  ValidationErrorEventData,
} from "./events.js";
export { GenericLogger } from "./loggers/generic.js";
export { ConsoleLogger } from "./loggers/console.js";
export { JSONConsoleLogger } from "./loggers/json.js";
export type { Logger } from "./loggers/types.js";

// Schema types (public API for type safety)
export type { Action, TaskValidationResult } from "./schemas.js";

// Error types
export { RecoverableError, BrowserException, NavigationTimeoutException } from "./errors.js";

// Navigation retry configuration
export type { NavigationRetryConfig } from "./browser/navigationRetry.js";
export { calculateTimeout, DEFAULT_NAVIGATION_RETRY_CONFIG } from "./browser/navigationRetry.js";

// Config system - single source of truth (browser-compatible)
export { getConfigDefaults } from "./configDefaults.js";

// Internal constants (not configurable via env/CLI)
export {
  DEFAULT_GENERATION_MAX_TOKENS,
  DEFAULT_PLANNING_MAX_TOKENS,
  DEFAULT_VALIDATION_MAX_TOKENS,
  DEFAULT_RETRY_MAX_ATTEMPTS,
  DEFAULT_RETRY_INITIAL_DELAY_MS,
  DEFAULT_RETRY_MAX_DELAY_MS,
  DEFAULT_RETRY_BACKOFF_FACTOR,
} from "./constants.js";

// Backward-compatible default exports (derived from schema)
// Use getConfigDefaults() for programmatic access to all defaults
import { getConfigDefaults as _getDefaults } from "./configDefaults.js";
const _defaults = _getDefaults();
export const DEFAULT_NAVIGATION_BASE_TIMEOUT_MS = _defaults.navigation_timeout_ms;
export const DEFAULT_NAVIGATION_MAX_TIMEOUT_MS = _defaults.navigation_max_timeout_ms;
export const DEFAULT_NAVIGATION_MAX_ATTEMPTS = _defaults.navigation_max_attempts;
export const DEFAULT_NAVIGATION_TIMEOUT_MULTIPLIER = _defaults.navigation_timeout_multiplier;
export const DEFAULT_BROWSER = _defaults.browser;
export const DEFAULT_ACTION_TIMEOUT_MS = _defaults.action_timeout_ms;
export const DEFAULT_HEADLESS = _defaults.headless;
export const DEFAULT_BLOCK_ADS = _defaults.block_ads;
export const DEFAULT_BLOCK_RESOURCES = _defaults.block_resources;
export const DEFAULT_BYPASS_CSP = _defaults.bypass_csp;
export const DEFAULT_MAX_ITERATIONS = _defaults.max_iterations;
export const DEFAULT_MAX_VALIDATION_ATTEMPTS = _defaults.max_validation_attempts;
export const DEFAULT_MAX_REPEATED_ACTIONS = _defaults.max_repeated_actions;
export const DEFAULT_MAX_CONSECUTIVE_ERRORS = _defaults.max_consecutive_errors;
export const DEFAULT_MAX_TOTAL_ERRORS = _defaults.max_total_errors;
export const DEFAULT_INITIAL_NAVIGATION_RETRIES = _defaults.initial_navigation_retries;
export const DEFAULT_DEBUG = _defaults.debug;
export const DEFAULT_VISION = _defaults.vision;
export const DEFAULT_PROVIDER = _defaults.provider;
export const DEFAULT_REASONING_EFFORT = _defaults.reasoning_effort;
export const DEFAULT_LOGGER = _defaults.logger;
export const DEFAULT_METRICS_INCREMENTAL = _defaults.metrics_incremental;

// Note: createProvider not exported in core to avoid Node.js dependencies in browser
// Use provider libraries directly in browser environments
export * from "./schemas.js";

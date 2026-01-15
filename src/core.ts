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
export { calculateTimeout } from "./browser/navigationRetry.js";

// Centralized defaults (single source of truth)
export {
  // Navigation
  DEFAULT_NAVIGATION_BASE_TIMEOUT_MS,
  DEFAULT_NAVIGATION_MAX_TIMEOUT_MS,
  DEFAULT_NAVIGATION_MAX_ATTEMPTS,
  DEFAULT_NAVIGATION_TIMEOUT_MULTIPLIER,
  DEFAULT_NAVIGATION_RETRY_CONFIG,
  // Browser
  DEFAULT_BROWSER,
  DEFAULT_ACTION_TIMEOUT_MS,
  DEFAULT_HEADLESS,
  DEFAULT_BLOCK_ADS,
  DEFAULT_BLOCK_RESOURCES,
  DEFAULT_BYPASS_CSP,
  // WebAgent
  DEFAULT_MAX_ITERATIONS,
  DEFAULT_MAX_CONSECUTIVE_ERRORS,
  DEFAULT_MAX_TOTAL_ERRORS,
  DEFAULT_MAX_VALIDATION_ATTEMPTS,
  DEFAULT_MAX_REPEATED_ACTIONS,
  DEFAULT_DEBUG,
  DEFAULT_VISION,
  // AI Provider
  DEFAULT_PROVIDER,
  DEFAULT_REASONING_EFFORT,
  DEFAULT_GENERATION_MAX_TOKENS,
  DEFAULT_PLANNING_MAX_TOKENS,
  DEFAULT_VALIDATION_MAX_TOKENS,
  // Retry
  DEFAULT_RETRY_MAX_ATTEMPTS,
  DEFAULT_RETRY_INITIAL_DELAY_MS,
  DEFAULT_RETRY_MAX_DELAY_MS,
  DEFAULT_RETRY_BACKOFF_FACTOR,
  // Logging
  DEFAULT_LOGGER,
  DEFAULT_METRICS_INCREMENTAL,
} from "./defaults.js";

// Note: createProvider not exported in core to avoid Node.js dependencies in browser
// Use provider libraries directly in browser environments
export * from "./schemas.js";

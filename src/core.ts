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
export { DEFAULT_NAVIGATION_RETRY_CONFIG, calculateTimeout } from "./browser/navigationRetry.js";

// Note: createProvider not exported in core to avoid Node.js dependencies in browser
// Use provider libraries directly in browser environments
export * from "./schemas.js";

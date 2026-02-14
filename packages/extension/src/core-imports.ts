/**
 * Re-exports from shared core library (platform-agnostic exports only)
 * This file acts as a controlled boundary to prevent bundling Node.js-specific code
 *
 * We explicitly re-export only what the extension needs to avoid WXT trying to
 * process all transitive imports from the core module.
 */

// Core classes and types
export { WebAgent } from "../../../src/webAgent.js";
export type { AriaBrowser } from "../../../src/browser/ariaBrowser.js";
export { PageAction, LoadState } from "../../../src/browser/ariaBrowser.js";
export type { TaskExecutionResult, TaskError, WebAgentOptions } from "../../../src/webAgent.js";
export { TaskErrorCode } from "../../../src/webAgent.js";

// Events
export { WebAgentEventEmitter, WebAgentEventType } from "../../../src/events.js";
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
} from "../../../src/events.js";

// Loggers
export { GenericLogger } from "../../../src/loggers/generic.js";
export { ConsoleLogger } from "../../../src/loggers/console.js";
export { JSONConsoleLogger } from "../../../src/loggers/json.js";
export type { Logger } from "../../../src/loggers/types.js";

// Schemas
export type { Action, TaskValidationResult } from "../../../src/schemas.js";

// Errors
export {
  RecoverableError,
  BrowserException,
  NavigationTimeoutException,
} from "../../../src/errors.js";

/**
 * Spark - Core exports
 *
 * Platform-agnostic core functionality.
 */

export { WebAgent } from "./webAgent.js";
export type { AriaBrowser, PageAction, LoadState } from "./browser/ariaBrowser.js";
export type { TaskExecutionResult, WebAgentOptions } from "./webAgent.js";
export { WebAgentEventEmitter, WebAgentEventType } from "./events.js";
export type {
  WebAgentEvent,
  TaskStartEventData,
  TaskCompleteEventData,
  PageNavigationEventData,
  CurrentStepEventData,
  ObservationEventData,
  ThoughtEventData,
  ExtractedDataEventData,
  ProcessingEventData,
  ActionExecutionEventData,
  ActionResultEventData,
  TaskValidationEventData,
  StatusMessageEventData,
  WaitingEventData,
  NetworkWaitingEventData,
  NetworkTimeoutEventData,
  ScreenshotCapturedEventData,
  ValidationErrorEventData,
} from "./events.js";
export { ConsoleLogger, GenericLogger } from "./loggers.js";
export type { Logger } from "./loggers.js";
export { createProvider, DEFAULT_MODELS } from "./providers.js";
export type { ProviderConfig } from "./providers.js";
export * from "./schemas.js";
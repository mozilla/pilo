/**
 * Spark - AI-powered web automation library
 *
 * This module exports the main classes and types for programmatic use of Spark.
 * Use this when you want to integrate Spark into your own applications.
 */

export { WebAgent } from "./webAgent.js";
export { PlaywrightBrowser } from "./browser/playwrightBrowser.js";
export type { AriaBrowser, PageAction, LoadState } from "./browser/ariaBrowser.js";
export type {
  PlaywrightBrowserOptions,
  ExtendedPlaywrightBrowserOptions,
} from "./browser/playwrightBrowser.js";
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
export { ConsoleLogger } from "./loggers/console.js";
export { ChalkConsoleLogger } from "./loggers/chalkConsole.js";
export { GenericLogger } from "./loggers/generic.js";
export { JSONConsoleLogger } from "./loggers/json.js";
export type { Logger } from "./loggers/types.js";
export * from "./schemas.js";

// Configuration and Provider System
export { config, ConfigManager } from "./config.js";
export type { SparkConfig } from "./config.js";
export { createAIProvider, getAIProviderInfo } from "./provider.js";

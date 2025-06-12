/**
 * Spark - AI-powered web automation library
 *
 * This module exports the main classes and types for programmatic use of Spark.
 * Use this when you want to integrate Spark into your own applications.
 */

export { WebAgent } from "./webAgent.js";
export { PlaywrightBrowser } from "./browser/playwrightBrowser.js";
export type { AriaBrowser, PageAction, LoadState } from "./browser/ariaBrowser.js";
export type { TaskExecutionResult } from "./webAgent.js";
export { WebAgentEventEmitter, WebAgentEventType } from "./events.js";
export type { WebAgentEvent } from "./events.js";
export { ConsoleLogger } from "./loggers.js";
export type { Logger } from "./loggers.js";
export * from "./schemas.js";

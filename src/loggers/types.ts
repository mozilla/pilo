import { WebAgentEventEmitter } from "../events.js";

/**
 * Base logger interface that all loggers must implement
 */
export interface Logger {
  /**
   * Initialize the logger with an event emitter
   */
  initialize(emitter: WebAgentEventEmitter): void;

  /**
   * Clean up any resources used by the logger,
   * including removing event listeners
   */
  dispose(): void;
}

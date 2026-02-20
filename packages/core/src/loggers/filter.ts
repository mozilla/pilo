import { WebAgentEventEmitter, WebAgentEventType } from "../events.js";
import { LoggerWrapper } from "./wrapper.js";

/**
 * Abstract base class for logger filters that intercept and transform events.
 *
 * LoggerFilter creates a new emitter that receives transformed events,
 * allowing filtering, modification, or enrichment of event data before
 * it reaches the wrapped logger.
 *
 * Subclasses must implement the transformData method to define their
 * specific transformation logic.
 */
export abstract class LoggerFilter extends LoggerWrapper {
  private filteredEmitter: WebAgentEventEmitter | null = null;
  private handleEvent: ((eventType: string, data: any) => void) | null = null;

  initialize(emitter: WebAgentEventEmitter): void {
    if (this.emitter) {
      this.dispose();
    }

    this.emitter = emitter;
    this.filteredEmitter = new WebAgentEventEmitter();

    // Create bound handler for cleanup
    this.handleEvent = (eventType: string, data: any) => {
      const transformedData = this.transformData(eventType as WebAgentEventType, data);
      this.filteredEmitter!.emit(eventType, transformedData);
    };

    // Listen to wildcard event to intercept all events
    emitter.on("*", this.handleEvent);

    // Initialize wrapped logger with filtered emitter
    this.wrappedLogger.initialize(this.filteredEmitter);
  }

  dispose(): void {
    if (this.emitter && this.handleEvent) {
      this.emitter.off("*", this.handleEvent);
      this.wrappedLogger.dispose();
      this.emitter = null;
      this.filteredEmitter = null;
      this.handleEvent = null;
    }
  }

  /**
   * Transform event data before passing it to the wrapped logger.
   *
   * @param eventType - The type of event being processed
   * @param data - The original event data
   * @returns The transformed event data
   */
  protected abstract transformData(eventType: WebAgentEventType, data: any): any;
}

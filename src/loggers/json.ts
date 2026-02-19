import { WebAgentEventEmitter, WebAgentEventType } from "../events.js";
import type { WebAgentEvent } from "../events.js";
import { Logger } from "./types.js";

/**
 * Events that are excluded by default from JSON console output
 * These events may be very large or too verbose for console logging
 */
const DEFAULT_EXCLUDED_EVENTS: readonly WebAgentEventType[] = [
  WebAgentEventType.BROWSER_SCREENSHOT_CAPTURED_IMAGE, // Very large base64 data
] as const;

export interface JSONConsoleLoggerOptions {
  /** Include screenshot image events (default: false) */
  includeScreenshotImages?: boolean;
}

export class JSONConsoleLogger implements Logger {
  private emitter: WebAgentEventEmitter | null = null;
  private handlers: [WebAgentEventType, (data: any) => void][] = [];
  private excludedEvents: Set<WebAgentEventType>;

  constructor(options: JSONConsoleLoggerOptions = {}) {
    // Build excluded events set
    this.excludedEvents = new Set(options.includeScreenshotImages ? [] : DEFAULT_EXCLUDED_EVENTS);
  }

  initialize(emitter: WebAgentEventEmitter): void {
    if (this.emitter) {
      this.dispose();
    }
    this.emitter = emitter;
    this.handlers = [];

    for (const event of Object.values(WebAgentEventType)) {
      const handler = this.buildEventHandler(event);
      this.handlers.push([event, handler]);
      emitter.onEvent(event, handler);
    }
  }

  dispose(): void {
    if (this.emitter) {
      for (const [event, handler] of this.handlers) {
        this.emitter.offEvent(event, handler);
      }
      this.emitter = null;
    }
  }

  private buildEventHandler(type: WebAgentEventType) {
    return (data: WebAgentEvent["data"]): void => {
      // Skip excluded events
      if (this.excludedEvents.has(type)) {
        return;
      }

      const json = JSON.stringify({ event: type, data }, null, 0);
      console.log(json);
    };
  }
}

import { WebAgentEventEmitter } from "../events.js";
import { Logger } from "./types.js";

/**
 * Generic logger that forwards all events to a callback function
 * Useful for custom logging implementations like streaming or external services
 */
export class GenericLogger implements Logger {
  private emitter: WebAgentEventEmitter | null = null;
  private eventHandler: (eventType: string, data: any) => void;

  constructor(eventHandler: (eventType: string, data: any) => void) {
    this.eventHandler = eventHandler;
  }

  initialize(emitter: WebAgentEventEmitter): void {
    if (this.emitter) {
      this.dispose();
    }
    this.emitter = emitter;

    // Listen to all events using wildcard
    emitter.on("*", (eventType: string, data: any) => {
      this.eventHandler(eventType, data);
    });
  }

  dispose(): void {
    if (this.emitter) {
      // Remove wildcard listener
      this.emitter.removeAllListeners("*");
      this.emitter = null;
    }
  }
}

import { WebAgentEventEmitter } from "../events.js";
import { Logger } from "./types.js";

export class LoggerWrapper implements Logger {
  protected emitter: WebAgentEventEmitter | null = null;
  protected wrappedLogger: Logger;

  constructor(wrappedLogger: Logger) {
    this.wrappedLogger = wrappedLogger;
  }

  initialize(emitter: WebAgentEventEmitter): void {
    if (this.emitter) {
      this.dispose();
    }
    this.emitter = emitter;
    this.wrappedLogger.initialize(emitter);
  }

  dispose(): void {
    if (this.emitter) {
      this.wrappedLogger.dispose();
      this.emitter = null;
    }
  }
}

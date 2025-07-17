import { WebAgentEventEmitter, WebAgentEventType } from "../events.js";
import type { WebAgentEvent } from "../events.js";
import { Logger } from "./types.js";

export class JSONConsoleLogger implements Logger {
  private emitter: WebAgentEventEmitter | null = null;
  private handlers: [WebAgentEventType, (data: any) => void][] = [];

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
      const json = JSON.stringify({ event: type, data }, null, 0);
      console.log(json);
    };
  }
}

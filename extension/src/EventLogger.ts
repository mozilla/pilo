import type { WebAgentEventType } from "../../src/events.js";

export interface LogEvent {
  id: string;
  type: WebAgentEventType;
  data: any;
  timestamp: Date;
}

export class EventLogger {
  private events: LogEvent[] = [];
  private listeners: ((events: LogEvent[]) => void)[] = [];

  addEvent(type: WebAgentEventType, data: any): void {
    const event: LogEvent = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      type,
      data,
      timestamp: new Date(),
    };

    this.events.push(event);
    this.notifyListeners();
  }

  getEvents(): LogEvent[] {
    return [...this.events];
  }

  clearEvents(): void {
    this.events = [];
    this.notifyListeners();
  }

  subscribe(listener: (events: LogEvent[]) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener(this.getEvents()));
  }
}

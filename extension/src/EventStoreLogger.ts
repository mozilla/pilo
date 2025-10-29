import browser from "webextension-polyfill";
import { GenericLogger } from "spark/core";
import { createLogger } from "./utils/logger";

interface EventData {
  type: string;
  data: unknown;
  timestamp: number;
}

interface RealtimeEventMessage {
  type: "realtimeEvent";
  event: EventData;
}

interface TaskStartedData {
  plan?: string;
  taskId?: string;
  timestamp?: number;
  [key: string]: unknown;
}

/**
 * EventStoreLogger - Collects all WebAgent events into an array for React consumption
 * Instead of writing HTML, this logger stores structured event data that React can render
 */
export class EventStoreLogger extends GenericLogger {
  private static readonly PLAN_LOG_MESSAGE = "Task Plan Details";
  private static readonly UNKNOWN_TASK_ID = "unknown";

  private events: EventData[] = [];
  private subscribers: Set<(events: EventData[]) => void> = new Set();
  private logger = createLogger("EventStoreLogger");

  constructor() {
    super((eventType: string, data: unknown) => {
      this.handleEvent(eventType, data);
    });
  }

  /**
   * Generic event handler - stores any event that comes through
   */
  private handleEvent = (eventType: string, data: unknown): void => {
    // Log errors to console BEFORE processing
    switch (eventType) {
      case "task:validation_error":
        console.error("Validation Error:", data);
        break;
      case "ai:generation:error":
        console.error("AI Generation Error:", data);
        break;
      case "browser:action_completed":
        if (data && typeof data === "object" && "success" in data && !data.success) {
          console.error("Browser Action Failed:", data);
        }
        break;
      case "task:aborted":
        console.error("Task Aborted:", data);
        break;
      case "task:started":
        this.logTaskPlan(data);
        break;
    }

    const event: EventData = {
      type: eventType,
      data,
      timestamp: this.getTimestamp(data),
    };

    this.events.push(event);

    // Send real-time event to SidePanel
    // Note: When in background script, we broadcast to all extension contexts
    if (typeof browser !== "undefined" && browser.runtime) {
      try {
        const message: RealtimeEventMessage = {
          type: "realtimeEvent",
          event,
        };
        // Use runtime.sendMessage to broadcast to all contexts (including sidepanel)
        browser.runtime.sendMessage(message).catch(() => {
          // Ignore errors if no listeners or sidepanel isn't open
        });
      } catch (error) {
        // Ignore errors in case we're not in background script context
      }
    }

    // Notify all subscribers that new events are available
    this.notifySubscribers();
  };

  /**
   * Extract timestamp from data or use current time
   */
  private getTimestamp(data: unknown): number {
    if (data && typeof data === "object" && "timestamp" in data) {
      const timestamp = (data as { timestamp: unknown }).timestamp;
      return typeof timestamp === "number" ? timestamp : Date.now();
    }
    return Date.now();
  }

  /**
   * Subscribe to event updates - React components can use this
   */
  subscribe(callback: (events: EventData[]) => void): () => void {
    this.subscribers.add(callback);

    // Immediately call with current events
    callback([...this.events]);

    // Return unsubscribe function
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Get current events array (for non-reactive access)
   */
  getEvents(): EventData[] {
    return [...this.events];
  }

  /**
   * Clear all events (useful for new tasks)
   */
  clearEvents(): void {
    this.events = [];
    this.notifySubscribers();
  }

  /**
   * Manually add an event (useful for events from background script)
   */
  addEvent(eventType: string, data: unknown): void {
    this.handleEvent(eventType, data);
  }

  private notifySubscribers(): void {
    const eventsCopy = [...this.events];
    this.subscribers.forEach((callback) => {
      try {
        callback(eventsCopy);
      } catch (error) {
        this.logger.error("Error in event subscriber", {}, error);
      }
    });
  }

  /**
   * Log task plan details when a task starts
   */
  private logTaskPlan(data: unknown): void {
    if (!this.isTaskStartedWithPlan(data)) {
      return;
    }

    const planData = data as TaskStartedData;

    // Log with the plan details as additional arguments so they appear in console
    this.logger.info(
      EventStoreLogger.PLAN_LOG_MESSAGE,
      {
        taskId: planData.taskId || EventStoreLogger.UNKNOWN_TASK_ID,
      },
      {
        taskId: planData.taskId || EventStoreLogger.UNKNOWN_TASK_ID,
        plan: planData.plan!,
        planLength: planData.plan!.length,
        timestamp: this.getTimestamp(data),
        fullEventData: data,
      },
    );
  }

  private isTaskStartedWithPlan(data: unknown): boolean {
    return !!(
      data &&
      typeof data === "object" &&
      "plan" in data &&
      (data as TaskStartedData).plan &&
      typeof (data as TaskStartedData).plan === "string"
    );
  }
}

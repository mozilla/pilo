import { GenericLogger } from "spark/core";

/**
 * EventStoreLogger - Collects all WebAgent events into an array for React consumption
 * Instead of writing HTML, this logger stores structured event data that React can render
 */
export class EventStoreLogger extends GenericLogger {
  private events: Array<{ type: string; data: any; timestamp: number }> = [];
  private subscribers: Set<
    (events: Array<{ type: string; data: any; timestamp: number }>) => void
  > = new Set();

  constructor() {
    super((eventType: string, data: any) => {
      this.handleEvent(eventType, data);
    });
  }

  /**
   * Generic event handler - stores any event that comes through
   */
  private handleEvent = (eventType: string, data: any): void => {
    this.events.push({
      type: eventType,
      data,
      timestamp: data.timestamp || Date.now(),
    });

    // Notify all subscribers that new events are available
    this.notifySubscribers();
  };

  /**
   * Subscribe to event updates - React components can use this
   */
  subscribe(
    callback: (events: Array<{ type: string; data: any; timestamp: number }>) => void,
  ): () => void {
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
  getEvents(): Array<{ type: string; data: any; timestamp: number }> {
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
  addEvent(eventType: string, data: any): void {
    this.handleEvent(eventType, data);
  }

  private notifySubscribers(): void {
    const eventsCopy = [...this.events];
    this.subscribers.forEach((callback) => {
      try {
        callback(eventsCopy);
      } catch (error) {
        console.error("Error in event subscriber:", error);
      }
    });
  }
}

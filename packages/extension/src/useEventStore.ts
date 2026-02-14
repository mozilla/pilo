import { useState, useEffect, useRef } from "react";
import { EventStoreLogger } from "./EventStoreLogger.js";

type AgentEvent = { type: string; data: any; timestamp: number };

/**
 * React hook to use the EventStoreLogger
 * Returns events array and the logger instance
 */
export function useEventStore() {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const loggerRef = useRef<EventStoreLogger | null>(null);

  // Create logger instance once
  if (!loggerRef.current) {
    loggerRef.current = new EventStoreLogger();
  }

  useEffect(() => {
    const logger = loggerRef.current!;

    // Subscribe to event updates
    const unsubscribe = logger.subscribe((newEvents) => {
      setEvents(newEvents);
    });

    return unsubscribe;
  }, []);

  const clearEvents = () => {
    loggerRef.current?.clearEvents();
  };

  return {
    events,
    logger: loggerRef.current,
    clearEvents,
  };
}

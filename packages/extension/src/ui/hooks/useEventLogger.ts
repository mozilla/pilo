import { useState, useEffect, useRef } from "react";
import { EventLogger, type LogEvent } from "../EventLogger";

export function useEventLogger(): {
  events: LogEvent[];
  logger: EventLogger;
  clearEvents: () => void;
} {
  const loggerRef = useRef<EventLogger>(new EventLogger());
  const [events, setEvents] = useState<LogEvent[]>([]);

  useEffect(() => {
    const unsubscribe = loggerRef.current.subscribe((newEvents) => {
      setEvents(newEvents);
    });

    return unsubscribe;
  }, []);

  return {
    events,
    logger: loggerRef.current,
    clearEvents: () => loggerRef.current.clearEvents(),
  };
}

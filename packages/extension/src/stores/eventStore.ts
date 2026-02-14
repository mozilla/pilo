import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import browser from "webextension-polyfill";
import type { WebAgentEventType } from "spark-core/core.js";
import { reviver } from "../utils/storage.js";

export interface EventData {
  id: string;
  type: string;
  data: unknown;
  timestamp: Date;
}

export interface LogEvent {
  id: string;
  type: WebAgentEventType;
  data: any;
  timestamp: Date;
}

interface EventStore {
  events: EventData[];

  // Actions
  addEvent: (type: string, data: unknown) => void;
  clearEvents: () => void;
  getEvents: () => EventData[];
}

// Create browser storage adapter for events (optional persistence)
const browserStorage = createJSONStorage(
  () => ({
    getItem: async (name: string): Promise<string | null> => {
      const result = await browser.storage.local.get(name);
      const value = result[name];
      return typeof value === "string" ? value : null;
    },
    setItem: async (name: string, value: string): Promise<void> => {
      await browser.storage.local.set({ [name]: value });
    },
    removeItem: async (name: string): Promise<void> => {
      await browser.storage.local.remove(name);
    },
  }),
  {
    reviver,
  },
);

export const useEventStore = create<EventStore>()(
  persist(
    (set, get) => ({
      events: [],

      addEvent: (type: string, data: unknown) => {
        const event: EventData = {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          type,
          data,
          timestamp: new Date(),
        };

        set((state) => ({
          events: [...state.events, event],
        }));

        // Note: We intentionally do NOT broadcast events from the sidepanel.
        // Events are broadcast by EventStoreLogger in the background script
        // with the correct tabId. Re-broadcasting here would create duplicate
        // events with tabId: -1, breaking indicator forwarding.
      },

      clearEvents: () => {
        set({ events: [] });
      },

      getEvents: () => {
        return get().events;
      },
    }),
    {
      name: "spark-events",
      storage: browserStorage,
      // Only persist events for a short time (they're mainly for debugging)
      partialize: (state) => ({
        events: state.events.slice(-100), // Keep only last 100 events
      }),
    },
  ),
);

/**
 * Hook that provides event logging functionality
 * Compatible with both old EventLogger and EventStoreLogger patterns
 */
export function useEvents() {
  const store = useEventStore();

  return {
    events: store.events,
    addEvent: store.addEvent,
    clearEvents: store.clearEvents,
    getEvents: store.getEvents,
  };
}

/**
 * Legacy compatibility hook for EventLogger pattern
 * @deprecated Use useEvents instead
 */
export function useEventLogger() {
  const { events, addEvent, clearEvents } = useEvents();

  // Convert to LogEvent format for compatibility
  const logEvents: LogEvent[] = events.map((event) => ({
    id: event.id,
    type: event.type as WebAgentEventType,
    data: event.data,
    timestamp: event.timestamp,
  }));

  // Create a compatibility logger object
  const logger = {
    addEvent: (type: WebAgentEventType, data: any) => {
      addEvent(type, data);
    },
    getEvents: () => logEvents,
    clearEvents,
    subscribe: (callback: (events: LogEvent[]) => void) => {
      // For simplicity, we'll just call the callback immediately
      // In a real implementation, you'd set up a subscription
      callback(logEvents);
      return () => {}; // Unsubscribe function
    },
  };

  return {
    events: logEvents,
    logger,
    clearEvents,
  };
}

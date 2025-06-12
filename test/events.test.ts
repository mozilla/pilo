import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  WebAgentEventEmitter,
  WebAgentEventType,
  WebAgentEvent,
  TaskStartEventData,
  TaskCompleteEventData,
  PageNavigationEventData,
  CurrentStepEventData,
  ObservationEventData,
  ThoughtEventData,
  ExtractedDataEventData,
  ActionExecutionEventData,
  ActionResultEventData,
  CompressionDebugEventData,
  MessagesDebugEventData,
  WaitingEventData,
  NetworkWaitingEventData,
  NetworkTimeoutEventData,
  TaskValidationEventData,
  StatusMessageEventData,
} from "../src/events.js";

describe("WebAgentEventEmitter", () => {
  let emitter: WebAgentEventEmitter;

  beforeEach(() => {
    emitter = new WebAgentEventEmitter();
  });

  describe("Basic event emission and listening", () => {
    it("should emit and listen to events", () => {
      const listener = vi.fn();
      const eventData: TaskStartEventData = {
        timestamp: Date.now(),
        task: "Test task",
        explanation: "Test explanation",
        plan: "Test plan",
        url: "https://example.com",
      };

      emitter.onEvent(WebAgentEventType.TASK_STARTED, listener);
      emitter.emitEvent({
        type: WebAgentEventType.TASK_STARTED,
        data: eventData,
      });

      expect(listener).toHaveBeenCalledWith(eventData);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("should listen to events only once with onceEvent", () => {
      const listener = vi.fn();
      const eventData: TaskCompleteEventData = {
        timestamp: Date.now(),
        finalAnswer: "Test answer",
      };

      emitter.onceEvent(WebAgentEventType.TASK_COMPLETED, listener);
      emitter.emitEvent({
        type: WebAgentEventType.TASK_COMPLETED,
        data: eventData,
      });
      emitter.emitEvent({
        type: WebAgentEventType.TASK_COMPLETED,
        data: eventData,
      });

      expect(listener).toHaveBeenCalledWith(eventData);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("should remove event listeners with offEvent", () => {
      const listener = vi.fn();
      const eventData: PageNavigationEventData = {
        timestamp: Date.now(),
        title: "Test Page",
        url: "https://example.com",
      };

      emitter.onEvent(WebAgentEventType.BROWSER_NAVIGATED, listener);
      emitter.offEvent(WebAgentEventType.BROWSER_NAVIGATED, listener);
      emitter.emitEvent({
        type: WebAgentEventType.BROWSER_NAVIGATED,
        data: eventData,
      });

      expect(listener).not.toHaveBeenCalled();
    });

    it("should handle multiple listeners for the same event", () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const eventData: CurrentStepEventData = {
        timestamp: Date.now(),
        currentStep: "Step 1",
      };

      emitter.onEvent(WebAgentEventType.AGENT_STEP, listener1);
      emitter.onEvent(WebAgentEventType.AGENT_STEP, listener2);
      emitter.emitEvent({
        type: WebAgentEventType.AGENT_STEP,
        data: eventData,
      });

      expect(listener1).toHaveBeenCalledWith(eventData);
      expect(listener2).toHaveBeenCalledWith(eventData);
      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });
  });

  describe("Event type validation", () => {
    it("should handle all WebAgentEventType values", () => {
      // Verify all event types are defined
      const expectedEventTypes = [
        "task:started",
        "task:completed",
        "task:validated",
        "task:validation_error",
        "agent:step",
        "agent:observed",
        "agent:reasoned",
        "agent:extracted",
        "agent:processing",
        "agent:status",
        "agent:waiting",
        "browser:action_started",
        "browser:action_completed",
        "browser:navigated",
        "browser:network_waiting",
        "browser:network_timeout",
        "system:debug_compression",
        "system:debug_message",
      ];

      const actualEventTypes = Object.values(WebAgentEventType);
      expect(actualEventTypes).toEqual(expect.arrayContaining(expectedEventTypes));
      expect(actualEventTypes.length).toBe(expectedEventTypes.length);
    });

    it("should emit events with correct event type strings", () => {
      const listeners: { [key: string]: any } = {};

      // Set up listeners for all event types
      Object.values(WebAgentEventType).forEach((eventType) => {
        listeners[eventType] = vi.fn();
        emitter.onEvent(eventType as any, listeners[eventType]);
      });

      // Test each event type
      const testEvents: WebAgentEvent[] = [
        {
          type: WebAgentEventType.TASK_STARTED,
          data: {
            timestamp: Date.now(),
            task: "test",
            explanation: "test",
            plan: "test",
            url: "test",
          },
        },
        {
          type: WebAgentEventType.TASK_COMPLETED,
          data: { timestamp: Date.now(), finalAnswer: "test" },
        },
        {
          type: WebAgentEventType.BROWSER_NAVIGATED,
          data: { timestamp: Date.now(), title: "test", url: "test" },
        },
        {
          type: WebAgentEventType.AGENT_STEP,
          data: { timestamp: Date.now(), currentStep: "test" },
        },
        {
          type: WebAgentEventType.AGENT_OBSERVED,
          data: { timestamp: Date.now(), observation: "test" },
        },
        {
          type: WebAgentEventType.AGENT_REASONED,
          data: { timestamp: Date.now(), thought: "test" },
        },
        {
          type: WebAgentEventType.AGENT_EXTRACTED,
          data: { timestamp: Date.now(), extractedData: "test" },
        },
        {
          type: WebAgentEventType.BROWSER_ACTION_STARTED,
          data: { timestamp: Date.now(), action: "click", ref: "s1e23" },
        },
        {
          type: WebAgentEventType.BROWSER_ACTION_COMPLETED,
          data: { timestamp: Date.now(), success: true },
        },
        {
          type: WebAgentEventType.SYSTEM_DEBUG_COMPRESSION,
          data: {
            timestamp: Date.now(),
            originalSize: 1000,
            compressedSize: 500,
            compressionPercent: 50,
          },
        },
        {
          type: WebAgentEventType.SYSTEM_DEBUG_MESSAGE,
          data: { timestamp: Date.now(), messages: [] },
        },
        {
          type: WebAgentEventType.AGENT_WAITING,
          data: { timestamp: Date.now(), seconds: 5 },
        },
        {
          type: WebAgentEventType.BROWSER_NETWORK_WAITING,
          data: { timestamp: Date.now(), action: "click" },
        },
        {
          type: WebAgentEventType.BROWSER_NETWORK_TIMEOUT,
          data: { timestamp: Date.now(), action: "click" },
        },
        {
          type: WebAgentEventType.TASK_VALIDATED,
          data: {
            timestamp: Date.now(),
            observation: "test observation",
            completionQuality: "complete" as const,
            feedback: "test",
            finalAnswer: "test",
          },
        },
        {
          type: WebAgentEventType.AGENT_STATUS,
          data: {
            timestamp: Date.now(),
            message: "Processing data",
          },
        },
        {
          type: WebAgentEventType.TASK_VALIDATION_ERROR,
          data: {
            timestamp: Date.now(),
            errors: ["Test error"],
            retryCount: 1,
            rawResponse: {},
          },
        },
        {
          type: WebAgentEventType.AGENT_PROCESSING,
          data: {
            timestamp: Date.now(),
            status: "start" as const,
            operation: "test operation",
          },
        },
      ];

      // Emit each event and verify the correct listener was called
      testEvents.forEach((event) => {
        emitter.emitEvent(event);
        expect(listeners[event.type]).toHaveBeenCalledWith(event.data);
      });
    });
  });

  describe("Event data structures", () => {
    it("should handle TaskStartEventData correctly", () => {
      const listener = vi.fn();
      const eventData: TaskStartEventData = {
        timestamp: 1234567890,
        task: "Complete a web form",
        explanation: "Fill out and submit a contact form",
        plan: "1. Navigate to form\n2. Fill fields\n3. Submit",
        url: "https://example.com/contact",
      };

      emitter.onEvent(WebAgentEventType.TASK_STARTED, listener);
      emitter.emitEvent({
        type: WebAgentEventType.TASK_STARTED,
        data: eventData,
      });

      expect(listener).toHaveBeenCalledWith(eventData);
    });

    it("should handle ActionExecutionEventData with optional fields", () => {
      const listener = vi.fn();

      // Test with all fields
      const fullEventData: ActionExecutionEventData = {
        timestamp: Date.now(),
        action: "fill",
        ref: "s1e23",
        value: "test@example.com",
      };

      emitter.onEvent(WebAgentEventType.BROWSER_ACTION_STARTED, listener);
      emitter.emitEvent({
        type: WebAgentEventType.BROWSER_ACTION_STARTED,
        data: fullEventData,
      });

      expect(listener).toHaveBeenCalledWith(fullEventData);

      // Test with minimal fields
      const minimalEventData: ActionExecutionEventData = {
        timestamp: Date.now(),
        action: "back",
      };

      listener.mockClear();
      emitter.emitEvent({
        type: WebAgentEventType.BROWSER_ACTION_STARTED,
        data: minimalEventData,
      });

      expect(listener).toHaveBeenCalledWith(minimalEventData);
    });

    it("should handle ActionResultEventData with success and error", () => {
      const listener = vi.fn();

      // Test success case
      const successData: ActionResultEventData = {
        timestamp: Date.now(),
        success: true,
      };

      emitter.onEvent(WebAgentEventType.BROWSER_ACTION_COMPLETED, listener);
      emitter.emitEvent({
        type: WebAgentEventType.BROWSER_ACTION_COMPLETED,
        data: successData,
      });

      expect(listener).toHaveBeenCalledWith(successData);

      // Test error case
      const errorData: ActionResultEventData = {
        timestamp: Date.now(),
        success: false,
        error: "Element not found",
      };

      listener.mockClear();
      emitter.emitEvent({
        type: WebAgentEventType.BROWSER_ACTION_COMPLETED,
        data: errorData,
      });

      expect(listener).toHaveBeenCalledWith(errorData);
    });

    it("should handle TaskValidationEventData with optional feedback", () => {
      const listener = vi.fn();

      // Test with feedback
      const withFeedback: TaskValidationEventData = {
        timestamp: Date.now(),
        observation: "Task incomplete, missing confirmation step",
        completionQuality: "partial",
        feedback: "Task incomplete, missing confirmation step",
        finalAnswer: "Form submitted",
      };

      emitter.onEvent(WebAgentEventType.TASK_VALIDATED, listener);
      emitter.emitEvent({
        type: WebAgentEventType.TASK_VALIDATED,
        data: withFeedback,
      });

      expect(listener).toHaveBeenCalledWith(withFeedback);

      // Test without feedback
      const withoutFeedback: TaskValidationEventData = {
        timestamp: Date.now(),
        observation: "Task completed successfully",
        completionQuality: "complete",
        finalAnswer: "Task completed successfully",
      };

      listener.mockClear();
      emitter.emitEvent({
        type: WebAgentEventType.TASK_VALIDATED,
        data: withoutFeedback,
      });

      expect(listener).toHaveBeenCalledWith(withoutFeedback);
    });

    it("should handle StatusMessageEventData correctly", () => {
      const listener = vi.fn();
      const eventData: StatusMessageEventData = {
        timestamp: Date.now(),
        message: "Analyzing search results",
      };

      emitter.onEvent(WebAgentEventType.AGENT_STATUS, listener);
      emitter.emitEvent({
        type: WebAgentEventType.AGENT_STATUS,
        data: eventData,
      });

      expect(listener).toHaveBeenCalledWith(eventData);
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe("Error handling", () => {
    it("should handle listener errors gracefully", () => {
      const errorListener = vi.fn().mockImplementation(() => {
        throw new Error("Listener error");
      });
      const successListener = vi.fn();

      const eventData: ObservationEventData = {
        timestamp: Date.now(),
        observation: "Test observation",
      };

      emitter.onEvent(WebAgentEventType.AGENT_OBSERVED, errorListener);
      emitter.onEvent(WebAgentEventType.AGENT_OBSERVED, successListener);

      // EventEmitter will throw when a listener throws, but both listeners should be called
      expect(() => {
        emitter.emitEvent({
          type: WebAgentEventType.AGENT_OBSERVED,
          data: eventData,
        });
      }).toThrow("Listener error");

      expect(errorListener).toHaveBeenCalled();
      // Note: successListener may not be called if errorListener throws first
      // This is expected EventEmitter behavior
    });
  });

  describe("Memory management", () => {
    it("should not leak memory when listeners are removed", () => {
      const listener = vi.fn();

      emitter.onEvent(WebAgentEventType.AGENT_REASONED, listener);
      expect(emitter.listenerCount(WebAgentEventType.AGENT_REASONED)).toBe(1);

      emitter.offEvent(WebAgentEventType.AGENT_REASONED, listener);
      expect(emitter.listenerCount(WebAgentEventType.AGENT_REASONED)).toBe(0);
    });

    it("should support removing all listeners", () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      emitter.onEvent(WebAgentEventType.AGENT_EXTRACTED, listener1);
      emitter.onEvent(WebAgentEventType.AGENT_EXTRACTED, listener2);
      expect(emitter.listenerCount(WebAgentEventType.AGENT_EXTRACTED)).toBe(2);

      emitter.removeAllListeners(WebAgentEventType.AGENT_EXTRACTED);
      expect(emitter.listenerCount(WebAgentEventType.AGENT_EXTRACTED)).toBe(0);
    });
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MetricsCollector } from "../src/loggers/metricsCollector.js";
import {
  WebAgentEventEmitter,
  WebAgentEventType,
  type AIGenerationEventData,
  type TaskCompleteEventData,
  type TaskAbortedEventData,
  type TaskMetricsEventData,
} from "../src/events.js";
import type { Logger } from "../src/loggers/types.js";

describe("MetricsCollector", () => {
  let metricsCollector: MetricsCollector;
  let emitter: WebAgentEventEmitter;
  let mockLogger: Logger;

  beforeEach(() => {
    // Create a mock logger with spy functions
    mockLogger = {
      initialize: vi.fn(),
      dispose: vi.fn(),
    };

    metricsCollector = new MetricsCollector(mockLogger);
    emitter = new WebAgentEventEmitter();
    metricsCollector.initialize(emitter);
  });

  afterEach(() => {
    metricsCollector.dispose();
  });

  describe("Event counting", () => {
    it("should track single event type", () => {
      emitter.emitEvent({
        type: WebAgentEventType.TASK_STARTED,
        data: {
          timestamp: Date.now(),
          iterationId: "test-1",
          task: "Test task",
          successCriteria: "Test criteria",
          plan: "Test plan",
          url: "https://example.com",
        },
      });

      const counts = metricsCollector.getEventCounts();
      expect(counts.get(WebAgentEventType.TASK_STARTED)).toBe(1);
    });

    it("should track multiple occurrences of same event type", () => {
      const eventData = {
        timestamp: Date.now(),
        iterationId: "test-1",
        reasoning: "Test reasoning",
      };

      emitter.emitEvent({
        type: WebAgentEventType.AGENT_REASONED,
        data: eventData,
      });
      emitter.emitEvent({
        type: WebAgentEventType.AGENT_REASONED,
        data: eventData,
      });
      emitter.emitEvent({
        type: WebAgentEventType.AGENT_REASONED,
        data: eventData,
      });

      const counts = metricsCollector.getEventCounts();
      expect(counts.get(WebAgentEventType.AGENT_REASONED)).toBe(3);
    });

    it("should track multiple different event types", () => {
      emitter.emitEvent({
        type: WebAgentEventType.TASK_STARTED,
        data: {
          timestamp: Date.now(),
          iterationId: "test-1",
          task: "Test task",
          successCriteria: "Test criteria",
          plan: "Test plan",
          url: "https://example.com",
        },
      });

      emitter.emitEvent({
        type: WebAgentEventType.AGENT_REASONED,
        data: {
          timestamp: Date.now(),
          iterationId: "test-1",
          reasoning: "Test reasoning",
        },
      });

      emitter.emitEvent({
        type: WebAgentEventType.BROWSER_NAVIGATED,
        data: {
          timestamp: Date.now(),
          iterationId: "test-1",
          title: "Test Page",
          url: "https://example.com",
        },
      });

      const counts = metricsCollector.getEventCounts();
      expect(counts.get(WebAgentEventType.TASK_STARTED)).toBe(1);
      expect(counts.get(WebAgentEventType.AGENT_REASONED)).toBe(1);
      expect(counts.get(WebAgentEventType.BROWSER_NAVIGATED)).toBe(1);
      expect(counts.size).toBe(3);
    });

    it("should return empty map initially", () => {
      const counts = metricsCollector.getEventCounts();
      expect(counts.size).toBe(0);
    });

    it("should track all standard event types", () => {
      const testEvents = [
        WebAgentEventType.TASK_SETUP,
        WebAgentEventType.TASK_STARTED,
        WebAgentEventType.AGENT_STEP,
        WebAgentEventType.AGENT_REASONED,
        WebAgentEventType.BROWSER_ACTION_STARTED,
        WebAgentEventType.BROWSER_ACTION_COMPLETED,
        WebAgentEventType.BROWSER_NAVIGATED,
      ];

      // Emit minimal event data - we're only testing counting, not validation
      testEvents.forEach((eventType) => {
        emitter.emitEvent({
          type: eventType,
          data: {
            timestamp: Date.now(),
            iterationId: "test-1",
          } as any, // Explicitly cast as any to bypass type checking for this test
        });
      });

      const counts = metricsCollector.getEventCounts();
      // AGENT_STEP now emits TASK_METRICS_INCREMENTAL, so we get 1 extra event
      expect(counts.size).toBe(testEvents.length + 1);

      testEvents.forEach((eventType) => {
        expect(counts.get(eventType)).toBe(1);
      });

      // Verify TASK_METRICS_INCREMENTAL was automatically emitted after AGENT_STEP
      expect(counts.get(WebAgentEventType.TASK_METRICS_INCREMENTAL)).toBe(1);
    });
  });

  describe("dispose", () => {
    it("should clear event counts on dispose", () => {
      emitter.emitEvent({
        type: WebAgentEventType.AGENT_REASONED,
        data: {
          timestamp: Date.now(),
          iterationId: "test-1",
          reasoning: "Test reasoning",
        },
      });

      let counts = metricsCollector.getEventCounts();
      expect(counts.size).toBe(1);

      metricsCollector.dispose();

      counts = metricsCollector.getEventCounts();
      expect(counts.size).toBe(0);
    });

    it("should not count events after dispose", () => {
      metricsCollector.dispose();

      emitter.emitEvent({
        type: WebAgentEventType.AGENT_REASONED,
        data: {
          timestamp: Date.now(),
          iterationId: "test-1",
          reasoning: "Test reasoning",
        },
      });

      const counts = metricsCollector.getEventCounts();
      expect(counts.size).toBe(0);
    });

    it("should be safe to call dispose multiple times", () => {
      expect(() => {
        metricsCollector.dispose();
        metricsCollector.dispose();
      }).not.toThrow();
    });
  });

  describe("getEventCounts", () => {
    it("should return a Map", () => {
      const counts = metricsCollector.getEventCounts();
      expect(counts).toBeInstanceOf(Map);
    });

    it("should return the same Map reference", () => {
      const counts1 = metricsCollector.getEventCounts();
      const counts2 = metricsCollector.getEventCounts();
      expect(counts1).toBe(counts2);
    });

    it("should reflect updated counts", () => {
      emitter.emitEvent({
        type: WebAgentEventType.AGENT_STEP,
        data: {
          timestamp: Date.now(),
          iterationId: "test-1",
          currentIteration: 1,
        },
      });

      let counts = metricsCollector.getEventCounts();
      expect(counts.get(WebAgentEventType.AGENT_STEP)).toBe(1);

      emitter.emitEvent({
        type: WebAgentEventType.AGENT_STEP,
        data: {
          timestamp: Date.now(),
          iterationId: "test-1",
          currentIteration: 2,
        },
      });

      counts = metricsCollector.getEventCounts();
      expect(counts.get(WebAgentEventType.AGENT_STEP)).toBe(2);
    });
  });

  describe("Agent step tracking", () => {
    it("should track AGENT_STEP events", () => {
      emitter.emitEvent({
        type: WebAgentEventType.AGENT_STEP,
        data: {
          timestamp: Date.now(),
          iterationId: "test-1",
          currentIteration: 1,
        },
      });

      emitter.emitEvent({
        type: WebAgentEventType.AGENT_STEP,
        data: {
          timestamp: Date.now(),
          iterationId: "test-1",
          currentIteration: 2,
        },
      });

      // Trigger metrics emission to check the count
      const metricsListener = vi.fn();
      emitter.onEvent(WebAgentEventType.TASK_METRICS, metricsListener);

      emitter.emitEvent({
        type: WebAgentEventType.TASK_COMPLETED,
        data: {
          timestamp: Date.now(),
          iterationId: "test-1",
          finalAnswer: "Done",
        },
      });

      expect(metricsListener).toHaveBeenCalledTimes(1);
      const metricsData = metricsListener.mock.calls[0][0] as TaskMetricsEventData;
      expect(metricsData.stepCount).toBe(2);
    });
  });

  describe("AI generation tracking", () => {
    it("should track AI_GENERATION events and token usage", () => {
      const generationData: AIGenerationEventData = {
        timestamp: Date.now(),
        iterationId: "test-1",
        prompt: "test prompt",
        schema: {},
        messages: [],
        object: {},
        finishReason: "stop",
        usage: {
          totalTokens: 150,
          inputTokens: 100,
          outputTokens: 50,
        },
        providerMetadata: {},
        warnings: [],
      };

      emitter.emitEvent({
        type: WebAgentEventType.AI_GENERATION,
        data: generationData,
      });

      emitter.emitEvent({
        type: WebAgentEventType.AI_GENERATION,
        data: {
          ...generationData,
          usage: {
            totalTokens: 275,
            inputTokens: 200,
            outputTokens: 75,
          },
        },
      });

      // Trigger metrics emission
      const metricsListener = vi.fn();
      emitter.onEvent(WebAgentEventType.TASK_METRICS, metricsListener);

      emitter.emitEvent({
        type: WebAgentEventType.TASK_COMPLETED,
        data: {
          timestamp: Date.now(),
          iterationId: "test-1",
          finalAnswer: "Done",
        },
      });

      expect(metricsListener).toHaveBeenCalledTimes(1);
      const metricsData = metricsListener.mock.calls[0][0] as TaskMetricsEventData;
      expect(metricsData.aiGenerationCount).toBe(2);
      expect(metricsData.totalInputTokens).toBe(300);
      expect(metricsData.totalOutputTokens).toBe(125);
    });

    it("should handle missing token values gracefully", () => {
      const generationData: AIGenerationEventData = {
        timestamp: Date.now(),
        iterationId: "test-1",
        prompt: "test prompt",
        schema: {},
        messages: [],
        object: {},
        finishReason: "stop",
        usage: {
          totalTokens: 150,
          inputTokens: undefined,
          outputTokens: undefined,
        },
        providerMetadata: {},
        warnings: [],
      };

      emitter.emitEvent({
        type: WebAgentEventType.AI_GENERATION,
        data: generationData,
      });

      const metricsListener = vi.fn();
      emitter.onEvent(WebAgentEventType.TASK_METRICS, metricsListener);

      emitter.emitEvent({
        type: WebAgentEventType.TASK_COMPLETED,
        data: {
          timestamp: Date.now(),
          iterationId: "test-1",
          finalAnswer: "Done",
        },
      });

      expect(metricsListener).toHaveBeenCalledTimes(1);
      const metricsData = metricsListener.mock.calls[0][0] as TaskMetricsEventData;
      expect(metricsData.totalInputTokens).toBe(0);
      expect(metricsData.totalOutputTokens).toBe(0);
    });
  });

  describe("AI generation error tracking", () => {
    it("should track AI_GENERATION_ERROR events", () => {
      emitter.emitEvent({
        type: WebAgentEventType.AI_GENERATION_ERROR,
        data: {
          timestamp: Date.now(),
          iterationId: "test-1",
          prompt: "test prompt",
          error: "API error",
          schema: {},
          messages: [],
        },
      });

      emitter.emitEvent({
        type: WebAgentEventType.AI_GENERATION_ERROR,
        data: {
          timestamp: Date.now(),
          iterationId: "test-1",
          prompt: "test prompt",
          error: "Another error",
          schema: {},
          messages: [],
        },
      });

      const metricsListener = vi.fn();
      emitter.onEvent(WebAgentEventType.TASK_METRICS, metricsListener);

      emitter.emitEvent({
        type: WebAgentEventType.TASK_COMPLETED,
        data: {
          timestamp: Date.now(),
          iterationId: "test-1",
          finalAnswer: "Done",
        },
      });

      expect(metricsListener).toHaveBeenCalledTimes(1);
      const metricsData = metricsListener.mock.calls[0][0] as TaskMetricsEventData;
      expect(metricsData.aiGenerationErrorCount).toBe(2);
    });
  });

  describe("Task completion metrics", () => {
    it("should emit metrics on TASK_COMPLETED", () => {
      const metricsListener = vi.fn();
      emitter.onEvent(WebAgentEventType.TASK_METRICS, metricsListener);

      const completeData: TaskCompleteEventData = {
        timestamp: Date.now(),
        iterationId: "test-1",
        finalAnswer: "Task completed successfully",
      };

      emitter.emitEvent({
        type: WebAgentEventType.TASK_COMPLETED,
        data: completeData,
      });

      expect(metricsListener).toHaveBeenCalledTimes(1);
      const metricsData = metricsListener.mock.calls[0][0] as TaskMetricsEventData;
      expect(metricsData.iterationId).toBe("test-1");
      expect(metricsData.eventCounts).toBeDefined();
      expect(typeof metricsData.eventCounts).toBe("object");
      expect(metricsData.stepCount).toBe(0);
      expect(metricsData.aiGenerationCount).toBe(0);
      expect(metricsData.aiGenerationErrorCount).toBe(0);
      expect(metricsData.totalInputTokens).toBe(0);
      expect(metricsData.totalOutputTokens).toBe(0);
    });

    it("should emit metrics on TASK_ABORTED", () => {
      const metricsListener = vi.fn();
      emitter.onEvent(WebAgentEventType.TASK_METRICS, metricsListener);

      const abortData: TaskAbortedEventData = {
        timestamp: Date.now(),
        iterationId: "test-1",
        reason: "User aborted",
        finalAnswer: "Task was aborted by user",
      };

      emitter.emitEvent({
        type: WebAgentEventType.TASK_ABORTED,
        data: abortData,
      });

      expect(metricsListener).toHaveBeenCalledTimes(1);
      const metricsData = metricsListener.mock.calls[0][0] as TaskMetricsEventData;
      expect(metricsData.iterationId).toBe("test-1");
    });
  });

  describe("Comprehensive metrics tracking", () => {
    it("should track all metrics through a complete task lifecycle", () => {
      // Simulate a task lifecycle with various events
      emitter.emitEvent({
        type: WebAgentEventType.AGENT_STEP,
        data: {
          timestamp: Date.now(),
          iterationId: "test-1",
          currentIteration: 1,
        },
      });

      emitter.emitEvent({
        type: WebAgentEventType.AI_GENERATION,
        data: {
          timestamp: Date.now(),
          iterationId: "test-1",
          prompt: "test",
          schema: {},
          messages: [],
          object: {},
          finishReason: "stop",
          usage: {
            totalTokens: 150,
            inputTokens: 100,
            outputTokens: 50,
          },
          providerMetadata: {},
          warnings: [],
        },
      });

      emitter.emitEvent({
        type: WebAgentEventType.AGENT_STEP,
        data: {
          timestamp: Date.now(),
          iterationId: "test-1",
          currentIteration: 2,
        },
      });

      emitter.emitEvent({
        type: WebAgentEventType.AI_GENERATION_ERROR,
        data: {
          timestamp: Date.now(),
          iterationId: "test-1",
          prompt: "test",
          error: "Error",
          schema: {},
          messages: [],
        },
      });

      emitter.emitEvent({
        type: WebAgentEventType.AI_GENERATION,
        data: {
          timestamp: Date.now(),
          iterationId: "test-1",
          prompt: "test",
          schema: {},
          messages: [],
          object: {},
          finishReason: "stop",
          usage: {
            totalTokens: 225,
            inputTokens: 150,
            outputTokens: 75,
          },
          providerMetadata: {},
          warnings: [],
        },
      });

      const metricsListener = vi.fn();
      emitter.onEvent(WebAgentEventType.TASK_METRICS, metricsListener);

      emitter.emitEvent({
        type: WebAgentEventType.TASK_COMPLETED,
        data: {
          timestamp: Date.now(),
          iterationId: "test-1",
          finalAnswer: "Done",
        },
      });

      expect(metricsListener).toHaveBeenCalledTimes(1);
      const metricsData = metricsListener.mock.calls[0][0] as TaskMetricsEventData;
      expect(metricsData.stepCount).toBe(2);
      expect(metricsData.aiGenerationCount).toBe(2);
      expect(metricsData.aiGenerationErrorCount).toBe(1);
      expect(metricsData.totalInputTokens).toBe(250);
      expect(metricsData.totalOutputTokens).toBe(125);

      // Verify eventCounts includes all event types
      expect(metricsData.eventCounts).toBeDefined();
      expect(metricsData.eventCounts[WebAgentEventType.AGENT_STEP]).toBe(2);
      expect(metricsData.eventCounts[WebAgentEventType.AI_GENERATION]).toBe(2);
      expect(metricsData.eventCounts[WebAgentEventType.AI_GENERATION_ERROR]).toBe(1);
      // Note: TASK_COMPLETED count is incremented after emitTaskMetrics is called,
      // so it's not yet in the eventCounts at emission time
    });
  });

  describe("Event counts in metrics", () => {
    it("should include eventCounts in emitted metrics", () => {
      // Emit various events
      emitter.emitEvent({
        type: WebAgentEventType.AGENT_STEP,
        data: {
          timestamp: Date.now(),
          iterationId: "test-1",
          currentIteration: 1,
        },
      });

      emitter.emitEvent({
        type: WebAgentEventType.BROWSER_NAVIGATED,
        data: {
          timestamp: Date.now(),
          iterationId: "test-1",
          title: "Test Page",
          url: "https://example.com",
        },
      });

      emitter.emitEvent({
        type: WebAgentEventType.AGENT_REASONED,
        data: {
          timestamp: Date.now(),
          iterationId: "test-1",
          reasoning: "Test reasoning",
        },
      });

      const metricsListener = vi.fn();
      emitter.onEvent(WebAgentEventType.TASK_METRICS, metricsListener);

      emitter.emitEvent({
        type: WebAgentEventType.TASK_COMPLETED,
        data: {
          timestamp: Date.now(),
          iterationId: "test-1",
          finalAnswer: "Done",
        },
      });

      expect(metricsListener).toHaveBeenCalledTimes(1);
      const metricsData = metricsListener.mock.calls[0][0] as TaskMetricsEventData;

      // Verify eventCounts structure
      expect(metricsData.eventCounts).toBeDefined();
      expect(typeof metricsData.eventCounts).toBe("object");

      // Verify specific event counts
      expect(metricsData.eventCounts[WebAgentEventType.AGENT_STEP]).toBe(1);
      expect(metricsData.eventCounts[WebAgentEventType.BROWSER_NAVIGATED]).toBe(1);
      expect(metricsData.eventCounts[WebAgentEventType.AGENT_REASONED]).toBe(1);
      // Note: TASK_COMPLETED and TASK_METRICS counts are incremented during/after
      // emitTaskMetrics is called, so the snapshot at emission time doesn't include them
    });
  });

  describe("Metric reset on initialize", () => {
    it("should reset all metrics when initialized", () => {
      // Add some events
      emitter.emitEvent({
        type: WebAgentEventType.AGENT_STEP,
        data: {
          timestamp: Date.now(),
          iterationId: "test-1",
          currentIteration: 1,
        },
      });

      emitter.emitEvent({
        type: WebAgentEventType.AI_GENERATION,
        data: {
          timestamp: Date.now(),
          iterationId: "test-1",
          prompt: "test",
          schema: {},
          messages: [],
          object: {},
          finishReason: "stop",
          usage: {
            totalTokens: 150,
            inputTokens: 100,
            outputTokens: 50,
          },
          providerMetadata: {},
          warnings: [],
        },
      });

      // Re-initialize
      const newEmitter = new WebAgentEventEmitter();
      metricsCollector.initialize(newEmitter);

      // Emit completion to get metrics
      const metricsListener = vi.fn();
      newEmitter.onEvent(WebAgentEventType.TASK_METRICS, metricsListener);

      newEmitter.emitEvent({
        type: WebAgentEventType.TASK_COMPLETED,
        data: {
          timestamp: Date.now(),
          iterationId: "test-2",
          finalAnswer: "Done",
        },
      });

      expect(metricsListener).toHaveBeenCalledTimes(1);
      const metricsData = metricsListener.mock.calls[0][0] as TaskMetricsEventData;
      expect(metricsData.stepCount).toBe(0);
      expect(metricsData.aiGenerationCount).toBe(0);
      expect(metricsData.totalInputTokens).toBe(0);
      expect(metricsData.totalOutputTokens).toBe(0);
    });
  });
});

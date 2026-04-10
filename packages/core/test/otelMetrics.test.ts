import { describe, it, expect, vi, beforeEach } from "vitest";
import { WebAgentEventEmitter, WebAgentEventType } from "../src/events.js";

// Mock the tracing module before importing OTelMetricsLogger
vi.mock("../src/telemetry/tracing.js", () => ({
  getOTelApi: vi.fn(),
}));

import { getOTelApi } from "../src/telemetry/tracing.js";
import { OTelMetricsLogger } from "../src/loggers/otelMetrics.js";
import type { Logger } from "../src/loggers/types.js";

function makeMockLogger(): Logger {
  return { initialize: vi.fn(), dispose: vi.fn() };
}

function makeMockMeter() {
  const counters = new Map<string, { add: ReturnType<typeof vi.fn> }>();
  const histograms = new Map<string, { record: ReturnType<typeof vi.fn> }>();

  const meter = {
    createCounter: vi.fn((name: string) => {
      const counter = { add: vi.fn() };
      counters.set(name, counter);
      return counter;
    }),
    createHistogram: vi.fn((name: string) => {
      const histogram = { record: vi.fn() };
      histograms.set(name, histogram);
      return histogram;
    }),
    _counters: counters,
    _histograms: histograms,
  };

  return meter;
}

function makeMockApi(meter: ReturnType<typeof makeMockMeter>) {
  return {
    metrics: {
      getMeter: vi.fn(() => meter),
    },
  };
}

describe("OTelMetricsLogger (OTel available)", () => {
  let logger: OTelMetricsLogger;
  let emitter: WebAgentEventEmitter;
  let mockMeter: ReturnType<typeof makeMockMeter>;

  beforeEach(async () => {
    mockMeter = makeMockMeter();
    const mockApi = makeMockApi(mockMeter);
    vi.mocked(getOTelApi).mockResolvedValue(mockApi as any);

    logger = new OTelMetricsLogger(makeMockLogger());
    emitter = new WebAgentEventEmitter();
    await logger.initialize(emitter);
  });

  it("creates a meter with the correct name", async () => {
    const freshMeter = makeMockMeter();
    const mockApi = makeMockApi(freshMeter);
    vi.mocked(getOTelApi).mockResolvedValue(mockApi as any);
    const freshLogger = new OTelMetricsLogger(makeMockLogger());
    const freshEmitter = new WebAgentEventEmitter();
    await freshLogger.initialize(freshEmitter);
    expect(mockApi.metrics.getMeter).toHaveBeenCalledWith("pilo-core");
    freshLogger.dispose();
  });

  it("creates counters and histograms on initialize", () => {
    const counterNames = mockMeter.createCounter.mock.calls.map((c) => c[0]);
    const histogramNames = mockMeter.createHistogram.mock.calls.map((c) => c[0]);

    expect(counterNames).toContain("pilo.task.count");
    expect(counterNames).toContain("pilo.task.success");
    expect(counterNames).toContain("pilo.task.failure");
    expect(counterNames).toContain("pilo.agent.steps");
    expect(counterNames).toContain("pilo.ai.generations");
    expect(counterNames).toContain("pilo.ai.errors");
    expect(counterNames).toContain("pilo.ai.tokens.input");
    expect(counterNames).toContain("pilo.ai.tokens.output");
    expect(counterNames).toContain("pilo.browser.actions");
    expect(counterNames).toContain("pilo.browser.action.errors");
    expect(counterNames).toContain("pilo.browser.navigations");
    expect(counterNames).toContain("pilo.browser.screenshots");
    expect(counterNames).toContain("pilo.browser.reconnects");
    expect(counterNames).toContain("pilo.cdp.endpoint_cycles");
    expect(counterNames).toContain("pilo.validation.quality");

    expect(histogramNames).toContain("pilo.task.duration");
    expect(histogramNames).toContain("pilo.browser.action.duration");
  });

  it("increments task.count on TASK_COMPLETED", () => {
    emitter.emitEvent({
      type: WebAgentEventType.TASK_SETUP,
      data: {
        timestamp: Date.now(),
        iterationId: "iter-1",
        task: "test task",
        browserName: "chromium",
        provider: "openai",
        model: "gpt-4",
      },
    });

    emitter.emitEvent({
      type: WebAgentEventType.TASK_COMPLETED,
      data: {
        timestamp: Date.now(),
        iterationId: "iter-1",
        finalAnswer: "done",
        success: true,
      },
    });

    // Find the call for pilo.task.count
    const taskCountAdd = findCounterAdd(mockMeter, "pilo.task.count");
    expect(taskCountAdd).toHaveBeenCalled();
  });

  it("increments task.count on TASK_ABORTED", () => {
    emitter.emitEvent({
      type: WebAgentEventType.TASK_ABORTED,
      data: {
        timestamp: Date.now(),
        iterationId: "iter-1",
        reason: "timeout",
        finalAnswer: "aborted",
      },
    });

    const taskCountAdd = findCounterAdd(mockMeter, "pilo.task.count");
    expect(taskCountAdd).toHaveBeenCalled();
  });

  it("increments task.success on TASK_COMPLETED with success=true", () => {
    emitter.emitEvent({
      type: WebAgentEventType.TASK_COMPLETED,
      data: {
        timestamp: Date.now(),
        iterationId: "iter-1",
        finalAnswer: "done",
        success: true,
      },
    });

    const successAdd = findCounterAdd(mockMeter, "pilo.task.success");
    expect(successAdd).toHaveBeenCalled();
  });

  it("increments task.failure on TASK_COMPLETED with success=false", () => {
    emitter.emitEvent({
      type: WebAgentEventType.TASK_COMPLETED,
      data: {
        timestamp: Date.now(),
        iterationId: "iter-1",
        finalAnswer: "failed",
        success: false,
      },
    });

    const failureAdd = findCounterAdd(mockMeter, "pilo.task.failure");
    expect(failureAdd).toHaveBeenCalled();
  });

  it("increments task.failure on TASK_ABORTED", () => {
    emitter.emitEvent({
      type: WebAgentEventType.TASK_ABORTED,
      data: {
        timestamp: Date.now(),
        iterationId: "iter-1",
        reason: "user abort",
        finalAnswer: "aborted",
      },
    });

    const failureAdd = findCounterAdd(mockMeter, "pilo.task.failure");
    expect(failureAdd).toHaveBeenCalled();
  });

  it("records task.duration on TASK_COMPLETED using TASK_SETUP timestamp", async () => {
    const setupTime = Date.now() - 1000; // 1 second ago

    emitter.emitEvent({
      type: WebAgentEventType.TASK_SETUP,
      data: {
        timestamp: setupTime,
        iterationId: "iter-1",
        task: "test task",
        browserName: "chromium",
        provider: "openai",
        model: "gpt-4",
      },
    });

    emitter.emitEvent({
      type: WebAgentEventType.TASK_COMPLETED,
      data: {
        timestamp: Date.now(),
        iterationId: "iter-1",
        finalAnswer: "done",
        success: true,
      },
    });

    const durationRecord = findHistogramRecord(mockMeter, "pilo.task.duration");
    expect(durationRecord).toHaveBeenCalled();
    const [duration] = durationRecord.mock.calls[0];
    expect(duration).toBeGreaterThanOrEqual(900); // at least ~1 second in ms
    expect(duration).toBeLessThan(10000); // sanity cap
  });

  it("increments agent.steps on AGENT_STEP", () => {
    emitter.emitEvent({
      type: WebAgentEventType.AGENT_STEP,
      data: {
        timestamp: Date.now(),
        iterationId: "iter-1",
        currentIteration: 1,
      },
    });

    const stepsAdd = findCounterAdd(mockMeter, "pilo.agent.steps");
    expect(stepsAdd).toHaveBeenCalled();
  });

  it("records AI token usage on AI_GENERATION", () => {
    emitter.emitEvent({
      type: WebAgentEventType.AI_GENERATION,
      data: {
        timestamp: Date.now(),
        iterationId: "iter-1",
        prompt: "test prompt",
        schema: {},
        messages: [],
        object: {},
        finishReason: "stop",
        usage: {
          totalTokens: 150,
          inputTokens: 100,
          outputTokens: 50,
          inputTokenDetails: {
            noCacheTokens: 100,
            cacheReadTokens: 0,
            cacheWriteTokens: 0,
          },
          outputTokenDetails: {
            textTokens: 50,
            reasoningTokens: 0,
          },
        },
        providerMetadata: {},
        warnings: [],
      },
    });

    const generationsAdd = findCounterAdd(mockMeter, "pilo.ai.generations");
    expect(generationsAdd).toHaveBeenCalled();

    const inputTokensAdd = findCounterAdd(mockMeter, "pilo.ai.tokens.input");
    expect(inputTokensAdd).toHaveBeenCalled();
    const [inputCount] = inputTokensAdd.mock.calls[0];
    expect(inputCount).toBe(100);

    const outputTokensAdd = findCounterAdd(mockMeter, "pilo.ai.tokens.output");
    expect(outputTokensAdd).toHaveBeenCalled();
    const [outputCount] = outputTokensAdd.mock.calls[0];
    expect(outputCount).toBe(50);
  });

  it("increments ai.errors on AI_GENERATION_ERROR", () => {
    emitter.emitEvent({
      type: WebAgentEventType.AI_GENERATION_ERROR,
      data: {
        timestamp: Date.now(),
        iterationId: "iter-1",
        prompt: "test",
        error: "API error",
        schema: {},
        messages: [],
      },
    });

    const errorsAdd = findCounterAdd(mockMeter, "pilo.ai.errors");
    expect(errorsAdd).toHaveBeenCalled();
  });

  it("records browser action duration from STARTED to COMPLETED", () => {
    const startTime = Date.now() - 500; // 500ms ago

    emitter.emitEvent({
      type: WebAgentEventType.BROWSER_ACTION_STARTED,
      data: {
        timestamp: startTime,
        iterationId: "iter-1",
        action: "click",
        ref: "btn-1",
      },
    });

    emitter.emitEvent({
      type: WebAgentEventType.BROWSER_ACTION_COMPLETED,
      data: {
        timestamp: Date.now(),
        iterationId: "iter-1",
        success: true,
      },
    });

    const actionDurationRecord = findHistogramRecord(mockMeter, "pilo.browser.action.duration");
    expect(actionDurationRecord).toHaveBeenCalled();
    const [duration] = actionDurationRecord.mock.calls[0];
    expect(duration).toBeGreaterThanOrEqual(400); // at least ~500ms
    expect(duration).toBeLessThan(5000); // sanity cap
  });

  it("increments browser.actions on BROWSER_ACTION_COMPLETED", () => {
    emitter.emitEvent({
      type: WebAgentEventType.BROWSER_ACTION_COMPLETED,
      data: {
        timestamp: Date.now(),
        iterationId: "iter-1",
        success: true,
      },
    });

    const actionsAdd = findCounterAdd(mockMeter, "pilo.browser.actions");
    expect(actionsAdd).toHaveBeenCalled();
  });

  it("increments browser.action.errors on failed BROWSER_ACTION_COMPLETED", () => {
    emitter.emitEvent({
      type: WebAgentEventType.BROWSER_ACTION_COMPLETED,
      data: {
        timestamp: Date.now(),
        iterationId: "iter-1",
        success: false,
        error: "element not found",
      },
    });

    const actionErrorsAdd = findCounterAdd(mockMeter, "pilo.browser.action.errors");
    expect(actionErrorsAdd).toHaveBeenCalled();
  });

  it("increments browser.navigations on BROWSER_NAVIGATED", () => {
    emitter.emitEvent({
      type: WebAgentEventType.BROWSER_NAVIGATED,
      data: {
        timestamp: Date.now(),
        iterationId: "iter-1",
        title: "Test Page",
        url: "https://example.com",
      },
    });

    const navigationsAdd = findCounterAdd(mockMeter, "pilo.browser.navigations");
    expect(navigationsAdd).toHaveBeenCalled();
  });

  it("increments browser.screenshots on BROWSER_SCREENSHOT_CAPTURED", () => {
    emitter.emitEvent({
      type: WebAgentEventType.BROWSER_SCREENSHOT_CAPTURED,
      data: {
        timestamp: Date.now(),
        iterationId: "iter-1",
        size: 51200,
        format: "jpeg",
      },
    });

    const screenshotsAdd = findCounterAdd(mockMeter, "pilo.browser.screenshots");
    expect(screenshotsAdd).toHaveBeenCalled();
  });

  it("increments browser.reconnects on BROWSER_RECONNECTED", () => {
    emitter.emitEvent({
      type: WebAgentEventType.BROWSER_RECONNECTED,
      data: {
        timestamp: Date.now(),
        iterationId: "iter-1",
        startingUrl: "https://example.com",
        endpointIndex: 1,
        total: 2,
      },
    });

    const reconnectsAdd = findCounterAdd(mockMeter, "pilo.browser.reconnects");
    expect(reconnectsAdd).toHaveBeenCalled();
  });

  it("increments cdp.endpoint_cycles on CDP_ENDPOINT_CYCLE", () => {
    emitter.emitEvent({
      type: WebAgentEventType.CDP_ENDPOINT_CYCLE,
      data: {
        timestamp: Date.now(),
        iterationId: "iter-1",
        attempt: 1,
        total: 2,
        error: "ConnectionRefused",
      },
    });

    const cyclesAdd = findCounterAdd(mockMeter, "pilo.cdp.endpoint_cycles");
    expect(cyclesAdd).toHaveBeenCalled();
  });

  it("increments validation.quality on TASK_VALIDATED", () => {
    emitter.emitEvent({
      type: WebAgentEventType.TASK_VALIDATED,
      data: {
        timestamp: Date.now(),
        iterationId: "iter-1",
        observation: "task done",
        completionQuality: "complete",
        finalAnswer: "success",
      },
    });

    const validationAdd = findCounterAdd(mockMeter, "pilo.validation.quality");
    expect(validationAdd).toHaveBeenCalled();
    const [, attrs] = validationAdd.mock.calls[0];
    expect(attrs).toMatchObject({ "pilo.validation.quality": "complete" });
  });

  it("captures provider and model from TASK_SETUP as attributes on subsequent metrics", () => {
    emitter.emitEvent({
      type: WebAgentEventType.TASK_SETUP,
      data: {
        timestamp: Date.now(),
        iterationId: "iter-1",
        task: "test task",
        browserName: "chromium",
        provider: "anthropic",
        model: "claude-3-sonnet",
      },
    });

    emitter.emitEvent({
      type: WebAgentEventType.AGENT_STEP,
      data: {
        timestamp: Date.now(),
        iterationId: "iter-1",
        currentIteration: 1,
      },
    });

    const stepsAdd = findCounterAdd(mockMeter, "pilo.agent.steps");
    expect(stepsAdd).toHaveBeenCalled();
    const [, attrs] = stepsAdd.mock.calls[0];
    expect(attrs).toMatchObject({ "pilo.provider": "anthropic", "pilo.model": "claude-3-sonnet" });
  });

  it("cleans up listeners on dispose", () => {
    const relevantEventTypes = [
      WebAgentEventType.TASK_SETUP,
      WebAgentEventType.TASK_COMPLETED,
      WebAgentEventType.TASK_ABORTED,
      WebAgentEventType.AGENT_STEP,
      WebAgentEventType.AI_GENERATION,
      WebAgentEventType.AI_GENERATION_ERROR,
      WebAgentEventType.BROWSER_ACTION_STARTED,
      WebAgentEventType.BROWSER_ACTION_COMPLETED,
      WebAgentEventType.BROWSER_NAVIGATED,
      WebAgentEventType.BROWSER_SCREENSHOT_CAPTURED,
      WebAgentEventType.BROWSER_RECONNECTED,
      WebAgentEventType.CDP_ENDPOINT_CYCLE,
      WebAgentEventType.TASK_VALIDATED,
    ];

    // All events should have listeners after initialize
    relevantEventTypes.forEach((eventType) => {
      expect(emitter.listenerCount(eventType)).toBeGreaterThan(0);
    });

    logger.dispose();

    // After dispose, no listeners
    relevantEventTypes.forEach((eventType) => {
      expect(emitter.listenerCount(eventType)).toBe(0);
    });
  });

  it("is safe to call dispose multiple times", () => {
    expect(() => {
      logger.dispose();
      logger.dispose();
    }).not.toThrow();
  });

  it("is safe to call dispose without initializing", () => {
    const uninitializedLogger = new OTelMetricsLogger(makeMockLogger());
    expect(() => uninitializedLogger.dispose()).not.toThrow();
  });
});

describe("OTelMetricsLogger (OTel unavailable)", () => {
  beforeEach(() => {
    vi.mocked(getOTelApi).mockResolvedValue(undefined);
  });

  it("becomes inert when getOTelApi returns undefined", async () => {
    const logger = new OTelMetricsLogger(makeMockLogger());
    const emitter = new WebAgentEventEmitter();

    await logger.initialize(emitter);

    // No listeners should be registered on the emitter
    const eventTypes = [
      WebAgentEventType.TASK_SETUP,
      WebAgentEventType.TASK_COMPLETED,
      WebAgentEventType.AGENT_STEP,
      WebAgentEventType.AI_GENERATION,
    ];
    eventTypes.forEach((eventType) => {
      expect(emitter.listenerCount(eventType)).toBe(0);
    });

    // Emitting events should not throw
    expect(() => {
      emitter.emitEvent({
        type: WebAgentEventType.TASK_COMPLETED,
        data: {
          timestamp: Date.now(),
          iterationId: "iter-1",
          finalAnswer: "done",
          success: true,
        },
      });
    }).not.toThrow();

    logger.dispose();
  });

  it("dispose is safe when inert", async () => {
    const logger = new OTelMetricsLogger(makeMockLogger());
    const emitter = new WebAgentEventEmitter();
    await logger.initialize(emitter);

    expect(() => logger.dispose()).not.toThrow();
  });
});

describe("OTelMetricsLogger (wrapped logger delegation)", () => {
  it("initializes and disposes the wrapped logger", async () => {
    const wrappedLogger = makeMockLogger();
    vi.mocked(getOTelApi).mockResolvedValue(undefined);

    const logger = new OTelMetricsLogger(wrappedLogger);
    const emitter = new WebAgentEventEmitter();
    await logger.initialize(emitter);

    expect(wrappedLogger.initialize).toHaveBeenCalledWith(emitter);

    logger.dispose();
    expect(wrappedLogger.dispose).toHaveBeenCalled();
  });

  it("delegates to wrapped logger even when OTel is available", async () => {
    const wrappedLogger = makeMockLogger();
    const mockMeter = makeMockMeter();
    vi.mocked(getOTelApi).mockResolvedValue(makeMockApi(mockMeter) as any);

    const logger = new OTelMetricsLogger(wrappedLogger);
    const emitter = new WebAgentEventEmitter();
    await logger.initialize(emitter);

    expect(wrappedLogger.initialize).toHaveBeenCalledWith(emitter);

    logger.dispose();
    expect(wrappedLogger.dispose).toHaveBeenCalled();
  });
});

// Helper: find the mock counter's add spy by counter name
function findCounterAdd(
  meter: ReturnType<typeof makeMockMeter>,
  counterName: string,
): ReturnType<typeof vi.fn> {
  const counter = meter._counters.get(counterName);
  if (!counter) throw new Error(`Counter "${counterName}" was never created`);
  return counter.add;
}

// Helper: find the mock histogram's record spy by histogram name
function findHistogramRecord(
  meter: ReturnType<typeof makeMockMeter>,
  histogramName: string,
): ReturnType<typeof vi.fn> {
  const histogram = meter._histograms.get(histogramName);
  if (!histogram) throw new Error(`Histogram "${histogramName}" was never created`);
  return histogram.record;
}

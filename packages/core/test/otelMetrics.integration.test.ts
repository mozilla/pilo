import { describe, it, expect, vi, beforeEach } from "vitest";
import { WebAgentEventEmitter, WebAgentEventType } from "../src/events.js";

vi.mock("../src/telemetry/tracing.js", () => ({
  getOTelApi: vi.fn(),
}));

import { getOTelApi } from "../src/telemetry/tracing.js";
import { OTelMetricsLogger } from "../src/loggers/otelMetrics.js";

function makeMockMeter() {
  const counters = new Map<string, { add: ReturnType<typeof vi.fn> }>();
  const histograms = new Map<string, { record: ReturnType<typeof vi.fn> }>();

  return {
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
}

type MockMeter = ReturnType<typeof makeMockMeter>;

function counter(meter: MockMeter, name: string) {
  const c = meter._counters.get(name);
  if (!c) throw new Error(`Counter "${name}" not found`);
  return c.add;
}

function histogram(meter: MockMeter, name: string) {
  const h = meter._histograms.get(name);
  if (!h) throw new Error(`Histogram "${name}" not found`);
  return h.record;
}

describe("OTelMetricsLogger integration: full task lifecycle", () => {
  let logger: OTelMetricsLogger;
  let emitter: WebAgentEventEmitter;
  let meter: MockMeter;

  beforeEach(async () => {
    meter = makeMockMeter();
    vi.mocked(getOTelApi).mockResolvedValue({
      metrics: { getMeter: vi.fn(() => meter) },
    } as any);

    logger = new OTelMetricsLogger();
    emitter = new WebAgentEventEmitter();
    await logger.initialize(emitter);
  });

  it("records correct metrics for a successful task with multiple steps", () => {
    const baseTime = 1000000;
    const iterationId = "iter-abc";

    // --- TASK_SETUP ---
    emitter.emitEvent({
      type: WebAgentEventType.TASK_SETUP,
      data: {
        timestamp: baseTime,
        iterationId,
        task: "Click the login button",
        browserName: "chromium",
        provider: "openrouter",
        model: "anthropic/claude-sonnet-4-20250514",
      },
    });

    // --- Step 1: AI generates a click action ---
    emitter.emitEvent({
      type: WebAgentEventType.AGENT_STEP,
      data: { timestamp: baseTime + 100, iterationId, currentIteration: 1 },
    });

    emitter.emitEvent({
      type: WebAgentEventType.AI_GENERATION,
      data: {
        timestamp: baseTime + 500,
        iterationId,
        prompt: "",
        schema: {},
        messages: [],
        object: {},
        finishReason: "tool-calls",
        usage: { totalTokens: 300, inputTokens: 200, outputTokens: 100 },
        providerMetadata: {},
        warnings: [],
      },
    });

    emitter.emitEvent({
      type: WebAgentEventType.BROWSER_ACTION_STARTED,
      data: { timestamp: baseTime + 600, iterationId, action: "click", ref: "btn-1" },
    });

    emitter.emitEvent({
      type: WebAgentEventType.BROWSER_ACTION_COMPLETED,
      data: { timestamp: baseTime + 800, iterationId, success: true },
    });

    emitter.emitEvent({
      type: WebAgentEventType.BROWSER_NAVIGATED,
      data: {
        timestamp: baseTime + 900,
        iterationId,
        title: "Dashboard",
        url: "https://app.example.com/dashboard",
      },
    });

    emitter.emitEvent({
      type: WebAgentEventType.BROWSER_SCREENSHOT_CAPTURED,
      data: { timestamp: baseTime + 1000, iterationId, size: 50000, format: "jpeg" },
    });

    // --- Step 2: AI generates a fill action ---
    emitter.emitEvent({
      type: WebAgentEventType.AGENT_STEP,
      data: { timestamp: baseTime + 1100, iterationId, currentIteration: 2 },
    });

    emitter.emitEvent({
      type: WebAgentEventType.AI_GENERATION,
      data: {
        timestamp: baseTime + 1500,
        iterationId,
        prompt: "",
        schema: {},
        messages: [],
        object: {},
        finishReason: "tool-calls",
        usage: { totalTokens: 250, inputTokens: 150, outputTokens: 100 },
        providerMetadata: {},
        warnings: [],
      },
    });

    emitter.emitEvent({
      type: WebAgentEventType.BROWSER_ACTION_STARTED,
      data: {
        timestamp: baseTime + 1600,
        iterationId,
        action: "fill",
        ref: "input-1",
        value: "hello",
      },
    });

    emitter.emitEvent({
      type: WebAgentEventType.BROWSER_ACTION_COMPLETED,
      data: { timestamp: baseTime + 1700, iterationId, success: true },
    });

    // --- Step 3: done ---
    emitter.emitEvent({
      type: WebAgentEventType.AGENT_STEP,
      data: { timestamp: baseTime + 1800, iterationId, currentIteration: 3 },
    });

    emitter.emitEvent({
      type: WebAgentEventType.AI_GENERATION,
      data: {
        timestamp: baseTime + 2000,
        iterationId,
        prompt: "",
        schema: {},
        messages: [],
        object: {},
        finishReason: "tool-calls",
        usage: { totalTokens: 100, inputTokens: 80, outputTokens: 20 },
        providerMetadata: {},
        warnings: [],
      },
    });

    // --- Validation ---
    emitter.emitEvent({
      type: WebAgentEventType.TASK_VALIDATED,
      data: {
        timestamp: baseTime + 2200,
        iterationId,
        observation: "Task completed successfully",
        completionQuality: "complete",
        finalAnswer: "Logged in and filled form",
      },
    });

    // --- TASK_COMPLETED ---
    emitter.emitEvent({
      type: WebAgentEventType.TASK_COMPLETED,
      data: {
        timestamp: baseTime + 2500,
        iterationId,
        finalAnswer: "Logged in and filled form",
        success: true,
      },
    });

    // --- Verify aggregated metrics ---
    const attrs = {
      "pilo.provider": "openrouter",
      "pilo.model": "anthropic/claude-sonnet-4-20250514",
    };

    // Task metrics
    expect(counter(meter, "pilo.task.count")).toHaveBeenCalledTimes(1);
    expect(counter(meter, "pilo.task.success")).toHaveBeenCalledTimes(1);
    expect(counter(meter, "pilo.task.failure")).not.toHaveBeenCalled();

    // Duration: 2500 - 1000000 start = 2500 (task completed timestamp - setup timestamp)
    const durationRecord = histogram(meter, "pilo.task.duration");
    expect(durationRecord).toHaveBeenCalledTimes(1);
    expect(durationRecord.mock.calls[0][0]).toBe(2500); // baseTime + 2500 - baseTime

    // Steps
    expect(counter(meter, "pilo.agent.steps")).toHaveBeenCalledTimes(3);

    // AI generations
    expect(counter(meter, "pilo.ai.generations")).toHaveBeenCalledTimes(3);
    expect(counter(meter, "pilo.ai.errors")).not.toHaveBeenCalled();

    // Token totals: 200+150+80 input, 100+100+20 output
    const inputCalls = counter(meter, "pilo.ai.tokens.input").mock.calls;
    const totalInput = inputCalls.reduce((sum: number, call: any[]) => sum + call[0], 0);
    expect(totalInput).toBe(430);

    const outputCalls = counter(meter, "pilo.ai.tokens.output").mock.calls;
    const totalOutput = outputCalls.reduce((sum: number, call: any[]) => sum + call[0], 0);
    expect(totalOutput).toBe(220);

    // Browser actions
    expect(counter(meter, "pilo.browser.actions")).toHaveBeenCalledTimes(2);
    expect(counter(meter, "pilo.browser.action.errors")).not.toHaveBeenCalled();

    // Action durations: 800-600=200ms, 1700-1600=100ms
    const actionDurationCalls = histogram(meter, "pilo.browser.action.duration").mock.calls;
    expect(actionDurationCalls).toHaveLength(2);
    expect(actionDurationCalls[0][0]).toBe(200);
    expect(actionDurationCalls[1][0]).toBe(100);

    // Navigation and screenshots
    expect(counter(meter, "pilo.browser.navigations")).toHaveBeenCalledTimes(1);
    expect(counter(meter, "pilo.browser.screenshots")).toHaveBeenCalledTimes(1);

    // Validation
    const validationAdd = counter(meter, "pilo.validation.quality");
    expect(validationAdd).toHaveBeenCalledTimes(1);
    expect(validationAdd.mock.calls[0][1]).toMatchObject({
      ...attrs,
      "pilo.validation.quality": "complete",
    });

    // All counters should carry provider/model attributes
    const stepsAttrs = counter(meter, "pilo.agent.steps").mock.calls[0][1];
    expect(stepsAttrs).toMatchObject(attrs);
  });

  it("records correct metrics for a failed task with browser errors", () => {
    const baseTime = 2000000;
    const iterationId = "iter-fail";

    emitter.emitEvent({
      type: WebAgentEventType.TASK_SETUP,
      data: {
        timestamp: baseTime,
        iterationId,
        task: "Submit form",
        browserName: "chromium",
        provider: "openai",
        model: "gpt-4o",
      },
    });

    // Step 1: browser action fails
    emitter.emitEvent({
      type: WebAgentEventType.AGENT_STEP,
      data: { timestamp: baseTime + 100, iterationId, currentIteration: 1 },
    });

    emitter.emitEvent({
      type: WebAgentEventType.AI_GENERATION,
      data: {
        timestamp: baseTime + 400,
        iterationId,
        prompt: "",
        schema: {},
        messages: [],
        object: {},
        finishReason: "tool-calls",
        usage: { totalTokens: 200, inputTokens: 150, outputTokens: 50 },
        providerMetadata: {},
        warnings: [],
      },
    });

    emitter.emitEvent({
      type: WebAgentEventType.BROWSER_ACTION_STARTED,
      data: { timestamp: baseTime + 500, iterationId, action: "click", ref: "btn-submit" },
    });

    emitter.emitEvent({
      type: WebAgentEventType.BROWSER_ACTION_COMPLETED,
      data: {
        timestamp: baseTime + 600,
        iterationId,
        success: false,
        error: "Element not found",
      },
    });

    // Step 2: AI generation error
    emitter.emitEvent({
      type: WebAgentEventType.AGENT_STEP,
      data: { timestamp: baseTime + 700, iterationId, currentIteration: 2 },
    });

    emitter.emitEvent({
      type: WebAgentEventType.AI_GENERATION_ERROR,
      data: {
        timestamp: baseTime + 900,
        iterationId,
        prompt: "",
        error: "Rate limit exceeded",
        schema: {},
        messages: [],
      },
    });

    // Task aborted
    emitter.emitEvent({
      type: WebAgentEventType.TASK_ABORTED,
      data: {
        timestamp: baseTime + 1000,
        iterationId,
        reason: "Too many errors",
        finalAnswer: "Task failed",
      },
    });

    // Verify failure metrics
    expect(counter(meter, "pilo.task.count")).toHaveBeenCalledTimes(1);
    expect(counter(meter, "pilo.task.failure")).toHaveBeenCalledTimes(1);
    expect(counter(meter, "pilo.task.success")).not.toHaveBeenCalled();

    expect(counter(meter, "pilo.agent.steps")).toHaveBeenCalledTimes(2);
    expect(counter(meter, "pilo.ai.generations")).toHaveBeenCalledTimes(1);
    expect(counter(meter, "pilo.ai.errors")).toHaveBeenCalledTimes(1);

    expect(counter(meter, "pilo.browser.actions")).toHaveBeenCalledTimes(1);
    expect(counter(meter, "pilo.browser.action.errors")).toHaveBeenCalledTimes(1);

    // Action duration: 600-500=100ms
    const actionDurationCalls = histogram(meter, "pilo.browser.action.duration").mock.calls;
    expect(actionDurationCalls).toHaveLength(1);
    expect(actionDurationCalls[0][0]).toBe(100);

    // Provider/model propagated to failure counter
    const failureAttrs = counter(meter, "pilo.task.failure").mock.calls[0][1];
    expect(failureAttrs).toMatchObject({
      "pilo.provider": "openai",
      "pilo.model": "gpt-4o",
    });
  });

  it("records correct metrics for a task with browser reconnection", () => {
    const baseTime = 3000000;
    const iterationId = "iter-reconnect";

    emitter.emitEvent({
      type: WebAgentEventType.TASK_SETUP,
      data: {
        timestamp: baseTime,
        iterationId,
        task: "Navigate and click",
        browserName: "chromium",
      },
    });

    // CDP endpoint cycle (failover attempt)
    emitter.emitEvent({
      type: WebAgentEventType.CDP_ENDPOINT_CYCLE,
      data: {
        timestamp: baseTime + 200,
        iterationId,
        attempt: 1,
        total: 3,
        error: "ConnectionRefused",
      },
    });

    // Browser reconnected
    emitter.emitEvent({
      type: WebAgentEventType.BROWSER_RECONNECTED,
      data: {
        timestamp: baseTime + 500,
        iterationId,
        startingUrl: "https://example.com",
        endpointIndex: 1,
        total: 3,
      },
    });

    // Task completes after reconnect
    emitter.emitEvent({
      type: WebAgentEventType.TASK_COMPLETED,
      data: {
        timestamp: baseTime + 1000,
        iterationId,
        finalAnswer: "Done",
        success: true,
      },
    });

    expect(counter(meter, "pilo.cdp.endpoint_cycles")).toHaveBeenCalledTimes(1);
    expect(counter(meter, "pilo.browser.reconnects")).toHaveBeenCalledTimes(1);
    expect(counter(meter, "pilo.task.success")).toHaveBeenCalledTimes(1);
  });

  it("resets state correctly when re-initialized for a second task", async () => {
    const iterationId = "iter-1";

    // First task
    emitter.emitEvent({
      type: WebAgentEventType.TASK_SETUP,
      data: {
        timestamp: 1000,
        iterationId,
        task: "first",
        browserName: "chromium",
        provider: "openai",
        model: "gpt-4o",
      },
    });

    emitter.emitEvent({
      type: WebAgentEventType.TASK_COMPLETED,
      data: { timestamp: 2000, iterationId, finalAnswer: "done", success: true },
    });

    // Re-initialize with a fresh emitter (simulating a new WebAgent run)
    const emitter2 = new WebAgentEventEmitter();
    await logger.initialize(emitter2);

    // Second task — different provider
    emitter2.emitEvent({
      type: WebAgentEventType.TASK_SETUP,
      data: {
        timestamp: 5000,
        iterationId: "iter-2",
        task: "second",
        browserName: "chromium",
        provider: "anthropic",
        model: "claude-sonnet",
      },
    });

    emitter2.emitEvent({
      type: WebAgentEventType.AGENT_STEP,
      data: { timestamp: 5100, iterationId: "iter-2", currentIteration: 1 },
    });

    // The step from the second task should use the second task's provider/model
    const stepCalls = counter(meter, "pilo.agent.steps").mock.calls;
    const lastStepAttrs = stepCalls[stepCalls.length - 1][1];
    expect(lastStepAttrs).toMatchObject({
      "pilo.provider": "anthropic",
      "pilo.model": "claude-sonnet",
    });

    // Events on the old emitter should no longer produce metrics
    const stepCountBefore = counter(meter, "pilo.agent.steps").mock.calls.length;
    emitter.emitEvent({
      type: WebAgentEventType.AGENT_STEP,
      data: { timestamp: 9999, iterationId, currentIteration: 99 },
    });
    expect(counter(meter, "pilo.agent.steps").mock.calls.length).toBe(stepCountBefore);
  });
});

import { getOTelApi } from "../telemetry/tracing.js";
import {
  WebAgentEventEmitter,
  WebAgentEventType,
  type TaskSetupEventData,
  type TaskCompleteEventData,
  type TaskAbortedEventData,
  type AgentStepEventData,
  type AIGenerationEventData,
  type AIGenerationErrorEventData,
  type ActionExecutionEventData,
  type ActionResultEventData,
  type PageNavigationEventData,
  type ScreenshotCapturedEventData,
  type BrowserReconnectedEventData,
  type CdpEndpointCycleEventData,
  type TaskValidationEventData,
} from "../events.js";

interface Counter {
  add(value: number, attributes?: Record<string, string | number | boolean>): void;
}

interface Histogram {
  record(value: number, attributes?: Record<string, string | number | boolean>): void;
}

/**
 * OTelMetricsLogger bridges WebAgent events into OpenTelemetry counters and histograms.
 * Becomes inert (no subscriptions, no overhead) when @opentelemetry/api is not available.
 */
export class OTelMetricsLogger {
  private emitter: WebAgentEventEmitter | null = null;

  // Common attributes captured from TASK_SETUP
  private commonAttrs: Record<string, string> = {};

  // Timing state
  private taskSetupTimestamp: number | null = null;
  private actionStartTimestamps: Map<string, number> = new Map();

  // Instruments (null when OTel unavailable)
  private taskCount: Counter | null = null;
  private taskDuration: Histogram | null = null;
  private taskSuccess: Counter | null = null;
  private taskFailure: Counter | null = null;
  private agentSteps: Counter | null = null;
  private aiGenerations: Counter | null = null;
  private aiErrors: Counter | null = null;
  private aiTokensInput: Counter | null = null;
  private aiTokensOutput: Counter | null = null;
  private browserActions: Counter | null = null;
  private browserActionDuration: Histogram | null = null;
  private browserActionErrors: Counter | null = null;
  private browserNavigations: Counter | null = null;
  private browserScreenshots: Counter | null = null;
  private browserReconnects: Counter | null = null;
  private cdpEndpointCycles: Counter | null = null;
  private validationQuality: Counter | null = null;

  async initialize(emitter: WebAgentEventEmitter): Promise<void> {
    this.emitter = emitter;
    this.commonAttrs = {};
    this.taskSetupTimestamp = null;
    this.actionStartTimestamps.clear();

    const api = await getOTelApi();
    if (!api) {
      return;
    }

    const meter = api.metrics.getMeter("pilo-core");

    this.taskCount = meter.createCounter("pilo.task.count", {
      unit: "{tasks}",
      description: "Total number of tasks completed or aborted",
    } as any);
    this.taskDuration = meter.createHistogram("pilo.task.duration", {
      unit: "ms",
      description: "Task duration in milliseconds",
    } as any);
    this.taskSuccess = meter.createCounter("pilo.task.success", {
      unit: "{tasks}",
      description: "Number of successfully completed tasks",
    } as any);
    this.taskFailure = meter.createCounter("pilo.task.failure", {
      unit: "{tasks}",
      description: "Number of failed or aborted tasks",
    } as any);
    this.agentSteps = meter.createCounter("pilo.agent.steps", {
      unit: "{steps}",
      description: "Number of agent steps",
    } as any);
    this.aiGenerations = meter.createCounter("pilo.ai.generations", {
      unit: "{generations}",
      description: "Number of AI generation calls",
    } as any);
    this.aiErrors = meter.createCounter("pilo.ai.errors", {
      unit: "{errors}",
      description: "Number of AI generation errors",
    } as any);
    this.aiTokensInput = meter.createCounter("pilo.ai.tokens.input", {
      unit: "{tokens}",
      description: "Total input tokens consumed",
    } as any);
    this.aiTokensOutput = meter.createCounter("pilo.ai.tokens.output", {
      unit: "{tokens}",
      description: "Total output tokens consumed",
    } as any);
    this.browserActions = meter.createCounter("pilo.browser.actions", {
      unit: "{actions}",
      description: "Number of browser actions completed",
    } as any);
    this.browserActionDuration = meter.createHistogram("pilo.browser.action.duration", {
      unit: "ms",
      description: "Browser action duration in milliseconds",
    } as any);
    this.browserActionErrors = meter.createCounter("pilo.browser.action.errors", {
      unit: "{errors}",
      description: "Number of failed browser actions",
    } as any);
    this.browserNavigations = meter.createCounter("pilo.browser.navigations", {
      unit: "{navigations}",
      description: "Number of browser navigations",
    } as any);
    this.browserScreenshots = meter.createCounter("pilo.browser.screenshots", {
      unit: "{screenshots}",
      description: "Number of screenshots captured",
    } as any);
    this.browserReconnects = meter.createCounter("pilo.browser.reconnects", {
      unit: "{reconnects}",
      description: "Number of browser reconnections",
    } as any);
    this.cdpEndpointCycles = meter.createCounter("pilo.cdp.endpoint_cycles", {
      unit: "{cycles}",
      description: "Number of CDP endpoint failover cycles",
    } as any);
    this.validationQuality = meter.createCounter("pilo.validation.quality", {
      unit: "{validations}",
      description: "Number of task validations by quality",
    } as any);

    // Subscribe to events
    emitter.onEvent(WebAgentEventType.TASK_SETUP, this.handleTaskSetup);
    emitter.onEvent(WebAgentEventType.TASK_COMPLETED, this.handleTaskCompleted);
    emitter.onEvent(WebAgentEventType.TASK_ABORTED, this.handleTaskAborted);
    emitter.onEvent(WebAgentEventType.AGENT_STEP, this.handleAgentStep);
    emitter.onEvent(WebAgentEventType.AI_GENERATION, this.handleAiGeneration);
    emitter.onEvent(WebAgentEventType.AI_GENERATION_ERROR, this.handleAiGenerationError);
    emitter.onEvent(WebAgentEventType.BROWSER_ACTION_STARTED, this.handleBrowserActionStarted);
    emitter.onEvent(WebAgentEventType.BROWSER_ACTION_COMPLETED, this.handleBrowserActionCompleted);
    emitter.onEvent(WebAgentEventType.BROWSER_NAVIGATED, this.handleBrowserNavigated);
    emitter.onEvent(
      WebAgentEventType.BROWSER_SCREENSHOT_CAPTURED,
      this.handleBrowserScreenshotCaptured,
    );
    emitter.onEvent(WebAgentEventType.BROWSER_RECONNECTED, this.handleBrowserReconnected);
    emitter.onEvent(WebAgentEventType.CDP_ENDPOINT_CYCLE, this.handleCdpEndpointCycle);
    emitter.onEvent(WebAgentEventType.TASK_VALIDATED, this.handleTaskValidated);
  }

  dispose(): void {
    if (this.emitter) {
      this.emitter.offEvent(WebAgentEventType.TASK_SETUP, this.handleTaskSetup);
      this.emitter.offEvent(WebAgentEventType.TASK_COMPLETED, this.handleTaskCompleted);
      this.emitter.offEvent(WebAgentEventType.TASK_ABORTED, this.handleTaskAborted);
      this.emitter.offEvent(WebAgentEventType.AGENT_STEP, this.handleAgentStep);
      this.emitter.offEvent(WebAgentEventType.AI_GENERATION, this.handleAiGeneration);
      this.emitter.offEvent(WebAgentEventType.AI_GENERATION_ERROR, this.handleAiGenerationError);
      this.emitter.offEvent(
        WebAgentEventType.BROWSER_ACTION_STARTED,
        this.handleBrowserActionStarted,
      );
      this.emitter.offEvent(
        WebAgentEventType.BROWSER_ACTION_COMPLETED,
        this.handleBrowserActionCompleted,
      );
      this.emitter.offEvent(WebAgentEventType.BROWSER_NAVIGATED, this.handleBrowserNavigated);
      this.emitter.offEvent(
        WebAgentEventType.BROWSER_SCREENSHOT_CAPTURED,
        this.handleBrowserScreenshotCaptured,
      );
      this.emitter.offEvent(WebAgentEventType.BROWSER_RECONNECTED, this.handleBrowserReconnected);
      this.emitter.offEvent(WebAgentEventType.CDP_ENDPOINT_CYCLE, this.handleCdpEndpointCycle);
      this.emitter.offEvent(WebAgentEventType.TASK_VALIDATED, this.handleTaskValidated);
    }

    this.emitter = null;
    this.commonAttrs = {};
    this.taskSetupTimestamp = null;
    this.actionStartTimestamps.clear();
  }

  private handleTaskSetup = (data: TaskSetupEventData): void => {
    this.taskSetupTimestamp = data.timestamp;
    this.commonAttrs = {};
    if (data.provider) this.commonAttrs.provider = data.provider;
    if (data.model) this.commonAttrs.model = data.model;
  };

  private handleTaskCompleted = (data: TaskCompleteEventData): void => {
    this.taskCount?.add(1, this.commonAttrs);

    if (this.taskSetupTimestamp !== null) {
      const duration = data.timestamp - this.taskSetupTimestamp;
      this.taskDuration?.record(duration, this.commonAttrs);
    }

    if (data.success === true) {
      this.taskSuccess?.add(1, this.commonAttrs);
    } else if (data.success === false) {
      this.taskFailure?.add(1, this.commonAttrs);
    }
  };

  private handleTaskAborted = (_data: TaskAbortedEventData): void => {
    this.taskCount?.add(1, this.commonAttrs);
    this.taskFailure?.add(1, this.commonAttrs);
  };

  private handleAgentStep = (_data: AgentStepEventData): void => {
    this.agentSteps?.add(1, this.commonAttrs);
  };

  private handleAiGeneration = (data: AIGenerationEventData): void => {
    this.aiGenerations?.add(1, this.commonAttrs);
    this.aiTokensInput?.add(data.usage.inputTokens ?? 0, this.commonAttrs);
    this.aiTokensOutput?.add(data.usage.outputTokens ?? 0, this.commonAttrs);
  };

  private handleAiGenerationError = (_data: AIGenerationErrorEventData): void => {
    this.aiErrors?.add(1, this.commonAttrs);
  };

  private handleBrowserActionStarted = (data: ActionExecutionEventData): void => {
    this.actionStartTimestamps.set(data.iterationId, data.timestamp);
  };

  private handleBrowserActionCompleted = (data: ActionResultEventData): void => {
    this.browserActions?.add(1, this.commonAttrs);

    const startTimestamp = this.actionStartTimestamps.get(data.iterationId);
    if (startTimestamp !== undefined) {
      const duration = data.timestamp - startTimestamp;
      this.browserActionDuration?.record(duration, this.commonAttrs);
      this.actionStartTimestamps.delete(data.iterationId);
    }

    if (!data.success) {
      this.browserActionErrors?.add(1, this.commonAttrs);
    }
  };

  private handleBrowserNavigated = (_data: PageNavigationEventData): void => {
    this.browserNavigations?.add(1, this.commonAttrs);
  };

  private handleBrowserScreenshotCaptured = (_data: ScreenshotCapturedEventData): void => {
    this.browserScreenshots?.add(1, this.commonAttrs);
  };

  private handleBrowserReconnected = (_data: BrowserReconnectedEventData): void => {
    this.browserReconnects?.add(1, this.commonAttrs);
  };

  private handleCdpEndpointCycle = (_data: CdpEndpointCycleEventData): void => {
    this.cdpEndpointCycles?.add(1, this.commonAttrs);
  };

  private handleTaskValidated = (data: TaskValidationEventData): void => {
    this.validationQuality?.add(1, {
      ...this.commonAttrs,
      quality: data.completionQuality,
    });
  };
}

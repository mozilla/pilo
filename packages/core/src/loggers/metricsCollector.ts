import { LoggerWrapper } from "./wrapper.js";
import { Logger } from "./types.js";
import {
  WebAgentEventEmitter,
  WebAgentEventType,
  AIGenerationEventData,
  TaskCompleteEventData,
  TaskAbortedEventData,
} from "../events.js";

export class MetricsCollector extends LoggerWrapper {
  private eventCounts: Map<string, number> = new Map();

  private stepCount: number = 0;
  private aiGenerationCount: number = 0;
  private aiGenerationErrorCount: number = 0;
  private totalInputTokens: number = 0;
  private totalOutputTokens: number = 0;

  constructor(wrappedLogger: Logger) {
    super(wrappedLogger);
  }

  initialize(emitter: WebAgentEventEmitter): void {
    this.stepCount = 0;
    this.aiGenerationCount = 0;
    this.aiGenerationErrorCount = 0;
    this.totalInputTokens = 0;
    this.totalOutputTokens = 0;

    emitter.on("*", this.handleEventCount);
    emitter.onEvent(WebAgentEventType.AGENT_STEP, this.handleAgentStep);
    emitter.onEvent(WebAgentEventType.AI_GENERATION, this.handleAiGeneration);
    emitter.onEvent(WebAgentEventType.AI_GENERATION_ERROR, this.handleAiGenerationError);
    emitter.onEvent(WebAgentEventType.TASK_COMPLETED, this.handleTaskComplete);
    emitter.onEvent(WebAgentEventType.TASK_ABORTED, this.handleTaskAborted);

    super.initialize(emitter);
  }

  dispose(): void {
    if (this.emitter) {
      this.eventCounts.clear();
      this.emitter.off("*", this.handleEventCount);
      this.emitter.offEvent(WebAgentEventType.AGENT_STEP, this.handleAgentStep);
      this.emitter.offEvent(WebAgentEventType.AI_GENERATION, this.handleAiGeneration);
      this.emitter.offEvent(WebAgentEventType.AI_GENERATION_ERROR, this.handleAiGenerationError);
      this.emitter.offEvent(WebAgentEventType.TASK_COMPLETED, this.handleTaskComplete);
      this.emitter.offEvent(WebAgentEventType.TASK_ABORTED, this.handleTaskAborted);
    }
    super.dispose();
  }

  getEventCounts(): Map<string, number> {
    return this.eventCounts;
  }

  emitTaskMetrics(iterationId: string, incremental = false): void {
    if (this.emitter) {
      this.emitter.emitEvent({
        type: incremental
          ? WebAgentEventType.TASK_METRICS_INCREMENTAL
          : WebAgentEventType.TASK_METRICS,
        data: {
          timestamp: Date.now(),
          iterationId,
          eventCounts: Object.fromEntries(this.eventCounts),
          stepCount: this.stepCount,
          aiGenerationCount: this.aiGenerationCount,
          aiGenerationErrorCount: this.aiGenerationErrorCount,
          totalInputTokens: this.totalInputTokens,
          totalOutputTokens: this.totalOutputTokens,
        },
      });
    }
  }

  private handleEventCount = (eventType: string): void => {
    const currentCount = this.eventCounts.get(eventType) || 0;
    this.eventCounts.set(eventType, currentCount + 1);
  };

  private handleAgentStep = (data: { timestamp: number; iterationId: string }): void => {
    this.stepCount += 1;
    // Emit incremental metrics after each step
    this.emitTaskMetrics(data.iterationId, true);
  };

  private handleAiGeneration = (data: AIGenerationEventData): void => {
    const { inputTokens, outputTokens } = data.usage;
    this.aiGenerationCount += 1;
    this.totalInputTokens += inputTokens || 0;
    this.totalOutputTokens += outputTokens || 0;
  };

  private handleAiGenerationError = (): void => {
    this.aiGenerationErrorCount += 1;
  };

  private handleTaskComplete = (data: TaskCompleteEventData): void => {
    this.emitTaskMetrics(data.iterationId);
  };

  private handleTaskAborted = (data: TaskAbortedEventData): void => {
    this.emitTaskMetrics(data.iterationId);
  };
}

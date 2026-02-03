import { ModelMessage, StreamTextResult } from "ai";
import { EventEmitter } from "eventemitter3";
import type { AwaitedProperties } from "./utils/types.js";

/**
 * Enum of all possible event types in the web agent
 */
export enum WebAgentEventType {
  // Task events
  TASK_SETUP = "task:setup",
  TASK_STARTED = "task:started",
  TASK_COMPLETED = "task:completed",
  TASK_ABORTED = "task:aborted",
  TASK_VALIDATED = "task:validated",
  TASK_VALIDATION_ERROR = "task:validation_error",
  TASK_METRICS = "task:metrics",
  TASK_METRICS_INCREMENTAL = "task:metrics_incremental",

  // AI events
  AI_GENERATION = "ai:generation",
  AI_GENERATION_ERROR = "ai:generation:error",

  // Agent reasoning and status
  AGENT_ACTION = "agent:action",
  AGENT_STEP = "agent:step",
  AGENT_REASONED = "agent:reasoned",
  AGENT_EXTRACTED = "agent:extracted",
  AGENT_PROCESSING = "agent:processing",
  AGENT_STATUS = "agent:status",
  AGENT_WAITING = "agent:waiting",

  // Browser operations
  BROWSER_ACTION_STARTED = "browser:action_started",
  BROWSER_ACTION_COMPLETED = "browser:action_completed",
  BROWSER_NAVIGATED = "browser:navigated",
  BROWSER_SCREENSHOT_CAPTURED = "browser:screenshot_captured",

  // System/Debug
  SYSTEM_DEBUG_COMPRESSION = "system:debug_compression",
  SYSTEM_DEBUG_MESSAGE = "system:debug_message",
}

/**
 * Base interface for all event data
 */
export interface WebAgentEventData {
  timestamp: number;
  iterationId: string;
}

/**
 * Event data when a task is setup
 */
export interface TaskSetupEventData extends WebAgentEventData {
  task: string;
  url?: string;
  browserName: string;
  guardrails?: string;
  data?: any;
  pwEndpoint?: string;
  pwCdpEndpoint?: string;
  proxy?: string;
  vision?: boolean;
  provider?: string;
  model?: string;
  hasApiKey?: boolean;
  keySource?: "global" | "env" | "not_set";
}

/**
 * Event data when a task is started
 */
export interface TaskStartEventData extends WebAgentEventData {
  task: string;
  successCriteria: string;
  plan: string;
  url: string;
  actionItems?: string[];
}

/**
 * Event data when a task is completed
 */
export interface TaskCompleteEventData extends WebAgentEventData {
  finalAnswer: string | null;
  success?: boolean;
}

/**
 * Event data when a task is aborted
 */
export interface TaskAbortedEventData extends WebAgentEventData {
  reason: string;
  finalAnswer: string;
}

export interface TaskMetricsEventData extends WebAgentEventData {
  eventCounts: Record<string, number>;
  stepCount: number;
  aiGenerationCount: number;
  aiGenerationErrorCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
}

// Get a nondescript StreamTextResult type for usage in event data
type StreamTextResultGeneric = StreamTextResult<any, never>;

// Extract and await the stream result properties we need for AI generation events
type AIGenerationStreamData = AwaitedProperties<
  Pick<StreamTextResultGeneric, "finishReason" | "usage" | "providerMetadata" | "warnings">
>;

/**
 * Event data when AI generation occurs
 */
export interface AIGenerationEventData extends WebAgentEventData, AIGenerationStreamData {
  prompt: string;
  schema: any;
  messages?: ModelMessage[];
  object?: any;
  temperature?: number;
}

/**
 * Event data when AI generation error occurs
 */
export interface AIGenerationErrorEventData extends WebAgentEventData {
  prompt: string;
  error: string;
  schema: any;
  messages?: any[];
}

/**
 * Event data when navigating to a page
 */
export interface PageNavigationEventData extends WebAgentEventData {
  title: string;
  url: string;
}

/**
 * Event data for agent step tracking (each loop iteration)
 */
export interface AgentStepEventData extends WebAgentEventData {
  iterationId: string;
  currentIteration: number;
}

/**
 * Event data for agent reasoning
 */
export interface ReasoningEventData extends WebAgentEventData {
  reasoning: string;
}

/**
 * Event data for extracted data
 */
export interface ExtractedDataEventData extends WebAgentEventData {
  extractedData: string;
}

/**
 * Event data for when the agent is waiting for model generation
 */
export interface ProcessingEventData extends WebAgentEventData {
  operation: string;
  hasScreenshot: boolean;
}

/**
 * Event data for action execution
 */
export interface ActionExecutionEventData extends WebAgentEventData {
  action: string;
  ref?: string | null;
  value?: string | null;
}

/**
 * Event data for action results
 */
export interface ActionResultEventData extends WebAgentEventData {
  success: boolean;
  error?: string;
}

/**
 * Event data for compression debug info
 */
export interface CompressionDebugEventData extends WebAgentEventData {
  originalSize: number;
  compressedSize: number;
  compressionPercent: number;
}

/**
 * Event data for message debug info
 */
export interface MessagesDebugEventData extends WebAgentEventData {
  messages: any[];
}

/**
 * Event data for waiting notifications
 */
export interface WaitingEventData extends WebAgentEventData {
  seconds: number;
}

/**
 * Event data for screenshot capture
 */
export interface ScreenshotCapturedEventData extends WebAgentEventData {
  size: number;
  format: "jpeg" | "png";
}

/**
 * Event data for task validation
 */
export interface TaskValidationEventData extends WebAgentEventData {
  observation: string;
  completionQuality: "failed" | "partial" | "complete" | "excellent";
  feedback?: string;
  finalAnswer: string;
}

/**
 * Event data for validation errors during action response processing
 */
export interface ValidationErrorEventData extends WebAgentEventData {
  errors: string[];
  retryCount: number;
  rawResponse: any;
}

/**
 * Event data for status messages
 */
export interface StatusMessageEventData extends WebAgentEventData {
  message: string;
}

/**
 * Union type of all event data types
 */
export type WebAgentEvent =
  | { type: WebAgentEventType.TASK_SETUP; data: TaskSetupEventData }
  | { type: WebAgentEventType.TASK_STARTED; data: TaskStartEventData }
  | { type: WebAgentEventType.TASK_COMPLETED; data: TaskCompleteEventData }
  | { type: WebAgentEventType.TASK_ABORTED; data: TaskAbortedEventData }
  | { type: WebAgentEventType.TASK_VALIDATED; data: TaskValidationEventData }
  | { type: WebAgentEventType.TASK_VALIDATION_ERROR; data: ValidationErrorEventData }
  | { type: WebAgentEventType.TASK_METRICS; data: TaskMetricsEventData }
  | { type: WebAgentEventType.TASK_METRICS_INCREMENTAL; data: TaskMetricsEventData }
  | { type: WebAgentEventType.AI_GENERATION; data: AIGenerationEventData }
  | { type: WebAgentEventType.AI_GENERATION_ERROR; data: AIGenerationErrorEventData }
  | { type: WebAgentEventType.AGENT_ACTION; data: ActionExecutionEventData }
  | { type: WebAgentEventType.AGENT_STEP; data: AgentStepEventData }
  | { type: WebAgentEventType.AGENT_REASONED; data: ReasoningEventData }
  | { type: WebAgentEventType.AGENT_EXTRACTED; data: ExtractedDataEventData }
  | { type: WebAgentEventType.AGENT_PROCESSING; data: ProcessingEventData }
  | { type: WebAgentEventType.AGENT_STATUS; data: StatusMessageEventData }
  | { type: WebAgentEventType.AGENT_WAITING; data: WaitingEventData }
  | { type: WebAgentEventType.BROWSER_ACTION_STARTED; data: ActionExecutionEventData }
  | { type: WebAgentEventType.BROWSER_ACTION_COMPLETED; data: ActionResultEventData }
  | { type: WebAgentEventType.BROWSER_NAVIGATED; data: PageNavigationEventData }
  | { type: WebAgentEventType.BROWSER_SCREENSHOT_CAPTURED; data: ScreenshotCapturedEventData }
  | { type: WebAgentEventType.SYSTEM_DEBUG_COMPRESSION; data: CompressionDebugEventData }
  | { type: WebAgentEventType.SYSTEM_DEBUG_MESSAGE; data: MessagesDebugEventData };

/**
 * Event emitter for WebAgent events
 */
export class WebAgentEventEmitter extends EventEmitter {
  /**
   * Override emit to also trigger wildcard listeners
   */
  emit(event: string | symbol, ...args: any[]): boolean {
    const result = super.emit(event, ...args);
    // Also emit to wildcard listeners if this isn't already a wildcard event
    if (event !== "*") {
      super.emit("*", event, ...args);
    }
    return result;
  }

  /**
   * Emit a WebAgent event
   */
  emitEvent<T extends WebAgentEvent>(event: T): boolean {
    return this.emit(event.type, event.data);
  }

  /**
   * Listen for a specific WebAgent event type
   */
  onEvent<T extends WebAgentEventType>(
    eventType: T,
    listener: (data: Extract<WebAgentEvent, { type: T }>["data"]) => void,
  ): this {
    return this.on(eventType, listener);
  }

  /**
   * Listen for a specific WebAgent event type once
   */
  onceEvent<T extends WebAgentEventType>(
    eventType: T,
    listener: (data: Extract<WebAgentEvent, { type: T }>["data"]) => void,
  ): this {
    return this.once(eventType, listener);
  }

  /**
   * Remove a listener for a specific WebAgent event type
   */
  offEvent<T extends WebAgentEventType>(
    eventType: T,
    listener: (data: Extract<WebAgentEvent, { type: T }>["data"]) => void,
  ): this {
    return this.off(eventType, listener);
  }
}

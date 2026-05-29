import { ModelMessage } from "ai";
import { EventEmitter } from "eventemitter3";
import type { FormFieldRequest } from "./types/interactive.js";
import type { TaskExecutionResult } from "./webAgent.js";

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
  BROWSER_SCREENSHOT_CAPTURED_IMAGE = "browser:screenshot_captured_image",

  // System/Debug
  SYSTEM_DEBUG_COMPRESSION = "system:debug_compression",
  SYSTEM_DEBUG_MESSAGE = "system:debug_message",
  SYSTEM_DEBUG_TOOL_DROP = "system:debug_tool_drop",
  SYSTEM_DEBUG_BATCH = "system:debug_batch",

  // CDP endpoint failover
  CDP_ENDPOINT_CONNECTED = "cdp:endpoint_connected",
  CDP_ENDPOINT_CYCLE = "cdp:endpoint_cycle",

  // Browser reconnect after mid-task disconnect
  BROWSER_RECONNECTED = "browser:reconnected",

  // Interactive mode events
  INTERACTIVE_FORM_DATA_REQUEST = "interactive:form_data:request",
  INTERACTIVE_FORM_DATA_ERROR = "interactive:form_data:error",

  // Firewall events
  FIREWALL_BLOCKED_NON_INTERACTIVE = "firewall:blocked_non_interactive",
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
  pwCdpEndpoints?: string[];
  /** Total number of CDP endpoints configured (index, not URLs) */
  pwCdpEndpointCount?: number;
  proxy?: string;
  vision?: boolean;
  provider?: string;
  model?: string;
  hasApiKey?: boolean;
  keySource?: "global" | "env" | "not_set";
}

/**
 * Event data when a CDP endpoint is successfully connected to
 */
export interface CdpEndpointConnectedEventData extends WebAgentEventData {
  /** 1-based index of the endpoint that connected */
  endpointIndex: number;
  /** Total number of configured CDP endpoints */
  total: number;
}

/**
 * Event data when a CDP endpoint fails and the next one is being tried
 */
export interface CdpEndpointCycleEventData extends WebAgentEventData {
  /** 1-based index of the endpoint attempt that failed */
  attempt: number;
  /** Total number of configured CDP endpoints */
  total: number;
  /** Sanitized error identifier from the failed connection attempt (error.name, not error.message — full messages may contain endpoint URLs) */
  error: string;
}

/**
 * Event data when the browser reconnects after a mid-task disconnect
 */
export interface BrowserReconnectedEventData extends WebAgentEventData {
  /** The original starting URL the agent is restarting execution from */
  startingUrl: string;
  /** 1-based index of the CDP endpoint now in use */
  endpointIndex: number;
  /** Total number of configured CDP endpoints */
  total: number;
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

/**
 * Inlined shape of the AI SDK's `StreamTextResult` fields we surface on AI
 * generation events.
 *
 * Previously derived as `AwaitedProperties<Pick<StreamTextResult, ...>>`, but
 * that form pulls through AI SDK's generics in a way `ts-json-schema-generator`
 * can't resolve — which breaks extraction of the whole `WebAgentEvent` union
 * for downstream tooling (tabs-api's OpenAPI spec, Stainless SDK generation).
 *
 * Fields mirror AI SDK's awaited `StreamTextResult` shape as of the `ai`
 * package version pinned in package.json. Keep the sub-field types loose
 * enough (optional, `unknown`, etc.) to absorb minor AI SDK evolution
 * without compile breakage here.
 */
type AIGenerationStreamData = {
  finishReason: "stop" | "length" | "content-filter" | "tool-calls" | "error" | "other";
  usage: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  providerMetadata?: Record<string, unknown>;
  warnings?: unknown[];
};

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
 * Event data for tool-drop diagnostics: emitted when a provider returns more
 * than one tool call in a single turn and the extras are dropped. The system
 * prompt instructs the model to call exactly one tool per turn, but some
 * providers occasionally return multiple — this event surfaces those cases
 * so they can be observed instead of silently lost.
 */
export interface ToolDropDebugEventData extends WebAgentEventData {
  /** Number of tool calls that were dropped (returnedCount - 1). */
  droppedCount: number;
  /** Names of the dropped tools (in original order, excluding the first). */
  droppedTools: string[];
  /** Name of the tool that was kept (first in the provider's response). */
  keptTool: string;
}

/**
 * Emitted after each action turn is processed, reporting how many of the
 * returned tool calls were processed and why processing stopped. Fires on every
 * turn (including the single-action default), so consumers can rely on it.
 */
export interface BatchDebugEventData extends WebAgentEventData {
  /** Number of tool calls the model returned this turn. */
  actionsRequested: number;
  /** Number of those the loop processed before stopping. */
  actionsProcessed: number;
  /** Why processing stopped: hit a terminal action, an error, or ran the whole batch. */
  batchStoppedBy: "terminal" | "error" | "completed";
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
 * Event data for screenshot image capture with full image data
 * This event contains the complete screenshot and can be very large
 */
export interface ScreenshotCapturedImageEventData extends WebAgentEventData {
  image: string; // base64-encoded image data
  mediaType: "image/jpeg" | "image/png";
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
 * Event data when the agent requests user data for form fields
 */
export interface InteractiveFormDataRequestEventData extends WebAgentEventData {
  requestId: string;
  pageUrl: string;
  pageTitle: string;
  formDescription: string;
  fields: FormFieldRequest[];
}

/**
 * Event data when form validation fails and the agent re-requests data.
 * Carries both the error context and the fields that need new values.
 * Callers respond to this the same way as a request event.
 */
export interface InteractiveFormDataErrorEventData extends WebAgentEventData {
  requestId: string;
  pageUrl: string;
  pageTitle: string;
  formDescription: string;
  fields: FormFieldRequest[];
  /** Per-field error messages from validation (field ref -> error text) */
  fieldErrors: Record<string, string>;
}

export type FirewallRemediation =
  | { kind: "add-trusted-hostnames"; hostnames: string[]; description: string }
  | { kind: "enable-interactive-mode"; description: string }
  | { kind: "enable-unsafe-mode"; description: string };

export interface FirewallBlockedNonInteractiveEventData extends WebAgentEventData {
  reason: string;
  kind: "freeform-fill" | "form-submission";
  pageHostname: string | null;
  formActionHostnames: string[];
  remediations: FirewallRemediation[];
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
  | {
      type: WebAgentEventType.BROWSER_SCREENSHOT_CAPTURED_IMAGE;
      data: ScreenshotCapturedImageEventData;
    }
  | { type: WebAgentEventType.SYSTEM_DEBUG_COMPRESSION; data: CompressionDebugEventData }
  | { type: WebAgentEventType.SYSTEM_DEBUG_MESSAGE; data: MessagesDebugEventData }
  | { type: WebAgentEventType.SYSTEM_DEBUG_TOOL_DROP; data: ToolDropDebugEventData }
  | { type: WebAgentEventType.SYSTEM_DEBUG_BATCH; data: BatchDebugEventData }
  | { type: WebAgentEventType.CDP_ENDPOINT_CONNECTED; data: CdpEndpointConnectedEventData }
  | { type: WebAgentEventType.CDP_ENDPOINT_CYCLE; data: CdpEndpointCycleEventData }
  | { type: WebAgentEventType.BROWSER_RECONNECTED; data: BrowserReconnectedEventData }
  | {
      type: WebAgentEventType.INTERACTIVE_FORM_DATA_REQUEST;
      data: InteractiveFormDataRequestEventData;
    }
  | {
      type: WebAgentEventType.INTERACTIVE_FORM_DATA_ERROR;
      data: InteractiveFormDataErrorEventData;
    }
  | {
      type: WebAgentEventType.FIREWALL_BLOCKED_NON_INTERACTIVE;
      data: FirewallBlockedNonInteractiveEventData;
    };

// ============================================================================
// Stream-wrapper events
// ============================================================================
//
// The events below are emitted by the HTTP route handler
// (packages/server/src/routes/pilo.ts) after the agent loop completes, not
// through WebAgentEventEmitter. They terminate the SSE stream. Wire-level
// consumers see them interleaved with WebAgentEvents on the response stream,
// so the authoritative schema for /v1/automate is AutomateStreamEvent (below),
// which composes both sets.

/**
 * Payload for the `complete` stream event. Structurally identical to
 * TaskExecutionResult from webAgent.ts — the `complete` event's data is
 * the agent's final TaskExecutionResult, stringified onto the SSE stream.
 */
export type StreamCompleteEventData = TaskExecutionResult;

/**
 * Payload for the `done` stream terminator event. Empty today; reserved for
 * future metadata.
 */
export type StreamDoneEventData = Record<string, never>;

/**
 * Payload for the top-level `error` stream event. Emitted when an uncaught
 * error escapes the task runner. Mirrors `ErrorResponse` from the server
 * package's `taskRunner.ts` — kept structurally aligned so schema and
 * runtime stay consistent. Distinct from agent-level error events like
 * `ai:generation:error` and `task:validation_error`, which are emitted
 * through the normal event emitter during the agent loop.
 */
export interface StreamErrorEventData {
  success: false;
  error: {
    message: string;
    code: string;
    /** ISO-8601 timestamp */
    timestamp: string;
  };
}

/**
 * Top-level discriminated union of every event a `/v1/automate` SSE client
 * can receive on the wire. Composes {@link WebAgentEvent} (agent-loop events
 * emitted via {@link WebAgentEventEmitter}) with the stream-wrapper events
 * (`complete`, `done`, `error`) emitted by the HTTP route handler after the
 * agent returns.
 *
 * This is the authoritative source-of-truth for downstream SDK generation.
 * Its JSON Schema export (`schemas/automate-stream-event.json`) is consumed
 * by tabs-api to type `/v1/automate`'s SSE response in `@tabstack/sdk`.
 */
export type AutomateStreamEvent =
  | WebAgentEvent
  | { type: "complete"; data: StreamCompleteEventData }
  | { type: "done"; data: StreamDoneEventData }
  | { type: "error"; data: StreamErrorEventData };

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

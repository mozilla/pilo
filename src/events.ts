import { EventEmitter } from "eventemitter3";

/**
 * Enum of all possible event types in the web agent
 */
export enum WebAgentEventType {
  // Task lifecycle
  TASK_STARTED = "task:started",
  TASK_COMPLETED = "task:completed",
  TASK_VALIDATED = "task:validated",
  TASK_VALIDATION_ERROR = "task:validation_error",

  // Agent reasoning and status
  AGENT_STEP = "agent:step",
  AGENT_OBSERVED = "agent:observed",
  AGENT_REASONED = "agent:reasoned",
  AGENT_EXTRACTED = "agent:extracted",
  AGENT_PROCESSING = "agent:processing",
  AGENT_STATUS = "agent:status",
  AGENT_WAITING = "agent:waiting",

  // Browser operations
  BROWSER_ACTION_STARTED = "browser:action_started",
  BROWSER_ACTION_COMPLETED = "browser:action_completed",
  BROWSER_NAVIGATED = "browser:navigated",
  BROWSER_NETWORK_WAITING = "browser:network_waiting",
  BROWSER_NETWORK_TIMEOUT = "browser:network_timeout",

  // System/Debug
  SYSTEM_DEBUG_COMPRESSION = "system:debug_compression",
  SYSTEM_DEBUG_MESSAGE = "system:debug_message",
}

/**
 * Base interface for all event data
 */
export interface WebAgentEventData {
  timestamp: number;
}

/**
 * Event data when a task is started
 */
export interface TaskStartEventData extends WebAgentEventData {
  task: string;
  explanation: string;
  plan: string;
  url: string;
}

/**
 * Event data when a task is completed
 */
export interface TaskCompleteEventData extends WebAgentEventData {
  finalAnswer: string | null;
}

/**
 * Event data when navigating to a page
 */
export interface PageNavigationEventData extends WebAgentEventData {
  title: string;
  url: string;
}

/**
 * Event data for current step tracking
 */
export interface CurrentStepEventData extends WebAgentEventData {
  currentStep: string;
}

/**
 * Event data for agent observations
 */
export interface ObservationEventData extends WebAgentEventData {
  observation: string;
}

/**
 * Event data for agent thoughts
 */
export interface ThoughtEventData extends WebAgentEventData {
  thought: string;
}

/**
 * Event data for extracted data
 */
export interface ExtractedDataEventData extends WebAgentEventData {
  extractedData: string;
}

/**
 * Event data for thinking status
 */
export interface ThinkingEventData extends WebAgentEventData {
  status: "start" | "end";
  operation: string;
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
 * Event data for network waiting notification
 */
export interface NetworkWaitingEventData extends WebAgentEventData {
  action: string;
}

/**
 * Event data for network timeout notification
 */
export interface NetworkTimeoutEventData extends WebAgentEventData {
  action: string;
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
  | { type: WebAgentEventType.TASK_STARTED; data: TaskStartEventData }
  | { type: WebAgentEventType.TASK_COMPLETED; data: TaskCompleteEventData }
  | { type: WebAgentEventType.TASK_VALIDATED; data: TaskValidationEventData }
  | { type: WebAgentEventType.TASK_VALIDATION_ERROR; data: ValidationErrorEventData }
  | { type: WebAgentEventType.AGENT_STEP; data: CurrentStepEventData }
  | { type: WebAgentEventType.AGENT_OBSERVED; data: ObservationEventData }
  | { type: WebAgentEventType.AGENT_REASONED; data: ThoughtEventData }
  | { type: WebAgentEventType.AGENT_EXTRACTED; data: ExtractedDataEventData }
  | { type: WebAgentEventType.AGENT_PROCESSING; data: ThinkingEventData }
  | { type: WebAgentEventType.AGENT_STATUS; data: StatusMessageEventData }
  | { type: WebAgentEventType.AGENT_WAITING; data: WaitingEventData }
  | { type: WebAgentEventType.BROWSER_ACTION_STARTED; data: ActionExecutionEventData }
  | { type: WebAgentEventType.BROWSER_ACTION_COMPLETED; data: ActionResultEventData }
  | { type: WebAgentEventType.BROWSER_NAVIGATED; data: PageNavigationEventData }
  | { type: WebAgentEventType.BROWSER_NETWORK_WAITING; data: NetworkWaitingEventData }
  | { type: WebAgentEventType.BROWSER_NETWORK_TIMEOUT; data: NetworkTimeoutEventData }
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

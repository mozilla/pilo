import { EventEmitter } from "eventemitter3";

/**
 * Enum of all possible event types in the web agent
 */
export enum WebAgentEventType {
  // Task events
  TASK_START = "task:start",
  TASK_COMPLETE = "task:complete",

  // Page events
  PAGE_NAVIGATION = "page:navigation",

  // Agent reasoning events
  OBSERVATION = "agent:observation",
  THOUGHT = "agent:thought",

  // Action events
  ACTION_EXECUTION = "action:execution",
  ACTION_RESULT = "action:result",

  // Debug events
  DEBUG_COMPRESSION = "debug:compression",
  DEBUG_MESSAGES = "debug:messages",

  // Waiting events
  WAITING = "system:waiting",
  NETWORK_WAITING = "system:network_waiting",
  NETWORK_TIMEOUT = "system:network_timeout",
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
 * Union type of all event data types
 */
export type WebAgentEvent =
  | { type: WebAgentEventType.TASK_START; data: TaskStartEventData }
  | { type: WebAgentEventType.TASK_COMPLETE; data: TaskCompleteEventData }
  | { type: WebAgentEventType.PAGE_NAVIGATION; data: PageNavigationEventData }
  | { type: WebAgentEventType.OBSERVATION; data: ObservationEventData }
  | { type: WebAgentEventType.THOUGHT; data: ThoughtEventData }
  | { type: WebAgentEventType.ACTION_EXECUTION; data: ActionExecutionEventData }
  | { type: WebAgentEventType.ACTION_RESULT; data: ActionResultEventData }
  | {
      type: WebAgentEventType.DEBUG_COMPRESSION;
      data: CompressionDebugEventData;
    }
  | { type: WebAgentEventType.DEBUG_MESSAGES; data: MessagesDebugEventData }
  | { type: WebAgentEventType.WAITING; data: WaitingEventData }
  | { type: WebAgentEventType.NETWORK_WAITING; data: NetworkWaitingEventData }
  | { type: WebAgentEventType.NETWORK_TIMEOUT; data: NetworkTimeoutEventData };

/**
 * Event emitter for WebAgent events
 */
export class WebAgentEventEmitter extends EventEmitter {
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
    listener: (data: Extract<WebAgentEvent, { type: T }>["data"]) => void
  ): this {
    return this.on(eventType, listener);
  }

  /**
   * Listen for a specific WebAgent event type once
   */
  onceEvent<T extends WebAgentEventType>(
    eventType: T,
    listener: (data: Extract<WebAgentEvent, { type: T }>["data"]) => void
  ): this {
    return this.once(eventType, listener);
  }

  /**
   * Remove a listener for a specific WebAgent event type
   */
  offEvent<T extends WebAgentEventType>(
    eventType: T,
    listener: (data: Extract<WebAgentEvent, { type: T }>["data"]) => void
  ): this {
    return this.off(eventType, listener);
  }
}

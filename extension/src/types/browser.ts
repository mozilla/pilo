// Browser-specific API types not included in webextension-polyfill

// Chrome-specific APIs
export interface ChromeSidePanel {
  open(options: { windowId?: number; tabId?: number }): Promise<void>;
  setOptions(options: { tabId?: number; path?: string; enabled?: boolean }): Promise<void>;
  setPanelBehavior(options: { openPanelOnActionClick?: boolean }): Promise<void>;
  getOptions(options: { tabId?: number }): Promise<{ path?: string; enabled?: boolean }>;
}

export interface ChromeBrowser {
  sidePanel?: ChromeSidePanel;
}

// Message types for extension communication
export interface ExecuteTaskMessage {
  type: "executeTask";
  task: string;
  apiKey: string;
  apiEndpoint: string;
  model: string;
  tabId?: number;
  data?: any;
}

export interface ExecuteTaskResponse {
  success: boolean;
  result?: string;
  message?: string;
  events?: Array<{ type: string; data: any }>;
}

export interface GetPageInfoMessage {
  type: "getPageInfo";
}

export interface GetPageInfoResponse {
  title: string;
  url: string;
}

export interface ExecutePageActionMessage {
  type: "executePageAction";
}

export interface ExecutePageActionResponse {
  success: boolean;
  message?: string;
}

export interface CancelTaskMessage {
  type: "cancelTask";
  tabId?: number;
}

export interface CancelTaskResponse {
  success: boolean;
  message?: string;
}

// Note: GetIndicatorStateMessage and GetIndicatorStateResponse removed
// Indicator is now controlled via CSS injection in background script (see indicatorControl.ts)

// Event data types for different event kinds
export interface TaskStartedEventData {
  plan?: string;
  taskId?: string;
  actionItems?: string[];
}

export interface AgentReasonedEventData {
  thought?: string;
}

export interface AgentStatusEventData {
  message?: string;
}

export interface AIGenerationErrorEventData {
  error?: string;
  isToolError?: boolean;
}

export interface TaskValidationErrorEventData {
  errors?: string[];
  retryCount?: number;
}

export interface BrowserActionCompletedEventData {
  success: boolean;
  error?: string;
  isRecoverable?: boolean;
}

export interface BrowserActionStartedEventData {
  action: string;
  ref?: string;
  value?: string;
}

// Generic event data for unknown event types
export interface GenericEventData {
  [key: string]: unknown;
}

// Discriminated union of all event types
export type RealtimeEvent =
  | { type: "task:started"; data: TaskStartedEventData; timestamp: number }
  | { type: "agent:reasoned"; data: AgentReasonedEventData; timestamp: number }
  | { type: "agent:status"; data: AgentStatusEventData; timestamp: number }
  | { type: "ai:generation:error"; data: AIGenerationErrorEventData; timestamp: number }
  | { type: "task:validation_error"; data: TaskValidationErrorEventData; timestamp: number }
  | { type: "browser:action:completed"; data: BrowserActionCompletedEventData; timestamp: number }
  | { type: "browser:action_started"; data: BrowserActionStartedEventData; timestamp: number }
  | { type: string; data: GenericEventData; timestamp: number };

export interface RealtimeEventMessage {
  type: "realtimeEvent";
  tabId: number;
  event: RealtimeEvent;
}

export type ExtensionMessage =
  | ExecuteTaskMessage
  | GetPageInfoMessage
  | ExecutePageActionMessage
  | CancelTaskMessage
  | RealtimeEventMessage;

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

export type ExtensionMessage = ExecuteTaskMessage | GetPageInfoMessage | ExecutePageActionMessage;

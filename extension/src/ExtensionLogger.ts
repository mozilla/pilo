import type { 
  Logger,
  WebAgentEventEmitter,
  TaskStartEventData,
  TaskCompleteEventData,
  PageNavigationEventData,
  ObservationEventData,
  ThoughtEventData,
  ActionExecutionEventData,
  ActionResultEventData,
  WaitingEventData,
  NetworkWaitingEventData,
  NetworkTimeoutEventData,
} from "spark/core";
import { WebAgentEventType } from "spark/core";

/**
 * ExtensionLogger - Logger implementation for browser extension sidebars
 * Displays events in a DOM element with HTML formatting
 */
export class ExtensionLogger implements Logger {
  private emitter: WebAgentEventEmitter | null = null;
  private logElement: HTMLElement | null;

  constructor(elementId: string = 'spark-log') {
    this.logElement = typeof document !== 'undefined' ? document.getElementById(elementId) : null;
  }

  private append(msg: string) {
    if (this.logElement) {
      const div = document.createElement('div');
      div.innerHTML = msg;
      this.logElement.appendChild(div);
      this.logElement.scrollTop = this.logElement.scrollHeight;
    }
  }

  initialize(emitter: WebAgentEventEmitter): void {
    this.emitter = emitter;
    
    // Subscribe to key events
    emitter.onEvent(WebAgentEventType.TASK_START, this.handleTaskStart);
    emitter.onEvent(WebAgentEventType.TASK_COMPLETE, this.handleTaskComplete);
    emitter.onEvent(WebAgentEventType.PAGE_NAVIGATION, this.handlePageNavigation);
    emitter.onEvent(WebAgentEventType.OBSERVATION, this.handleObservation);
    emitter.onEvent(WebAgentEventType.THOUGHT, this.handleThought);
    emitter.onEvent(WebAgentEventType.ACTION_EXECUTION, this.handleActionExecution);
    emitter.onEvent(WebAgentEventType.ACTION_RESULT, this.handleActionResult);
    emitter.onEvent(WebAgentEventType.WAITING, this.handleWaiting);
    emitter.onEvent(WebAgentEventType.NETWORK_WAITING, this.handleNetworkWaiting);
    emitter.onEvent(WebAgentEventType.NETWORK_TIMEOUT, this.handleNetworkTimeout);
  }

  dispose(): void {
    if (this.emitter) {
      this.emitter.offEvent(WebAgentEventType.TASK_START, this.handleTaskStart);
      this.emitter.offEvent(WebAgentEventType.TASK_COMPLETE, this.handleTaskComplete);
      this.emitter.offEvent(WebAgentEventType.PAGE_NAVIGATION, this.handlePageNavigation);
      this.emitter.offEvent(WebAgentEventType.OBSERVATION, this.handleObservation);
      this.emitter.offEvent(WebAgentEventType.THOUGHT, this.handleThought);
      this.emitter.offEvent(WebAgentEventType.ACTION_EXECUTION, this.handleActionExecution);
      this.emitter.offEvent(WebAgentEventType.ACTION_RESULT, this.handleActionResult);
      this.emitter.offEvent(WebAgentEventType.WAITING, this.handleWaiting);
      this.emitter.offEvent(WebAgentEventType.NETWORK_WAITING, this.handleNetworkWaiting);
      this.emitter.offEvent(WebAgentEventType.NETWORK_TIMEOUT, this.handleNetworkTimeout);
      this.emitter = null;
    }
  }

  private handleTaskStart = (data: TaskStartEventData): void => {
    this.append(`<b>🎯 Task:</b> <span>${data.task}</span>`);
    this.append(`<b>💡 Explanation:</b> <span>${data.explanation}</span>`);
    this.append(`<b>📋 Plan:</b> <span>${data.plan}</span>`);
    this.append(`<b>🌐 Starting URL:</b> <span style='color:#0074d9;'>${data.url}</span>`);
  };

  private handleTaskComplete = (data: TaskCompleteEventData): void => {
    if (data.finalAnswer) {
      this.append(`<b style='color:green;'>✨ Final Answer:</b> <span>${data.finalAnswer}</span>`);
    }
  };

  private handlePageNavigation = (data: PageNavigationEventData): void => {
    this.append(`<div style='color:#aaa;margin:8px 0 2px 0;'>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</div>`);
    const truncatedTitle = data.title.length > 50 ? data.title.slice(0, 47) + '...' : data.title;
    this.append(`<b>📍 Current Page:</b> <span>${truncatedTitle}</span>`);
  };

  private handleObservation = (data: ObservationEventData): void => {
    this.append(`<b>🔭 Observation:</b> <span>${data.observation}</span>`);
  };

  private handleThought = (data: ThoughtEventData): void => {
    this.append(`<b>💭 Thought:</b> <span>${data.thought}</span>`);
  };

  private handleActionExecution = (data: ActionExecutionEventData): void => {
    let details = `<b>🎯 Action:</b> <span>${data.action.toUpperCase()}</span>`;
    if (data.ref) details += ` <span style='color:#0074d9;'>ref: ${data.ref}</span>`;
    if (data.value) details += ` <span style='color:green;'>value: "${data.value}"</span>`;
    this.append(details);
  };

  private handleActionResult = (data: ActionResultEventData): void => {
    if (!data.success) {
      this.append(`<span style='color:red;'><b>❌ Failed:</b> ${data.error || 'Unknown error'}</span>`);
    } else {
      this.append(`<span style='color:green;'><b>✅ Success</b></span>`);
    }
  };

  private handleWaiting = (data: WaitingEventData): void => {
    this.append(`<span style='color:#b8860b;'>⏳ Waiting ${data.seconds}s...</span>`);
  };

  private handleNetworkWaiting = (data: NetworkWaitingEventData): void => {
    this.append(`<span style='color:#888;'>🌐 Waiting for network...</span>`);
  };

  private handleNetworkTimeout = (data: NetworkTimeoutEventData): void => {
    this.append(`<span style='color:#888;'>⚠️ Network timeout</span>`);
  };
}
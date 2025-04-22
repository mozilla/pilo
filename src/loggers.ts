import chalk from "chalk";
import { WebAgentEventType, WebAgentEventEmitter } from "./events.js";
import type {
  ActionExecutionEventData,
  ActionResultEventData,
  CompressionDebugEventData,
  CurrentStepEventData,
  ExtractedDataEventData,
  MessagesDebugEventData,
  NetworkTimeoutEventData,
  NetworkWaitingEventData,
  ObservationEventData,
  PageNavigationEventData,
  TaskCompleteEventData,
  TaskStartEventData,
  ThoughtEventData,
  WaitingEventData,
  TaskValidationEventData,
} from "./events.js";

/**
 * Base logger interface that all loggers must implement
 */
export interface Logger {
  /**
   * Initialize the logger with an event emitter
   */
  initialize(emitter: WebAgentEventEmitter): void;

  /**
   * Clean up any resources used by the logger,
   * including removing event listeners
   */
  dispose(): void;
}

/**
 * Console logger that outputs colored text to the console
 */
export class ConsoleLogger implements Logger {
  private emitter: WebAgentEventEmitter | null = null;

  initialize(emitter: WebAgentEventEmitter): void {
    this.emitter = emitter;

    // Task events
    emitter.onEvent(WebAgentEventType.TASK_START, this.handleTaskStart);
    emitter.onEvent(WebAgentEventType.TASK_COMPLETE, this.handleTaskComplete);
    emitter.onEvent(
      WebAgentEventType.TASK_VALIDATION,
      this.handleTaskValidation
    );

    // Page events
    emitter.onEvent(
      WebAgentEventType.PAGE_NAVIGATION,
      this.handlePageNavigation
    );

    // Agent reasoning events
    emitter.onEvent(WebAgentEventType.CURRENT_STEP, this.handleCurrentStep);
    emitter.onEvent(WebAgentEventType.OBSERVATION, this.handleObservation);
    emitter.onEvent(WebAgentEventType.THOUGHT, this.handleThought);
    emitter.onEvent(WebAgentEventType.EXTRACTED_DATA, this.handleExtractedData);

    // Action events
    emitter.onEvent(
      WebAgentEventType.ACTION_EXECUTION,
      this.handleActionExecution
    );
    emitter.onEvent(WebAgentEventType.ACTION_RESULT, this.handleActionResult);

    // Debug events
    emitter.onEvent(
      WebAgentEventType.DEBUG_COMPRESSION,
      this.handleCompressionDebug
    );
    emitter.onEvent(WebAgentEventType.DEBUG_MESSAGES, this.handleMessagesDebug);

    // Waiting events
    emitter.onEvent(WebAgentEventType.WAITING, this.handleWaiting);
    emitter.onEvent(
      WebAgentEventType.NETWORK_WAITING,
      this.handleNetworkWaiting
    );
    emitter.onEvent(
      WebAgentEventType.NETWORK_TIMEOUT,
      this.handleNetworkTimeout
    );
  }

  dispose(): void {
    // Clean up event listeners to prevent memory leaks
    if (this.emitter) {
      // Task events
      this.emitter.offEvent(WebAgentEventType.TASK_START, this.handleTaskStart);
      this.emitter.offEvent(
        WebAgentEventType.TASK_COMPLETE,
        this.handleTaskComplete
      );
      this.emitter.offEvent(
        WebAgentEventType.TASK_VALIDATION,
        this.handleTaskValidation
      );

      // Page events
      this.emitter.offEvent(
        WebAgentEventType.PAGE_NAVIGATION,
        this.handlePageNavigation
      );

      // Agent reasoning events
      this.emitter.offEvent(
        WebAgentEventType.CURRENT_STEP,
        this.handleCurrentStep
      );
      this.emitter.offEvent(
        WebAgentEventType.OBSERVATION,
        this.handleObservation
      );
      this.emitter.offEvent(WebAgentEventType.THOUGHT, this.handleThought);
      this.emitter.offEvent(
        WebAgentEventType.EXTRACTED_DATA,
        this.handleExtractedData
      );

      // Action events
      this.emitter.offEvent(
        WebAgentEventType.ACTION_EXECUTION,
        this.handleActionExecution
      );
      this.emitter.offEvent(
        WebAgentEventType.ACTION_RESULT,
        this.handleActionResult
      );

      // Debug events
      this.emitter.offEvent(
        WebAgentEventType.DEBUG_COMPRESSION,
        this.handleCompressionDebug
      );
      this.emitter.offEvent(
        WebAgentEventType.DEBUG_MESSAGES,
        this.handleMessagesDebug
      );

      // Waiting events
      this.emitter.offEvent(WebAgentEventType.WAITING, this.handleWaiting);
      this.emitter.offEvent(
        WebAgentEventType.NETWORK_WAITING,
        this.handleNetworkWaiting
      );
      this.emitter.offEvent(
        WebAgentEventType.NETWORK_TIMEOUT,
        this.handleNetworkTimeout
      );

      // Reset emitter reference
      this.emitter = null;
    }
  }

  private handleTaskStart = (data: TaskStartEventData): void => {
    console.log(chalk.cyan.bold("\n🎯 Task: "), chalk.whiteBright(data.task));
    console.log(chalk.yellow.bold("\n💡 Explanation:"));
    console.log(chalk.whiteBright(data.explanation));
    console.log(chalk.magenta.bold("\n📋 Plan:"));
    console.log(chalk.whiteBright(data.plan));
    console.log(
      chalk.blue.bold("🌐 Starting URL: "),
      chalk.blue.underline(data.url)
    );
  };

  private handleTaskComplete = (data: TaskCompleteEventData): void => {
    if (data.finalAnswer) {
      console.log(
        chalk.green.bold("\n✨ Final Answer:"),
        chalk.whiteBright(data.finalAnswer)
      );
    }
  };

  private handleTaskValidation = (data: TaskValidationEventData): void => {
    if (data.isValid) {
      console.log(
        chalk.green.bold("\n✅ Task Validation:"),
        chalk.green("Answer is valid")
      );
    } else {
      console.log(
        chalk.yellow.bold("\n⚠️ Task Validation:"),
        chalk.yellow("Answer needs improvement")
      );
      if (data.feedback) {
        console.log(
          chalk.yellow("   Feedback:"),
          chalk.whiteBright(data.feedback)
        );
      }
    }
  };

  private handlePageNavigation = (data: PageNavigationEventData): void => {
    console.log(
      chalk.gray(
        "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
      )
    );

    const truncatedTitle =
      data.title.length > 50 ? data.title.slice(0, 47) + "..." : data.title;

    console.log(
      chalk.blue.bold("📍 Current Page:"),
      chalk.blue(truncatedTitle)
    );
  };

  private handleCurrentStep = (data: CurrentStepEventData): void => {
    console.log(chalk.magenta.bold("🔄 Current Step:"));
    console.log(chalk.whiteBright("   " + data.currentStep));
  };

  private handleObservation = (data: ObservationEventData): void => {
    console.log(chalk.yellow.bold("🔭 Observation:"));
    console.log(chalk.whiteBright("   " + data.observation));
  };

  private handleThought = (data: ThoughtEventData): void => {
    console.log(chalk.yellow.bold("\n💭 Thought:"));
    console.log(chalk.whiteBright("   " + data.thought));
  };

  private handleExtractedData = (data: ExtractedDataEventData): void => {
    console.log(chalk.green.bold("\n📋 Extracted Data:"));
    console.log(chalk.whiteBright("   " + data.extractedData));
  };

  private handleActionExecution = (data: ActionExecutionEventData): void => {
    console.log(chalk.yellow.bold("\n🎯 Actions:"));
    console.log(
      chalk.whiteBright(`   1. ${data.action.toUpperCase()}`),
      data.ref ? chalk.cyan(`ref: ${data.ref}`) : "",
      data.value ? chalk.green(`value: "${data.value}"`) : ""
    );

    console.log(
      chalk.cyan.bold("\n▶️ Executing action:"),
      chalk.whiteBright(data.action.toUpperCase()),
      data.ref ? chalk.cyan(`ref: ${data.ref}`) : "",
      data.value ? chalk.green(`value: "${data.value}"`) : ""
    );
  };

  private handleActionResult = (data: ActionResultEventData): void => {
    if (!data.success) {
      console.error(
        chalk.red.bold(`❌ Failed to execute action: `),
        chalk.whiteBright(data.error || "Unknown error")
      );
    }
  };

  private handleCompressionDebug = (data: CompressionDebugEventData): void => {
    console.log(
      chalk.gray("\n📝 Compression:"),
      chalk.green(`${data.compressionPercent}%`),
      chalk.gray(`(${data.originalSize} → ${data.compressedSize} chars)`)
    );
  };

  private handleMessagesDebug = (data: MessagesDebugEventData): void => {
    console.log(chalk.cyan.bold("\n🤔 Messages:"));
    console.log(chalk.gray(JSON.stringify(data.messages, null, 2)));
  };

  private handleWaiting = (data: WaitingEventData): void => {
    console.log(
      chalk.yellow.bold(
        `⏳ Waiting for ${data.seconds} second${
          data.seconds !== 1 ? "s" : ""
        }...`
      )
    );
  };

  private handleNetworkWaiting = (data: NetworkWaitingEventData): void => {
    console.log(chalk.gray("   🌐 Waiting for network activity to settle..."));
  };

  private handleNetworkTimeout = (data: NetworkTimeoutEventData): void => {
    console.log(chalk.gray("   ⚠️  Network wait timed out, continuing..."));
  };
}

export class SidebarLogger implements Logger {
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
    emitter.onEvent(WebAgentEventType.TASK_START, this.handleTaskStart);
    emitter.onEvent(WebAgentEventType.TASK_COMPLETE, this.handleTaskComplete);
    emitter.onEvent(WebAgentEventType.PAGE_NAVIGATION, this.handlePageNavigation);
    emitter.onEvent(WebAgentEventType.OBSERVATION, this.handleObservation);
    emitter.onEvent(WebAgentEventType.THOUGHT, this.handleThought);
    emitter.onEvent(WebAgentEventType.ACTION_EXECUTION, this.handleActionExecution);
    emitter.onEvent(WebAgentEventType.ACTION_RESULT, this.handleActionResult);
    emitter.onEvent(WebAgentEventType.DEBUG_COMPRESSION, this.handleCompressionDebug);
    emitter.onEvent(WebAgentEventType.DEBUG_MESSAGES, this.handleMessagesDebug);
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
      this.emitter.offEvent(WebAgentEventType.DEBUG_COMPRESSION, this.handleCompressionDebug);
      this.emitter.offEvent(WebAgentEventType.DEBUG_MESSAGES, this.handleMessagesDebug);
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
    this.append(`<b>▶️ Executing:</b> <span>${data.action.toUpperCase()}</span>`);
  };

  private handleActionResult = (data: ActionResultEventData): void => {
    if (!data.success) {
      this.append(`<span style='color:red;'><b>❌ Failed to execute action:</b> ${data.error || 'Unknown error'}</span>`);
    }
  };

  private handleCompressionDebug = (data: CompressionDebugEventData): void => {
    this.append(`<span style='color:#888;'>📝 Compression: <b>${data.compressionPercent}%</b> (${data.originalSize} → ${data.compressedSize} chars)</span>`);
  };

  private handleMessagesDebug = (data: MessagesDebugEventData): void => {
    this.append(`<b>🤔 Messages:</b> <pre style='white-space:pre-wrap;max-height:100px;overflow:auto;background:#f8f8f8;border:1px solid #eee;padding:4px;'>${JSON.stringify(data.messages, null, 2)}</pre>`);
  };

  private handleWaiting = (data: WaitingEventData): void => {
    this.append(`<span style='color:#b8860b;'>⏳ Waiting for ${data.seconds} second${data.seconds !== 1 ? 's' : ''}...</span>`);
  };

  private handleNetworkWaiting = (data: NetworkWaitingEventData): void => {
    this.append(`<span style='color:#888;'>🌐 Waiting for network activity to settle...</span>`);
  };

  private handleNetworkTimeout = (data: NetworkTimeoutEventData): void => {
    this.append(`<span style='color:#888;'>⚠️  Network wait timed out, continuing...</span>`);
  };
}

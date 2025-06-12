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
  StatusMessageEventData,
  TaskCompleteEventData,
  TaskStartEventData,
  ThoughtEventData,
  WaitingEventData,
  TaskValidationEventData,
  ThinkingEventData,
  ValidationErrorEventData,
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
    if (this.emitter) {
      // Dispose existing listeners before reinitializing
      this.dispose();
    }
    this.emitter = emitter;

    // Task events
    emitter.onEvent(WebAgentEventType.TASK_START, this.handleTaskStart);
    emitter.onEvent(WebAgentEventType.TASK_COMPLETE, this.handleTaskComplete);
    emitter.onEvent(WebAgentEventType.TASK_VALIDATION, this.handleTaskValidation);

    // Page events
    emitter.onEvent(WebAgentEventType.PAGE_NAVIGATION, this.handlePageNavigation);

    // Agent reasoning events
    emitter.onEvent(WebAgentEventType.CURRENT_STEP, this.handleCurrentStep);
    emitter.onEvent(WebAgentEventType.OBSERVATION, this.handleObservation);
    emitter.onEvent(WebAgentEventType.THOUGHT, this.handleThought);
    emitter.onEvent(WebAgentEventType.EXTRACTED_DATA, this.handleExtractedData);
    emitter.onEvent(WebAgentEventType.THINKING, this.handleThinking);

    // Action events
    emitter.onEvent(WebAgentEventType.ACTION_EXECUTION, this.handleActionExecution);
    emitter.onEvent(WebAgentEventType.ACTION_RESULT, this.handleActionResult);

    // Debug events
    emitter.onEvent(WebAgentEventType.DEBUG_COMPRESSION, this.handleCompressionDebug);
    emitter.onEvent(WebAgentEventType.DEBUG_MESSAGES, this.handleMessagesDebug);

    // Waiting events
    emitter.onEvent(WebAgentEventType.WAITING, this.handleWaiting);
    emitter.onEvent(WebAgentEventType.NETWORK_WAITING, this.handleNetworkWaiting);
    emitter.onEvent(WebAgentEventType.NETWORK_TIMEOUT, this.handleNetworkTimeout);

    // Validation events
    emitter.onEvent(WebAgentEventType.VALIDATION_ERROR, this.handleValidationError);

    // Status events
    emitter.onEvent(WebAgentEventType.STATUS_MESSAGE, this.handleStatusMessage);
  }

  dispose(): void {
    // Clean up event listeners to prevent memory leaks
    if (this.emitter) {
      // Task events
      this.emitter.offEvent(WebAgentEventType.TASK_START, this.handleTaskStart);
      this.emitter.offEvent(WebAgentEventType.TASK_COMPLETE, this.handleTaskComplete);
      this.emitter.offEvent(WebAgentEventType.TASK_VALIDATION, this.handleTaskValidation);

      // Page events
      this.emitter.offEvent(WebAgentEventType.PAGE_NAVIGATION, this.handlePageNavigation);

      // Agent reasoning events
      this.emitter.offEvent(WebAgentEventType.CURRENT_STEP, this.handleCurrentStep);
      this.emitter.offEvent(WebAgentEventType.OBSERVATION, this.handleObservation);
      this.emitter.offEvent(WebAgentEventType.THOUGHT, this.handleThought);
      this.emitter.offEvent(WebAgentEventType.EXTRACTED_DATA, this.handleExtractedData);
      this.emitter.offEvent(WebAgentEventType.THINKING, this.handleThinking);

      // Action events
      this.emitter.offEvent(WebAgentEventType.ACTION_EXECUTION, this.handleActionExecution);
      this.emitter.offEvent(WebAgentEventType.ACTION_RESULT, this.handleActionResult);

      // Debug events
      this.emitter.offEvent(WebAgentEventType.DEBUG_COMPRESSION, this.handleCompressionDebug);
      this.emitter.offEvent(WebAgentEventType.DEBUG_MESSAGES, this.handleMessagesDebug);

      // Waiting events
      this.emitter.offEvent(WebAgentEventType.WAITING, this.handleWaiting);
      this.emitter.offEvent(WebAgentEventType.NETWORK_WAITING, this.handleNetworkWaiting);
      this.emitter.offEvent(WebAgentEventType.NETWORK_TIMEOUT, this.handleNetworkTimeout);

      // Validation events
      this.emitter.offEvent(WebAgentEventType.VALIDATION_ERROR, this.handleValidationError);

      // Status events
      this.emitter.offEvent(WebAgentEventType.STATUS_MESSAGE, this.handleStatusMessage);

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
    console.log(chalk.blue.bold("🌐 Starting URL: "), chalk.blue.underline(data.url));
  };

  private handleTaskComplete = (data: TaskCompleteEventData): void => {
    if (data.finalAnswer) {
      console.log(chalk.green.bold("\n✨ Final Answer:"), chalk.whiteBright(data.finalAnswer));
    }
  };

  private handleTaskValidation = (data: TaskValidationEventData): void => {
    const qualityColors = {
      excellent: chalk.green,
      complete: chalk.green,
      partial: chalk.yellow,
      failed: chalk.red,
    };

    const qualityLabels = {
      excellent: "✨ Excellent completion",
      complete: "✅ Task completed",
      partial: "⚠️ Partial completion",
      failed: "❌ Task failed",
    };

    const color = qualityColors[data.completionQuality];
    const label = qualityLabels[data.completionQuality];

    console.log(chalk.bold("\n🔍 Task Validation:"), color(label));

    if (data.observation) {
      console.log(chalk.gray("   Analysis:"), chalk.whiteBright(data.observation));
    }

    if (data.feedback) {
      console.log(chalk.gray("   Feedback:"), chalk.whiteBright(data.feedback));
    }
  };

  private handlePageNavigation = (data: PageNavigationEventData): void => {
    console.log(chalk.gray("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"));

    const truncatedTitle = data.title.length > 50 ? data.title.slice(0, 47) + "..." : data.title;

    console.log(chalk.blue.bold("📍 Current Page:"), chalk.blue(truncatedTitle));
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
      data.value ? chalk.green(`value: "${data.value}"`) : "",
    );

    console.log(
      chalk.cyan.bold("\n▶️ Executing action:"),
      chalk.whiteBright(data.action.toUpperCase()),
      data.ref ? chalk.cyan(`ref: ${data.ref}`) : "",
      data.value ? chalk.green(`value: "${data.value}"`) : "",
    );
  };

  private handleActionResult = (data: ActionResultEventData): void => {
    if (!data.success) {
      console.error(
        chalk.red.bold(`❌ Failed to execute action: `),
        chalk.whiteBright(data.error || "Unknown error"),
      );
    }
  };

  private handleCompressionDebug = (data: CompressionDebugEventData): void => {
    console.log(
      chalk.gray("\n📝 Compression:"),
      chalk.green(`${data.compressionPercent}%`),
      chalk.gray(`(${data.originalSize} → ${data.compressedSize} chars)`),
    );
  };

  private handleMessagesDebug = (data: MessagesDebugEventData): void => {
    console.log(chalk.cyan.bold("\n🤔 Messages:"));
    console.log(chalk.gray(JSON.stringify(data.messages, null, 2)));
  };

  private handleWaiting = (data: WaitingEventData): void => {
    console.log(
      chalk.yellow.bold(`⏳ Waiting for ${data.seconds} second${data.seconds !== 1 ? "s" : ""}...`),
    );
  };

  private handleNetworkWaiting = (data: NetworkWaitingEventData): void => {
    console.log(
      chalk.gray(`   🌐 Waiting for network activity to settle after "${data.action}"...`),
    );
  };

  private handleNetworkTimeout = (data: NetworkTimeoutEventData): void => {
    console.log(chalk.gray(`   ⚠️  Network wait timed out for "${data.action}", continuing...`));
  };

  private handleThinking = (data: ThinkingEventData): void => {
    if (data.status === "start") {
      console.log(chalk.cyan.bold(`\n🤔 ${data.operation}...`));
    }
  };

  private handleValidationError = (data: ValidationErrorEventData): void => {
    console.error(
      chalk.red.bold(`\n⚠️ Action validation failed (attempt ${data.retryCount + 1}):`),
    );
    data.errors.forEach((error, index) => {
      console.error(chalk.red(`   ${index + 1}. ${error}`));
    });
    if (data.retryCount < 2) {
      console.log(chalk.yellow("   🔄 Retrying with corrected feedback..."));
    }
  };

  private handleStatusMessage = (data: StatusMessageEventData): void => {
    console.log(chalk.green.bold("📡 Status:"), chalk.whiteBright(data.message));
  };
}

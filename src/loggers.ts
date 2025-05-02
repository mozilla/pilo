import chalk from "chalk";
import { WebAgentEventType, WebAgentEventEmitter } from "./events.js";
import type {
  ActionExecutionEventData,
  ActionResultEventData,
  CompressionDebugEventData,
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
    emitter.onEvent(WebAgentEventType.OBSERVATION, this.handleObservation);
    emitter.onEvent(WebAgentEventType.THOUGHT, this.handleThought);

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
        WebAgentEventType.OBSERVATION,
        this.handleObservation
      );
      this.emitter.offEvent(WebAgentEventType.THOUGHT, this.handleThought);

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

  private handleObservation = (data: ObservationEventData): void => {
    console.log(chalk.yellow.bold("🔭 Observation:"));
    console.log(chalk.whiteBright("   " + data.observation));
  };

  private handleThought = (data: ThoughtEventData): void => {
    console.log(chalk.yellow.bold("\n💭 Thought:"));
    console.log(chalk.whiteBright("   " + data.thought));
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

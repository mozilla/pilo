import chalk from "chalk";
import { WebAgentEventType, WebAgentEventEmitter } from "../events.js";
import type {
  ActionExecutionEventData,
  ActionResultEventData,
  AgentStepEventData,
  CompressionDebugEventData,
  ExtractedDataEventData,
  MessagesDebugEventData,
  NetworkTimeoutEventData,
  NetworkWaitingEventData,
  PageNavigationEventData,
  ReasoningEventData,
  StatusMessageEventData,
  TaskCompleteEventData,
  TaskSetupEventData,
  TaskStartEventData,
  WaitingEventData,
  TaskValidationEventData,
  ProcessingEventData,
  ScreenshotCapturedEventData,
  ValidationErrorEventData,
  AIGenerationErrorEventData,
} from "../events.js";
import { Logger } from "./types.js";

/**
 * Console logger that outputs colored text to the console
 * Note: Uses Node.js specific APIs (chalk) - not suitable for browser environments
 */
export class ChalkConsoleLogger implements Logger {
  private emitter: WebAgentEventEmitter | null = null;

  initialize(emitter: WebAgentEventEmitter): void {
    if (this.emitter) {
      // Dispose existing listeners before reinitializing
      this.dispose();
    }
    this.emitter = emitter;

    // Task events
    emitter.onEvent(WebAgentEventType.TASK_SETUP, this.handleTaskSetup);
    emitter.onEvent(WebAgentEventType.TASK_STARTED, this.handleTaskStart);
    emitter.onEvent(WebAgentEventType.TASK_COMPLETED, this.handleTaskComplete);
    emitter.onEvent(WebAgentEventType.TASK_VALIDATED, this.handleTaskValidation);
    emitter.onEvent(WebAgentEventType.TASK_VALIDATION_ERROR, this.handleValidationError);

    // Browser events
    emitter.onEvent(WebAgentEventType.BROWSER_NAVIGATED, this.handlePageNavigation);
    emitter.onEvent(WebAgentEventType.AGENT_ACTION, this.handleAgentAction);
    emitter.onEvent(WebAgentEventType.BROWSER_ACTION_STARTED, this.handleBrowserAction);
    emitter.onEvent(WebAgentEventType.BROWSER_ACTION_COMPLETED, this.handleActionResult);
    emitter.onEvent(WebAgentEventType.BROWSER_NETWORK_WAITING, this.handleNetworkWaiting);
    emitter.onEvent(WebAgentEventType.BROWSER_NETWORK_TIMEOUT, this.handleNetworkTimeout);
    emitter.onEvent(WebAgentEventType.BROWSER_SCREENSHOT_CAPTURED, this.handleScreenshotCaptured);

    // Agent reasoning events
    emitter.onEvent(WebAgentEventType.AGENT_STEP, this.handleAgentStep);
    emitter.onEvent(WebAgentEventType.AGENT_REASONED, this.handleReasoning);
    emitter.onEvent(WebAgentEventType.AGENT_EXTRACTED, this.handleExtractedData);
    emitter.onEvent(WebAgentEventType.AGENT_PROCESSING, this.handleProcessing);
    emitter.onEvent(WebAgentEventType.AGENT_STATUS, this.handleStatusMessage);
    emitter.onEvent(WebAgentEventType.AGENT_WAITING, this.handleWaiting);

    // Debug events
    emitter.onEvent(WebAgentEventType.SYSTEM_DEBUG_COMPRESSION, this.handleCompressionDebug);
    emitter.onEvent(WebAgentEventType.SYSTEM_DEBUG_MESSAGE, this.handleMessagesDebug);

    // AI events
    emitter.onEvent(WebAgentEventType.AI_GENERATION_ERROR, this.handleAIGenerationError);
  }

  dispose(): void {
    // Clean up event listeners to prevent memory leaks
    if (this.emitter) {
      // Task events
      this.emitter.offEvent(WebAgentEventType.TASK_SETUP, this.handleTaskSetup);
      this.emitter.offEvent(WebAgentEventType.TASK_STARTED, this.handleTaskStart);
      this.emitter.offEvent(WebAgentEventType.TASK_COMPLETED, this.handleTaskComplete);
      this.emitter.offEvent(WebAgentEventType.TASK_VALIDATED, this.handleTaskValidation);
      this.emitter.offEvent(WebAgentEventType.TASK_VALIDATION_ERROR, this.handleValidationError);

      // Browser events
      this.emitter.offEvent(WebAgentEventType.BROWSER_NAVIGATED, this.handlePageNavigation);
      this.emitter.offEvent(WebAgentEventType.AGENT_ACTION, this.handleAgentAction);
      this.emitter.offEvent(WebAgentEventType.BROWSER_ACTION_STARTED, this.handleBrowserAction);
      this.emitter.offEvent(WebAgentEventType.BROWSER_ACTION_COMPLETED, this.handleActionResult);
      this.emitter.offEvent(WebAgentEventType.BROWSER_NETWORK_WAITING, this.handleNetworkWaiting);
      this.emitter.offEvent(WebAgentEventType.BROWSER_NETWORK_TIMEOUT, this.handleNetworkTimeout);
      this.emitter.offEvent(
        WebAgentEventType.BROWSER_SCREENSHOT_CAPTURED,
        this.handleScreenshotCaptured,
      );

      // Agent reasoning events
      this.emitter.offEvent(WebAgentEventType.AGENT_STEP, this.handleAgentStep);
      this.emitter.offEvent(WebAgentEventType.AGENT_REASONED, this.handleReasoning);
      this.emitter.offEvent(WebAgentEventType.AGENT_EXTRACTED, this.handleExtractedData);
      this.emitter.offEvent(WebAgentEventType.AGENT_PROCESSING, this.handleProcessing);
      this.emitter.offEvent(WebAgentEventType.AGENT_STATUS, this.handleStatusMessage);
      this.emitter.offEvent(WebAgentEventType.AGENT_WAITING, this.handleWaiting);

      // Debug events
      this.emitter.offEvent(
        WebAgentEventType.SYSTEM_DEBUG_COMPRESSION,
        this.handleCompressionDebug,
      );
      this.emitter.offEvent(WebAgentEventType.SYSTEM_DEBUG_MESSAGE, this.handleMessagesDebug);

      // AI events
      this.emitter.offEvent(WebAgentEventType.AI_GENERATION_ERROR, this.handleAIGenerationError);

      // Reset emitter reference
      this.emitter = null;
    }
  }

  private handleTaskSetup = (data: TaskSetupEventData): void => {
    console.log(chalk.blue.bold("🚀 Spark Automation Starting"));
    console.log(chalk.gray(`Task: ${data.task}`));
    if (data.provider) console.log(chalk.gray(`Provider: ${data.provider}`));
    if (data.model) console.log(chalk.gray(`Model: ${data.model}`));
    console.log(chalk.gray(`Browser: ${data.browserName}`));
    if (data.pwEndpoint) console.log(chalk.gray(`Remote endpoint: ${data.pwEndpoint}`));
    if (data.pwCdpEndpoint) console.log(chalk.gray(`CDP endpoint: ${data.pwCdpEndpoint}`));
    if (data.proxy) console.log(chalk.gray(`Proxy: ${data.proxy}`));
    if (data.url) console.log(chalk.gray(`Starting URL: ${data.url}`));
    if (data.guardrails) console.log(chalk.gray(`Guardrails: ${data.guardrails}`));
    if (data.vision) console.log(chalk.gray(`Vision: enabled`));
    console.log("");
  };

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

  private handleAgentStep = (data: AgentStepEventData): void => {
    console.log(chalk.cyan(`\n🔄 Iteration ${data.currentIteration} [${data.iterationId}]`));
  };

  private handleReasoning = (data: ReasoningEventData): void => {
    console.log(chalk.yellow.bold("\n🧠 Agent Reasoned:"));
    console.log(chalk.whiteBright("   " + data.reasoning));
  };

  private handleExtractedData = (data: ExtractedDataEventData): void => {
    console.log(chalk.green.bold("\n📊 Agent Extracted:"));
    console.log(chalk.whiteBright("   " + data.extractedData));
  };

  private handleAgentAction = (data: ActionExecutionEventData): void => {
    console.log(
      chalk.yellow.bold("\n🎯 Agent Action:"),
      chalk.whiteBright(data.action.toUpperCase()),
      data.ref ? chalk.cyan(`ref: ${data.ref}`) : "",
      data.value ? chalk.green(`value: "${data.value}"`) : "",
    );
  };

  private handleBrowserAction = (data: ActionExecutionEventData): void => {
    console.log(
      chalk.cyan.bold("\n🤖 Browser Executing:"),
      chalk.whiteBright(data.action.toUpperCase()),
      data.ref ? chalk.cyan(`ref: ${data.ref}`) : "",
      data.value ? chalk.green(`value: "${data.value}"`) : "",
    );
  };

  private handleActionResult = (data: ActionResultEventData): void => {
    if (!data.success) {
      console.error(
        chalk.red.bold(`❌ Browser Action Failed: `),
        chalk.whiteBright(data.error || "Unknown error"),
      );
    }
  };

  private handleCompressionDebug = (data: CompressionDebugEventData): void => {
    console.log(
      chalk.gray("\n🗜️ System Debug - Compression:"),
      chalk.green(`${data.compressionPercent}%`),
      chalk.gray(`(${data.originalSize} → ${data.compressedSize} chars)`),
    );
  };

  private handleMessagesDebug = (data: MessagesDebugEventData): void => {
    console.log(chalk.cyan.bold("\n💬 System Debug - Messages:"));
    console.log(chalk.gray(JSON.stringify(data.messages, null, 2)));
  };

  private handleWaiting = (data: WaitingEventData): void => {
    console.log(
      chalk.yellow.bold(
        `⏳ Agent Waiting ${data.seconds} second${data.seconds !== 1 ? "s" : ""}...`,
      ),
    );
  };

  private handleNetworkWaiting = (data: NetworkWaitingEventData): void => {
    console.log(chalk.gray(`   🌐 Browser Network Waiting after "${data.action}"...`));
  };

  private handleNetworkTimeout = (data: NetworkTimeoutEventData): void => {
    console.log(chalk.gray(`   ⚠️ Browser Network Timeout for "${data.action}", continuing...`));
  };

  private handleScreenshotCaptured = (data: ScreenshotCapturedEventData): void => {
    const sizeKB = Math.round(data.size / 1024);
    console.log(chalk.gray(`   📸 Screenshot captured (${sizeKB}KB ${data.format.toUpperCase()})`));
  };

  private handleProcessing = (data: ProcessingEventData): void => {
    if (data.status === "start") {
      const visionIndicator = data.hasScreenshot ? "👁️ " : "";
      console.log(chalk.cyan.bold(`\n🧮 ${visionIndicator}Agent Processing: ${data.operation}...`));
    }
  };

  private handleValidationError = (data: ValidationErrorEventData): void => {
    console.error(chalk.red.bold(`\n⚠️ Task Validation Error (attempt ${data.retryCount + 1}):`));
    data.errors.forEach((error, index) => {
      console.error(chalk.red(`   ${index + 1}. ${error}`));
    });
    if (data.retryCount < 2) {
      console.log(chalk.yellow("   🔄 Retrying with corrected feedback..."));
    }
  };

  private handleStatusMessage = (data: StatusMessageEventData): void => {
    console.log(chalk.green.bold("💬 Agent Status:"), chalk.whiteBright(data.message));
  };

  private handleAIGenerationError = (data: AIGenerationErrorEventData): void => {
    console.error(chalk.red.bold("❌ AI generation error:"), chalk.whiteBright(data.error));
  };
}

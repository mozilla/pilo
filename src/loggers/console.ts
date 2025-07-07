import { WebAgentEventType, WebAgentEventEmitter } from "../events.js";
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
  TaskSetupEventData,
  TaskStartEventData,
  ThoughtEventData,
  WaitingEventData,
  TaskValidationEventData,
  ProcessingEventData,
  ScreenshotCapturedEventData,
  ValidationErrorEventData,
  AIGenerationErrorEventData,
} from "../events.js";
import { Logger } from "./types.js";

/**
 * Basic console logger that outputs plain text to the console
 * Browser-safe - uses only console.log/console.error without Node.js dependencies
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
    emitter.onEvent(WebAgentEventType.TASK_SETUP, this.handleTaskSetup);
    emitter.onEvent(WebAgentEventType.TASK_STARTED, this.handleTaskStart);
    emitter.onEvent(WebAgentEventType.TASK_COMPLETED, this.handleTaskComplete);
    emitter.onEvent(WebAgentEventType.TASK_VALIDATED, this.handleTaskValidation);
    emitter.onEvent(WebAgentEventType.TASK_VALIDATION_ERROR, this.handleValidationError);

    // Browser events
    emitter.onEvent(WebAgentEventType.BROWSER_NAVIGATED, this.handlePageNavigation);
    emitter.onEvent(WebAgentEventType.BROWSER_ACTION_STARTED, this.handleActionExecution);
    emitter.onEvent(WebAgentEventType.BROWSER_ACTION_COMPLETED, this.handleActionResult);
    emitter.onEvent(WebAgentEventType.BROWSER_NETWORK_WAITING, this.handleNetworkWaiting);
    emitter.onEvent(WebAgentEventType.BROWSER_NETWORK_TIMEOUT, this.handleNetworkTimeout);
    emitter.onEvent(WebAgentEventType.BROWSER_SCREENSHOT_CAPTURED, this.handleScreenshotCaptured);

    // Agent reasoning events
    emitter.onEvent(WebAgentEventType.AGENT_STEP, this.handleCurrentStep);
    emitter.onEvent(WebAgentEventType.AGENT_OBSERVED, this.handleObservation);
    emitter.onEvent(WebAgentEventType.AGENT_REASONED, this.handleThought);
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
      this.emitter.offEvent(WebAgentEventType.BROWSER_ACTION_STARTED, this.handleActionExecution);
      this.emitter.offEvent(WebAgentEventType.BROWSER_ACTION_COMPLETED, this.handleActionResult);
      this.emitter.offEvent(WebAgentEventType.BROWSER_NETWORK_WAITING, this.handleNetworkWaiting);
      this.emitter.offEvent(WebAgentEventType.BROWSER_NETWORK_TIMEOUT, this.handleNetworkTimeout);
      this.emitter.offEvent(
        WebAgentEventType.BROWSER_SCREENSHOT_CAPTURED,
        this.handleScreenshotCaptured,
      );

      // Agent reasoning events
      this.emitter.offEvent(WebAgentEventType.AGENT_STEP, this.handleCurrentStep);
      this.emitter.offEvent(WebAgentEventType.AGENT_OBSERVED, this.handleObservation);
      this.emitter.offEvent(WebAgentEventType.AGENT_REASONED, this.handleThought);
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
    console.log("🚀 Spark Automation Starting");
    console.log(`Task: ${data.task}`);
    if (data.provider) console.log(`Provider: ${data.provider}`);
    if (data.model) console.log(`Model: ${data.model}`);
    console.log(`Browser: ${data.browserName}`);
    if (data.pwEndpoint) console.log(`Remote endpoint: ${data.pwEndpoint}`);
    if (data.proxy) console.log(`Proxy: ${data.proxy}`);
    if (data.url) console.log(`Starting URL: ${data.url}`);
    if (data.guardrails) console.log(`Guardrails: ${data.guardrails}`);
    if (data.vision) console.log(`Vision: enabled`);
    console.log("");
  };

  private handleTaskStart = (data: TaskStartEventData): void => {
    console.log("\n🎯 Task: ", data.task);
    console.log("\n💡 Explanation:");
    console.log(data.explanation);
    console.log("\n📋 Plan:");
    console.log(data.plan);
    console.log("🌐 Starting URL: ", data.url);
  };

  private handleTaskComplete = (data: TaskCompleteEventData): void => {
    if (data.finalAnswer) {
      console.log("\n✨ Final Answer:", data.finalAnswer);
    }
  };

  private handleTaskValidation = (data: TaskValidationEventData): void => {
    const qualityLabels = {
      excellent: "✨ Excellent completion",
      complete: "✅ Task completed",
      partial: "⚠️ Partial completion",
      failed: "❌ Task failed",
    };

    const label = qualityLabels[data.completionQuality];

    console.log("\n🔍 Task Validation:", label);

    if (data.observation) {
      console.log("   Analysis:", data.observation);
    }

    if (data.feedback) {
      console.log("   Feedback:", data.feedback);
    }
  };

  private handlePageNavigation = (data: PageNavigationEventData): void => {
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    const truncatedTitle = data.title.length > 50 ? data.title.slice(0, 47) + "..." : data.title;

    console.log("📍 Current Page:", truncatedTitle);
  };

  private handleCurrentStep = (data: CurrentStepEventData): void => {
    console.log("🎯 Agent Step:");
    console.log("   " + data.currentStep);
  };

  private handleObservation = (data: ObservationEventData): void => {
    console.log("👁️ Agent Observed:");
    console.log("   " + data.observation);
  };

  private handleThought = (data: ThoughtEventData): void => {
    console.log("\n🧠 Agent Reasoned:");
    console.log("   " + data.thought);
  };

  private handleExtractedData = (data: ExtractedDataEventData): void => {
    console.log("\n📊 Agent Extracted:");
    console.log("   " + data.extractedData);
  };

  private handleActionExecution = (data: ActionExecutionEventData): void => {
    console.log("\n🎯 Planned Action:");
    console.log(
      `   1. ${data.action.toUpperCase()}`,
      data.ref ? `ref: ${data.ref}` : "",
      data.value ? `value: "${data.value}"` : "",
    );

    console.log(
      "\n🤖 Browser Executing:",
      data.action.toUpperCase(),
      data.ref ? `ref: ${data.ref}` : "",
      data.value ? `value: "${data.value}"` : "",
    );
  };

  private handleActionResult = (data: ActionResultEventData): void => {
    if (!data.success) {
      console.error(`❌ Browser Action Failed: `, data.error || "Unknown error");
    }
  };

  private handleCompressionDebug = (data: CompressionDebugEventData): void => {
    console.log(
      "\n🗜️ System Debug - Compression:",
      `${data.compressionPercent}%`,
      `(${data.originalSize} → ${data.compressedSize} chars)`,
    );
  };

  private handleMessagesDebug = (data: MessagesDebugEventData): void => {
    console.log("\n💬 System Debug - Messages:");
    console.log(JSON.stringify(data.messages, null, 2));
  };

  private handleWaiting = (data: WaitingEventData): void => {
    console.log(`⏳ Agent Waiting ${data.seconds} second${data.seconds !== 1 ? "s" : ""}...`);
  };

  private handleNetworkWaiting = (data: NetworkWaitingEventData): void => {
    console.log(`   🌐 Browser Network Waiting after "${data.action}"...`);
  };

  private handleNetworkTimeout = (data: NetworkTimeoutEventData): void => {
    console.log(`   ⚠️ Browser Network Timeout for "${data.action}", continuing...`);
  };

  private handleScreenshotCaptured = (data: ScreenshotCapturedEventData): void => {
    const sizeKB = Math.round(data.size / 1024);
    console.log(`   📸 Screenshot captured (${sizeKB}KB ${data.format.toUpperCase()})`);
  };

  private handleProcessing = (data: ProcessingEventData): void => {
    if (data.status === "start") {
      const visionIndicator = data.hasScreenshot ? "👁️ " : "";
      console.log(`\n🧮 ${visionIndicator}Agent Processing: ${data.operation}...`);
    }
  };

  private handleValidationError = (data: ValidationErrorEventData): void => {
    console.error(`\n⚠️ Task Validation Error (attempt ${data.retryCount + 1}):`);
    data.errors.forEach((error, index) => {
      console.error(`   ${index + 1}. ${error}`);
    });
    if (data.retryCount < 2) {
      console.log("   🔄 Retrying with corrected feedback...");
    }
  };

  private handleStatusMessage = (data: StatusMessageEventData): void => {
    console.log("💬 Agent Status:", data.message);
  };

  private handleAIGenerationError = (data: AIGenerationErrorEventData): void => {
    console.error("❌ AI generation error:", data.error);
  };
}

/**
 * WebAgent
 *
 * Core web automation agent that executes tasks using browser automation.
 * Handles the main execution loop with:
 * - SnapshotCompressor: Optimizes accessibility tree for token efficiency
 * - Validator: Context validation and task completion checking
 */

import { streamText, ModelMessage, StreamTextResult } from "ai";
import type { ProviderConfig } from "./provider.js";
import { AriaBrowser } from "./browser/ariaBrowser.js";
import { WebAgentEventEmitter, WebAgentEventType } from "./events.js";
import { SnapshotCompressor } from "./snapshotCompressor.js";
import { Logger } from "./loggers/types.js";
import { ConsoleLogger } from "./loggers/console.js";
import { RecoverableError, ToolExecutionError } from "./errors.js";
import { generateTextWithRetry } from "./utils/retry.js";
import type { AwaitedProperties } from "./utils/types.js";
import {
  buildActionLoopSystemPrompt,
  buildTaskAndPlanPrompt,
  buildPageSnapshotPrompt,
  buildPlanAndUrlPrompt,
  buildPlanPrompt,
  buildStepErrorFeedbackPrompt,
  buildTaskValidationPrompt,
  buildValidationFeedbackPrompt,
} from "./prompts.js";
import { createWebActionTools } from "./tools/webActionTools.js";
import { createPlanningTools } from "./tools/planningTools.js";
import { createValidationTools } from "./tools/validationTools.js";
import { nanoid } from "nanoid";
import { getConfigDefaults } from "./configDefaults.js";
import {
  DEFAULT_GENERATION_MAX_TOKENS,
  DEFAULT_PLANNING_MAX_TOKENS,
  DEFAULT_VALIDATION_MAX_TOKENS,
} from "./constants.js";

// === Type Definitions ===

export interface WebAgentOptions {
  /** Provider configuration including model and options */
  providerConfig: ProviderConfig;
  /** Debug mode for additional logging */
  debug?: boolean;
  /** Whether to use vision capabilities */
  vision?: boolean;
  /** Maximum iterations for task completion */
  maxIterations?: number;
  /** Maximum consecutive errors before failing */
  maxConsecutiveErrors?: number;
  /** Maximum total errors before failing */
  maxTotalErrors?: number;
  /** Optional guardrails to constrain agent behavior */
  guardrails?: string | null;
  /** Event emitter for custom event handling */
  eventEmitter?: WebAgentEventEmitter;
  /** Logger for handling events */
  logger?: Logger;
  /** Maximum validation attempts when task completion quality is insufficient */
  maxValidationAttempts?: number;
  /** Maximum times an action can be repeated before warning/aborting */
  maxRepeatedActions?: number;
  /** Number of times to retry initial navigation with browser restart (0 = no retries, default: 1) */
  initialNavigationRetries?: number;
}

export interface ExecuteOptions {
  /** Optional starting URL */
  startingUrl?: string;
  /** Optional data to provide to the agent */
  data?: any;
  /** Abort signal for cancellation */
  abortSignal?: AbortSignal;
}

/** Error codes for task failures */
export enum TaskErrorCode {
  /** Task was aborted by user */
  TASK_ABORTED = "TASK_ABORTED",
  /** Maximum iterations reached without completion */
  MAX_ITERATIONS = "MAX_ITERATIONS",
  /** Too many consecutive or total errors */
  MAX_ERRORS = "MAX_ERRORS",
  /** Generic task failure */
  TASK_FAILED = "TASK_FAILED",
}

/** Structured error information for failed tasks */
export interface TaskError {
  /** Error code for programmatic handling */
  code: TaskErrorCode;
  /** Human-readable error message */
  message: string;
}

export interface TaskExecutionResult {
  /** Whether the task completed successfully */
  success: boolean;
  /** Final answer or result from the agent */
  finalAnswer: string | null;
  /** Error details when success is false */
  error?: TaskError;
  /** Execution statistics */
  stats: {
    iterations: number;
    actions: number;
    startTime: number;
    endTime: number;
    durationMs: number;
  };
}

interface ExecutionState {
  currentIteration: number;
  actionCount: number;
  startTime: number;
  success: boolean;
  finalAnswer: string | null;
  error?: TaskError;
  lastAction?: string;
  actionRepeatCount: number;
  validationAttempts: number;
}

type StreamTextResultGeneric = StreamTextResult<any, never>;
// HACK: cobble together a type from StreamTextResult with promises resolved
type ProcessedAIResponse = AwaitedProperties<
  Pick<
    StreamTextResultGeneric,
    "toolResults" | "response" | "finishReason" | "usage" | "warnings" | "providerMetadata"
  >
>;

/**
 * Simplified WebAgent with core execution logic
 */
export class WebAgent {
  // === Core State (stays here) ===
  private plan: string = "";
  private url: string = "";
  private messages: ModelMessage[] = [];
  private successCriteria: string = "";
  private currentPage: { url: string; title: string } = { url: "", title: "" };
  private currentIterationId: string = "";
  private data: any = null;
  private abortSignal: AbortSignal | undefined = undefined;

  // === Services ===
  private compressor: SnapshotCompressor;
  private eventEmitter: WebAgentEventEmitter;
  private logger: Logger;

  // === Configuration ===
  private readonly providerConfig: ProviderConfig;
  private readonly debug: boolean;
  private readonly vision: boolean;
  private readonly maxIterations: number;
  private readonly maxConsecutiveErrors: number;
  private readonly maxTotalErrors: number;
  private readonly maxValidationAttempts: number;
  private readonly maxRepeatedActions: number;
  private readonly initialNavigationRetries: number;
  private readonly guardrails: string | null;

  constructor(
    private browser: AriaBrowser,
    options: WebAgentOptions,
  ) {
    // Initialize configuration
    const defaults = getConfigDefaults();
    this.providerConfig = options.providerConfig;
    this.debug = options.debug ?? false;
    this.vision = options.vision ?? false;
    this.maxIterations = options.maxIterations ?? defaults.max_iterations;
    this.maxConsecutiveErrors = options.maxConsecutiveErrors ?? defaults.max_consecutive_errors;
    this.maxTotalErrors = options.maxTotalErrors ?? defaults.max_total_errors;
    this.maxValidationAttempts = options.maxValidationAttempts ?? defaults.max_validation_attempts;
    this.maxRepeatedActions = options.maxRepeatedActions ?? defaults.max_repeated_actions;
    this.initialNavigationRetries =
      options.initialNavigationRetries ?? defaults.initial_navigation_retries;
    this.guardrails = options.guardrails ?? null;

    // Initialize services
    this.compressor = new SnapshotCompressor();
    this.eventEmitter = options.eventEmitter ?? new WebAgentEventEmitter();
    this.logger = options.logger ?? new ConsoleLogger();

    // Initialize logger with event emitter
    this.logger.initialize(this.eventEmitter);
  }

  /**
   * Main entry point - keep this simple and clear
   */
  async execute(task: string, options: ExecuteOptions = {}): Promise<TaskExecutionResult> {
    // 1. Validate input parameters (let validation errors throw)
    this.validateTaskAndOptions(task, options);

    // 2. Initialize browser and internal state
    await this.initializeBrowserAndState(task, options);

    const executionState = this.initializeExecutionState();

    try {
      // 3. Planning phase
      await this.planTask(task, options.startingUrl);

      // 4. Navigation phase (with retry on recoverable errors)
      await this.navigateToStartWithRetry(task);
      this.initializeSystemPromptAndTask(task);

      // 5. Main execution loop
      const loopOutcome = await this.runMainLoop(task, executionState);

      // 6. Return results
      return this.buildResult(loopOutcome, executionState);
    } catch (error) {
      // Check if aborted
      if (this.abortSignal?.aborted) {
        return this.buildResult(
          {
            success: false,
            finalAnswer: "Task aborted by user",
            error: { code: TaskErrorCode.TASK_ABORTED, message: "Task aborted by user" },
          },
          executionState,
        );
      }

      // Re-throw setup/planning errors (they indicate configuration issues)
      if (this.isSetupError(error)) {
        throw error;
      }

      // Convert runtime errors to results
      const message = `Task failed: ${this.extractErrorMessage(error)}`;
      return this.buildResult(
        {
          success: false,
          finalAnswer: message,
          error: { code: TaskErrorCode.TASK_FAILED, message },
        },
        executionState,
      );
    }
  }

  /**
   * The main execution loop - clean and maintainable
   */
  private async runMainLoop(
    task: string,
    executionState: ExecutionState,
  ): Promise<{ success: boolean; finalAnswer: string | null; error?: TaskError }> {
    // Setup tools once
    const webActionTools = createWebActionTools({
      browser: this.browser,
      eventEmitter: this.eventEmitter,
      providerConfig: this.providerConfig,
      abortSignal: this.abortSignal,
    });

    let needsPageSnapshot = true;
    let consecutiveErrors = 0;
    let totalErrors = 0;

    // Helper to track errors consistently
    const trackError = (): void => {
      consecutiveErrors++;
      totalErrors++;
    };

    // Main loop
    while (
      executionState.currentIteration < this.maxIterations &&
      executionState.finalAnswer === null
    ) {
      // Check abort signal once at the start of each iteration
      if (this.abortSignal?.aborted) {
        console.warn("[WebAgent] Task aborted by user signal");
        return {
          success: false,
          finalAnswer: "Task aborted by user",
          error: { code: TaskErrorCode.TASK_ABORTED, message: "Task aborted by user" },
        };
      }

      // Generate unique iteration ID
      this.currentIterationId = nanoid(8);

      // Emit step event for this iteration
      this.emit(WebAgentEventType.AGENT_STEP, {
        iterationId: this.currentIterationId,
        currentIteration: executionState.currentIteration,
      });

      // Add page snapshot if needed
      if (needsPageSnapshot) {
        await this.addPageSnapshot();
      }

      // Single try-catch for ALL iteration logic
      try {
        const result = await this.generateAndProcessAction(task, webActionTools, executionState);

        // Reset error counter on success
        consecutiveErrors = 0;

        // Handle terminal actions
        if (result.isTerminal) {
          executionState.success = result.success;
          executionState.finalAnswer = result.finalAnswer;
          executionState.error = result.error;
          break;
        }

        // Update state for successful action
        if (result.actionExecuted) {
          executionState.actionCount++;
        }

        needsPageSnapshot = result.pageChanged;
      } catch (error) {
        trackError();

        // Check if we should continue
        if (!this.shouldContinueAfterError(consecutiveErrors, totalErrors, error)) {
          const isNonRecoverable = this.isNonRecoverableError(error);
          const errorMessage = this.extractErrorMessage(error);

          if (isNonRecoverable) {
            console.error(`[WebAgent] Non-recoverable error, stopping execution:`, errorMessage);
          } else {
            console.error(
              `[WebAgent] Too many errors (${consecutiveErrors} consecutive, ${totalErrors} total), stopping:`,
              errorMessage,
            );
          }

          const message = isNonRecoverable
            ? `Task failed: ${errorMessage}`
            : `Task failed after ${consecutiveErrors} consecutive errors (${totalErrors} total): ${errorMessage}`;
          return {
            success: false,
            finalAnswer: message,
            error: {
              code: isNonRecoverable ? TaskErrorCode.TASK_FAILED : TaskErrorCode.MAX_ERRORS,
              message,
            },
          };
        }

        // Add error feedback and retry
        this.addErrorFeedback(error);
        needsPageSnapshot = false; // Nothing changed, don't snapshot
      }

      executionState.currentIteration++;
    }

    // Check final state
    if (executionState.finalAnswer !== null) {
      return {
        success: executionState.success,
        finalAnswer: executionState.finalAnswer,
        error: executionState.error,
      };
    }

    // Max iterations reached
    console.error(
      `[WebAgent] Max iterations (${this.maxIterations}) reached without completing task`,
    );
    const message = "Maximum iterations reached without completing the task.";
    return {
      success: false,
      finalAnswer: message,
      error: { code: TaskErrorCode.MAX_ITERATIONS, message },
    };
  }

  /**
   * Check if we should continue after an error
   */
  private shouldContinueAfterError(
    consecutiveErrors: number,
    totalErrors: number,
    error: unknown,
  ): boolean {
    return (
      !this.isNonRecoverableError(error) &&
      consecutiveErrors < this.maxConsecutiveErrors &&
      totalErrors < this.maxTotalErrors
    );
  }

  /**
   * Check if an error is non-recoverable (e.g., provider/API errors)
   */
  private isNonRecoverableError(error: unknown): boolean {
    // RecoverableErrors (including ToolExecutionError) are explicitly recoverable
    if (error instanceof RecoverableError) {
      return false;
    }

    if (error instanceof Error) {
      const errorAny = error as any;

      // Check for HTTP status codes
      const statusCode = errorAny.statusCode || errorAny.status;
      if (statusCode) {
        // 4xx errors are client errors - non-recoverable
        // except 429 (rate limit) which might work after waiting
        if (statusCode >= 400 && statusCode < 500 && statusCode !== 429) {
          return true;
        }
        // Note: 5xx errors (server errors) are potentially recoverable, so we retry those
      }
    }

    return false;
  }

  /**
   * Add error feedback to the conversation
   *
   * IMPORTANT: Tool execution errors (ToolExecutionError) are NOT added as user messages
   * because the error information is already present in the tool result output.
   * This prevents duplicate error reporting to the LLM.
   */
  private addErrorFeedback(error: unknown): void {
    // Check if this is a tool execution error
    if (error instanceof ToolExecutionError) {
      // Don't add a user message - the error is already in the tool result
      // The LLM will see the error in the tool output and can retry

      // Still emit the error event for logging/monitoring
      this.emit(WebAgentEventType.AI_GENERATION_ERROR, {
        error: error.message,
        iterationId: this.currentIterationId,
        isToolError: true,
      });

      // Early return - no user message needed
      return;
    }

    // For other RecoverableErrors, use the message directly as it's already user-friendly
    const errorMessage =
      error instanceof RecoverableError ? error.message : this.extractErrorMessage(error);

    // Emit error event for logging
    this.emit(WebAgentEventType.AI_GENERATION_ERROR, {
      error: errorMessage,
      iterationId: this.currentIterationId,
      isToolError: false,
    });

    // Add error feedback to conversation for non-tool errors
    const errorFeedback = buildStepErrorFeedbackPrompt(errorMessage, Boolean(this.guardrails));
    this.messages.push({ role: "user", content: errorFeedback });
  }

  /**
   * Truncate old snapshots in messages to keep context size down
   * Replaces everything after the first ``` with "[clipped for brevity]"
   */
  private truncateOldSnapshots(): void {
    this.messages = this.messages.map((msg) => {
      if (msg.role === "user") {
        // Handle text-only messages
        // Check if this is a snapshot message (starts with Title: and URL: followed by ```)
        if (
          typeof msg.content === "string" &&
          msg.content.startsWith("Title:") &&
          msg.content.includes("URL:") &&
          msg.content.includes("```")
        ) {
          // Find the first ``` and replace everything after it
          const firstBackticksIndex = msg.content.indexOf("```");
          if (firstBackticksIndex !== -1) {
            return {
              ...msg,
              content: msg.content.substring(0, firstBackticksIndex) + "[clipped for brevity]",
            };
          }
        }
        // Handle multimodal messages (text + image)
        if (Array.isArray(msg.content)) {
          return {
            ...msg,
            content: msg.content.map((item: any) => {
              if (
                item.type === "text" &&
                item.text.startsWith("Title:") &&
                item.text.includes("URL:") &&
                item.text.includes("```")
              ) {
                // Find the first ``` and replace everything after it
                const firstBackticksIndex = item.text.indexOf("```");
                if (firstBackticksIndex !== -1) {
                  return {
                    ...item,
                    text: item.text.substring(0, firstBackticksIndex) + "[clipped for brevity]",
                  };
                }
              }
              if (item.type === "image") {
                // Remove the image data to save memory
                return {
                  type: "text",
                  text: "[screenshot clipped for brevity]",
                };
              }
              return item;
            }),
          };
        }
      }
      return msg;
    });
  }

  /**
   * Add page snapshot to the conversation
   */
  private async addPageSnapshot(): Promise<void> {
    // First, truncate old snapshots to keep context size manageable
    this.truncateOldSnapshots();

    const currentPageSnapshot = await this.browser.getTreeWithRefs();
    const compressedSnapshot = this.compressor.compress(currentPageSnapshot);

    // DEBUG: Log sample of refs in compressed snapshot
    const refMatches = compressedSnapshot.match(/\[s1e\d+\]/g);
    if (refMatches) {
      const uniqueRefs = [...new Set(refMatches)];
      console.log(`[DEBUG WebAgent] Found ${uniqueRefs.length} unique refs in compressed snapshot`);
      console.log(`[DEBUG WebAgent] First 10 refs:`, uniqueRefs.slice(0, 10));
      console.log(`[DEBUG WebAgent] Last 10 refs:`, uniqueRefs.slice(-10));
    }

    // Debug compression stats if enabled
    if (this.debug) {
      const stats = this.calculateCompressionStats(
        currentPageSnapshot.length,
        compressedSnapshot.length,
      );
      this.emit(WebAgentEventType.SYSTEM_DEBUG_COMPRESSION, stats);
    }

    // Get current page info
    const currentPageInfo = await this.getCurrentPageInfo();

    // Build the text content for the snapshot
    const snapshotMessage = buildPageSnapshotPrompt(
      currentPageInfo.title,
      currentPageInfo.url,
      compressedSnapshot,
      this.vision,
    );

    // Handle vision mode with screenshots
    if (this.vision) {
      try {
        const screenshot = await this.browser.getScreenshot();

        // Emit screenshot captured event
        this.emit(WebAgentEventType.BROWSER_SCREENSHOT_CAPTURED, {
          size: screenshot.length,
          format: "jpeg" as const,
        });

        // Add multimodal message with text and image
        this.messages.push({
          role: "user",
          content: [
            {
              type: "text",
              text: snapshotMessage,
            },
            {
              type: "image",
              image: screenshot,
              mediaType: "image/jpeg",
            },
          ],
        });
      } catch (error) {
        // If screenshot fails, fall back to text-only
        console.warn("Screenshot capture failed, falling back to text-only:", error);
        this.messages.push({ role: "user", content: snapshotMessage });
      }
    } else {
      // Text-only mode
      this.messages.push({ role: "user", content: snapshotMessage });
    }
  }

  /**
   * Generate AI response and process the result
   * @returns Object with action details and terminal status
   */
  private async generateAndProcessAction(
    task: string,
    webActionTools: any,
    executionState: ExecutionState,
  ): Promise<{
    isTerminal: boolean;
    success: boolean;
    finalAnswer: string | null;
    pageChanged: boolean;
    actionExecuted: boolean;
    error?: TaskError;
  }> {
    // Start processing - hasScreenshot is true if we're in vision mode and just captured a screenshot
    this.emit(WebAgentEventType.AGENT_PROCESSING, {
      operation: "Thinking about next action",
      hasScreenshot: this.vision,
      iterationId: this.currentIterationId,
    });

    let aiResponse: ProcessedAIResponse | null = null;
    let generationError: Error | null = null;

    try {
      // Generate AI response using streamText
      const streamResult = streamText({
        ...this.providerConfig,
        messages: this.messages,
        tools: webActionTools,
        toolChoice: "required",
        maxOutputTokens: DEFAULT_GENERATION_MAX_TOKENS,
        abortSignal: this.abortSignal,
      });

      // Process the full stream to capture reasoning before tool execution
      let reasoningText = "";
      let reasoningEmitted = false;

      for await (const part of streamResult.fullStream) {
        switch (part.type) {
          case "reasoning-start":
            // Start accumulating reasoning
            reasoningText = "";
            reasoningEmitted = false;
            break;

          case "reasoning-delta":
            // Accumulate reasoning text
            if ("text" in part) {
              reasoningText += part.text;
            }
            break;

          case "tool-input-start":
          case "tool-call":
          case "reasoning-end":
            // Emit reasoning when we're about to execute a tool or when reasoning ends
            if (reasoningText && !reasoningEmitted) {
              this.emit(WebAgentEventType.AGENT_REASONED, {
                reasoning: reasoningText.trim(),
                iterationId: this.currentIterationId,
              });
              reasoningEmitted = true;
            }
            break;
        }
      }

      // Await only the properties we actually need
      const [toolResults, response, finishReason, usage, warnings, providerMetadata] =
        await Promise.all([
          streamResult.toolResults,
          streamResult.response,
          streamResult.finishReason,
          streamResult.usage,
          streamResult.warnings,
          streamResult.providerMetadata,
        ]);

      aiResponse = {
        toolResults,
        response,
        finishReason,
        usage,
        warnings,
        providerMetadata,
      };
    } catch (error) {
      // Preserve original error
      generationError = error instanceof Error ? error : new Error(String(error));
    }

    // Always append messages if they exist (even on error)
    if (aiResponse?.response?.messages) {
      for (const msg of aiResponse.response.messages) {
        this.messages.push(msg);
      }
    }

    // Always emit generation event (with error info if applicable)
    this.emit(WebAgentEventType.AI_GENERATION, {
      messages: this.messages,
      temperature: 0,
      object: null,
      finishReason: aiResponse?.finishReason || "error",
      usage: aiResponse?.usage || {},
      warnings: aiResponse?.warnings || [],
      providerMetadata: aiResponse?.providerMetadata || {},
      error: generationError ? this.extractErrorMessage(generationError) : undefined,
    });

    // Re-throw if generation failed
    if (generationError) {
      throw generationError;
    }

    // Process tool results
    if (!aiResponse?.toolResults?.length) {
      console.error("[WebAgent] No tools called in action generation");
      throw new ToolExecutionError(
        "You must use exactly one tool. Please use one of the available tools.",
        {
          action: "none",
        },
      );
    }

    const toolResult = aiResponse.toolResults[0];
    const actionOutput = toolResult.output as any;

    if (!actionOutput) {
      throw new Error("Tool execution failed: missing output property.");
    }

    // Check if the tool returned an error
    // The tool output structure is guaranteed to have:
    // - success: boolean
    // - error?: string (present when success is false)
    // - isRecoverable?: boolean (present for browser errors)
    if (!actionOutput.success && actionOutput.error) {
      // For recoverable tool errors, throw ToolExecutionError
      // This special error type indicates the error is already in the tool result,
      // so we don't need to add it as a separate user message
      if (actionOutput.isRecoverable) {
        throw new ToolExecutionError(actionOutput.error, {
          action: actionOutput.action,
          ref: actionOutput.ref,
          output: actionOutput, // Store the full output for debugging
        });
      }
      // For non-recoverable errors, throw regular error
      throw new Error(actionOutput.error);
    }

    // Determine if page changed (most actions change the page, except extract)
    const pageChanged = actionOutput.action !== "extract";

    // Check for terminal actions
    if (actionOutput.isTerminal) {
      if (actionOutput.action === "done") {
        // Validate the task completion before accepting it
        const validationResult = await this.validateTaskCompletion(
          task,
          actionOutput.result,
          executionState,
        );

        // Check if validation passed
        if (validationResult.isAccepted) {
          return {
            isTerminal: true,
            success: true,
            finalAnswer: actionOutput.result,
            pageChanged: false,
            actionExecuted: true,
          };
        } else {
          // Validation failed - the feedback has been added to messages
          // Don't add a new page snapshot, let the agent respond to feedback
          return {
            isTerminal: false,
            success: false,
            finalAnswer: null,
            pageChanged: false, // Keep false to avoid new snapshot
            actionExecuted: false, // Don't count as action since we're retrying
          };
        }
      } else if (actionOutput.action === "abort") {
        // Emit TASK_ABORTED event
        this.emit(WebAgentEventType.TASK_ABORTED, {
          reason: actionOutput.reason,
          finalAnswer: `Aborted: ${actionOutput.reason}`,
          iterationId: this.currentIterationId,
        });

        const message = `Aborted: ${actionOutput.reason}`;
        return {
          isTerminal: true,
          success: false,
          finalAnswer: message,
          pageChanged: false,
          actionExecuted: true,
          error: { code: TaskErrorCode.TASK_ABORTED, message },
        };
      }
    }

    // Check for repeated actions on non-terminal actions
    const repetitionResult = this.checkAndHandleRepeatedAction(actionOutput, executionState);
    if (repetitionResult) {
      return repetitionResult; // Early return if intervention needed
    }

    // Regular action executed successfully
    return {
      isTerminal: false,
      success: false,
      finalAnswer: null,
      pageChanged,
      actionExecuted: true,
    };
  }

  /**
   * Check for repeated actions and handle accordingly
   * @returns Action result if intervention is needed, null otherwise
   */
  private checkAndHandleRepeatedAction(
    actionOutput: any,
    executionState: ExecutionState,
  ): {
    isTerminal: boolean;
    success: boolean;
    finalAnswer: string | null;
    pageChanged: boolean;
    actionExecuted: boolean;
    error?: TaskError;
  } | null {
    // Define explicit thresholds for warning and abort
    const REPETITION_WARNING_THRESHOLD = this.maxRepeatedActions + 1;
    const REPETITION_ABORT_THRESHOLD = this.maxRepeatedActions + 2;

    // Create signature for current action
    const currentActionSignature = this.createActionSignature(
      actionOutput.action,
      actionOutput.ref,
      actionOutput.value,
    );

    // Check if this is the same action as the last one
    if (executionState.lastAction === currentActionSignature) {
      executionState.actionRepeatCount++;

      // Check if we've exceeded the repetition limit
      if (executionState.actionRepeatCount > this.maxRepeatedActions) {
        // First time over limit: add warning message
        if (executionState.actionRepeatCount === REPETITION_WARNING_THRESHOLD) {
          const warningMessage = `You have repeated the same action (${actionOutput.action}) ${executionState.actionRepeatCount} times. Please try a different approach or action to make progress on the task.`;
          this.messages.push({ role: "user", content: warningMessage });

          // Emit warning event
          this.emit(WebAgentEventType.AGENT_STATUS, {
            message: `Warning: Repeated action detected - ${currentActionSignature}`,
            repeatCount: executionState.actionRepeatCount,
            iterationId: this.currentIterationId,
          });

          // Return intervention result - force new snapshot to let agent see the warning
          return {
            isTerminal: false,
            success: false,
            finalAnswer: null,
            pageChanged: true, // Force new snapshot so agent sees the warning
            actionExecuted: false, // Don't count this as a successful action
          };
        }

        // Second time over limit: abort the task
        if (executionState.actionRepeatCount >= REPETITION_ABORT_THRESHOLD) {
          const abortReason = `Excessive repetition of action '${actionOutput.action}' (${executionState.actionRepeatCount} times). The agent appears to be stuck in a loop.`;
          const abortMessage = `Aborted: ${abortReason}`;

          // Emit abort event
          this.emit(WebAgentEventType.TASK_ABORTED, {
            reason: abortReason,
            finalAnswer: abortMessage,
            iterationId: this.currentIterationId,
          });

          // Return terminal result
          return {
            isTerminal: true,
            success: false,
            finalAnswer: abortMessage,
            pageChanged: false,
            actionExecuted: false,
            error: { code: TaskErrorCode.TASK_ABORTED, message: abortMessage },
          };
        }
      }
    } else {
      // Different action - reset counter and update last action
      executionState.actionRepeatCount = 0;
      executionState.lastAction = currentActionSignature;
    }

    // No intervention needed
    return null;
  }

  /**
   * Validate task completion using the validation tool
   */
  private async validateTaskCompletion(
    task: string,
    finalAnswer: string,
    executionState: ExecutionState,
  ): Promise<{ isAccepted: boolean }> {
    // Increment validation attempts
    executionState.validationAttempts++;

    // Emit processing event with attempt number
    this.emit(WebAgentEventType.AGENT_PROCESSING, {
      operation: `Validating task completion (attempt ${executionState.validationAttempts})`,
      hasScreenshot: false,
      iterationId: this.currentIterationId,
    });

    try {
      // Format conversation history for validation context
      const conversationHistory = this.formatConversationHistory();

      // Build validation prompt
      const validationPrompt = buildTaskValidationPrompt(
        task,
        this.successCriteria,
        finalAnswer,
        conversationHistory,
      );

      // Call validation tool
      const validationTools = createValidationTools();
      const validationResponse = await generateTextWithRetry(
        {
          ...this.providerConfig,
          prompt: validationPrompt,
          tools: validationTools,
          toolChoice: "required", // Use "required" for compatibility with providers that don't support specific tool selection
          maxOutputTokens: DEFAULT_VALIDATION_MAX_TOKENS,
          abortSignal: this.abortSignal,
        },
        {
          maxAttempts: 2,
          onRetry: (attempt, error) => {
            this.emit(WebAgentEventType.AGENT_STATUS, {
              message: `Validation retry attempt ${attempt} after error: ${this.extractErrorMessage(error)}`,
              iterationId: this.currentIterationId,
            });
          },
        },
      );

      if (!validationResponse.toolResults?.[0]) {
        throw new Error("Failed to validate task completion");
      }

      const validationResult = validationResponse.toolResults[0].output as any;
      const { taskAssessment, completionQuality, feedback } = validationResult;

      // Emit validation event
      this.emit(WebAgentEventType.TASK_VALIDATED, {
        observation: taskAssessment,
        completionQuality,
        feedback,
        finalAnswer,
        iterationId: this.currentIterationId,
      });

      // Check if quality is acceptable
      const isAccepted = completionQuality === "complete" || completionQuality === "excellent";

      // If not accepted and we haven't hit max attempts, add feedback to conversation
      if (!isAccepted && executionState.validationAttempts < this.maxValidationAttempts) {
        // Build feedback message using the prompt function
        const feedbackMessage = buildValidationFeedbackPrompt(
          executionState.validationAttempts,
          taskAssessment,
          feedback,
        );

        this.messages.push({ role: "user", content: feedbackMessage });

        // Emit event for debugging
        this.emit(WebAgentEventType.TASK_VALIDATION_ERROR, {
          errors: [`Validation failed: ${completionQuality}`],
          retryCount: executionState.validationAttempts,
          feedback: feedbackMessage,
          iterationId: this.currentIterationId,
        });
      }

      // Accept if quality is good OR we've hit max validation attempts
      const forceAccept = executionState.validationAttempts >= this.maxValidationAttempts;
      if (forceAccept && !isAccepted) {
        // Log warning that we're accepting due to max attempts
        this.emit(WebAgentEventType.AGENT_STATUS, {
          message: `Accepting answer after ${executionState.validationAttempts} validation attempts`,
          finalAnswer,
          iterationId: this.currentIterationId,
        });
      }

      return {
        isAccepted: isAccepted || forceAccept,
      };
    } catch (error) {
      // On validation error, accept the result if we've hit max attempts
      if (executionState.validationAttempts >= this.maxValidationAttempts) {
        return { isAccepted: true };
      }

      // Otherwise, continue execution
      this.emit(WebAgentEventType.TASK_VALIDATION_ERROR, {
        errors: [this.extractErrorMessage(error)],
        retryCount: executionState.validationAttempts,
        rawResponse: null,
        iterationId: this.currentIterationId,
      });

      return { isAccepted: false };
    }
  }

  /**
   * Format conversation history for validation
   */
  private formatConversationHistory(): string {
    // Take recent messages but don't truncate content - validation needs full context
    // The validation prompt itself will manage token limits
    const recentMessages = this.messages.slice(-30);

    return recentMessages
      .map((msg) => {
        let content: string;
        if (typeof msg.content === "string") {
          content = msg.content;
        } else if (Array.isArray(msg.content)) {
          // Handle multimodal content by extracting text parts
          content = msg.content
            .map((item: any) => {
              if (item.type === "text") return item.text;
              return `[${item.type}]`;
            })
            .join(" ");
        } else {
          content = JSON.stringify(msg.content);
        }
        return `${msg.role}: ${content}`;
      })
      .join("\n\n");
  }

  /**
   * Plan the task using proper tool calling
   */
  private async planTask(task: string, startingUrl?: string): Promise<void> {
    // Auto-detect OpenTable tasks and construct a parameterized search URL
    if (!startingUrl) {
      const openTableUrl = this.buildOpenTableUrl(task);
      if (openTableUrl) {
        startingUrl = openTableUrl;
      }
    }

    const planningPrompt = startingUrl
      ? buildPlanPrompt(task, startingUrl, this.guardrails)
      : buildPlanAndUrlPrompt(task, this.guardrails);

    // Emit processing event before planning - planning doesn't use screenshots
    this.emit(WebAgentEventType.AGENT_PROCESSING, {
      operation: "Creating task plan",
      hasScreenshot: false,
      iterationId: this.currentIterationId || "planning",
    });

    // Also emit as status so extension ChatView shows it to user
    this.emit(WebAgentEventType.AGENT_STATUS, {
      message: "Creating task plan",
      iterationId: this.currentIterationId || "planning",
    });

    try {
      const planningTools = createPlanningTools();

      const planningResponse = await generateTextWithRetry(
        {
          ...this.providerConfig,
          prompt: planningPrompt,
          tools: planningTools,
          toolChoice: "required", // Use "required" for compatibility with providers that don't support specific tool selection
          maxOutputTokens: DEFAULT_PLANNING_MAX_TOKENS,
        },
        {
          maxAttempts: 3,
          onRetry: (attempt, error) => {
            const errorMsg = this.extractErrorMessage(error);
            console.warn(`[WebAgent] Planning retry attempt ${attempt}/3 after error:`, errorMsg);
            this.emit(WebAgentEventType.AGENT_STATUS, {
              message: `Planning retry attempt ${attempt} after error: ${errorMsg}`,
              iterationId: this.currentIterationId || "planning",
            });
          },
        },
      );

      if (!planningResponse.toolResults?.[0]) {
        throw new Error("No tool results returned from planning");
      }

      const { plan, successCriteria, url } = this.extractPlanOutput(planningResponse);

      this.plan = plan;
      this.successCriteria = successCriteria;

      if (!startingUrl && url) {
        this.url = url;
      } else if (startingUrl) {
        this.url = startingUrl;
      }

      this.emit(WebAgentEventType.AGENT_STATUS, {
        message: "Task plan created",
        plan: this.plan,
        successCriteria: this.successCriteria,
        url: this.url,
      });
    } catch (error) {
      const errorMsg = this.extractErrorMessage(error);
      console.error(`[WebAgent] Failed to generate plan:`, errorMsg);

      // Check if the error message already contains "Failed to generate plan" to avoid double-wrapping
      if (errorMsg.includes("Failed to generate plan")) {
        throw new Error(errorMsg);
      } else {
        throw new Error(`Failed to generate plan: ${errorMsg}`);
      }
    }
  }

  // === Helper Methods ===

  /**
   * Create a signature for an action to track repetitions
   */
  private createActionSignature(action: string, ref?: string, value?: string | number): string {
    return `${action}:${ref || ""}:${value || ""}`;
  }

  /**
   * Detect OpenTable restaurant tasks and build a parameterized search URL.
   * Returns the URL if the task matches, or null otherwise.
   */
  private buildOpenTableUrl(task: string): string | null {
    if (!/opentable/i.test(task)) return null;

    const lower = task.toLowerCase();

    // Extract date — try explicit dates first, then relative day names
    let dateStr: string | null = null;
    // Match formats like "2026-02-14", "Feb 14, 2026", "February 14 2026", "2/14/2026"
    const explicitDate =
      task.match(/(\d{4}-\d{2}-\d{2})/) ||
      task.match(/(\d{1,2}\/\d{1,2}\/\d{4})/) ||
      task.match(
        /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\.?\s+\d{1,2},?\s+\d{4})/i,
      );
    if (explicitDate) {
      const parsed = new Date(explicitDate[1]);
      if (!isNaN(parsed.getTime())) {
        dateStr = parsed.toISOString().split("T")[0];
      }
    }
    if (!dateStr) {
      // Relative days: today, tomorrow, day names
      const now = new Date();
      if (lower.includes("today")) {
        dateStr = now.toISOString().split("T")[0];
      } else if (lower.includes("tomorrow")) {
        now.setDate(now.getDate() + 1);
        dateStr = now.toISOString().split("T")[0];
      } else {
        const days = [
          "sunday",
          "monday",
          "tuesday",
          "wednesday",
          "thursday",
          "friday",
          "saturday",
        ];
        for (let i = 0; i < days.length; i++) {
          if (lower.includes(days[i])) {
            const current = now.getDay();
            let diff = i - current;
            if (diff <= 0) diff += 7;
            now.setDate(now.getDate() + diff);
            dateStr = now.toISOString().split("T")[0];
            break;
          }
        }
      }
    }

    // Extract time — e.g. "7pm", "7:30 PM", "19:00"
    // Also handles relative offsets like "2 hours before/beforehand/earlier"
    let hour = 19;
    let minute = 0;
    const timeMatch =
      task.match(/(\d{1,2}):(\d{2})\s*(am|pm)/i) ||
      task.match(/(\d{1,2})\s*(am|pm)/i) ||
      task.match(/(\d{2}):(\d{2})/);
    if (timeMatch) {
      hour = parseInt(timeMatch[1], 10);
      minute = timeMatch[2] && !timeMatch[2].match(/am|pm/i) ? parseInt(timeMatch[2], 10) : 0;
      const ampm = timeMatch[3] || timeMatch[2];
      if (ampm && /pm/i.test(ampm) && hour < 12) hour += 12;
      if (ampm && /am/i.test(ampm) && hour === 12) hour = 0;
    }
    // Apply relative offset: "2 hours before", "1 hour beforehand", "3 hours earlier"
    const offsetMatch = lower.match(/(\d+)\s+hours?\s+(?:before(?:hand)?|earlier|prior)/);
    if (offsetMatch) {
      hour -= parseInt(offsetMatch[1], 10);
      if (hour < 0) hour += 24;
    }

    // Extract party size — e.g. "for 4", "party of 6", "2 people", "table for 3"
    let covers = 2;
    const coversMatch = lower.match(
      /(?:for|party\s+of|table\s+for|group\s+of)\s+(\d+)|(\d+)\s+(?:people|guests|diners|persons)/,
    );
    if (coversMatch) {
      covers = parseInt(coversMatch[1] || coversMatch[2], 10);
    }

    // Extract location — try multiple patterns from most to least specific
    let location: string | null = null;
    const locationPatterns = [
      // "in downtown San Francisco, CA" / "in San Francisco" / "near Portland, Oregon"
      /\b(?:in|near|around|downtown)\s+([A-Z][A-Za-z]+(?:[\s,]+[A-Z][A-Za-z]*)*)/,
      // "San Francisco restaurants" / "NYC restaurants"
      /([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]*)*)\s+restaurants?\b/,
      // "restaurants in san francisco" (lowercase)
      /restaurants?\s+(?:in|near|around)\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)*)/i,
      // Fallback: any capitalized multi-word phrase not matching known non-location words
      /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/,
    ];
    // Words that look like locations but aren't
    const nonLocationWords = /^(Open\s*Table|Find|Book|Reserve|Search|Make|Get|Show|Looking|Friday|Saturday|Sunday|Monday|Tuesday|Wednesday|Thursday|January|February|March|April|May|June|July|August|September|October|November|December)$/i;
    for (const pattern of locationPatterns) {
      const match = task.match(pattern);
      if (match && match[1] && !nonLocationWords.test(match[1].trim())) {
        location = match[1].trim();
        break;
      }
    }

    // OpenTable search URLs require a location to return results
    if (!location) return null;

    // Build the URL
    const timeParam = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
    const params = new URLSearchParams();
    params.set("dateTime", `${dateStr || new Date().toISOString().split("T")[0]}T${timeParam}`);
    params.set("covers", String(covers));
    if (location) {
      params.set("term", location);
    }

    return `https://www.opentable.com/s?${params.toString()}`;
  }

  /**
   * Extract error message from unknown error type
   */
  private extractErrorMessage(error: unknown): string {
    if (!(error instanceof Error)) return String(error);

    const e = error as any;
    const status = e.statusCode || e.status;

    return status ? `[${status}] ${error.message}` : error.message;
  }

  /**
   * Calculate compression statistics for debug logging
   */
  private calculateCompressionStats(
    originalSize: number,
    compressedSize: number,
  ): {
    originalSize: number;
    compressedSize: number;
    compressionPercent: number;
  } {
    return {
      originalSize,
      compressedSize,
      compressionPercent: Math.round((1 - compressedSize / originalSize) * 100),
    };
  }

  /**
   * Check if error is a setup/planning error that should be re-thrown
   */
  private isSetupError(error: unknown): boolean {
    return (
      error instanceof Error &&
      (error.message.includes("Failed to generate plan") ||
        error.message.includes("No starting URL"))
    );
  }

  /**
   * Extract plan output from planning response
   */
  private extractPlanOutput(planningResponse: any): {
    plan: string;
    successCriteria: string;
    url?: string;
  } {
    const firstToolResult = planningResponse.toolResults[0] as any;
    const planOutput = firstToolResult.output;

    return {
      plan: planOutput.plan || "",
      successCriteria: planOutput.successCriteria || "",
      url: planOutput.url,
    };
  }

  private validateTaskAndOptions(task: string, options: ExecuteOptions): void {
    if (!task?.trim()) {
      throw new Error("Task cannot be empty");
    }

    if (options.startingUrl && !this.isValidUrl(options.startingUrl)) {
      throw new Error("Invalid starting URL");
    }
  }

  private async initializeBrowserAndState(task: string, options: ExecuteOptions): Promise<void> {
    this.clearInternalState();
    this.data = options.data || null;
    this.abortSignal = options.abortSignal || undefined;

    this.emit(WebAgentEventType.TASK_SETUP, {
      task,
      browserName: this.browser.browserName,
      url: options.startingUrl,
      guardrails: this.guardrails,
      data: this.data,
      pwEndpoint: (this.browser as any).pwEndpoint,
      pwCdpEndpoint: (this.browser as any).pwCdpEndpoint,
      proxy: (this.browser as any).proxyServer,
      vision: this.vision,
    });

    await this.browser.start();
  }

  /**
   * Navigate to the starting URL with retry on recoverable errors.
   * On failure, restarts the browser and tries again.
   */
  private async navigateToStartWithRetry(task: string): Promise<void> {
    let lastError: unknown;
    const maxAttempts = this.initialNavigationRetries + 1; // retries + initial attempt

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      // Check abort signal before each attempt
      if (this.abortSignal?.aborted) {
        throw new Error("Task aborted by user");
      }

      try {
        await this.navigateToStart(task);
        return; // Success
      } catch (error) {
        lastError = error;

        // Only retry on recoverable errors (e.g., timeout, network issues)
        if (!(error instanceof RecoverableError)) {
          throw error;
        }

        // Check if we have retries remaining
        if (attempt < maxAttempts) {
          console.warn(
            `[WebAgent] Initial navigation failed (attempt ${attempt}/${maxAttempts}), restarting browser: ${this.extractErrorMessage(error)}`,
          );

          // Restart browser for a fresh connection
          await this.browser.shutdown();
          await this.browser.start();
        }
      }
    }

    // All retries exhausted
    throw lastError;
  }

  private async navigateToStart(task: string): Promise<void> {
    if (!this.url) {
      throw new Error("No starting URL determined");
    }

    await this.browser.goto(this.url);
    await this.updatePageState();

    this.emit(WebAgentEventType.TASK_STARTED, {
      task: task,
      successCriteria: this.successCriteria,
      plan: this.plan,
      url: this.url,
      title: this.currentPage.title,
    });
  }

  private initializeSystemPromptAndTask(task: string): void {
    const hasGuardrails = Boolean(this.guardrails);

    this.messages = [
      {
        role: "system",
        content: buildActionLoopSystemPrompt(hasGuardrails),
      },
      {
        role: "user",
        content: buildTaskAndPlanPrompt(
          task,
          this.successCriteria,
          this.plan,
          this.data,
          this.guardrails,
        ),
      },
    ];
  }

  private async updatePageState(): Promise<void> {
    try {
      const [title, url] = await Promise.all([this.browser.getTitle(), this.browser.getUrl()]);

      this.currentPage = { title, url };

      this.emit(WebAgentEventType.BROWSER_NAVIGATED, {
        title,
        url,
      });
    } catch (error) {
      // Browser might be disconnected or page might be in transition
      // Use cached values if available
      if (!this.currentPage.url) {
        throw new Error("Browser disconnected or page unavailable");
      }
    }
  }

  private async getCurrentPageInfo(): Promise<{ title: string; url: string }> {
    try {
      const [title, url] = await Promise.all([this.browser.getTitle(), this.browser.getUrl()]);

      this.currentPage = { title, url };
      return { title, url };
    } catch (error) {
      // Browser might be disconnected or page might be in transition
      // Return cached values if available
      if (this.currentPage.url) {
        return this.currentPage;
      }
      throw new Error("Browser disconnected or page unavailable");
    }
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  private clearInternalState(): void {
    this.plan = "";
    this.url = "";
    this.messages = [];
    this.successCriteria = "";
    this.currentPage = { url: "", title: "" };
    this.currentIterationId = "";
    this.data = null;
    this.abortSignal = undefined;
  }

  private initializeExecutionState(): ExecutionState {
    return {
      currentIteration: 0,
      actionCount: 0,
      startTime: Date.now(),
      success: false,
      finalAnswer: null,
      actionRepeatCount: 0,
      validationAttempts: 0,
    };
  }

  private buildResult(
    executionOutcome: { success: boolean; finalAnswer: string | null; error?: TaskError },
    executionState: ExecutionState,
  ): TaskExecutionResult {
    const endTime = Date.now();

    this.emit(WebAgentEventType.TASK_COMPLETED, {
      success: executionOutcome.success,
      finalAnswer: executionOutcome.finalAnswer,
    });

    return {
      success: executionOutcome.success,
      finalAnswer: executionOutcome.finalAnswer,
      ...(executionOutcome.error && { error: executionOutcome.error }),
      stats: {
        iterations: executionState.currentIteration,
        actions: executionState.actionCount,
        startTime: executionState.startTime,
        endTime,
        durationMs: endTime - executionState.startTime,
      },
    };
  }

  private emit(type: WebAgentEventType, data: any): void {
    this.eventEmitter.emit(type, data);
  }

  /**
   * Close the browser and clean up resources
   */
  async close(): Promise<void> {
    // Dispose the logger
    this.logger.dispose();

    // Close the browser
    await this.browser.shutdown();
  }
}

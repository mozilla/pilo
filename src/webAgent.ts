/**
 * WebAgent
 *
 * Core web automation agent that executes tasks using browser automation.
 * Handles the main execution loop with:
 * - SnapshotCompressor: Optimizes accessibility tree for token efficiency
 * - Validator: Context validation and task completion checking
 */

import { generateText, LanguageModel, ModelMessage } from "ai";
import { AriaBrowser } from "./browser/ariaBrowser.js";
import { WebAgentEventEmitter, WebAgentEventType } from "./events.js";
import { SnapshotCompressor } from "./snapshotCompressor.js";
import { Logger } from "./loggers/types.js";
import { ConsoleLogger } from "./loggers/console.js";
import {
  buildActionLoopSystemPrompt,
  buildTaskAndPlanPrompt,
  buildPageSnapshotPrompt,
  buildPlanAndUrlPrompt,
  buildPlanPrompt,
  buildStepErrorFeedbackPrompt,
} from "./prompts.js";
import { createWebActionTools } from "./tools/webActionTools.js";
import { createPlanningTools } from "./tools/planningTools.js";
import { nanoid } from "nanoid";

// === Configuration Constants ===
const DEFAULT_MAX_ITERATIONS = 50;
const DEFAULT_GENERATION_MAX_TOKENS = 3000;
const DEFAULT_PLANNING_MAX_TOKENS = 1500;
const DEFAULT_MAX_CONSECUTIVE_ERRORS = 5;
const DEFAULT_MAX_TOTAL_ERRORS = 15;

// === Type Definitions ===

export interface WebAgentOptions {
  /** Language model provider */
  provider: LanguageModel;
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
  /** @deprecated maxValidationAttempts is no longer used */
  maxValidationAttempts?: number;
}

export interface ExecuteOptions {
  /** Optional starting URL */
  startingUrl?: string;
  /** Optional data to provide to the agent */
  data?: any;
  /** Abort signal for cancellation */
  abortSignal?: AbortSignal;
}

export interface TaskExecutionResult {
  /** Whether the task completed successfully */
  success: boolean;
  /** Final answer or result from the agent */
  finalAnswer: string | null;
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
  finalAnswer: string | null;
  lastAction?: string;
}

/**
 * Simplified WebAgent with core execution logic
 */
export class WebAgent {
  // === Core State (stays here) ===
  private plan: string = "";
  private url: string = "";
  private messages: ModelMessage[] = [];
  private taskExplanation: string = "";
  private currentPage: { url: string; title: string } = { url: "", title: "" };
  private currentIterationId: string = "";
  private data: any = null;
  private abortSignal: AbortSignal | null = null;

  // === Services ===
  private compressor: SnapshotCompressor;
  private eventEmitter: WebAgentEventEmitter;
  private logger: Logger;

  // === Configuration ===
  private readonly provider: LanguageModel;
  private readonly debug: boolean;
  private readonly vision: boolean;
  private readonly maxIterations: number;
  private readonly maxConsecutiveErrors: number;
  private readonly maxTotalErrors: number;
  private readonly guardrails: string | null;

  constructor(
    private browser: AriaBrowser,
    options: WebAgentOptions,
  ) {
    // Initialize configuration
    this.provider = options.provider;
    this.debug = options.debug ?? false;
    this.vision = options.vision ?? false;
    this.maxIterations = options.maxIterations ?? DEFAULT_MAX_ITERATIONS;
    this.maxConsecutiveErrors = options.maxConsecutiveErrors ?? DEFAULT_MAX_CONSECUTIVE_ERRORS;
    this.maxTotalErrors = options.maxTotalErrors ?? DEFAULT_MAX_TOTAL_ERRORS;
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

      // 4. Navigation phase
      await this.navigateToStart(task);
      this.initializeSystemPromptAndTask(task);

      // 5. Main execution loop
      const loopOutcome = await this.runMainLoop(executionState);

      // 6. Return results
      return this.buildResult(loopOutcome, executionState);
    } catch (error) {
      // Check if aborted
      if (this.abortSignal?.aborted) {
        return this.buildResult(
          { success: false, finalAnswer: "Task aborted by user" },
          executionState,
        );
      }

      // Re-throw setup/planning errors (they indicate configuration issues)
      if (
        error instanceof Error &&
        (error.message.includes("Failed to generate plan") ||
          error.message.includes("No starting URL"))
      ) {
        throw error;
      }

      // Convert runtime errors to results
      return this.buildResult(
        {
          success: false,
          finalAnswer: `Task failed: ${error instanceof Error ? error.message : String(error)}`,
        },
        executionState,
      );
    }
  }

  /**
   * The main execution loop - clean and maintainable
   */
  private async runMainLoop(
    executionState: ExecutionState,
  ): Promise<{ success: boolean; finalAnswer: string | null }> {
    // Setup tools once
    const webActionTools = createWebActionTools({
      browser: this.browser,
      eventEmitter: this.eventEmitter,
      provider: this.provider,
      abortSignal: this.abortSignal || undefined,
    });

    let needsPageSnapshot = true;
    let consecutiveErrors = 0;
    let totalErrors = 0;

    // Main loop
    while (
      executionState.currentIteration < this.maxIterations &&
      executionState.finalAnswer === null
    ) {
      // Check abort signal once at the start of each iteration
      if (this.abortSignal?.aborted) {
        return { success: false, finalAnswer: "Task aborted by user" };
      }

      // Generate unique iteration ID
      this.currentIterationId = nanoid(8);

      // Add page snapshot if needed
      if (needsPageSnapshot) {
        await this.addPageSnapshot();
      }

      // Single try-catch for ALL iteration logic
      try {
        const result = await this.generateAndProcessAction(webActionTools);

        // Reset error counter on success
        consecutiveErrors = 0;

        // Handle terminal actions
        if (result.isTerminal) {
          executionState.finalAnswer = result.finalAnswer;
          break;
        }

        // Update state for successful action
        if (result.actionExecuted) {
          executionState.actionCount++;
        }

        needsPageSnapshot = result.pageChanged;
      } catch (error) {
        consecutiveErrors++;
        totalErrors++;

        // Check if we should continue
        if (!this.shouldContinueAfterError(consecutiveErrors, totalErrors)) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return {
            success: false,
            finalAnswer: `Task failed after ${consecutiveErrors} consecutive errors (${totalErrors} total): ${errorMessage}`,
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
      const success = !executionState.finalAnswer.startsWith("Aborted:");
      return { success, finalAnswer: executionState.finalAnswer };
    }

    // Max iterations reached
    return {
      success: false,
      finalAnswer: "Maximum iterations reached without completing the task.",
    };
  }

  /**
   * Check if we should continue after an error
   */
  private shouldContinueAfterError(consecutiveErrors: number, totalErrors: number): boolean {
    return consecutiveErrors < this.maxConsecutiveErrors && totalErrors < this.maxTotalErrors;
  }

  /**
   * Add error feedback to the conversation
   */
  private addErrorFeedback(error: unknown): void {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Emit error event for logging
    this.emit(WebAgentEventType.AI_GENERATION_ERROR, {
      error: errorMessage,
      iterationId: this.currentIterationId,
    });

    // Add error feedback to conversation
    const hasGuardrails = Boolean(this.guardrails);
    const errorFeedback = buildStepErrorFeedbackPrompt(errorMessage, hasGuardrails);
    this.messages.push({ role: "user", content: errorFeedback });
  }

  /**
   * Add page snapshot to the conversation
   */
  private async addPageSnapshot(): Promise<void> {
    const currentPageSnapshot = await this.browser.getTreeWithRefs();
    const compressedSnapshot = this.compressor.compress(currentPageSnapshot);

    // Debug compression stats if enabled
    if (this.debug) {
      const originalSize = currentPageSnapshot.length;
      const compressedSize = compressedSnapshot.length;
      const compressionPercent = Math.round((1 - compressedSize / originalSize) * 100);
      this.emit(WebAgentEventType.SYSTEM_DEBUG_COMPRESSION, {
        originalSize,
        compressedSize,
        compressionPercent,
      });
    }

    // Get current page info and add snapshot to conversation
    const currentPageInfo = await this.getCurrentPageInfo();
    const snapshotMessage = buildPageSnapshotPrompt(
      currentPageInfo.title,
      currentPageInfo.url,
      compressedSnapshot,
      this.vision,
    );
    this.messages.push({ role: "user", content: snapshotMessage });
  }

  /**
   * Generate AI response and process the result
   * @returns Object with action details and terminal status
   */
  private async generateAndProcessAction(webActionTools: any): Promise<{
    isTerminal: boolean;
    finalAnswer: string | null;
    pageChanged: boolean;
    actionExecuted: boolean;
  }> {
    // Start processing
    this.emit(WebAgentEventType.AGENT_PROCESSING, {
      status: "start",
      operation: "Thinking about next action",
      iterationId: this.currentIterationId,
    });

    // Generate AI response
    const aiResponse = await generateText({
      model: this.provider,
      messages: this.messages,
      tools: webActionTools,
      toolChoice: "required",
      maxOutputTokens: DEFAULT_GENERATION_MAX_TOKENS,
      abortSignal: this.abortSignal || undefined,
    });

    // Add response to messages
    if (aiResponse.response?.messages) {
      for (const msg of aiResponse.response.messages) {
        this.messages.push(msg);
      }
    }

    // Emit generation event
    this.emit(WebAgentEventType.AI_GENERATION, {
      messages: this.messages,
      temperature: 0,
      object: null,
      finishReason: aiResponse.finishReason,
      usage: aiResponse.usage,
      warnings: aiResponse.warnings || [],
      providerMetadata: aiResponse.providerMetadata,
    });

    // Emit observation if present
    if (aiResponse.text?.trim()) {
      this.emit(WebAgentEventType.AGENT_OBSERVED, {
        observation: aiResponse.text,
        iterationId: this.currentIterationId,
      });
    }

    // Process tool results
    if (!aiResponse.toolResults?.length) {
      throw new Error("You must use exactly one tool. Please use one of the available tools.");
    }

    const toolResult = aiResponse.toolResults[0];
    const actionOutput = toolResult.output as any;

    if (!actionOutput) {
      throw new Error("Tool execution failed: missing output property.");
    }

    // Determine if page changed (most actions change the page, except extract)
    const pageChanged = actionOutput.action !== "extract";

    // Check for terminal actions
    if (actionOutput.isTerminal) {
      if (actionOutput.action === "done") {
        return {
          isTerminal: true,
          finalAnswer: actionOutput.result,
          pageChanged: false,
          actionExecuted: true,
        };
      } else if (actionOutput.action === "abort") {
        return {
          isTerminal: true,
          finalAnswer: `Aborted: ${actionOutput.reason}`,
          pageChanged: false,
          actionExecuted: true,
        };
      }
    }

    // Regular action executed successfully
    return {
      isTerminal: false,
      finalAnswer: null,
      pageChanged,
      actionExecuted: true,
    };
  }

  /**
   * Plan the task using proper tool calling
   */
  private async planTask(task: string, startingUrl?: string): Promise<void> {
    const planningPrompt = startingUrl
      ? buildPlanPrompt(task, startingUrl, this.guardrails)
      : buildPlanAndUrlPrompt(task, this.guardrails);

    // Emit processing event before planning
    this.emit(WebAgentEventType.AGENT_PROCESSING, {
      status: "start",
      operation: "Creating task plan",
      iterationId: this.currentIterationId || "planning",
    });

    try {
      const planningTools = createPlanningTools();
      const planningToolName = startingUrl ? "create_plan" : "create_plan_with_url";

      const planningResponse = await generateText({
        model: this.provider,
        prompt: planningPrompt,
        tools: planningTools,
        toolChoice: { type: "tool", toolName: planningToolName },
        maxOutputTokens: DEFAULT_PLANNING_MAX_TOKENS,
      });

      // Emit processing complete
      this.emit(WebAgentEventType.AGENT_PROCESSING, {
        status: "end",
        operation: "Creating task plan",
        iterationId: this.currentIterationId || "planning",
      });

      if (!planningResponse.toolResults?.[0]) {
        throw new Error("Failed to generate plan");
      }

      const firstToolResult = planningResponse.toolResults[0] as any;

      // Extract the actual plan output from the tool execution
      // Structure: { type: 'tool-result', toolCallId, toolName, input, output, dynamic }
      const planOutput = firstToolResult.output;

      this.plan = planOutput.plan || "";
      this.taskExplanation = planOutput.explanation || "";

      if (!startingUrl && planOutput.url) {
        this.url = planOutput.url;
      } else if (startingUrl) {
        this.url = startingUrl;
      }

      this.emit(WebAgentEventType.AGENT_STATUS, {
        message: "Task plan created",
        plan: this.plan,
        explanation: this.taskExplanation,
        url: this.url,
      });
    } catch (error) {
      // Emit processing complete even on error
      this.emit(WebAgentEventType.AGENT_PROCESSING, {
        status: "end",
        operation: "Creating task plan",
        iterationId: this.currentIterationId || "planning",
      });

      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to generate plan: ${errorMessage}`);
    }
  }

  // === Helper Methods ===

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
    this.abortSignal = options.abortSignal || null;

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

  private async navigateToStart(task: string): Promise<void> {
    if (!this.url) {
      throw new Error("No starting URL determined");
    }

    await this.browser.goto(this.url);
    await this.updatePageState();

    this.emit(WebAgentEventType.TASK_STARTED, {
      task: task,
      explanation: this.taskExplanation,
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
          this.taskExplanation,
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
    this.taskExplanation = "";
    this.currentPage = { url: "", title: "" };
    this.currentIterationId = "";
    this.data = null;
    this.abortSignal = null;
  }

  private initializeExecutionState(): ExecutionState {
    return {
      currentIteration: 0,
      actionCount: 0,
      startTime: Date.now(),
      finalAnswer: null,
    };
  }

  private buildResult(
    executionOutcome: { success: boolean; finalAnswer: string | null },
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

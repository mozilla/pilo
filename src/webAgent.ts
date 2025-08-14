/**
 * WebAgent
 *
 * Core web automation agent that executes tasks using browser automation.
 * Handles the main execution loop with:
 * - SnapshotCompressor: Optimizes accessibility tree for token efficiency
 * - Validator: Context validation and task completion checking
 */

import { generateText, LanguageModel } from "ai";
import { AriaBrowser, PageAction } from "./browser/ariaBrowser.js";
import { WebAgentEventEmitter, WebAgentEventType } from "./events.js";
import { SnapshotCompressor } from "./snapshotCompressor.js";
import { Validator } from "./validator.js";
import { Logger } from "./loggers/types.js";
import { ConsoleLogger } from "./loggers/console.js";
import {
  buildActionLoopSystemPrompt,
  buildTaskAndPlanPrompt,
  buildPageSnapshotPrompt,
  buildPlanAndUrlPrompt,
  buildPlanPrompt,
  buildExtractionPrompt,
} from "./prompts.js";
import { webActionTools, planningTools } from "./schemas.js";
import { nanoid } from "nanoid";
import { tryJSONParse } from "./utils/jsonParser.js";

// === Configuration Constants ===
const DEFAULT_MAX_ITERATIONS = 50;
const DEFAULT_GENERATION_MAX_TOKENS = 3000;
const DEFAULT_EXTRACTION_MAX_TOKENS = 5000;
const DEFAULT_PLANNING_MAX_TOKENS = 1500;
const MAX_ACTION_FAILURES = 5;

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

interface Action {
  type: string;
  ref?: string;
  value?: string;
  url?: string;
  seconds?: number;
  result?: string;
  description?: string;
}

interface ExecutionState {
  currentIteration: number;
  actionCount: number;
  startTime: number;
  finalAnswer: string | null;
  consecutiveFailures: number;
  lastActionType?: string;
}

/**
 * Simplified WebAgent with core execution logic
 */
export class WebAgent {
  // === Core State (stays here) ===
  private plan: string = "";
  private url: string = "";
  private messages: any[] = [];
  private taskExplanation: string = "";
  private currentPage: { url: string; title: string } = { url: "", title: "" };
  private currentIterationId: string = "";
  private data: any = null;
  private abortSignal: AbortSignal | null = null;

  // === Services ===
  private compressor: SnapshotCompressor;
  private validator: Validator;
  private eventEmitter: WebAgentEventEmitter;
  private logger: Logger;

  // === Configuration ===
  private readonly provider: LanguageModel;
  private readonly debug: boolean;
  private readonly vision: boolean;
  private readonly maxIterations: number;
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
    this.guardrails = options.guardrails ?? null;

    // Initialize services
    this.compressor = new SnapshotCompressor();
    this.validator = new Validator();
    this.eventEmitter = options.eventEmitter ?? new WebAgentEventEmitter();
    this.logger = options.logger ?? new ConsoleLogger();

    // Initialize logger with event emitter
    this.logger.initialize(this.eventEmitter);

    // Log initialization
    if (this.debug) {
      console.log("WebAgent initialized");
    }
  }

  /**
   * Main entry point - keep this simple and clear
   */
  async execute(task: string, options: ExecuteOptions = {}): Promise<TaskExecutionResult> {
    // 1. Validate input (let validation errors throw)
    this.validateInput(task, options);

    // 2. Setup phase
    await this.setup(task, options);

    const state = this.createExecutionState();

    try {
      // 3. Planning phase
      await this.planTask(task, options.startingUrl);

      // 4. Navigation phase
      await this.navigateToStart(task);
      this.initializeConversation(task);

      // 5. Main execution loop
      const result = await this.runMainLoop(task, state);

      // 6. Return results
      return this.buildResult(result, state);
    } catch (error) {
      // Check if aborted
      if (this.abortSignal?.aborted) {
        return this.buildResult({ success: false, finalAnswer: "Task aborted by user" }, state);
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
        state,
      );
    }
  }

  /**
   * The main loop - keep it here where it belongs
   */
  private async runMainLoop(
    task: string,
    state: ExecutionState,
  ): Promise<{ success: boolean; finalAnswer: string | null }> {
    let iteration = 0;
    let finalAnswer: string | null = null;

    while (iteration++ < this.maxIterations) {
      try {
        this.currentIterationId = nanoid(8);
        state.currentIteration = iteration;

        // Get and compress page snapshot
        const pageSnapshot = await this.browser.getTreeWithRefs();
        const compressed = this.compressor.compress(pageSnapshot);

        // Debug logging: show compression effectiveness
        if (this.debug) {
          const originalSize = pageSnapshot.length;
          const compressedSize = compressed.length;
          const compressionPercent = Math.round((1 - compressedSize / originalSize) * 100);
          this.emit(WebAgentEventType.SYSTEM_DEBUG_COMPRESSION, {
            originalSize,
            compressedSize,
            compressionPercent,
          });
        }

        // Update conversation with page state (only when needed)
        if (this.shouldUpdateSnapshot(state.lastActionType)) {
          await this.updateConversation(compressed, state.lastActionType);

          // Debug logging: show full conversation history
          if (this.debug) {
            this.emit(WebAgentEventType.SYSTEM_DEBUG_MESSAGE, { messages: this.messages });
          }
        }

        // Generate next action
        const action = await this.generateNextAction();

        // Context validation
        const error = this.validator.checkAction(action, pageSnapshot);
        if (error) {
          // Emit validation error event
          this.emit(WebAgentEventType.TASK_VALIDATION_ERROR, {
            errors: [error],
            retryCount: state.consecutiveFailures,
            action: action,
          });

          this.validator.giveFeedback(this.messages, error);
          state.consecutiveFailures++;

          if (state.consecutiveFailures >= MAX_ACTION_FAILURES) {
            return {
              success: false,
              finalAnswer: "Too many consecutive failures. Task could not be completed.",
            };
          }
          continue;
        }

        // Reset failure counter on successful validation
        state.consecutiveFailures = 0;

        // Handle terminal actions (these don't use the browser)
        if (action.type === "done") {
          finalAnswer = action.result || action.value || "";
          const isComplete = await this.validateCompletion(task, finalAnswer);
          if (isComplete) {
            return { success: true, finalAnswer };
          }
          this.validator.giveFeedback(
            this.messages,
            "Task not complete. Please continue working on it.",
          );
          continue;
        }

        if (action.type === "abort") {
          const reason = action.description || action.value || "Task aborted";
          return { success: false, finalAnswer: `Aborted: ${reason}` };
        }

        // Execute action
        const result = await this.executeAction(action);
        if (!result.success) {
          // Provide the actual error message to the agent
          const feedback = result.error
            ? `Action failed: ${result.error}`
            : "Action failed. Please try something else.";
          this.validator.giveFeedback(this.messages, feedback);
          state.consecutiveFailures++;
        } else {
          state.actionCount++;
          state.lastActionType = action.type;
        }
      } catch (error) {
        this.emit(WebAgentEventType.AI_GENERATION_ERROR, {
          error: error instanceof Error ? error.message : String(error),
          iterationId: this.currentIterationId,
        });

        this.validator.giveFeedback(
          this.messages,
          `Error: ${error instanceof Error ? error.message : "Unknown error"}. Please try again.`,
        );
        state.consecutiveFailures++;

        if (state.consecutiveFailures >= MAX_ACTION_FAILURES) {
          return {
            success: false,
            finalAnswer: "Too many errors. Task could not be completed.",
          };
        }
      }
    }

    return {
      success: false,
      finalAnswer: finalAnswer || "Maximum iterations reached without completing the task.",
    };
  }

  /**
   * Wrapper for generateText with tools that adds retry logic
   */
  private async generateWithTools(config: {
    messages?: any[];
    prompt?: string;
    tools: any;
    toolChoice: any;
    maxTokens: number;
    maxRetries?: number;
  }): Promise<any> {
    const maxRetries = config.maxRetries ?? 2;
    let lastError: Error | null = null;
    let lastResponse: any = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await generateText({
          model: this.provider,
          messages: config.messages,
          prompt: config.prompt,
          tools: config.tools,
          toolChoice: config.toolChoice,
          maxOutputTokens: config.maxTokens,
          abortSignal: this.abortSignal ?? undefined,
        });

        // Store the response even if it has issues
        lastResponse = response;

        // If we get a valid response, return it
        if (response?.toolCalls?.length || (!config.tools && response?.text)) {
          return response;
        }

        // The response exists but has no tool calls
        throw new Error("No valid tool call in response");
      } catch (error) {
        lastError = error as Error;

        // Check if aborted - if so, throw immediately
        if (this.abortSignal?.aborted) {
          throw new Error("Operation aborted by user");
        }

        // Emit error event if this is the first attempt (original error)
        if (attempt === 0) {
          this.emit(WebAgentEventType.AI_GENERATION_ERROR, {
            error: lastError.message,
            iterationId: this.currentIterationId,
          });

          // Also emit AI_GENERATION event for failed requests
          // Critical for accurate LLM usage tracking and metrics
          this.emit(WebAgentEventType.AI_GENERATION, {
            messages: config.messages || [],
            temperature: 0,
            object: null, // No tool call since it failed
            error: lastError.message,
            finishReason: "error",
            usage: null,
            warnings: [],
            providerMetadata: null,
          });
        }

        // If we have more retries and messages array, add proper tool error response
        if (attempt < maxRetries && config.messages) {
          if (lastResponse && lastResponse.toolCalls?.length > 0) {
            // We have a response with tool calls (but they might be invalid)
            config.messages.push({
              role: "assistant",
              content: lastResponse.text || "",
              toolCalls: lastResponse.toolCalls,
            });

            // Add tool error response for the invalid tool call
            const toolCall = lastResponse.toolCalls[0];

            config.messages.push({
              role: "tool",
              content: [
                {
                  type: "tool-result",
                  toolCallId: toolCall.toolCallId,
                  toolName: toolCall.toolName,
                  result: `Error: ${lastError.message}`,
                },
              ],
            });
          } else if (lastResponse && !lastResponse.toolCalls?.length) {
            // We got a response but it had no tool calls - preserve it

            // Only add the assistant message if there's actual content
            if (lastResponse.text) {
              config.messages.push({
                role: "assistant",
                content: lastResponse.text,
                // Don't include toolCalls property at all if there are none
              });
            }

            // Add user message asking for a valid tool call
            config.messages.push({
              role: "user",
              content: `Error: ${lastError.message}`,
            });
          } else if (lastError.message.includes("unavailable tool")) {
            // SDK rejected the tool call before giving us a response
            // Extract the invalid tool name from the error message
            const toolMatch = lastError.message.match(/tool '([^']+)'/);
            const invalidTool = toolMatch ? toolMatch[1] : "unknown";

            // Create a synthetic tool call to preserve in history
            const syntheticToolCall = {
              toolCallId: `invalid_${Date.now()}`,
              toolName: invalidTool,
              args: {},
            };

            // Add synthetic assistant message with the invalid tool call
            config.messages.push({
              role: "assistant",
              content: "",
              toolCalls: [syntheticToolCall],
            });

            // Add tool error response
            config.messages.push({
              role: "tool",
              content: [
                {
                  type: "tool-result",
                  toolCallId: syntheticToolCall.toolCallId,
                  toolName: invalidTool,
                  result: lastError.message,
                },
              ],
            });
          } else {
            // Fallback to user message if no tool call to respond to
            config.messages.push({
              role: "user",
              content: `Error: Please provide a valid tool call response. The previous attempt failed with: ${lastError.message}`,
            });
          }
        }
      }
    }

    throw lastError || new Error("Failed to generate valid tool response");
  }

  /**
   * Generate action via AI - keep this here as it's core logic
   */
  private async generateNextAction(): Promise<Action> {
    // Emit processing event before LLM call
    this.emit(WebAgentEventType.AGENT_PROCESSING, {
      status: "start",
      operation: "Thinking about next action",
      iterationId: this.currentIterationId,
    });

    const response = await this.generateWithTools({
      messages: this.messages,
      tools: webActionTools,
      toolChoice: "required",
      maxTokens: DEFAULT_GENERATION_MAX_TOKENS,
    });

    // Emit processing complete
    this.emit(WebAgentEventType.AGENT_PROCESSING, {
      status: "end",
      operation: "Thinking about next action",
      iterationId: this.currentIterationId,
    });

    // If there's reasoning text, emit it as observation
    if (response.text && response.text.trim()) {
      this.emit(WebAgentEventType.AGENT_OBSERVED, {
        observation: response.text,
        iterationId: this.currentIterationId,
      });
    }

    // Emit AI generation details event
    if (response.toolCalls?.length) {
      this.emit(WebAgentEventType.AI_GENERATION, {
        messages: this.messages,
        temperature: 0,
        object: response.toolCalls[0],
        finishReason: response.finishReason,
        usage: response.usage,
        warnings: response.warnings,
        providerMetadata: response.providerMetadata,
      });
    }

    if (!response.toolCalls?.length) {
      throw new Error("No tool call in response");
    }

    const action = this.parseToolCall(response.toolCalls[0]);

    // Add the tool call to the conversation history
    this.messages.push({
      role: "assistant",
      content: response.text || "", // Include any reasoning
      toolCalls: response.toolCalls, // Preserve the actual tool calls
    });

    // Emit AGENT_ACTION for ALL actions to show what the agent decided
    this.emit(WebAgentEventType.AGENT_ACTION, {
      action: action.type,
      ref: action.ref,
      value: action.value || action.result || action.description,
    });

    return action;
  }

  /**
   * Execute browser action - keep here as it coordinates browser
   */
  private async executeAction(action: Action): Promise<{ success: boolean; error?: string }> {
    try {
      // Emit BROWSER_ACTION_STARTED only for actual browser operations
      this.emit(WebAgentEventType.BROWSER_ACTION_STARTED, {
        action: action.type,
        ref: action.ref,
        value: action.value,
      });

      switch (action.type) {
        case "wait":
          const seconds = action.seconds || parseInt(action.value || "1");
          this.emit(WebAgentEventType.AGENT_WAITING, { seconds });
          await this.wait(seconds);
          break;

        case "goto":
          const url = action.url || action.value;
          if (!url) throw new Error("goto requires a URL");
          await this.browser.goto(url);
          await this.updatePageState();
          break;

        case "back":
          await this.browser.goBack();
          await this.updatePageState();
          break;

        case "forward":
          await this.browser.goForward();
          await this.updatePageState();
          break;

        case "extract":
          const description = action.description || action.value;
          if (!description) throw new Error("extract requires a description");
          const extractedData = await this.extractData(description);
          this.emit(WebAgentEventType.AGENT_EXTRACTED, { extractedData });
          break;

        case "fill_and_enter":
          if (!action.ref || !action.value) {
            throw new Error("fill_and_enter requires ref and value");
          }
          await this.browser.performAction(action.ref, PageAction.Fill, action.value);
          await this.browser.performAction(action.ref, PageAction.Enter);
          break;

        default:
          // Standard browser actions
          if (action.ref) {
            await this.browser.performAction(action.ref, action.type as PageAction, action.value);
          }
      }

      this.emit(WebAgentEventType.BROWSER_ACTION_COMPLETED, {
        success: true,
        action: action.type,
      });

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.emit(WebAgentEventType.BROWSER_ACTION_COMPLETED, {
        success: false,
        error: errorMessage,
      });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Validate task completion with retry logic
   */
  private async validateCompletion(task: string, finalAnswer: string): Promise<boolean> {
    // Emit processing event for validation
    this.emit(WebAgentEventType.AGENT_PROCESSING, {
      status: "start",
      operation: "Validating task completion",
      iterationId: this.currentIterationId,
    });

    let check: { isComplete: boolean; feedback?: string } | null = null;
    let lastError: Error | null = null;
    const maxRetries = 2;

    // Try validation with retries
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        check = await this.validator.checkTaskComplete(task, finalAnswer, this.provider);
        break; // Success, exit retry loop
      } catch (error) {
        lastError = error as Error;

        // Log validation errors only on final attempt
        if (attempt === maxRetries) {
          console.error("Task validation failed after retries:", lastError.message);
        }

        // Clean up any malformed validation attempts from the error message
        // Don't let raw JSON parsing errors leak into the conversation
        if (
          lastError.message.includes("JSON parsing failed") ||
          lastError.message.includes("Invalid arguments for tool validate_task")
        ) {
          // Simplify the error for feedback
          lastError = new Error("Task validation failed. Please try again.");
        }
      }
    }

    // Emit processing complete
    this.emit(WebAgentEventType.AGENT_PROCESSING, {
      status: "end",
      operation: "Validating task completion",
      iterationId: this.currentIterationId,
    });

    // If validation failed completely, treat as incomplete with simplified feedback
    if (!check) {
      check = {
        isComplete: false,
        feedback: "Task not complete. Please continue working on it.",
      };
    }

    // Emit validation result event
    if (check.isComplete) {
      this.emit(WebAgentEventType.TASK_VALIDATED, {
        observation: "Task completed successfully",
        completionQuality: "complete",
        finalAnswer: finalAnswer,
        iterationId: this.currentIterationId,
      });
    } else {
      this.emit(WebAgentEventType.TASK_VALIDATED, {
        observation: "Task not yet complete",
        completionQuality: "partial",
        feedback: check.feedback,
        finalAnswer: finalAnswer,
        iterationId: this.currentIterationId,
      });
    }

    if (!check.isComplete && check.feedback) {
      this.validator.giveFeedback(this.messages, check.feedback);
    }

    return check.isComplete;
  }

  // === Helper Methods ===

  private validateInput(task: string, options: ExecuteOptions): void {
    if (!task?.trim()) {
      throw new Error("Task cannot be empty");
    }

    if (options.startingUrl && !this.isValidUrl(options.startingUrl)) {
      throw new Error("Invalid starting URL");
    }
  }

  private async setup(task: string, options: ExecuteOptions): Promise<void> {
    this.resetState();
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

  private async planTask(task: string, startingUrl?: string): Promise<void> {
    const prompt = startingUrl
      ? buildPlanPrompt(task, startingUrl, this.guardrails)
      : buildPlanAndUrlPrompt(task, this.guardrails);

    // Emit processing event before planning
    this.emit(WebAgentEventType.AGENT_PROCESSING, {
      status: "start",
      operation: "Creating task plan",
      iterationId: this.currentIterationId || "planning",
    });

    let response;
    try {
      response = await this.generateWithTools({
        prompt,
        tools: planningTools,
        toolChoice: startingUrl
          ? { type: "tool", toolName: "create_plan" }
          : { type: "tool", toolName: "create_plan_with_url" },
        maxTokens: DEFAULT_PLANNING_MAX_TOKENS,
      });
    } catch (error) {
      // Emit processing complete even on error
      this.emit(WebAgentEventType.AGENT_PROCESSING, {
        status: "end",
        operation: "Creating task plan",
        iterationId: this.currentIterationId || "planning",
      });

      // Preserve original error for better debugging
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to generate plan: ${errorMessage}`);
    }

    // Emit processing complete
    this.emit(WebAgentEventType.AGENT_PROCESSING, {
      status: "end",
      operation: "Creating task plan",
      iterationId: this.currentIterationId || "planning",
    });

    if (!response.toolCalls?.length) {
      throw new Error("Failed to generate plan");
    }

    const planData = (response.toolCalls[0] as any).input;
    this.plan = planData.plan;
    this.taskExplanation = planData.explanation;

    if (!startingUrl && "url" in planData && planData.url) {
      this.url = planData.url;
    } else if (startingUrl) {
      this.url = startingUrl;
    }

    this.emit(WebAgentEventType.AGENT_STATUS, {
      message: "Task plan created",
      plan: this.plan,
      explanation: this.taskExplanation,
      url: this.url,
    });
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

  private initializeConversation(task: string): void {
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

  private async updateConversation(
    compressedSnapshot: string,
    _lastActionType?: string,
  ): Promise<void> {
    // Truncate old snapshots to save tokens
    this.truncateOldSnapshots();

    const { title, url } = await this.getPageInfo();

    const content = buildPageSnapshotPrompt(title, url, compressedSnapshot, this.vision);

    this.messages.push({ role: "user", content });
  }

  private shouldUpdateSnapshot(lastActionType?: string): boolean {
    // Always update on first iteration
    if (!lastActionType) return true;

    // Update after state-changing actions
    const stateChangingActions = [
      "click",
      "select",
      "fill_and_enter",
      "enter",
      "goto",
      "back",
      "forward",
      "fill",
      "check",
      "uncheck",
      "focus",
      "hover",
      "wait",
    ];

    return stateChangingActions.includes(lastActionType);
  }

  private truncateOldSnapshots(): void {
    // Keep system and initial task messages, truncate old snapshots
    this.messages = this.messages.map((msg, index) => {
      if (index < 2) return msg; // Keep system and task messages

      if (msg.role === "user" && msg.content?.includes("accessibility tree snapshot")) {
        // Truncate old snapshot to just title and URL
        const lines = msg.content.split("\n");
        const titleLine = lines.find((l: string) => l.startsWith("Title:"));
        const urlLine = lines.find((l: string) => l.startsWith("URL:"));
        return {
          ...msg,
          content: `Previous page state:\n${titleLine}\n${urlLine}`,
        };
      }

      return msg;
    });
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
      console.error("Failed to update page state:", error);
      // Use cached values if available
      if (!this.currentPage.url) {
        throw new Error("Browser disconnected or page unavailable");
      }
    }
  }

  private async getPageInfo(): Promise<{ title: string; url: string }> {
    try {
      const [title, url] = await Promise.all([this.browser.getTitle(), this.browser.getUrl()]);

      this.currentPage = { title, url };
      return { title, url };
    } catch (error) {
      // Browser might be disconnected or page might be in transition
      console.error("Failed to get page info:", error);
      // Return cached values if available
      if (this.currentPage.url) {
        return this.currentPage;
      }
      throw new Error("Browser disconnected or page unavailable");
    }
  }

  private async extractData(description: string): Promise<string> {
    try {
      const markdown = await this.browser.getMarkdown();
      const prompt = buildExtractionPrompt(description, markdown);

      const response = await generateText({
        model: this.provider,
        prompt,
        maxOutputTokens: DEFAULT_EXTRACTION_MAX_TOKENS,
        abortSignal: this.abortSignal ?? undefined,
      });

      // Add extraction result as a tool response
      const lastMessage = this.messages[this.messages.length - 1];
      if (lastMessage?.role === "assistant" && lastMessage?.toolCalls?.length > 0) {
        const toolCall = lastMessage.toolCalls[0];
        this.messages.push({
          role: "tool",
          content: [
            {
              type: "tool-result",
              toolCallId: toolCall.toolCallId,
              toolName: "extract",
              result: response.text,
            },
          ],
        });
      } else {
        // Fallback if no tool call found (shouldn't happen)
        this.messages.push({
          role: "assistant",
          content: `Extracted data:\n${response.text}`,
        });
      }

      return response.text;
    } catch (error) {
      // Check if aborted
      if (this.abortSignal?.aborted) {
        throw new Error("Extraction aborted by user");
      }

      // Re-throw with context
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to extract data: ${errorMessage}`);
    }
  }

  private parseToolCall(toolCall: any): Action {
    let args = toolCall.input || {};

    // Parse if string
    if (typeof args === "string") {
      const parsed = tryJSONParse(args);
      if (parsed) {
        args = parsed;
      } else {
        args = {};
      }
    }

    return {
      type: toolCall.toolName,
      ref: args.ref,
      value: args.value || args.result || args.url || args.description,
      url: args.url,
      seconds: args.seconds,
      result: args.result,
      description: args.description,
    };
  }

  private async wait(seconds: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  private resetState(): void {
    this.plan = "";
    this.url = "";
    this.messages = [];
    this.taskExplanation = "";
    this.currentPage = { url: "", title: "" };
    this.currentIterationId = "";
    this.data = null;
    this.abortSignal = null;
  }

  private createExecutionState(): ExecutionState {
    return {
      currentIteration: 0,
      actionCount: 0,
      startTime: Date.now(),
      finalAnswer: null,
      consecutiveFailures: 0,
      lastActionType: undefined,
    };
  }

  private buildResult(
    loopResult: { success: boolean; finalAnswer: string | null },
    state: ExecutionState,
  ): TaskExecutionResult {
    const endTime = Date.now();

    this.emit(WebAgentEventType.TASK_COMPLETED, {
      success: loopResult.success,
      finalAnswer: loopResult.finalAnswer,
    });

    return {
      success: loopResult.success,
      finalAnswer: loopResult.finalAnswer,
      stats: {
        iterations: state.currentIteration,
        actions: state.actionCount,
        startTime: state.startTime,
        endTime,
        durationMs: endTime - state.startTime,
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

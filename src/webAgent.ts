/**
 * WebAgent - AI-powered web automation using natural language tasks
 *
 * This module provides the core WebAgent class that combines LLM reasoning with browser automation
 * to execute natural language tasks on web pages. The agent follows a plan-action-validate cycle:
 *
 * 1. Plans the task by generating a step-by-step approach
 * 2. Executes actions on web pages using accessibility tree navigation
 * 3. Validates task completion and retries if needed
 */

import { generateObject, streamObject, generateText, LanguageModel } from "ai";
import {
  buildActionLoopPrompt,
  buildPlanPrompt,
  buildPlanAndUrlPrompt,
  buildTaskAndPlanPrompt,
  buildPageSnapshotPrompt,
  buildStepValidationFeedbackPrompt,
  buildTaskValidationPrompt,
  buildExtractionPrompt,
} from "./prompts.js";
import { AriaBrowser, PageAction } from "./browser/ariaBrowser.js";
import {
  Action,
  TaskValidationResult,
  getActionSchemaFieldOrder,
  webActionTools,
  planningTools,
  validationTools,
} from "./schemas.js";
import { WebAgentEventEmitter, WebAgentEventType, WebAgentEvent } from "./events.js";
import { Logger } from "./loggers/types.js";
import { ConsoleLogger } from "./loggers/console.js";
import { ActionValidator } from "./validation/ActionValidator.js";
import { EventEmissionHelper } from "./events/EventEmissionHelper.js";
import {
  SUCCESS_QUALITIES,
  DEFAULT_MAX_VALIDATION_ATTEMPTS,
  DEFAULT_MAX_ITERATIONS,
  DEFAULT_GENERATION_MAX_TOKENS,
  DEFAULT_EXTRACTION_MAX_TOKENS,
  DEFAULT_PLANNING_MAX_TOKENS,
  DEFAULT_VALIDATION_MAX_TOKENS,
  MAX_RETRY_ATTEMPTS,
  RETRY_DELAY_MS,
  MAX_CONVERSATION_MESSAGES,
  FILTERED_PREFIXES,
  ARIA_TRANSFORMATIONS,
} from "./config/WebAgentConfig.js";
import { nanoid } from "nanoid";

// Type definitions for better type safety

// Response structure from AI function calling
type ToolCallResponse = {
  toolCalls?: Array<{ toolName: string; args: Record<string, any> }>;
  text?: string;
  reasoning?: string;
  finishReason?: string;
  usage?: any;
  warnings?: any;
  providerMetadata?: any;
};

// ActionExecutionResult is now just an Action with optional extracted data
type ActionExecutionResult = Action & {
  extractedData?: string;
};

/**
 * Options for WebAgent.execute()
 */
export interface ExecuteOptions {
  /** Optional URL to begin from (if not provided, AI will choose) */
  startingUrl?: string;

  /** Optional contextual data to reference during task execution */
  data?: any;

  /** Optional AbortSignal to cancel execution */
  abortSignal?: AbortSignal;
}

/**
 * Result returned by WebAgent.execute()
 */
export interface TaskExecutionResult {
  /** Whether the task completed successfully */
  success: boolean;

  /** The final answer provided by the agent */
  finalAnswer: string;

  /** The plan that was created for the task */
  plan: string;

  /** The explanation of how the task will be approached */
  taskExplanation: string;

  /** Validation result details (only present if validation was performed) */
  validationResult?: TaskValidationResult;

  /** Number of iterations taken during execution */
  iterations: number;

  /** Number of validation attempts made */
  validationAttempts: number;
}

/**
 * Options for configuring the WebAgent
 */
export interface WebAgentOptions {
  /** Custom logger to use (defaults to ConsoleLogger) */
  logger?: Logger;

  /** Enable debug mode with additional logging */
  debug?: boolean;

  /** Enable vision capabilities to include screenshots */
  vision?: boolean;

  /** AI Provider to use for LLM requests (required) */
  provider: LanguageModel;

  /** Optional guardrails to limit what the agent can do */
  guardrails?: string;

  /** Maximum validation attempts when task completion quality is insufficient (defaults to 3) */
  maxValidationAttempts?: number;

  /** Maximum total iterations to prevent infinite loops (defaults to 50) */
  maxIterations?: number;
}

/**
 * WebAgent - Main class for AI-powered web automation
 *
 * Orchestrates the complete task execution lifecycle:
 * 1. Task planning and URL generation
 * 2. Browser navigation and page interaction
 * 3. Action generation and validation
 * 4. Task completion verification
 *
 * The agent maintains conversation state with the LLM and tracks page state
 * to provide context for decision making.
 */
export class WebAgent {
  // === Task State ===
  /** The generated plan for the current task */
  private plan: string = "";

  /** Starting URL for the task (generated or provided) */
  private url: string = "";

  /** Conversation history with the LLM for context */
  private messages: any[] = [];

  /** Explanation of how the task will be approached */
  private taskExplanation: string = "";

  /** Optional contextual data passed from CLI for task execution */
  private data: any = null;

  // === Configuration ===
  /** LLM provider for AI reasoning (defaults to OpenAI GPT-4.1) */
  private provider: LanguageModel;

  /** Debug mode flag for additional logging */
  private DEBUG = false;

  /** Vision mode flag for including screenshots */
  private vision = false;

  /** Optional guardrails to constrain agent behavior */
  private guardrails: string | null = null;

  /** Maximum attempts to validate task completion before giving up */
  private maxValidationAttempts: number;

  /** Maximum total iterations to prevent infinite loops */
  private maxIterations: number;

  /** Cached field order for action schema to avoid repeated Object.keys calls */
  private readonly actionSchemaFieldOrder: string[] = getActionSchemaFieldOrder();

  // === Event System ===
  /** Event emitter for logging and monitoring */
  private eventEmitter: WebAgentEventEmitter;

  /** Logger for console output and debugging */
  private logger: Logger;

  /** Action validator for validating actions and refs */
  private actionValidator: ActionValidator;

  /** Event emission helper for common event patterns */
  private eventHelper: EventEmissionHelper;

  // === State Tracking ===
  /** Current page information for navigation tracking */
  private currentPage: { url: string; title: string } = { url: "", title: "" };

  /** Current iteration ID for linking events within an execution loop */
  private currentIterationId: string = "";

  /** AbortSignal for cancelling execution */
  private abortSignal: AbortSignal | null = null;

  // === Validation Patterns ===
  // No regex patterns needed - we just check if refs exist in the page snapshot

  /**
   * Initialize WebAgent with browser interface and configuration options
   *
   * @param browser - Browser automation interface (usually PlaywrightBrowser)
   * @param options - Configuration options for the agent
   */
  constructor(
    private browser: AriaBrowser,
    options: WebAgentOptions,
  ) {
    // Initialize configuration from options with sensible defaults
    this.DEBUG = options.debug ?? false;
    this.vision = options.vision ?? false;
    this.provider = options.provider;
    this.guardrails = options.guardrails ?? null;
    this.maxValidationAttempts = options.maxValidationAttempts ?? DEFAULT_MAX_VALIDATION_ATTEMPTS;
    this.maxIterations = options.maxIterations ?? DEFAULT_MAX_ITERATIONS;

    // Set up event system for logging and monitoring
    this.eventEmitter = new WebAgentEventEmitter();
    this.logger = options.logger ?? new ConsoleLogger();
    this.logger.initialize(this.eventEmitter);
    this.actionValidator = new ActionValidator();
    this.eventHelper = new EventEmissionHelper((type, data) => this.emit(type, data));
  }

  /**
   * Generate a task plan and determine the starting URL automatically
   *
   * Used when no starting URL is provided - the LLM determines the best
   * website to visit based on the task description.
   *
   * @param task - Natural language description of what to accomplish
   * @returns The generated plan and starting URL
   */
  async generatePlanWithUrl(task: string) {
    this.emit(WebAgentEventType.AGENT_STATUS, {
      message: "Making a plan and finding the best starting URL",
    });

    const response = await this.generateGenericFunctionCall(
      planningTools,
      buildPlanAndUrlPrompt(task, this.guardrails),
      undefined,
      "create_plan_with_url",
      DEFAULT_PLANNING_MAX_TOKENS,
    );

    if (!response.toolCalls || response.toolCalls.length === 0) {
      throw new Error("No function call found in planning response");
    }

    const toolCall = response.toolCalls[0];
    const args = toolCall.args as { explanation: string; plan: string; url: string };

    // Store the plan details for later use in conversation
    this.taskExplanation = args.explanation;
    this.plan = args.plan;
    this.url = args.url;

    return { plan: this.plan, url: this.url };
  }

  /**
   * Generate a task plan for a specific starting URL
   *
   * Used when a starting URL is provided - the LLM creates a plan
   * tailored to accomplish the task on that specific website.
   *
   * @param task - Natural language description of what to accomplish
   * @param startingUrl - Optional URL to start from (included in planning context)
   * @returns The generated plan
   */
  async generatePlan(task: string, startingUrl?: string) {
    this.emit(WebAgentEventType.AGENT_STATUS, { message: "Making a plan" });

    const response = await this.generateGenericFunctionCall(
      planningTools,
      buildPlanPrompt(task, startingUrl, this.guardrails),
      undefined,
      "create_plan",
      DEFAULT_PLANNING_MAX_TOKENS,
    );

    if (!response.toolCalls || response.toolCalls.length === 0) {
      throw new Error("No function call found in planning response");
    }

    const toolCall = response.toolCalls[0];
    const args = toolCall.args as { explanation: string; plan: string };

    // Store the plan details for later use in conversation
    this.taskExplanation = args.explanation;
    this.plan = args.plan;

    return { plan: this.plan };
  }

  /**
   * Initialize the conversation with the LLM for the action execution phase
   *
   * Sets up the system prompt and initial user message with task context.
   * This conversation will be used throughout the execution to maintain context
   * and generate appropriate actions based on page state.
   *
   * @param task - The original task description
   * @returns The initialized message array
   */
  initializeConversation(task: string) {
    const hasGuardrails = !!this.guardrails;

    this.messages = [
      {
        role: "system",
        content: buildActionLoopPrompt(hasGuardrails),
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

    return this.messages;
  }

  /**
   * Validates aria reference by checking if it exists in the current page snapshot
   */
  protected validateAriaRef(ref: string): {
    isValid: boolean;
    error?: string;
  } {
    return this.actionValidator.validateAriaRef(ref);
  }

  protected validateActionResponse(response: any): {
    isValid: boolean;
    errors: string[];
  } {
    return this.actionValidator.validateActionResponse(response);
  }

  // === PAGE STATE MANAGEMENT ===
  //
  // Design rationale: Page state tracking is separated into distinct methods to handle
  // different scenarios while maintaining consistency and avoiding duplicate events.
  //
  // The separation allows us to:
  // 1. Update state without emitting events (for internal tracking)
  // 2. Emit events without state changes (for detected navigation)
  // 3. Combine both for confirmed navigation
  // 4. Refresh from browser when state might be stale

  /**
   * Updates internal page state only (no side effects)
   *
   * Used when we need to track page state changes without triggering events.
   * This is important for maintaining accurate internal state during navigation detection.
   */
  private updatePageState(title: string, url: string): void {
    this.currentPage = { url, title };
  }

  /**
   * Emits navigation event for logging/display
   *
   * Separated from state updates to avoid duplicate events when we detect navigation
   * that may have already been recorded elsewhere.
   */
  private emitNavigationEvent(title: string, url: string): void {
    this.emit(WebAgentEventType.BROWSER_NAVIGATED, { title, url });
  }

  /**
   * Fetches current page info and updates internal state
   *
   * Used when we need fresh page info but don't want to emit navigation events
   * (e.g., when checking if navigation occurred after an action).
   */
  private async refreshPageState(): Promise<{ title: string; url: string }> {
    const [title, url] = await Promise.all([this.browser.getTitle(), this.browser.getUrl()]);
    this.updatePageState(title, url);
    return { title, url };
  }

  /**
   * Fetches current page info and records navigation
   *
   * Used when we expect navigation to have occurred and want to both update state
   * and emit events for the change.
   */
  private async refreshAndRecordNavigation(): Promise<void> {
    const { title, url } = await this.refreshPageState();
    this.emitNavigationEvent(title, url);
  }

  /**
   * Generate the next action using function calling based on current page state
   *
   * This is the core decision-making method that:
   * 1. Compresses the page snapshot to reduce token usage
   * 2. Updates the conversation with current page state
   * 3. Uses function calling to let the LLM decide what action to take
   * 4. Converts function calls back to Action format for compatibility
   *
   * @param pageSnapshot - Raw aria tree snapshot of the current page
   * @param retryCount - Number of validation retry attempts (for error handling)
   * @returns The validated action to execute
   */
  async generateNextAction(pageSnapshot: string, retryCount = 0): Promise<Action> {
    // Store the current page snapshot for ref validation
    this.actionValidator.updatePageSnapshot(pageSnapshot);

    // Compress the page snapshot to reduce token usage while preserving essential information
    const compressedSnapshot = this.compressSnapshot(pageSnapshot);

    // Get current page info and update internal state for AI context
    const { title: pageTitle, url: pageUrl } = await this.refreshPageState();

    // Debug logging: show compression effectiveness
    if (this.DEBUG) {
      const originalSize = pageSnapshot.length;
      const compressedSize = compressedSnapshot.length;
      const compressionPercent = Math.round((1 - compressedSize / originalSize) * 100);
      this.emit(WebAgentEventType.SYSTEM_DEBUG_COMPRESSION, {
        originalSize,
        compressedSize,
        compressionPercent,
      });
    }

    // Add the current page snapshot to the conversation for LLM context
    await this.updateMessagesWithSnapshot(pageTitle, pageUrl, compressedSnapshot);

    // Debug logging: show full conversation history
    if (this.DEBUG) {
      this.emit(WebAgentEventType.SYSTEM_DEBUG_MESSAGE, { messages: this.messages });
    }

    // Use function calling to get the next action
    const response = await this.withProcessingEvents(
      "Planning next action",
      () => this.generateFunctionCallResponse(this.messages),
      this.vision,
    );

    // Validate and parse the function call response using centralized validation
    const validationResult = this.actionValidator.validateAndParseToolCallResponse(response);

    if (!validationResult.isValid) {
      // Emit validation error event for logging
      this.emit(WebAgentEventType.TASK_VALIDATION_ERROR, {
        errors: validationResult.errors,
        retryCount,
        rawResponse: response,
      });

      if (retryCount >= MAX_RETRY_ATTEMPTS) {
        throw new Error(
          `Failed to get valid response after ${
            retryCount + 1
          } attempts. Errors: ${validationResult.errors.join(", ")}`,
        );
      }

      // Add feedback message if provided by the validator
      if (validationResult.feedbackMessage) {
        this.addUserMessage(validationResult.feedbackMessage);
      } else {
        // Fallback to general validation feedback
        this.addValidationErrorFeedback(validationResult.errors, response);
      }

      return this.generateNextAction(pageSnapshot, retryCount + 1);
    }

    // Return the validated and parsed action
    return validationResult.action!;
  }

  /**
   * Centralized event emission with automatic timestamp and iteration ID injection
   *
   * Design decision: All events flow through this single method to ensure:
   * 1. Consistent timestamp injection for debugging and monitoring
   * 2. Automatic iteration ID injection to link events within execution loops
   * 3. Type safety through WebAgentEventType enum
   * 4. Error isolation - logging failures don't crash the main task
   * 5. Single point of control for event filtering/debugging
   *
   * @param type - Event type from WebAgentEventType enum
   * @param data - Event-specific data (timestamp and iterationId will be auto-injected)
   */
  protected emit(type: WebAgentEventType, data: Omit<any, "timestamp" | "iterationId">) {
    try {
      this.eventEmitter.emitEvent({
        type,
        data: {
          timestamp: Date.now(),
          iterationId: this.currentIterationId,
          ...data,
        },
      } as WebAgentEvent);
    } catch (error) {
      // Critical design decision: Never let logging errors crash the main task
      // The task execution is more important than perfect logging
      console.error("Failed to emit event:", error);
    }
  }

  /**
   * Helper to emit processing start/end events around AI operations
   *
   * This wrapper ensures we always emit both start and end events, even if the AI operation
   * fails. This is important for UI consistency - users need to know when processing has stopped.
   *
   * Design pattern: Using higher-order function to guarantee paired events
   *
   * @param operation - Human-readable description of what the AI is processing
   * @param task - The async AI operation to execute
   * @param hasScreenshot - Whether this processing includes screenshot data
   * @returns The result of the AI operation
   */
  protected async withProcessingEvents<T>(
    operation: string,
    task: () => Promise<T>,
    hasScreenshot?: boolean,
  ): Promise<T> {
    return this.eventHelper.withProcessingEvents(operation, task, hasScreenshot);
  }

  /**
   * Helper to add assistant response to conversation history
   */
  protected addAssistantMessage(response: any): void {
    this.messages.push({
      role: "assistant",
      content: JSON.stringify(response),
    });
  }

  /**
   * Helper to add user message to conversation history
   */
  protected addUserMessage(content: string): void {
    this.messages.push({
      role: "user",
      content,
    });

    // Prevent memory bloat by limiting conversation history
    if (this.messages.length > MAX_CONVERSATION_MESSAGES) {
      // Keep system message and remove oldest user/assistant messages
      const systemMessages = this.messages.filter((msg) => msg.role === "system");
      const otherMessages = this.messages.filter((msg) => msg.role !== "system");

      // Keep the most recent messages up to the limit
      const messagesToKeep = otherMessages.slice(
        -(MAX_CONVERSATION_MESSAGES - systemMessages.length),
      );
      this.messages = [...systemMessages, ...messagesToKeep];
    }
  }

  /**
   * Maps action response fields to their corresponding WebAgent events
   *
   * This centralized mapping ensures consistent event emission for each field type
   * and provides a single place to manage field-to-event relationships.
   *
   * @param fieldName - The field name from the action response schema
   * @param value - The field value to emit
   */
  private emitFieldEvent(fieldName: string, value: any): void {
    switch (fieldName) {
      case "observation":
        this.emit(WebAgentEventType.AGENT_OBSERVED, { observation: value });
        break;
      case "observationStatusMessage":
        this.emit(WebAgentEventType.AGENT_STATUS, { message: value });
        break;
      case "action":
        this.emit(WebAgentEventType.BROWSER_ACTION_STARTED, {
          action: value.action,
          ref: value.ref ?? undefined,
          value: value.value ?? undefined,
        });
        break;
      case "actionStatusMessage":
        this.emit(WebAgentEventType.AGENT_STATUS, { message: value });
        break;
      default:
        // Unknown field type - no event emission
        break;
    }
  }

  /**
   * Emits AI generation metadata after successful streaming completion
   *
   * @param stream - The completed stream object
   * @param schema - Zod schema for response validation
   * @param messages - Conversation history for context
   * @param final - The final action response
   */
  private emitAIGenerationMetadata(stream: any, schema: any, messages: any[], final: Action): void {
    this.emit(WebAgentEventType.AI_GENERATION, {
      prompt: undefined,
      schema,
      messages,
      temperature: 0,
      object: final,
      finishReason: (stream as any).finishReason,
      usage: (stream as any).usage,
      warnings: (stream as any).warnings,
      providerMetadata: (stream as any).providerMetadata,
    });
  }

  /**
   * Handles errors during streaming AI generation with retry logic
   *
   * @param error - The error that occurred
   * @param schema - Zod schema for response validation
   * @param messages - Conversation history for context
   * @param retryCount - Current retry attempt number
   * @returns Promise that resolves to Action or throws error
   */
  private async handleStreamingError(
    error: unknown,
    schema: any,
    messages: any[],
    retryCount: number,
  ): Promise<Action> {
    try {
      await this.handleAIGenerationError(error, {
        retryCount,
        messages,
        schema,
      });
    } catch (err) {
      if (err instanceof Error && err.message === "RETRY_NEEDED") {
        return this.generateStreamingActionResponse(schema, messages, retryCount + 1);
      }
      throw err;
    }

    // This should never be reached due to the Promise<never> return type
    throw error;
  }

  /**
   * Emits remaining field events after streaming completes
   *
   * @param final - The complete action response
   * @param fieldOrder - Array of field names in expected order
   * @param emittedFields - Set of fields already emitted during streaming
   * @param chunkCount - Number of chunks processed during streaming
   */
  private emitRemainingFieldEvents(
    final: Action,
    fieldOrder: string[],
    emittedFields: Set<string>,
    chunkCount: number,
  ): void {
    // Fallback: emit all events if streaming failed
    if (chunkCount === 0) {
      for (const field of fieldOrder) {
        if (final[field as keyof Action]) {
          this.emitFieldEvent(field, final[field as keyof Action]);
        }
      }
    } else {
      // Emit any remaining fields (typically the last field)
      for (const field of fieldOrder) {
        if (final[field as keyof Action] && !emittedFields.has(field)) {
          this.emitFieldEvent(field, final[field as keyof Action]);
          emittedFields.add(field);
        }
      }
    }
  }

  /**
   * Processes streaming partial objects and emits field events as they complete
   *
   * @param stream - The streaming response object
   * @param fieldOrder - Array of field names in expected order
   * @returns Number of chunks processed and set of emitted fields
   */
  private async processStreamingResponse(
    stream: any,
    fieldOrder: string[],
  ): Promise<{ chunkCount: number; emittedFields: Set<string> }> {
    const emittedFields = new Set<string>();
    let chunkCount = 0;

    // Process streaming partial objects
    for await (const partialObject of stream.partialObjectStream) {
      chunkCount++;
      const partial = partialObject as Partial<Action>;

      // Emit fields when we detect the next field has appeared (indicating current field is complete)
      for (let i = 0; i < fieldOrder.length; i++) {
        const currentField = fieldOrder[i] as keyof Action;
        const nextField = fieldOrder[i + 1] as keyof Action;

        if (partial[currentField] && !emittedFields.has(currentField)) {
          // Only emit if next field exists and has appeared (current field is complete)
          if (nextField && partial[nextField]) {
            this.emitFieldEvent(currentField, partial[currentField]);
            emittedFields.add(currentField);
          }
          // Special case: if this is the last field and all fields are present, emit it
          else if (!nextField && Object.keys(partial).length === fieldOrder.length) {
            this.emitFieldEvent(currentField, partial[currentField]);
            emittedFields.add(currentField);
          }
          // Note: Last field is normally handled after stream completes
        }
      }
    }

    return { chunkCount, emittedFields };
  }

  /**
   * Generates AI action responses with real-time streaming event emission
   *
   * This method uses the AI SDK's streamObject to get incremental responses and emits
   * WebAgent events as soon as each field is complete, providing real-time UI updates.
   *
   * @param schema - Zod schema for response validation
   * @param messages - Conversation history for context
   * @param retryCount - Current retry attempt (for error handling)
   * @returns Complete validated Action object
   */
  protected async generateStreamingActionResponse(
    schema: any,
    messages: any[],
    retryCount = 0,
  ): Promise<Action> {
    const config: any = {
      model: this.provider,
      schema,
      messages,
      temperature: 0,
    };

    // Add AbortSignal if provided
    if (this.abortSignal) {
      config.abortSignal = this.abortSignal;
    }

    try {
      const stream = await streamObject(config);

      // Use cached field order to avoid repeated Object.keys calls
      const fieldOrder = this.actionSchemaFieldOrder;

      // Process streaming partial objects and emit field events
      const { chunkCount, emittedFields } = await this.processStreamingResponse(stream, fieldOrder);

      // Get final complete response
      const finalResponse = await stream.object;
      const final = finalResponse as Action;

      // Emit any remaining fields and handle fallback for failed streaming
      this.emitRemainingFieldEvents(final, fieldOrder, emittedFields, chunkCount);

      // Emit AI generation metadata
      this.emitAIGenerationMetadata(stream, schema, messages, final);

      return final;
    } catch (error) {
      return this.handleStreamingError(error, schema, messages, retryCount);
    }
  }

  // Repetition handling is now done in ActionValidator.handleRepeatedToolCallArguments()

  /**
   * Generic function calling method for any set of tools
   */
  protected async generateGenericFunctionCall(
    tools: any,
    prompt?: string,
    messages?: any[],
    specificFunction?: string,
    maxTokens?: number,
  ): Promise<ToolCallResponse> {
    const config: any = {
      model: this.provider,
      tools,
      toolChoice: specificFunction
        ? ({ type: "tool", toolName: specificFunction } as const)
        : ("required" as const),
      temperature: 0,
      maxToolRoundtrips: 0,
    };

    // Add max tokens if specified
    if (maxTokens) {
      config.maxTokens = maxTokens;
    }

    // Add prompt or messages
    if (prompt) {
      config.prompt = prompt;
    } else if (messages) {
      config.messages = messages;
    }

    // Add AbortSignal if provided
    const finalConfig = this.abortSignal ? { ...config, abortSignal: this.abortSignal } : config;

    try {
      const response = await generateText(finalConfig);
      return response;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("AI function call request was cancelled");
      }
      throw error;
    }
  }

  /**
   * Generate function call response using AI SDK (but treat it like structured JSON)
   * We use function calling purely for better response conformity, not for actual function calling conversation
   */
  protected async generateFunctionCallResponse(messages: any[]): Promise<ToolCallResponse> {
    // Create a clean messages array without any function call artifacts that might confuse the AI
    const cleanMessages = messages.map((msg) => {
      if (msg.role === "assistant" && msg.tool_calls) {
        // Remove tool_calls from assistant messages to keep conversation clean
        return {
          role: msg.role,
          content: msg.content ?? "Action taken",
        };
      }
      return msg;
    });

    const config = {
      model: this.provider,
      messages: cleanMessages,
      tools: webActionTools,
      toolChoice: "required" as const,
      temperature: 0,
      maxTokens: DEFAULT_GENERATION_MAX_TOKENS, // Generous limit to prevent infinite loops, especially for "done" actions
      maxToolRoundtrips: 0, // Prevent multiple function calls in one response
      providerOptions: {
        openrouter: {
          reasoning: {
            max_tokens: 500,
            exclude: false,
          },
        },
      },
    };

    // Add AbortSignal if provided
    const finalConfig = this.abortSignal ? { ...config, abortSignal: this.abortSignal } : config;

    try {
      const response = await generateText(finalConfig);

      // Emit observation first (the AI's reasoning/thinking)
      const thinkingText = response.reasoning ?? response.text ?? "Function call executed";
      this.emit(WebAgentEventType.AGENT_OBSERVED, { observation: thinkingText });

      // Then emit events for the function call
      if (response.toolCalls && response.toolCalls.length > 0) {
        const toolCall = response.toolCalls[0];
        // Properly handle union types based on function name
        let ref: string | undefined;
        let value: string | number | undefined;

        switch (toolCall.toolName) {
          case "click":
          case "hover":
          case "check":
          case "uncheck":
          case "focus":
          case "enter":
            ref = (toolCall.args as { ref: string }).ref;
            break;
          case "fill":
          case "fill_and_enter":
          case "select":
            ref = (toolCall.args as { ref: string; value: string }).ref;
            value = (toolCall.args as { ref: string; value: string }).value;
            break;
          case "wait":
            value = (toolCall.args as { seconds: number }).seconds;
            break;
          case "goto":
            value = (toolCall.args as { url: string }).url;
            break;
          case "extract":
            value = (toolCall.args as { description: string }).description;
            break;
          case "done":
            value = (toolCall.args as { result: string }).result;
            break;
        }

        this.emit(WebAgentEventType.BROWSER_ACTION_STARTED, {
          action: toolCall.toolName,
          ref,
          value,
        });
      }

      this.emit(WebAgentEventType.AI_GENERATION, {
        prompt: undefined,
        schema: undefined,
        messages: cleanMessages,
        temperature: 0,
        object: response.toolCalls?.[0] ?? null,
        finishReason: response.finishReason,
        usage: response.usage,
        warnings: (response as any).warnings,
        providerMetadata: (response as any).providerMetadata,
      });

      return response;
    } catch (error) {
      // Handle AbortError specifically
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("AI function call request was cancelled");
      }

      if (error instanceof Error) {
        // Add generic error feedback to conversation without showing the raw error details
        this.addUserMessage(
          `⚠️ Error: ${error.message}. ` +
            `Please follow the function calling instructions carefully and try again. ` +
            `Call exactly one function with valid parameters.`,
        );

        // Emit error event for logging
        this.emit(WebAgentEventType.AI_GENERATION_ERROR, {
          error: `AI generation error - attempting retry: ${error.message}`,
          prompt: undefined,
          schema: undefined,
          messages: cleanMessages,
        });

        // Retry the function call once
        return this.generateFunctionCallResponse(cleanMessages);
      }
      throw error;
    }
  }

  // Function call validation and parsing is now handled by ActionValidator

  /**
   * Centralized error handling for AI generation failures
   */
  private async handleAIGenerationError(
    error: unknown,
    context: {
      retryCount: number;
      messages?: any[];
      prompt?: string;
      schema?: any;
    },
  ): Promise<never> {
    const { retryCount, messages, prompt, schema } = context;

    // Handle AbortError specifically
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("AI request was cancelled");
    }

    if (error instanceof Error) {
      this.emit(WebAgentEventType.AI_GENERATION_ERROR, {
        error: error.message,
        prompt,
        schema,
        messages,
      });
    }

    // Check if this is a recoverable AI generation error
    const isRecoverableError =
      error instanceof Error &&
      (error.message.includes("response did not match schema") ||
        error.message.includes("AI_NoObjectGeneratedError") ||
        error.message.includes("No object generated") ||
        error.message.includes("Invalid JSON response") ||
        error.message.includes("AI_APICallError") ||
        error.name === "AI_APICallError");

    if (isRecoverableError) {
      console.error(
        `AI response schema mismatch (attempt ${retryCount + 1}):`,
        (error as Error).message,
      );

      // Log debugging info on the first failure
      if (retryCount === 0 && this.DEBUG && messages) {
        console.error("Debug info - Last few messages:");
        const lastMessages = messages.slice(-2);
        console.error(JSON.stringify(lastMessages, null, 2));
      }

      if (retryCount < MAX_RETRY_ATTEMPTS) {
        console.log("🔄 Retrying AI generation...");
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        return Promise.reject(new Error("RETRY_NEEDED")); // Special error to indicate retry is needed
      } else {
        const errorMessage =
          `AI generation failed after ${retryCount + 1} attempts. This may be due to:\n` +
          `1. The AI response not matching the expected schema format\n` +
          `2. Network issues or AI service problems\n` +
          `3. Complex page content that confused the AI\n` +
          `Original error: ${(error as Error).message}`;
        throw new Error(errorMessage);
      }
    }

    // Re-throw non-recoverable errors
    throw error;
  }

  /**
   * Centralized AI generation with consistent configuration
   */
  protected async generateAIResponse<T>(
    schema: any,
    options: {
      prompt?: string;
      messages?: any[];
      maxTokens?: number;
      retryCount?: number;
    } = {},
  ): Promise<T> {
    const { prompt, messages, maxTokens, retryCount = 0 } = options;

    const config: any = {
      model: this.provider,
      schema,
      temperature: 0,
    };

    // Add token limit if specified
    if (maxTokens) {
      config.maxTokens = maxTokens;
    }

    // Add AbortSignal if provided
    if (this.abortSignal) {
      config.abortSignal = this.abortSignal;
    }

    if (prompt) {
      config.prompt = prompt;
    } else if (messages) {
      config.messages = messages;
    }

    try {
      const response = await generateObject(config);
      this.emit(WebAgentEventType.AI_GENERATION, {
        prompt,
        schema,
        messages,
        temperature: config.temperature,
        object: response.object,
        finishReason: response.finishReason,
        usage: response.usage,
        warnings: response.warnings,
        providerMetadata: response.providerMetadata,
      });
      return response.object as T;
    } catch (error) {
      // Log raw response for debugging when parsing fails
      if (error instanceof Error && error.message.includes("could not parse the response")) {
        console.error("❌ Raw AI response that failed to parse:", (error as any).response);
      }

      try {
        await this.handleAIGenerationError(error, {
          retryCount,
          messages,
          prompt,
          schema,
        });
      } catch (err) {
        if (err instanceof Error && err.message === "RETRY_NEEDED") {
          return this.generateAIResponse<T>(schema, {
            prompt,
            messages,
            maxTokens,
            retryCount: retryCount + 1,
          });
        }
        throw err;
      }

      // This should never be reached due to the Promise<never> return type
      throw error;
    }
  }

  private truncateSnapshotsInMessages(messages: any[]): any[] {
    return messages.map((msg) => {
      if (msg.role === "user") {
        // Handle text-only messages
        if (
          typeof msg.content === "string" &&
          msg.content.includes("snapshot") &&
          msg.content.includes("```")
        ) {
          return {
            ...msg,
            content: msg.content.replace(/```[\s\S]*$/g, "```[snapshot clipped for length]```"),
          };
        }
        // Handle multimodal messages (text + image)
        if (Array.isArray(msg.content)) {
          return {
            ...msg,
            content: msg.content.map((item: any) => {
              if (
                item.type === "text" &&
                item.text.includes("snapshot") &&
                item.text.includes("```")
              ) {
                return {
                  ...item,
                  text: item.text.replace(/```[\s\S]*$/g, "```[snapshot clipped for length]```"),
                };
              }
              if (item.type === "image") {
                return {
                  type: "text",
                  text: "[screenshot clipped for length]",
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

  private async updateMessagesWithSnapshot(pageTitle: string, pageUrl: string, snapshot: string) {
    // Clip old snapshots from existing messages
    this.messages = this.truncateSnapshotsInMessages(this.messages);

    const textContent = buildPageSnapshotPrompt(pageTitle, pageUrl, snapshot, this.vision);

    if (this.vision) {
      try {
        const screenshot = await this.browser.getScreenshot();
        this.emit(WebAgentEventType.BROWSER_SCREENSHOT_CAPTURED, {
          size: screenshot.length,
          format: "jpeg" as const,
        });
        this.messages.push({
          role: "user",
          content: [
            {
              type: "text",
              text: textContent,
            },
            {
              type: "image",
              image: screenshot,
              mimeType: "image/jpeg",
            },
          ],
        });
      } catch (error) {
        // If screenshot fails, fall back to text-only
        console.warn("Screenshot capture failed, falling back to text-only:", error);
        this.messages.push({
          role: "user",
          content: textContent,
        });
      }
    } else {
      this.messages.push({
        role: "user",
        content: textContent,
      });
    }
  }

  private addValidationErrorFeedback(errors: string[], response: any) {
    const hasGuardrails = !!this.guardrails;
    // Add the attempted response to conversation, then the error feedback
    this.addAssistantMessage(response);
    this.addUserMessage(buildStepValidationFeedbackPrompt(errors.join("\n"), hasGuardrails));
  }

  private addTaskRetryFeedback(result: any, validationResult: TaskValidationResult) {
    // Add the task completion attempt, then feedback about quality
    this.addAssistantMessage(result);
    this.addUserMessage(
      `Task completion quality: ${validationResult.completionQuality}. ${validationResult.feedback} Please continue working on the task.`,
    );
  }

  protected async executeAction(result: ActionExecutionResult): Promise<boolean> {
    try {
      switch (result.action.action) {
        case "wait":
          const seconds = parseInt(result.action.value ?? "1", 10);
          await this.wait(seconds);
          break;

        case "goto":
          if (result.action.value) {
            await this.browser.goto(result.action.value);
            await this.refreshAndRecordNavigation();
          } else {
            throw new Error("Missing URL for goto action");
          }
          break;

        case "back":
          await this.browser.goBack();
          await this.refreshAndRecordNavigation();
          break;

        case "forward":
          await this.browser.goForward();
          await this.refreshAndRecordNavigation();
          break;

        case "extract":
          if (!result.action.value) {
            throw new Error("Missing extraction description for extract action");
          }
          const extractedData = await this.extractDataFromPage(result.action.value);

          // Store the extracted data so we can add it to conversation history
          (result as any).extractedData = extractedData;
          break;

        case "fill_and_enter":
          if (!result.action.ref) {
            throw new Error("Missing ref for fill_and_enter action");
          }
          if (!result.action.value) {
            throw new Error("Missing value for fill_and_enter action");
          }

          // Fill the element first
          await this.browser.performAction(result.action.ref, PageAction.Fill, result.action.value);

          // Then press enter on the same element
          await this.browser.performAction(result.action.ref, PageAction.Enter, undefined);
          break;

        case "done":
          // "done" actions are handled in the main loop, not here
          break;

        default:
          if (!result.action.ref) {
            throw new Error("Missing ref for action");
          }

          await this.browser.performAction(
            result.action.ref,
            result.action.action as PageAction,
            result.action.value,
          );

          // Check if navigation occurred for actions that might navigate
          if (["click", "select", "fill_and_enter"].includes(result.action.action)) {
            const { title: actionTitle, url: actionUrl } = await this.refreshPageState();

            if (actionUrl !== this.currentPage.url || actionTitle !== this.currentPage.title) {
              this.emitNavigationEvent(actionTitle, actionUrl);
            }
          }
      }
      return true;
    } catch (error) {
      this.emit(WebAgentEventType.BROWSER_ACTION_COMPLETED, {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  private recordActionResult(result: ActionExecutionResult, actionSuccess: boolean) {
    if (actionSuccess) {
      // Add the action result to conversation history in our normal format
      // This maintains our existing conversation flow while using function calls for format
      this.addAssistantMessage(result);

      // For extract actions, also add the extracted data to conversation history
      if (result.action.action === "extract" && result.extractedData) {
        this.addUserMessage(`Extraction result: ${result.extractedData}`);
      }

      this.emit(WebAgentEventType.BROWSER_ACTION_COMPLETED, { success: true });
    } else {
      this.addAssistantMessage(`Failed to execute action: ${result.action.action}`);
    }
  }

  // Helper function to wait for a specified number of seconds
  async wait(seconds: number) {
    this.emit(WebAgentEventType.AGENT_WAITING, { seconds });

    return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
  }

  /**
   * Extracts data from the current page using clean markdown representation
   *
   * @param extractionDescription - Description of what data to extract
   * @returns The extracted data
   */
  private async extractDataFromPage(extractionDescription: string): Promise<string> {
    if (!this.browser) throw new Error("Browser not started");

    try {
      // Get the page content as clean markdown
      const markdown = await this.browser.getMarkdown();

      // Create extraction prompt using the template
      const extractionPrompt = buildExtractionPrompt(extractionDescription, markdown);

      // Use simple text generation for extraction - no need for function calling with plain text
      const response = await generateText({
        model: this.provider,
        prompt: extractionPrompt,
        maxTokens: DEFAULT_EXTRACTION_MAX_TOKENS,
        temperature: 0,
        abortSignal: this.abortSignal ?? undefined,
      });

      let extractedData = response.text;

      // Check if response was truncated due to token limit
      if (response.finishReason === "length") {
        console.warn(
          "⚠️  Data extraction was truncated due to token limit - response may be incomplete",
        );
        extractedData += "\n\n[Response truncated due to length limit]";
      }

      this.emit(WebAgentEventType.AGENT_EXTRACTED, { extractedData });

      return extractedData;
    } catch (error) {
      const errorMsg = `Failed to extract data: ${error instanceof Error ? error.message : String(error)}`;
      this.emit(WebAgentEventType.AGENT_EXTRACTED, { extractedData: errorMsg });
      return errorMsg;
    }
  }

  /**
   * Validates if a string is a valid URL
   */
  private isValidUrl(urlString: string): boolean {
    try {
      const url = new URL(urlString);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }

  /**
   * Emits the task setup event with initial task information
   */
  private emitTaskSetupEvent(task: string) {
    this.emit(WebAgentEventType.TASK_SETUP, {
      task,
      browserName: this.browser.browserName,
      url: this.url,
      guardrails: this.guardrails,
      data: this.data,
      pwEndpoint: (this.browser as any).pwEndpoint,
      pwCdpEndpoint: (this.browser as any).pwCdpEndpoint,
      proxy: (this.browser as any).proxyServer,
      vision: this.vision,
    });
  }

  /**
   * Emits the task start event with all initial task information
   */
  private emitTaskStartEvent(task: string) {
    this.emit(WebAgentEventType.TASK_STARTED, {
      task,
      explanation: this.taskExplanation,
      plan: this.plan,
      url: this.url,
    });
  }

  // Reset the state for a new task
  resetState() {
    this.plan = "";
    this.url = "";
    this.messages = [];
    this.data = null;
    this.currentPage = { url: "", title: "" };
    this.currentIterationId = "";
    this.abortSignal = null;
  }

  private formatConversationHistory(): string {
    // Clip snapshots for validation - we don't need massive page content for validation
    const clippedMessages = this.truncateSnapshotsInMessages(this.messages);

    return clippedMessages
      .map((msg) => {
        let content = msg.content;
        // Handle multimodal content by extracting text parts
        if (Array.isArray(content)) {
          content = content
            .map((item: any) => (item.type === "text" ? item.text : `[${item.type}]`))
            .join(" ");
        }
        return `${msg.role}: ${content}`;
      })
      .join("\n\n");
  }

  protected async validateTaskCompletion(
    task: string,
    finalAnswer: string,
  ): Promise<TaskValidationResult> {
    const conversationHistory = this.formatConversationHistory();

    this.emit(WebAgentEventType.AGENT_STATUS, { message: "Reviewing the answer" });

    const validationPrompt = buildTaskValidationPrompt(task, finalAnswer, conversationHistory);
    if (this.DEBUG) {
      console.log("🔍 Task validation prompt:", validationPrompt);
    }

    const response = await this.withProcessingEvents("Validating task completion", async () => {
      const result = await this.generateGenericFunctionCall(
        validationTools,
        validationPrompt,
        undefined,
        "validate_task",
        DEFAULT_VALIDATION_MAX_TOKENS,
      );

      if (!result.toolCalls || result.toolCalls.length === 0) {
        throw new Error("No function call found in validation response");
      }

      const toolCall = result.toolCalls[0];
      return toolCall.args as TaskValidationResult;
    });

    this.emit(WebAgentEventType.TASK_VALIDATED, {
      taskAssessment: response.taskAssessment,
      completionQuality: response.completionQuality,
      feedback: response.feedback,
      finalAnswer,
    });

    return response;
  }

  /**
   * Execute a natural language task with optional starting URL and context data
   *
   * This is the main entry point for task execution. The method follows this lifecycle:
   *
   * 1. **Planning Phase**: Generate task plan and determine starting URL
   * 2. **Navigation Phase**: Launch browser and navigate to starting page
   * 3. **Execution Phase**: Iteratively analyze page, generate actions, and execute them
   * 4. **Validation Phase**: Verify task completion and retry if needed
   *
   * The agent will continue executing actions until:
   * - Task is marked as "done" and validation succeeds
   * - Maximum validation attempts are reached
   * - Maximum iteration limit is hit (safety mechanism)
   * - AbortSignal is triggered (immediate cancellation)
   *
   * @param task - Natural language description of what to accomplish
   * @param options - Optional configuration for task execution
   * @returns Complete execution results including success status and metrics
   */
  async execute(task: string, options: ExecuteOptions = {}): Promise<TaskExecutionResult> {
    this.validateTaskInput(task, options);
    await this.setupTaskExecution(task, options);
    await this.initializeBrowserAndPlan(task, options.startingUrl);
    await this.navigateToStartingPage(task);

    const executionState = this.createExecutionState();
    const loopResult = await this.runMainExecutionLoop(task, executionState);

    return this.buildExecutionResult(loopResult, executionState);
  }

  /**
   * Validates task input and options before execution begins
   */
  private validateTaskInput(task: string, options: ExecuteOptions): void {
    if (!task?.trim()) {
      throw new Error("Task cannot be empty or whitespace-only.");
    }

    if (task.length > 10000) {
      throw new Error("Task description is too long (maximum 10,000 characters).");
    }

    if (options.startingUrl && !this.isValidUrl(options.startingUrl)) {
      throw new Error("Invalid starting URL provided.");
    }
  }

  /**
   * Sets up the task execution environment
   */
  private async setupTaskExecution(task: string, options: ExecuteOptions): Promise<void> {
    this.emitTaskSetupEvent(task);
    this.resetState();
    this.abortSignal = options.abortSignal ?? null;

    if (options.data) {
      this.data = options.data;
    }
  }

  /**
   * Initializes browser and creates task plan in parallel for efficiency
   */
  private async initializeBrowserAndPlan(task: string, startingUrl?: string): Promise<void> {
    try {
      this.emit(WebAgentEventType.AGENT_STATUS, {
        message: "Starting browser and creating plan",
      });

      if (startingUrl) {
        this.url = startingUrl;
        await Promise.all([this.generatePlan(task, startingUrl), this.browser.start()]);
      } else {
        await Promise.all([this.generatePlanWithUrl(task), this.browser.start()]);
      }
    } catch (error) {
      await this.cleanupOnInitializationError();
      throw new Error(
        `Failed to initialize task: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Navigates to the starting page and records the navigation
   */
  private async navigateToStartingPage(task: string): Promise<void> {
    this.emitTaskStartEvent(task);
    this.emit(WebAgentEventType.AGENT_STATUS, { message: "Navigating to starting page" });
    await this.browser.goto(this.url);
    await this.refreshAndRecordNavigation();
    this.initializeConversation(task);
  }

  /**
   * Creates the initial execution state for the main loop
   */
  private createExecutionState() {
    return {
      finalAnswer: null as string | null,
      validationAttempts: 0,
      currentIteration: 0,
      lastValidationResult: undefined as TaskValidationResult | undefined,
    };
  }

  /**
   * Runs the main execution loop until completion or termination
   */
  private async runMainExecutionLoop(
    task: string,
    state: ReturnType<typeof this.createExecutionState>,
  ): Promise<{ success: boolean; finalAnswer: string | null }> {
    while (true) {
      // Safety check: prevent infinite loops
      state.currentIteration++;
      if (state.currentIteration > this.maxIterations) {
        this.emit(WebAgentEventType.TASK_COMPLETED, {
          finalAnswer: `Task stopped after reaching maximum iterations (${this.maxIterations})`,
          success: false,
        });
        state.finalAnswer = `Task stopped after reaching maximum iterations (${this.maxIterations})`;
        break;
      }

      this.currentIterationId = nanoid(8);

      try {
        const loopResult = await this.executeMainLoopIteration(task, state);
        if (loopResult.shouldExit) {
          return loopResult;
        }
      } catch (error) {
        // Emit error details before handling
        this.emit(WebAgentEventType.AI_GENERATION_ERROR, {
          error: `Main loop iteration failed: ${error instanceof Error ? error.message : String(error)}`,
          iterationId: this.currentIterationId,
          currentIteration: state.currentIteration,
        });

        const errorResult = this.handleMainLoopError(error);
        if (errorResult.shouldExit) {
          state.finalAnswer = errorResult.finalAnswer ?? null;
          break;
        }
      }
    }

    const success = state.lastValidationResult
      ? SUCCESS_QUALITIES.includes(state.lastValidationResult.completionQuality as any)
      : false;

    return { success, finalAnswer: state.finalAnswer };
  }

  /**
   * Executes a single iteration of the main loop
   */
  private async executeMainLoopIteration(
    task: string,
    state: ReturnType<typeof this.createExecutionState>,
  ): Promise<{ shouldExit: boolean; success: boolean; finalAnswer: string | null }> {
    this.emit(WebAgentEventType.AGENT_STATUS, { message: "Analyzing the page..." });
    const pageSnapshot = await this.browser.getTreeWithRefs();
    const result = await this.generateNextAction(pageSnapshot);

    // Handle task completion
    if (result.action.action === "done") {
      return await this.handleTaskCompletion(task, result, state);
    }

    // Execute regular action
    const actionSuccess = await this.executeAction(result);
    this.recordActionResult(result, actionSuccess);

    return { shouldExit: false, success: false, finalAnswer: null };
  }

  /**
   * Handles task completion validation and retry logic
   */
  private async handleTaskCompletion(
    task: string,
    result: ActionExecutionResult,
    state: ReturnType<typeof this.createExecutionState>,
  ): Promise<{ shouldExit: boolean; success: boolean; finalAnswer: string | null }> {
    state.finalAnswer = result.action.value!;
    const validationResult = await this.validateTaskCompletion(task, state.finalAnswer);
    state.lastValidationResult = validationResult;
    state.validationAttempts++;

    if (SUCCESS_QUALITIES.includes(validationResult.completionQuality as any)) {
      this.emit(WebAgentEventType.TASK_COMPLETED, { finalAnswer: state.finalAnswer });
      return { shouldExit: true, success: true, finalAnswer: state.finalAnswer! };
    }

    if (state.validationAttempts >= this.maxValidationAttempts) {
      return { shouldExit: true, success: false, finalAnswer: state.finalAnswer! };
    }

    this.emit(WebAgentEventType.AGENT_STATUS, {
      message: "Task needs improvement, continuing work",
    });
    this.addTaskRetryFeedback(result, validationResult);
    state.finalAnswer = null;

    return { shouldExit: false, success: false, finalAnswer: null };
  }

  /**
   * Handles errors that occur during the main execution loop
   */
  private handleMainLoopError(error: unknown): {
    shouldExit: boolean;
    finalAnswer?: string;
  } {
    const isCancellation =
      error instanceof Error &&
      (error.name === "AbortError" ||
        (this.abortSignal?.aborted &&
          (error.message.includes("cancelled") || error.message.includes("aborted"))));

    if (isCancellation) {
      this.emit(WebAgentEventType.TASK_COMPLETED, {
        finalAnswer: "Task cancelled",
        success: false,
      });
      return { shouldExit: true, finalAnswer: "Task cancelled" };
    }

    // Log the full error details for debugging
    console.error("❌ Main loop error:", error);
    if (error instanceof Error) {
      console.error("Error stack:", error.stack);
    }

    const errorMessage = `Task failed due to AI generation error: ${
      error instanceof Error ? error.message : String(error)
    }`;

    this.emit(WebAgentEventType.TASK_COMPLETED, {
      finalAnswer: errorMessage,
      success: false,
    });

    return {
      shouldExit: true,
      finalAnswer: errorMessage,
    };
  }

  /**
   * Builds the final execution result
   */
  private buildExecutionResult(
    loopResult: { success: boolean; finalAnswer: string | null },
    state: ReturnType<typeof this.createExecutionState>,
  ): TaskExecutionResult {
    return {
      success: loopResult.success,
      finalAnswer: loopResult.finalAnswer ?? "Task did not complete",
      plan: this.plan,
      taskExplanation: this.taskExplanation,
      validationResult: state.lastValidationResult,
      iterations: state.currentIteration,
      validationAttempts: state.validationAttempts,
    };
  }

  /**
   * Cleans up resources when initialization fails
   */
  private async cleanupOnInitializationError(): Promise<void> {
    try {
      await this.browser.shutdown();
    } catch (shutdownError) {
      console.warn("Failed to shutdown browser during error cleanup:", shutdownError);
    }
  }

  async close() {
    // Dispose the logger
    this.logger.dispose();

    // Close the browser
    await this.browser.shutdown();
  }

  /**
   * Compresses the aria tree snapshot to reduce token usage while maintaining essential information
   *
   * This is a critical optimization that can reduce page snapshots by 60-80% while preserving
   * all actionable elements. Large pages can easily exceed LLM context limits without this.
   *
   * Compression strategy:
   * 1. Normalize whitespace and remove bullet points
   * 2. Filter out noise (URLs, non-actionable content)
   * 3. Apply semantic transformations (listitem -> li, etc.)
   * 4. Deduplicate repeated text content
   *
   * @param snapshot - Raw aria tree snapshot from browser
   * @returns Compressed snapshot optimized for LLM processing
   */
  protected compressSnapshot(snapshot: string): string {
    // === STEP 1: Basic cleanup and filtering ===
    const transformed = snapshot
      .split("\n")
      .map((line) => line.trim()) // Remove leading/trailing whitespace
      .map((line) => line.replace(/^- /, "")) // Remove bullet point prefixes
      .filter((line) => !FILTERED_PREFIXES.some((start) => line.startsWith(start))) // Remove noise
      .map((line) => {
        // === STEP 2: Apply semantic transformations ===
        // Convert verbose aria descriptions to concise equivalents for better LLM understanding
        return ARIA_TRANSFORMATIONS.reduce(
          (processed, [pattern, replacement]) => processed.replace(pattern, replacement),
          line,
        );
      })
      .filter(Boolean); // Remove empty lines

    // === STEP 3: Deduplicate repeated text content ===
    // Many pages have repeated text (navigation, footers, etc.) that wastes tokens
    let lastQuotedText = "";
    const deduped = transformed.map((line) => {
      const match = line.match(/^([^"]*)"([^"]+)"(.*)$/);
      if (!match) return line;

      const [, prefix, quotedText, suffix] = match;

      // If this text is identical to the previous line's text, replace with reference
      // This commonly happens with repeated navigation elements, saving significant tokens
      if (quotedText === lastQuotedText) {
        return `${prefix}[same as above]${suffix}`;
      }

      lastQuotedText = quotedText;
      return line;
    });

    return deduped.join("\n");
  }
}

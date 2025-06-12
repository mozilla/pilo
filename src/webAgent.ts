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

import { generateObject, LanguageModel } from "ai";
import {
  buildActionLoopPrompt,
  buildPlanPrompt,
  buildPlanAndUrlPrompt,
  buildTaskAndPlanPrompt,
  buildPageSnapshotPrompt,
  buildValidationFeedbackPrompt,
  buildTaskValidationPrompt,
} from "./prompts.js";
import { AriaBrowser, PageAction } from "./browser/ariaBrowser.js";
import {
  planSchema,
  planAndUrlSchema,
  actionSchema,
  Action,
  taskValidationSchema,
  TaskValidationResult,
} from "./schemas.js";
import { WebAgentEventEmitter, WebAgentEventType, WebAgentEvent } from "./events.js";
import { Logger, ConsoleLogger } from "./loggers.js";

// Task completion quality constants used for validation
const COMPLETION_QUALITY = {
  FAILED: "failed",
  PARTIAL: "partial",
  COMPLETE: "complete",
  EXCELLENT: "excellent",
} as const;

// Quality levels that indicate successful task completion
const SUCCESS_QUALITIES = [COMPLETION_QUALITY.COMPLETE, COMPLETION_QUALITY.EXCELLENT] as const;

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

  /** Optional guardrails to constrain agent behavior */
  private guardrails: string | null = null;

  /** Maximum attempts to validate task completion before giving up */
  private maxValidationAttempts: number;

  /** Maximum total iterations to prevent infinite loops */
  private maxIterations: number;

  // === Page Processing ===
  /** Prefixes to filter out from page snapshots to reduce noise */
  private readonly FILTERED_PREFIXES = ["/url:"];

  /** Transformations to compress aria tree snapshots for better LLM processing */
  private readonly ARIA_TRANSFORMATIONS: Array<[RegExp, string]> = [
    [/^listitem/g, "li"], // Shorten 'listitem' to 'li'
    [/(?<=\[)ref=/g, ""], // Remove 'ref=' prefix from references
    [/^link/g, "a"], // Shorten 'link' to 'a'
    [/^text: (.*?)$/g, '"$1"'], // Convert 'text: content' to '"content"'
    [/^heading "([^"]+)" \[level=(\d+)\]/g, 'h$2 "$1"'], // Convert headings to h1, h2, etc.
  ];

  // === Event System ===
  /** Event emitter for logging and monitoring */
  private eventEmitter: WebAgentEventEmitter;

  /** Logger for console output and debugging */
  private logger: Logger;

  // === State Tracking ===
  /** Current page information for navigation tracking */
  private currentPage: { url: string; title: string } = { url: "", title: "" };

  // === Validation Patterns ===
  /** Regex for valid aria reference format (s<number>e<number>) */
  private readonly ARIA_REF_REGEX = /^s\d+e\d+$/;

  /** Regex to extract aria references from malformed input for auto-correction */
  private readonly ARIA_REF_EXTRACT_REGEX = /\b(s\d+e\d+)\b/;

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
    this.DEBUG = options.debug || false;
    this.provider = options.provider;
    this.guardrails = options.guardrails || null;
    this.maxValidationAttempts = options.maxValidationAttempts || 3;
    this.maxIterations = options.maxIterations || 50;

    // Set up event system for logging and monitoring
    this.eventEmitter = new WebAgentEventEmitter();
    this.logger = options.logger || new ConsoleLogger();
    this.logger.initialize(this.eventEmitter);
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
    const response = await this.generateAIResponse<{
      explanation: string;
      plan: string;
      url: string;
    }>(planAndUrlSchema, buildPlanAndUrlPrompt(task, this.guardrails));

    // Store the plan details for later use in conversation
    this.taskExplanation = response.explanation;
    this.plan = response.plan;
    this.url = response.url;

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
    const response = await this.generateAIResponse<{
      explanation: string;
      plan: string;
    }>(planSchema, buildPlanPrompt(task, startingUrl, this.guardrails));

    // Store the plan details for later use in conversation
    this.taskExplanation = response.explanation;
    this.plan = response.plan;

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
   * Validates aria reference format and attempts to auto-correct common issues
   */
  protected validateAriaRef(ref: string): {
    isValid: boolean;
    error?: string;
    correctedRef?: string;
  } {
    if (!ref?.trim()) {
      return { isValid: false, error: "Aria ref cannot be empty" };
    }

    const trimmedRef = ref.trim();

    // Check if it's already in the correct format (s<number>e<number>)
    if (this.ARIA_REF_REGEX.test(trimmedRef)) {
      return { isValid: true };
    }

    // Try to extract a valid ref from the input (auto-correction)
    const match = trimmedRef.match(this.ARIA_REF_EXTRACT_REGEX);
    if (match?.[1]) {
      return {
        isValid: true,
        correctedRef: match[1],
      };
    }

    return {
      isValid: false,
      error: `Invalid aria ref format "${trimmedRef}". Expected: s<number>e<number> (e.g., s1e23)`,
    };
  }

  protected validateActionResponse(response: any): {
    isValid: boolean;
    errors: string[];
    correctedResponse?: any;
  } {
    const errors: string[] = [];
    const correctedResponse = { ...response };

    // Validate required top-level fields
    this.validateRequiredStringField(response, "currentStep", errors);
    this.validateRequiredStringField(response, "observation", errors);
    this.validateRequiredStringField(response, "observationStatusMessage", errors);
    this.validateRequiredStringField(response, "thought", errors);
    this.validateRequiredStringField(response, "actionStatusMessage", errors);

    // Validate conditional status message requirements
    if (response.extractedData && response.extractedData.trim()) {
      this.validateRequiredStringField(response, "extractedDataStatusMessage", errors);
    }

    // Validate action object exists
    if (!response.action || typeof response.action !== "object") {
      errors.push('Missing or invalid "action" field - must be an object');
      return { isValid: false, errors };
    }

    // Validate action object structure
    const actionErrors = this.validateActionObject(response.action, correctedResponse);
    errors.push(...actionErrors);

    return {
      isValid: errors.length === 0,
      errors,
      correctedResponse: errors.length === 0 ? correctedResponse : undefined,
    };
  }

  /**
   * Validates that a required string field exists and is non-empty
   */
  private validateRequiredStringField(obj: any, fieldName: string, errors: string[]): void {
    const value = obj?.[fieldName];
    if (typeof value !== "string" || !value.trim()) {
      errors.push(`Missing or empty required field "${fieldName}"`);
    }
  }

  /**
   * Validates the action object structure and requirements
   */
  private validateActionObject(action: any, correctedResponse: any): string[] {
    const errors: string[] = [];

    // Validate action type
    if (!action.action?.trim()) {
      errors.push('Missing or empty "action.action" field');
      return errors; // Can't validate further without action type
    }

    const actionType = action.action;

    // Check if action type is valid
    const validActions = Object.values(PageAction);
    if (!validActions.includes(actionType)) {
      errors.push(`Invalid action type "${actionType}". Valid actions: ${validActions.join(", ")}`);
      return errors;
    }

    // Define action requirements
    const actionsRequiringRef = [
      PageAction.Click,
      PageAction.Hover,
      PageAction.Fill,
      PageAction.Focus,
      PageAction.Check,
      PageAction.Uncheck,
      PageAction.Select,
    ];
    const actionsRequiringValue = [
      PageAction.Fill,
      PageAction.Select,
      PageAction.Wait,
      PageAction.Done,
      PageAction.Goto,
    ];
    const actionsProhibitingRefAndValue = [PageAction.Back, PageAction.Forward];

    // Validate ref requirement
    if (actionsRequiringRef.includes(actionType)) {
      if (!action.ref || typeof action.ref !== "string") {
        errors.push(`Action "${actionType}" requires a "ref" field`);
      } else {
        const { isValid, error, correctedRef } = this.validateAriaRef(action.ref);
        if (!isValid && error) {
          errors.push(`Invalid ref for "${actionType}" action: ${error}`);
        } else if (correctedRef) {
          correctedResponse.action.ref = correctedRef;
        }
      }
    }

    // Validate value requirement
    if (actionsRequiringValue.includes(actionType)) {
      if (actionType === PageAction.Wait) {
        // Special validation for wait action - must be a valid number (including 0)
        if (
          action.value === undefined ||
          action.value === null ||
          action.value === "" ||
          isNaN(Number(action.value))
        ) {
          errors.push('Action "wait" requires a numeric "value" field (seconds to wait)');
        }
      } else {
        // Regular string value validation
        if (!action.value?.trim()) {
          errors.push(`Action "${actionType}" requires a non-empty "value" field`);
        }
      }
    }

    // Validate that certain actions don't have ref or value
    if (actionsProhibitingRefAndValue.includes(actionType)) {
      const hasRef = action.ref !== undefined && action.ref !== null && action.ref !== "";
      const hasValue = action.value !== undefined && action.value !== null && action.value !== "";
      if (hasRef || hasValue) {
        errors.push(`Action "${actionType}" should not have "ref" or "value" fields`);
      }
    }

    return errors;
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
    this.emit(WebAgentEventType.PAGE_NAVIGATION, { title, url });
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
   * Generate the next action to take based on current page state
   *
   * This is the core decision-making method that:
   * 1. Compresses the page snapshot to reduce token usage
   * 2. Updates the conversation with current page state
   * 3. Asks the LLM to decide what action to take next
   * 4. Validates the response and retries if needed
   *
   * @param pageSnapshot - Raw aria tree snapshot of the current page
   * @param retryCount - Number of validation retry attempts (for error handling)
   * @returns The validated action to execute
   */
  async generateNextAction(pageSnapshot: string, retryCount = 0): Promise<Action> {
    // Compress the page snapshot to reduce token usage while preserving essential information
    const compressedSnapshot = this.compressSnapshot(pageSnapshot);

    // Get current page info and update internal state for AI context
    const { title: pageTitle, url: pageUrl } = await this.refreshPageState();

    // Debug logging: show compression effectiveness
    if (this.DEBUG) {
      const originalSize = pageSnapshot.length;
      const compressedSize = compressedSnapshot.length;
      const compressionPercent = Math.round((1 - compressedSize / originalSize) * 100);
      this.emit(WebAgentEventType.DEBUG_COMPRESSION, {
        originalSize,
        compressedSize,
        compressionPercent,
      });
    }

    // Add the current page snapshot to the conversation for LLM context
    this.updateMessagesWithSnapshot(pageTitle, pageUrl, compressedSnapshot);

    // Debug logging: show full conversation history
    if (this.DEBUG) {
      this.emit(WebAgentEventType.DEBUG_MESSAGES, { messages: this.messages });
    }

    // Ask the LLM to analyze the page and decide on the next action
    const response = await this.withThinkingEvents("Planning next action", () =>
      this.generateAIResponse<Action>(actionSchema, undefined, this.messages),
    );

    // Validate the LLM response to ensure it's properly formatted and actionable
    const { isValid, errors, correctedResponse } = this.validateActionResponse(response);

    if (!isValid) {
      // Emit validation error event for logging
      this.emit(WebAgentEventType.VALIDATION_ERROR, {
        errors,
        retryCount,
        rawResponse: response,
      });

      if (retryCount >= 2) {
        throw new Error(
          `Failed to get valid response after ${
            retryCount + 1
          } attempts. Errors: ${errors.join(", ")}`,
        );
      }

      if (correctedResponse) {
        return correctedResponse;
      }

      this.addValidationErrorFeedback(errors, response);
      return this.generateNextAction(pageSnapshot, retryCount + 1);
    }

    return response;
  }

  /**
   * Centralized event emission with automatic timestamp injection
   *
   * Design decision: All events flow through this single method to ensure:
   * 1. Consistent timestamp injection for debugging and monitoring
   * 2. Type safety through WebAgentEventType enum
   * 3. Error isolation - logging failures don't crash the main task
   * 4. Single point of control for event filtering/debugging
   *
   * @param type - Event type from WebAgentEventType enum
   * @param data - Event-specific data (timestamp will be auto-injected)
   */
  protected emit(type: WebAgentEventType, data: Omit<any, "timestamp">) {
    try {
      this.eventEmitter.emitEvent({
        type,
        data: { timestamp: Date.now(), ...data },
      } as WebAgentEvent);
    } catch (error) {
      // Critical design decision: Never let logging errors crash the main task
      // The task execution is more important than perfect logging
      console.error("Failed to emit event:", error);
    }
  }

  /**
   * Helper to emit thinking start/end events around AI operations
   *
   * This wrapper ensures we always emit both start and end events, even if the AI operation
   * fails. This is important for UI consistency - users need to know when thinking has stopped.
   *
   * Design pattern: Using higher-order function to guarantee paired events
   *
   * @param operation - Human-readable description of what the AI is thinking about
   * @param task - The async AI operation to execute
   * @returns The result of the AI operation
   */
  protected async withThinkingEvents<T>(operation: string, task: () => Promise<T>): Promise<T> {
    this.emit(WebAgentEventType.THINKING, { status: "start", operation });
    try {
      const result = await task();
      this.emit(WebAgentEventType.THINKING, { status: "end", operation });
      return result;
    } catch (error) {
      // Critical: Always emit 'end' even on errors to prevent UI getting stuck in 'thinking' state
      this.emit(WebAgentEventType.THINKING, { status: "end", operation });
      throw error;
    }
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
  }

  /**
   * Centralized AI generation with consistent configuration
   */
  protected async generateAIResponse<T>(
    schema: any,
    prompt?: string,
    messages?: any[],
    retryCount = 0,
  ): Promise<T> {
    const config: any = {
      model: this.provider,
      schema,
      temperature: 0,
    };

    if (prompt) {
      config.prompt = prompt;
    } else if (messages) {
      config.messages = messages;
    }

    try {
      const response = await generateObject(config);
      return response.object as T;
    } catch (error) {
      // Handle AI generation failures with retry logic
      if (
        error instanceof Error &&
        (error.message.includes("response did not match schema") ||
          error.message.includes("AI_NoObjectGeneratedError") ||
          error.message.includes("No object generated"))
      ) {
        console.error(`AI response schema mismatch (attempt ${retryCount + 1}):`, error.message);

        // Log some debugging info on the first failure
        if (retryCount === 0 && this.DEBUG) {
          console.error("Debug info - Last few messages:");
          const lastMessages = messages ? messages.slice(-2) : [];
          console.error(JSON.stringify(lastMessages, null, 2));
        }

        if (retryCount < 2) {
          console.log("🔄 Retrying AI generation...");
          // Add a small delay before retry
          await new Promise((resolve) => setTimeout(resolve, 1000));
          return this.generateAIResponse<T>(schema, prompt, messages, retryCount + 1);
        } else {
          const errorMessage =
            `AI generation failed after ${retryCount + 1} attempts. This may be due to:\n` +
            `1. The AI response not matching the expected schema format\n` +
            `2. Network issues or AI service problems\n` +
            `3. Complex page content that confused the AI\n` +
            `Original error: ${error.message}`;
          throw new Error(errorMessage);
        }
      }

      // Re-throw other errors
      throw error;
    }
  }

  private truncateSnapshotsInMessages(messages: any[]): any[] {
    return messages.map((msg) => {
      if (msg.role === "user" && msg.content.includes("snapshot") && msg.content.includes("```")) {
        return {
          ...msg,
          content: msg.content.replace(/```[\s\S]*$/g, "```[snapshot clipped for length]```"),
        };
      }
      return msg;
    });
  }

  private updateMessagesWithSnapshot(pageTitle: string, pageUrl: string, snapshot: string) {
    // Clip old snapshots from existing messages
    this.messages = this.truncateSnapshotsInMessages(this.messages);

    this.messages.push({
      role: "user",
      content: buildPageSnapshotPrompt(pageTitle, pageUrl, snapshot),
    });
  }

  private addValidationErrorFeedback(errors: string[], response: any) {
    const hasGuardrails = !!this.guardrails;
    this.addAssistantMessage(response);
    this.addUserMessage(buildValidationFeedbackPrompt(errors.join("\n"), hasGuardrails));
  }

  /**
   * Broadcasts all details of the current action for logging/display
   */
  protected broadcastActionDetails(result: any) {
    this.emit(WebAgentEventType.CURRENT_STEP, { currentStep: result.currentStep });

    this.emit(WebAgentEventType.OBSERVATION, { observation: result.observation });
    this.emit(WebAgentEventType.STATUS_MESSAGE, { message: result.observationStatusMessage });

    // Only emit extractedData if it exists and has content
    if (result.extractedData && result.extractedData.trim()) {
      this.emit(WebAgentEventType.EXTRACTED_DATA, { extractedData: result.extractedData });
      if (result.extractedDataStatusMessage) {
        this.emit(WebAgentEventType.STATUS_MESSAGE, { message: result.extractedDataStatusMessage });
      }
    }

    this.emit(WebAgentEventType.THOUGHT, { thought: result.thought });

    this.emit(WebAgentEventType.ACTION_EXECUTION, {
      action: result.action.action,
      ref: result.action.ref || undefined,
      value: result.action.value || undefined,
    });
    if (result.actionStatusMessage) {
      this.emit(WebAgentEventType.STATUS_MESSAGE, { message: result.actionStatusMessage });
    }
  }

  private addTaskRetryFeedback(result: any, validationResult: TaskValidationResult) {
    this.addAssistantMessage(result);
    this.addUserMessage(
      `Task completion quality: ${validationResult.completionQuality}. ${validationResult.feedback} Please continue working on the task.`,
    );
  }

  protected async executeAction(result: any): Promise<boolean> {
    try {
      switch (result.action.action) {
        case "wait":
          const seconds = parseInt(result.action.value || "1", 10);
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

        case "done":
          // "done" actions are handled in the main loop, not here
          break;

        default:
          if (!result.action.ref) {
            throw new Error("Missing ref for action");
          }

          await this.browser.performAction(
            result.action.ref,
            result.action.action,
            result.action.value,
          );

          // Check if navigation occurred for actions that might navigate
          if (["click", "select"].includes(result.action.action)) {
            const { title: actionTitle, url: actionUrl } = await this.refreshPageState();

            if (actionUrl !== this.currentPage.url || actionTitle !== this.currentPage.title) {
              this.emitNavigationEvent(actionTitle, actionUrl);
            }
          }
      }
      return true;
    } catch (error) {
      this.emit(WebAgentEventType.ACTION_RESULT, {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  private recordActionResult(result: any, actionSuccess: boolean) {
    if (actionSuccess) {
      this.addAssistantMessage(result);
      this.emit(WebAgentEventType.ACTION_RESULT, { success: true });
    } else {
      this.addAssistantMessage(`Failed to execute action: ${result.action.action}`);
    }
  }

  // Helper function to wait for a specified number of seconds
  async wait(seconds: number) {
    this.emit(WebAgentEventType.WAITING, { seconds });

    return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
  }

  /**
   * Emits the task start event with all initial task information
   */
  private emitTaskStartEvent(task: string) {
    this.emit(WebAgentEventType.TASK_START, {
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
  }

  private formatConversationHistory(): string {
    // Clip snapshots for validation - we don't need massive page content for validation
    const clippedMessages = this.truncateSnapshotsInMessages(this.messages);

    return clippedMessages.map((msg) => `${msg.role}: ${msg.content}`).join("\n\n");
  }

  protected async validateTaskCompletion(
    task: string,
    finalAnswer: string,
  ): Promise<TaskValidationResult> {
    const conversationHistory = this.formatConversationHistory();

    const response = await this.withThinkingEvents("Validating task completion", () =>
      this.generateAIResponse<TaskValidationResult>(
        taskValidationSchema,
        buildTaskValidationPrompt(task, finalAnswer, conversationHistory),
      ),
    );

    this.emit(WebAgentEventType.TASK_VALIDATION, {
      observation: response.observation,
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
   *
   * @param task - Natural language description of what to accomplish
   * @param startingUrl - Optional URL to begin from (if not provided, AI will choose)
   * @param data - Optional contextual data to reference during task execution
   * @returns Complete execution results including success status and metrics
   */
  async execute(task: string, startingUrl?: string, data?: any): Promise<TaskExecutionResult> {
    if (!task) {
      throw new Error("No task provided.");
    }

    // === SETUP PHASE ===
    // Reset any previous task state to ensure clean execution
    this.resetState();

    // Store contextual data for use in prompts (optional)
    if (data) {
      this.data = data;
    }

    // === PLANNING PHASE ===
    // Generate task plan and determine starting URL
    if (startingUrl) {
      this.url = startingUrl;
      // Run browser launch and plan creation in parallel for efficiency
      await Promise.all([this.generatePlan(task, startingUrl), this.browser.start()]);
    } else {
      // Let AI choose the best starting URL based on the task
      await Promise.all([this.generatePlanWithUrl(task), this.browser.start()]);
    }

    // === NAVIGATION PHASE ===
    // Emit task start event for logging
    this.emitTaskStartEvent(task);

    // Navigate to the determined starting URL
    await this.browser.goto(this.url);

    // Record initial page load for tracking
    await this.refreshAndRecordNavigation();

    // Setup messages
    this.initializeConversation(task);
    let finalAnswer = null;
    let validationAttempts = 0;
    let currentIteration = 0;
    let lastValidationResult: TaskValidationResult | undefined;

    // === EXECUTION PHASE ===
    // Main execution loop - continues until one of these exit conditions:
    // 1. Task successfully completed ("done" action + successful validation)
    // 2. Max validation attempts reached (task marked done but validation keeps failing)
    // 3. Max iterations reached (safety mechanism to prevent infinite loops)
    while (true) {
      // Safety check: prevent infinite loops
      currentIteration++;
      if (currentIteration > this.maxIterations) {
        break; // Exit: hit iteration limit
      }

      // Get current page state and ask AI what to do next
      const pageSnapshot = await this.browser.getText();
      const result = await this.generateNextAction(pageSnapshot);

      // Broadcast the AI's reasoning and planned action for logging
      this.broadcastActionDetails(result);

      // === TASK COMPLETION HANDLING ===
      // If AI says task is done, validate the completion quality
      if (result.action.action === "done") {
        finalAnswer = result.action.value!; // validateActionResponse ensures this exists
        const validationResult = await this.validateTaskCompletion(task, finalAnswer);
        lastValidationResult = validationResult;
        validationAttempts++;

        // Check if validation shows successful completion
        if (SUCCESS_QUALITIES.includes(validationResult.completionQuality as any)) {
          this.emit(WebAgentEventType.TASK_COMPLETE, { finalAnswer });
          break; // Exit: task completed successfully
        } else {
          // Task marked as done but validation failed
          if (validationAttempts >= this.maxValidationAttempts) {
            break; // Exit: max validation attempts reached, give up
          }

          // Give AI feedback about what went wrong and try again
          this.addTaskRetryFeedback(result, validationResult);
          finalAnswer = null; // Reset for next attempt
          continue; // Continue loop for retry
        }
      }

      // === ACTION EXECUTION ===
      // Execute the action on the browser (click, fill, navigate, etc.)
      const actionSuccess = await this.executeAction(result);

      // Add the action result to conversation history for AI context
      this.recordActionResult(result, actionSuccess);
    }

    // Determine success: task completed and validation result shows success
    const success = lastValidationResult
      ? SUCCESS_QUALITIES.includes(lastValidationResult.completionQuality as any)
      : false;

    return {
      success,
      finalAnswer: finalAnswer || "Task did not complete",
      plan: this.plan,
      taskExplanation: this.taskExplanation,
      validationResult: lastValidationResult,
      iterations: currentIteration,
      validationAttempts,
    };
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
      .filter((line) => !this.FILTERED_PREFIXES.some((start) => line.startsWith(start))) // Remove noise
      .map((line) => {
        // === STEP 2: Apply semantic transformations ===
        // Convert verbose aria descriptions to concise equivalents for better LLM understanding
        return this.ARIA_TRANSFORMATIONS.reduce(
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

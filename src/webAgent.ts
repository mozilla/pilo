import { generateObject, LanguageModel } from "ai";
import { openai } from "@ai-sdk/openai";
import {
  buildActionLoopPrompt,
  buildPlanPrompt,
  buildPlanAndUrlPrompt,
  buildTaskAndPlanPrompt,
  buildPageSnapshotPrompt,
  buildValidationFeedbackPrompt,
  buildTaskValidationPrompt,
} from "./prompts.js";
import { AriaBrowser, LoadState, PageAction } from "./browser/ariaBrowser.js";
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

// Task completion quality constants
const COMPLETION_QUALITY = {
  FAILED: "failed",
  PARTIAL: "partial",
  COMPLETE: "complete",
  EXCELLENT: "excellent",
} as const;

// Success values are COMPLETE and EXCELLENT
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

  /** AI Provider to use for LLM requests (defaults to openai("gpt-4.1-nano")) */
  provider?: LanguageModel;

  /** Optional guardrails to limit what the agent can do */
  guardrails?: string;

  /** Maximum validation attempts when task completion quality is insufficient (defaults to 3) */
  maxValidationAttempts?: number;

  /** Maximum total iterations to prevent infinite loops (defaults to 50) */
  maxIterations?: number;
}

export class WebAgent {
  private plan: string = "";
  private url: string = "";
  private messages: any[] = [];
  private provider: LanguageModel;
  private DEBUG = false;
  private taskExplanation: string = "";
  private data: any = null;
  private guardrails: string | null = null;
  private maxValidationAttempts: number;
  private maxIterations: number;
  private readonly FILTERED_PREFIXES = ["/url:"];
  private readonly ARIA_TRANSFORMATIONS: Array<[RegExp, string]> = [
    [/^listitem/g, "li"],
    [/(?<=\[)ref=/g, ""],
    [/^link/g, "a"],
    [/^text: (.*?)$/g, '"$1"'],
    [/^heading "([^"]+)" \[level=(\d+)\]/g, 'h$2 "$1"'],
  ];
  private eventEmitter: WebAgentEventEmitter;
  private logger: Logger;
  private currentPage: { url: string; title: string } = { url: "", title: "" };

  // Regex patterns for aria ref validation
  private readonly ARIA_REF_REGEX = /^s\d+e\d+$/;
  private readonly ARIA_REF_EXTRACT_REGEX = /\b(s\d+e\d+)\b/;

  constructor(
    private browser: AriaBrowser,
    options: WebAgentOptions = {},
  ) {
    this.DEBUG = options.debug || false;
    this.provider = options.provider || openai("gpt-4.1");
    this.eventEmitter = new WebAgentEventEmitter();
    this.logger = options.logger || new ConsoleLogger();
    this.logger.initialize(this.eventEmitter);
    this.guardrails = options.guardrails || null;
    this.maxValidationAttempts = options.maxValidationAttempts || 3;
    this.maxIterations = options.maxIterations || 50;
  }

  async generatePlanWithUrl(task: string) {
    const response = await this.generateAIResponse<{
      explanation: string;
      plan: string;
      url: string;
    }>(planAndUrlSchema, buildPlanAndUrlPrompt(task, this.guardrails));

    this.taskExplanation = response.explanation;
    this.plan = response.plan;
    this.url = response.url;

    return { plan: this.plan, url: this.url };
  }

  async generatePlan(task: string, startingUrl?: string) {
    const response = await this.generateAIResponse<{
      explanation: string;
      plan: string;
    }>(planSchema, buildPlanPrompt(task, startingUrl, this.guardrails));

    this.taskExplanation = response.explanation;
    this.plan = response.plan;

    return { plan: this.plan };
  }

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
    this.validateRequiredStringField(response, "thought", errors);

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

  /**
   * Updates internal page state only (no side effects)
   */
  private updatePageState(title: string, url: string): void {
    this.currentPage = { url, title };
  }

  /**
   * Emits navigation event for logging/display
   */
  private emitNavigationEvent(title: string, url: string): void {
    this.emit(WebAgentEventType.PAGE_NAVIGATION, { title, url });
  }

  /**
   * Records actual navigation (state + event)
   */
  private recordNavigation(title: string, url: string): void {
    this.updatePageState(title, url);
    this.emitNavigationEvent(title, url);
  }

  /**
   * Fetches current page info and updates internal state
   */
  private async refreshPageState(): Promise<{ title: string; url: string }> {
    const [title, url] = await Promise.all([this.browser.getTitle(), this.browser.getUrl()]);
    this.updatePageState(title, url);
    return { title, url };
  }

  /**
   * Fetches current page info and records navigation
   */
  private async refreshAndRecordNavigation(): Promise<void> {
    const { title, url } = await this.refreshPageState();
    this.emitNavigationEvent(title, url);
  }

  async generateNextAction(pageSnapshot: string, retryCount = 0): Promise<Action> {
    const compressedSnapshot = this.compressSnapshot(pageSnapshot);

    // Get current page info and update state for AI context
    const { title: pageTitle, url: pageUrl } = await this.refreshPageState();

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

    // Update AI messages with new snapshot
    this.updateMessagesWithSnapshot(pageTitle, pageUrl, compressedSnapshot);

    if (this.DEBUG) {
      this.emit(WebAgentEventType.DEBUG_MESSAGES, { messages: this.messages });
    }

    const response = await this.withThinkingEvents("Planning next action", () =>
      this.generateAIResponse<Action>(actionSchema, undefined, this.messages),
    );

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
   * Provides type safety and consistent event structure
   */
  protected emit(type: WebAgentEventType, data: Omit<any, "timestamp">) {
    try {
      this.eventEmitter.emitEvent({
        type,
        data: { timestamp: Date.now(), ...data },
      } as WebAgentEvent);
    } catch (error) {
      // Prevent logging errors from crashing the agent
      console.error("Failed to emit event:", error);
    }
  }

  /**
   * Helper to emit thinking start/end events around AI operations
   */
  protected async withThinkingEvents<T>(operation: string, task: () => Promise<T>): Promise<T> {
    this.emit(WebAgentEventType.THINKING, { status: "start", operation });
    try {
      const result = await task();
      this.emit(WebAgentEventType.THINKING, { status: "end", operation });
      return result;
    } catch (error) {
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

    const response = await generateObject(config);
    return response.object as T;
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
    this.emit(WebAgentEventType.EXTRACTED_DATA, { extractedData: result.extractedData || "" });
    this.emit(WebAgentEventType.THOUGHT, { thought: result.thought });
    this.emit(WebAgentEventType.ACTION_EXECUTION, {
      action: result.action.action,
      ref: result.action.ref || undefined,
      value: result.action.value || undefined,
    });
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

  async execute(task: string, startingUrl?: string, data?: any): Promise<TaskExecutionResult> {
    if (!task) {
      throw new Error("No task provided.");
    }

    // Reset state for new task
    this.resetState();

    // Store the data if provided
    if (data) {
      this.data = data;
    }

    // If a starting URL is provided, use it directly
    if (startingUrl) {
      this.url = startingUrl;
      // Run browser launch and plan creation concurrently
      await Promise.all([this.generatePlan(task, startingUrl), this.browser.start()]);
    } else {
      // Run plan creation and browser launch concurrently
      await Promise.all([this.generatePlanWithUrl(task), this.browser.start()]);
    }

    // Emit task start event
    this.emitTaskStartEvent(task);

    // Go to the starting URL
    await this.browser.goto(this.url);

    // Record initial navigation event
    await this.refreshAndRecordNavigation();

    // Setup messages
    this.initializeConversation(task);
    let finalAnswer = null;
    let validationAttempts = 0;
    let currentIteration = 0;
    let lastValidationResult: TaskValidationResult | undefined;

    // Main execution loop - continues until one of these conditions:
    // 1. Task successfully completed
    // 2. Max validation attempts reached
    // 3. Max iterations reached (prevents infinite loops)
    while (true) {
      // Check iteration limit
      currentIteration++;
      if (currentIteration > this.maxIterations) {
        break; // Exit: hit iteration limit
      }

      // Get current page state and generate next action
      const pageSnapshot = await this.browser.getText();
      const result = await this.generateNextAction(pageSnapshot);

      // Emit all the step events
      this.broadcastActionDetails(result);

      // Handle "done" action - check if task is complete
      if (result.action.action === "done") {
        finalAnswer = result.action.value!; // validateActionResponse ensures this exists
        const validationResult = await this.validateTaskCompletion(task, finalAnswer);
        lastValidationResult = validationResult;
        validationAttempts++;

        if (SUCCESS_QUALITIES.includes(validationResult.completionQuality as any)) {
          this.emit(WebAgentEventType.TASK_COMPLETE, { finalAnswer });
          break; // Exit: task completed successfully
        } else {
          // Validation failed
          if (validationAttempts >= this.maxValidationAttempts) {
            break; // Exit: max validation attempts reached
          }

          // Add feedback and try again
          this.addTaskRetryFeedback(result, validationResult);
          finalAnswer = null; // Reset for next attempt
          continue; // Continue loop for retry
        }
      }

      // Execute the action (not "done")
      const actionSuccess = await this.executeAction(result);

      // Add result to conversation history
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
   */
  protected compressSnapshot(snapshot: string): string {
    // First apply all our normal transformations
    const transformed = snapshot
      .split("\n")
      .map((line) => line.trim())
      .map((line) => line.replace(/^- /, ""))
      .filter((line) => !this.FILTERED_PREFIXES.some((start) => line.startsWith(start)))
      .map((line) => {
        return this.ARIA_TRANSFORMATIONS.reduce(
          (processed, [pattern, replacement]) => processed.replace(pattern, replacement),
          line,
        );
      })
      .filter(Boolean);

    // Then deduplicate repeated text strings by checking previous line
    let lastQuotedText = "";
    const deduped = transformed.map((line) => {
      const match = line.match(/^([^"]*)"([^"]+)"(.*)$/);
      if (!match) return line;

      const [, prefix, quotedText, suffix] = match;
      if (quotedText === lastQuotedText) {
        return `${prefix}[same as above]${suffix}`;
      }

      lastQuotedText = quotedText;
      return line;
    });

    return deduped.join("\n");
  }
}

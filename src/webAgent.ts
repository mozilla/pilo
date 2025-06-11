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
import { AriaBrowser, LoadState } from "./browser/ariaBrowser.js";
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

  async createPlanAndUrl(task: string) {
    const response = await generateObject({
      model: this.provider,
      schema: planAndUrlSchema,
      prompt: buildPlanAndUrlPrompt(task, this.guardrails),
      temperature: 0,
    });

    this.taskExplanation = response.object.explanation;
    this.plan = response.object.plan;
    this.url = response.object.url;

    return { plan: this.plan, url: this.url };
  }

  async createPlan(task: string, startingUrl?: string) {
    const response = await generateObject({
      model: this.provider,
      schema: planSchema,
      prompt: buildPlanPrompt(task, startingUrl, this.guardrails),
      temperature: 0,
    });

    this.taskExplanation = response.object.explanation;
    this.plan = response.object.plan;

    return { plan: this.plan };
  }

  setupMessages(task: string) {
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

  private validateAriaRef(ref: string): {
    isValid: boolean;
    error?: string;
    correctedRef?: string;
  } {
    if (!ref) {
      return { isValid: false, error: "Aria ref is required" };
    }

    // First check if it's already in the correct format
    if (this.ARIA_REF_REGEX.test(ref)) {
      return { isValid: true };
    }

    // Try to extract a valid ref from the input
    const match = ref.match(this.ARIA_REF_EXTRACT_REGEX);
    if (match?.[1]) {
      return { isValid: true, correctedRef: match[1] };
    }

    return {
      isValid: false,
      error: `Invalid aria ref format. Expected format: s<number>e<number> (e.g., s1e23). Got: ${ref}`,
    };
  }

  private validateActionResponse(response: any): {
    isValid: boolean;
    errors: string[];
    correctedResponse?: any;
  } {
    const errors: string[] = [];
    const correctedResponse = { ...response };

    // Validate top-level fields
    if (!response.currentStep?.trim()) {
      errors.push('Missing or invalid "currentStep" field');
    }
    if (!response.observation?.trim()) {
      errors.push('Missing or invalid "observation" field');
    }
    if (!response.thought?.trim()) {
      errors.push('Missing or invalid "thought" field');
    }
    if (!response.extractedData?.trim()) {
      errors.push('Missing or invalid "extractedData" field');
    }
    if (!response.action || typeof response.action !== "object") {
      errors.push('Missing or invalid "action" field');
      return { isValid: false, errors };
    }

    // Validate action object
    const { action } = response;
    if (!action.action?.trim()) {
      errors.push('Missing or invalid "action.action" field');
    }

    // Validate action-specific requirements
    switch (action.action) {
      case "select":
      case "fill":
      case "click":
      case "hover":
      case "check":
      case "uncheck":
        if (!action.ref) {
          errors.push(`Missing required "ref" field for ${action.action} action`);
        } else {
          const { isValid, error, correctedRef } = this.validateAriaRef(action.ref);
          if (!isValid && error) {
            errors.push(error);
          } else if (correctedRef) {
            correctedResponse.action.ref = correctedRef;
          }
        }
        if ((action.action === "fill" || action.action === "select") && !action.value?.trim()) {
          errors.push(`Missing required "value" field for ${action.action} action`);
        }
        break;
      case "wait":
        if (!action.value || isNaN(Number(action.value))) {
          errors.push('Missing or invalid "value" field for wait action (must be a number)');
        }
        break;
      case "done":
        if (!action.value?.trim()) {
          errors.push('Missing required "value" field for done action');
        }
        break;
      case "goto":
        if (!action.value?.trim()) {
          errors.push('Missing required "value" field for goto action');
        }
        break;
      case "back":
      case "forward":
        if (action.ref || action.value) {
          errors.push(`${action.action} action should not have ref or value fields`);
        }
        break;
    }

    return {
      isValid: errors.length === 0,
      errors,
      correctedResponse: errors.length === 0 ? correctedResponse : undefined,
    };
  }

  /**
   * Captures the current page state but doesn't emit navigation events
   * Only used when taking snapshots for AI processing
   */
  private capturePageState(newTitle: string, newUrl: string): void {
    this.currentPage = { url: newUrl, title: newTitle };
  }

  /**
   * Records a true navigation event (explicitly called only when we know navigation has occurred)
   * This emits the navigation event for logging/display purposes
   */
  private recordNavigationEvent(title: string, url: string): void {
    this.emit(WebAgentEventType.PAGE_NAVIGATION, { title, url });
    this.currentPage = { url, title };
  }

  async getNextActions(pageSnapshot: string, retryCount = 0): Promise<Action> {
    const compressedSnapshot = this.compressSnapshot(pageSnapshot);

    // Get current page info
    const [pageTitle, pageUrl] = await Promise.all([
      this.browser.getTitle(),
      this.browser.getUrl(),
    ]);

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

    // Silently update our page state without emitting navigation events
    // (This is just taking a snapshot, not navigating)
    this.capturePageState(pageTitle, pageUrl);

    // Update AI messages with new snapshot
    this.updateMessagesWithSnapshot(pageTitle, pageUrl, compressedSnapshot);

    if (this.DEBUG) {
      this.emit(WebAgentEventType.DEBUG_MESSAGES, { messages: this.messages });
    }

    this.emit(WebAgentEventType.THINKING, { status: "start", operation: "Planning next action" });
    const response = await generateObject({
      model: this.provider,
      schema: actionSchema,
      messages: this.messages,
      temperature: 0,
    });
    this.emit(WebAgentEventType.THINKING, { status: "end", operation: "Planning next action" });

    const { isValid, errors, correctedResponse } = this.validateActionResponse(response.object);

    if (!isValid) {
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

      this.addValidationFeedback(errors, response.object);
      return this.getNextActions(pageSnapshot, retryCount + 1);
    }

    return response.object;
  }

  /**
   * Centralized event emission with automatic timestamp injection
   * Provides type safety and consistent event structure
   */
  private emit(type: WebAgentEventType, data: Omit<any, "timestamp">) {
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

  private clipSnapshotsFromMessages(messages: any[]): any[] {
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
    this.messages = this.clipSnapshotsFromMessages(this.messages);

    this.messages.push({
      role: "user",
      content: buildPageSnapshotPrompt(pageTitle, pageUrl, snapshot),
    });
  }

  private addValidationFeedback(errors: string[], response: any) {
    const hasGuardrails = !!this.guardrails;
    this.messages.push({
      role: "assistant",
      content: JSON.stringify(response),
    });
    this.messages.push({
      role: "user",
      content: buildValidationFeedbackPrompt(errors.join("\n"), hasGuardrails),
    });
  }

  /**
   * Emits all step-related events for the current AI reasoning cycle
   */
  private emitStepEvents(result: any) {
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

  private addTaskValidationFeedback(result: any, validationResult: TaskValidationResult) {
    this.messages.push({
      role: "assistant",
      content: JSON.stringify(result),
    });
    this.messages.push({
      role: "user",
      content: `Task completion quality: ${validationResult.completionQuality}. ${validationResult.feedback} Please continue working on the task.`,
    });
  }

  private async executeAction(result: any): Promise<boolean> {
    try {
      switch (result.action.action) {
        case "wait":
          const seconds = parseInt(result.action.value || "1", 10);
          await this.wait(seconds);
          break;

        case "goto":
          if (result.action.value) {
            await this.browser.goto(result.action.value);
            const [navTitle, navUrl] = await Promise.all([
              this.browser.getTitle(),
              this.browser.getUrl(),
            ]);
            this.recordNavigationEvent(navTitle, navUrl);
          } else {
            throw new Error("Missing URL for goto action");
          }
          break;

        case "back":
          await this.browser.goBack();
          const [backTitle, backUrl] = await Promise.all([
            this.browser.getTitle(),
            this.browser.getUrl(),
          ]);
          this.recordNavigationEvent(backTitle, backUrl);
          break;

        case "forward":
          await this.browser.goForward();
          const [fwdTitle, fwdUrl] = await Promise.all([
            this.browser.getTitle(),
            this.browser.getUrl(),
          ]);
          this.recordNavigationEvent(fwdTitle, fwdUrl);
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
            const [actionTitle, actionUrl] = await Promise.all([
              this.browser.getTitle(),
              this.browser.getUrl(),
            ]);

            if (actionUrl !== this.currentPage.url || actionTitle !== this.currentPage.title) {
              this.recordNavigationEvent(actionTitle, actionUrl);
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

  private addActionToHistory(result: any, actionSuccess: boolean) {
    if (actionSuccess) {
      this.messages.push({
        role: "assistant",
        content: JSON.stringify(result),
      });

      this.emit(WebAgentEventType.ACTION_RESULT, { success: true });
    } else {
      this.messages.push({
        role: "assistant",
        content: `Failed to execute action: ${result.action.action}`,
      });
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
    const clippedMessages = this.clipSnapshotsFromMessages(this.messages);

    return clippedMessages.map((msg) => `${msg.role}: ${msg.content}`).join("\n\n");
  }

  private async validateTaskCompletion(
    task: string,
    finalAnswer: string,
  ): Promise<TaskValidationResult> {
    const conversationHistory = this.formatConversationHistory();

    this.emit(WebAgentEventType.THINKING, {
      status: "start",
      operation: "Validating task completion",
    });
    const response = await generateObject({
      model: this.provider,
      schema: taskValidationSchema,
      prompt: buildTaskValidationPrompt(task, finalAnswer, conversationHistory),
      temperature: 0,
    });
    this.emit(WebAgentEventType.THINKING, {
      status: "end",
      operation: "Validating task completion",
    });

    this.emit(WebAgentEventType.TASK_VALIDATION, {
      observation: response.object.observation,
      completionQuality: response.object.completionQuality,
      feedback: response.object.feedback,
      finalAnswer,
    });

    return response.object;
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
      await Promise.all([this.createPlan(task, startingUrl), this.browser.start()]);
    } else {
      // Run plan creation and browser launch concurrently
      await Promise.all([this.createPlanAndUrl(task), this.browser.start()]);
    }

    // Emit task start event
    this.emitTaskStartEvent(task);

    // Go to the starting URL
    await this.browser.goto(this.url);

    // Get page info after navigation
    const [pageTitle, pageUrl] = await Promise.all([
      this.browser.getTitle(),
      this.browser.getUrl(),
    ]);

    // Record initial navigation event
    this.recordNavigationEvent(pageTitle, pageUrl);

    // Setup messages
    this.setupMessages(task);
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
      const result = await this.getNextActions(pageSnapshot);

      // Emit all the step events
      this.emitStepEvents(result);

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
          this.addTaskValidationFeedback(result, validationResult);
          finalAnswer = null; // Reset for next attempt
          continue; // Continue loop for retry
        }
      }

      // Execute the action (not "done")
      const actionSuccess = await this.executeAction(result);

      // Add result to conversation history
      this.addActionToHistory(result, actionSuccess);
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
  private compressSnapshot(snapshot: string): string {
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

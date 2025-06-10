import { generateObject, LanguageModel } from "ai";
import { openai } from "@ai-sdk/openai";
import {
  actionLoopPrompt,
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
import { WebAgentEventEmitter, WebAgentEventType } from "./events.js";
import { Logger, ConsoleLogger } from "./loggers.js";

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
}

export class WebAgent {
  private plan: string = "";
  private url: string = "";
  private messages: any[] = [];
  private provider: LanguageModel;
  private DEBUG = false;
  private taskExplanation: string = "";
  private data: any = null;
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
  }

  async createPlanAndUrl(task: string) {
    const response = await generateObject({
      model: this.provider,
      schema: planAndUrlSchema,
      prompt: buildPlanAndUrlPrompt(task),
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
      prompt: buildPlanPrompt(task, startingUrl),
      temperature: 0,
    });

    this.taskExplanation = response.object.explanation;
    this.plan = response.object.plan;

    return { plan: this.plan };
  }

  setupMessages(task: string) {
    this.messages = [
      {
        role: "system",
        content: actionLoopPrompt,
      },
      {
        role: "user",
        content: buildTaskAndPlanPrompt(task, this.taskExplanation, this.plan, this.data),
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
    // Always silently update our tracking state
    this.currentPage = { url: newUrl, title: newTitle };
  }

  /**
   * Records a true navigation event (explicitly called only when we know navigation has occurred)
   * This emits the navigation event for logging/display purposes
   */
  private recordNavigationEvent(title: string, url: string): void {
    console.debug(`📄 Navigation occurred to: ${url}`);
    this.eventEmitter.emitEvent({
      type: WebAgentEventType.PAGE_NAVIGATION,
      data: { timestamp: Date.now(), title, url },
    });

    // Update our tracking state
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
      this.logCompressionStats(pageSnapshot, compressedSnapshot);
    }

    // Silently update our page state without emitting navigation events
    // (This is just taking a snapshot, not navigating)
    this.capturePageState(pageTitle, pageUrl);

    // Update AI messages with new snapshot
    this.updateMessagesWithSnapshot(pageTitle, pageUrl, compressedSnapshot);

    if (this.DEBUG) {
      this.emitDebugMessages();
    }

    const response = await generateObject({
      model: this.provider,
      schema: actionSchema,
      messages: this.messages,
      temperature: 0,
    });

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

  private logCompressionStats(original: string, compressed: string) {
    const originalSize = original.length;
    const compressedSize = compressed.length;
    const compressionPercent = Math.round((1 - compressedSize / originalSize) * 100);

    this.eventEmitter.emitEvent({
      type: WebAgentEventType.DEBUG_COMPRESSION,
      data: {
        timestamp: Date.now(),
        originalSize,
        compressedSize,
        compressionPercent,
      },
    });
  }

  private updateMessagesWithSnapshot(pageTitle: string, pageUrl: string, snapshot: string) {
    this.messages.forEach((msg: any) => {
      if (msg.role === "user" && msg.content.includes("snapshot") && msg.content.includes("```")) {
        msg.content = msg.content.replace(/```[\s\S]*$/g, "```[snapshot clipped for length]```");
      }
    });

    this.messages.push({
      role: "user",
      content: buildPageSnapshotPrompt(pageTitle, pageUrl, snapshot),
    });
  }

  private emitDebugMessages() {
    this.eventEmitter.emitEvent({
      type: WebAgentEventType.DEBUG_MESSAGES,
      data: { timestamp: Date.now(), messages: this.messages },
    });
  }

  private addValidationFeedback(errors: string[], response: any) {
    this.messages.push({
      role: "assistant",
      content: JSON.stringify(response),
    });
    this.messages.push({
      role: "user",
      content: buildValidationFeedbackPrompt(errors.join("\n")),
    });
  }

  // Helper function to wait for a specified number of seconds
  async wait(seconds: number) {
    this.eventEmitter.emitEvent({
      type: WebAgentEventType.WAITING,
      data: {
        timestamp: Date.now(),
        seconds,
      },
    });

    return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
  }

  emitTaskStartEvent(task: string) {
    this.eventEmitter.emitEvent({
      type: WebAgentEventType.TASK_START,
      data: {
        timestamp: Date.now(),
        task,
        explanation: this.taskExplanation,
        plan: this.plan,
        url: this.url,
      },
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

  private async validateTaskCompletion(
    task: string,
    finalAnswer: string,
  ): Promise<TaskValidationResult> {
    const response = await generateObject({
      model: this.provider,
      schema: taskValidationSchema,
      prompt: buildTaskValidationPrompt(task, finalAnswer),
      temperature: 0,
    });

    // Emit validation event
    this.eventEmitter.emitEvent({
      type: WebAgentEventType.TASK_VALIDATION,
      data: {
        timestamp: Date.now(),
        isValid: response.object.isValid,
        feedback: response.object.feedback,
        finalAnswer,
      },
    });

    return response.object;
  }

  async execute(task: string, startingUrl?: string, data?: any) {
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
    let lastValidationFeedback = "";

    // Start the loop
    while (!finalAnswer && validationAttempts < 3) {
      // Get the page snapshot directly from the browser
      const pageSnapshot = await this.browser.getText();

      // Call LLM with the page snapshot
      const result = await this.getNextActions(pageSnapshot);

      // Emit observation and thought events
      this.eventEmitter.emitEvent({
        type: WebAgentEventType.CURRENT_STEP,
        data: {
          timestamp: Date.now(),
          currentStep: result.currentStep,
        },
      });

      this.eventEmitter.emitEvent({
        type: WebAgentEventType.OBSERVATION,
        data: {
          timestamp: Date.now(),
          observation: result.observation,
        },
      });

      this.eventEmitter.emitEvent({
        type: WebAgentEventType.EXTRACTED_DATA,
        data: {
          timestamp: Date.now(),
          extractedData: result.extractedData || "",
        },
      });

      this.eventEmitter.emitEvent({
        type: WebAgentEventType.THOUGHT,
        data: {
          timestamp: Date.now(),
          thought: result.thought,
        },
      });

      // Emit action execution event
      this.eventEmitter.emitEvent({
        type: WebAgentEventType.ACTION_EXECUTION,
        data: {
          timestamp: Date.now(),
          action: result.action.action,
          ref: result.action.ref || undefined,
          value: result.action.value || undefined,
        },
      });

      // Check for the final answer
      if (result.action.action === "done") {
        finalAnswer = result.action.value;

        if (!finalAnswer) {
          throw new Error("Missing final answer value in done action");
        }

        // Validate the task completion
        const { isValid, feedback } = await this.validateTaskCompletion(task, finalAnswer);

        if (isValid) {
          // Emit task complete event
          this.eventEmitter.emitEvent({
            type: WebAgentEventType.TASK_COMPLETE,
            data: {
              timestamp: Date.now(),
              finalAnswer,
            },
          });
          break;
        } else {
          validationAttempts++;
          lastValidationFeedback = feedback || "Unknown validation error";

          if (validationAttempts < 3) {
            // Reset finalAnswer so the loop continues
            finalAnswer = null;

            // Add validation feedback to messages
            this.messages.push({
              role: "assistant",
              content: JSON.stringify(result),
            });
            this.messages.push({
              role: "user",
              content: `Task not completed successfully. ${feedback} Please continue working on the task.`,
            });
            continue;
          }

          throw new Error(
            `Failed to complete task after ${validationAttempts} attempts. Last feedback: ${lastValidationFeedback}`,
          );
        }
      }

      try {
        switch (result.action.action) {
          case "wait":
            const seconds = parseInt(result.action.value || "1", 10);
            await this.wait(seconds);
            break;

          case "goto":
            if (result.action.value) {
              await this.browser.goto(result.action.value);

              // After navigation, record the navigation event
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

            // After navigation, record the navigation event
            const [backTitle, backUrl] = await Promise.all([
              this.browser.getTitle(),
              this.browser.getUrl(),
            ]);
            this.recordNavigationEvent(backTitle, backUrl);
            break;

          case "forward":
            await this.browser.goForward();

            // After navigation, record the navigation event
            const [fwdTitle, fwdUrl] = await Promise.all([
              this.browser.getTitle(),
              this.browser.getUrl(),
            ]);
            this.recordNavigationEvent(fwdTitle, fwdUrl);
            break;

          default:
            if (!result.action.ref) {
              throw new Error("Missing ref for action");
            }

            // Perform the action (which might cause navigation)
            await this.browser.performAction(
              result.action.ref,
              result.action.action,
              result.action.value,
            );

            // For actions that potentially cause navigation (click, select),
            // check if navigation occurred by comparing current URL/title with previous
            if (["click", "select"].includes(result.action.action)) {
              const [actionTitle, actionUrl] = await Promise.all([
                this.browser.getTitle(),
                this.browser.getUrl(),
              ]);

              // Only record navigation if URL or title changed
              if (actionUrl !== this.currentPage.url || actionTitle !== this.currentPage.title) {
                this.recordNavigationEvent(actionTitle, actionUrl);
              }
            }
        }

        // Add the successful result to messages for context
        this.messages.push({
          role: "assistant",
          content: JSON.stringify(result),
        });

        // Emit action result event (success)
        this.eventEmitter.emitEvent({
          type: WebAgentEventType.ACTION_RESULT,
          data: {
            timestamp: Date.now(),
            success: true,
          },
        });
      } catch (error) {
        // Emit action result event (failure)
        this.eventEmitter.emitEvent({
          type: WebAgentEventType.ACTION_RESULT,
          data: {
            timestamp: Date.now(),
            success: false,
            error: error instanceof Error ? error.message : String(error),
          },
        });

        // Add the failure to the messages for context
        this.messages.push({
          role: "assistant",
          content: `Failed to execute action: ${
            error instanceof Error ? error.message : String(error)
          }`,
        });
      }
    }

    return finalAnswer;
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

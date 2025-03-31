import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import {
  actionLoopPrompt,
  buildPlanPrompt,
  buildTaskAndPlanPrompt,
  buildPageSnapshotPrompt,
} from "./prompts.js";
import { AriaBrowser } from "./browser/ariaBrowser.js";
import { planSchema, actionSchema } from "./schemas.js";
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

  /** Model to use for LLM requests (defaults to "gpt-4o") */
  model?: string;
}

export class WebAgent {
  private plan: string = "";
  private url: string = "";
  private messages: any[] = [];
  private llm;
  private DEBUG = false;
  private taskExplanation: string = "";
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

  /**
   * Create a new WebAgent
   *
   * @param browser Browser instance to use for automation
   * @param options Options for configuring the agent
   */
  constructor(private browser: AriaBrowser, options: WebAgentOptions = {}) {
    this.DEBUG = options.debug || false;
    this.llm = openai(options.model || "gpt-4o");
    this.eventEmitter = new WebAgentEventEmitter();
    this.logger = options.logger || new ConsoleLogger();
    this.logger.initialize(this.eventEmitter);
  }

  async createPlan(task: string) {
    const response = await generateObject({
      model: this.llm,
      schema: planSchema,
      prompt: buildPlanPrompt(task),
      temperature: 0,
    });

    this.taskExplanation = response.object.explanation;
    this.plan = response.object.plan;
    this.url = response.object.url;

    return { plan: this.plan, url: this.url };
  }

  setupMessages(task: string) {
    this.messages = [
      {
        role: "system",
        content: actionLoopPrompt,
      },
      {
        role: "user",
        content: buildTaskAndPlanPrompt(task, this.taskExplanation, this.plan),
      },
    ];
    return this.messages;
  }

  async getNextActions(pageSnapshot: string) {
    // Compress the snapshot before using it
    const compressedSnapshot = this.compressSnapshot(pageSnapshot);

    // Get current page title and URL
    const [title, url] = await Promise.all([
      this.browser.getTitle(),
      this.browser.getUrl(),
    ]);

    if (this.DEBUG) {
      const originalSize = pageSnapshot.length;
      const compressedSize = compressedSnapshot.length;
      const compressionPercent = Math.round(
        (1 - compressedSize / originalSize) * 100
      );

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

    // Replace all previous snapshot messages with placeholders
    this.messages.forEach((msg: any) => {
      if (
        msg.role === "user" &&
        msg.content.includes("snapshot") &&
        msg.content.includes("```")
      ) {
        msg.content = msg.content.replace(
          /```[\s\S]*$/g,
          "```[snapshot clipped for length]```"
        );
      }
    });

    // Add the new snapshot message with compressed snapshot
    this.messages.push({
      role: "user",
      content: buildPageSnapshotPrompt(title, url, compressedSnapshot),
    });

    this.eventEmitter.emitEvent({
      type: WebAgentEventType.PAGE_NAVIGATION,
      data: {
        timestamp: Date.now(),
        title,
        url,
      },
    });

    if (this.DEBUG) {
      this.eventEmitter.emitEvent({
        type: WebAgentEventType.DEBUG_MESSAGES,
        data: {
          timestamp: Date.now(),
          messages: this.messages,
        },
      });
    }

    const response = await generateObject({
      model: this.llm,
      schema: actionSchema,
      messages: this.messages,
      temperature: 0,
    });

    return response.object;
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
  }

  async execute(task: string) {
    if (!task) {
      throw new Error("No task provided.");
    }

    // Reset state for new task
    this.resetState();

    // Run plan creation and browser launch concurrently
    await Promise.all([this.createPlan(task), this.browser.start()]);

    // Emit task start event
    this.emitTaskStartEvent(task);

    // Go to the starting URL
    await this.browser.goto(this.url);

    // Setup messages
    this.setupMessages(task);
    let finalAnswer = null;

    // Start the loop
    while (!finalAnswer) {
      // Get the page snapshot directly from the browser
      const pageSnapshot = await this.browser.getText();

      // Call LLM with the page snapshot
      const result = await this.getNextActions(pageSnapshot);

      // Emit observation and thought events
      this.eventEmitter.emitEvent({
        type: WebAgentEventType.OBSERVATION,
        data: {
          timestamp: Date.now(),
          observation: result.observation,
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
        finalAnswer = result.action.value || null;

        // Emit task complete event
        this.eventEmitter.emitEvent({
          type: WebAgentEventType.TASK_COMPLETE,
          data: {
            timestamp: Date.now(),
            finalAnswer,
          },
        });

        break;
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
            } else {
              throw new Error("Missing URL for goto action");
            }
            break;

          case "back":
            await this.browser.goBack();
            break;

          case "forward":
            await this.browser.goForward();
            break;

          default:
            if (!result.action.ref) {
              throw new Error("Missing ref for action");
            }
            await this.browser.performAction(
              result.action.ref,
              result.action.action,
              result.action.value
            );
        }

        // For interactive actions, wait for the page to settle
        if (
          [
            "click",
            "select",
            "fill",
            "hover",
            "check",
            "uncheck",
            "goto",
            "back",
            "forward",
          ].includes(result.action.action)
        ) {
          try {
            // Emit network waiting event
            this.eventEmitter.emitEvent({
              type: WebAgentEventType.NETWORK_WAITING,
              data: {
                timestamp: Date.now(),
                action: result.action.action,
              },
            });

            // Wait for both network idle and DOM to be stable
            await this.browser.waitForLoadState("networkidle", {
              timeout: 750,
            });
          } catch (e) {
            // If timeout occurs, emit timeout event
            this.eventEmitter.emitEvent({
              type: WebAgentEventType.NETWORK_TIMEOUT,
              data: {
                timestamp: Date.now(),
                action: result.action.action,
              },
            });
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
      .filter(
        (line) =>
          !this.FILTERED_PREFIXES.some((start) => line.startsWith(start))
      )
      .map((line) => {
        return this.ARIA_TRANSFORMATIONS.reduce(
          (processed, [pattern, replacement]) =>
            processed.replace(pattern, replacement),
          line
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

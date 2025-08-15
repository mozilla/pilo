/**
 * Web Action Tools
 *
 * Defines browser automation tools using AI SDK's tool() helper.
 * Each tool includes description, inputSchema, and execute function.
 */

import { tool, generateText, LanguageModel } from "ai";
import { z } from "zod";
import { AriaBrowser, PageAction } from "../browser/ariaBrowser.js";
import { WebAgentEventEmitter, WebAgentEventType } from "../events.js";
import { buildExtractionPrompt } from "../prompts.js";

interface WebActionContext {
  browser: AriaBrowser;
  eventEmitter: WebAgentEventEmitter;
  provider: LanguageModel;
  abortSignal?: AbortSignal;
}

/**
 * Helper function to perform an action with better error handling
 * @param ref The element reference
 * @param action The action to perform
 * @param browser The browser instance
 * @param value Optional value for actions like fill
 * @returns The result of the action
 */
async function performActionWithValidation(
  ref: string,
  action: PageAction,
  browser: AriaBrowser,
  value?: string,
): Promise<void> {
  try {
    await browser.performAction(ref, action, value);
  } catch (error: any) {
    // Check if it's a timeout error (element not found)
    if (error.message?.includes("Timeout") || error.message?.includes("timeout")) {
      throw new Error(
        `Element with reference '${ref}' not found or not interactable. The element may have been removed from the page or the reference may be invalid. Please check the current page snapshot.`,
      );
    }
    // Re-throw other errors as-is
    throw error;
  }
}

export function createWebActionTools(context: WebActionContext) {
  // Helper functions that have access to context
  const emitAgentAction = (action: string, ref?: string, value?: string | number) => {
    context.eventEmitter.emit(WebAgentEventType.AGENT_ACTION, {
      action,
      ref,
      value,
    });
  };

  const emitBrowserActionStarted = (action: string, ref?: string, value?: string) => {
    // First emit the agent action
    emitAgentAction(action, ref, value);

    // Then emit browser action started
    context.eventEmitter.emit(WebAgentEventType.BROWSER_ACTION_STARTED, {
      action,
      ref,
      value,
    });
  };

  const emitBrowserActionCompleted = (action: string, success: boolean = true) => {
    context.eventEmitter.emit(WebAgentEventType.BROWSER_ACTION_COMPLETED, {
      success,
      action,
    });
  };

  return {
    click: tool({
      description: "Click on an element on the page",
      inputSchema: z.object({
        ref: z.string().describe("Element reference from page snapshot (e.g., s1e23)"),
      }),
      execute: async ({ ref }) => {
        emitBrowserActionStarted("click", ref);
        await performActionWithValidation(ref, PageAction.Click, context.browser);
        emitBrowserActionCompleted("click");
        return { success: true, action: "click", ref };
      },
    }),

    fill: tool({
      description: "Fill text into an input field",
      inputSchema: z.object({
        ref: z.string().describe("Element reference from page snapshot (e.g., s1e23)"),
        value: z.string().describe("Text to enter into the field"),
      }),
      execute: async ({ ref, value }) => {
        emitBrowserActionStarted("fill", ref, value);
        await performActionWithValidation(ref, PageAction.Fill, context.browser, value);
        emitBrowserActionCompleted("fill");
        return { success: true, action: "fill", ref, value };
      },
    }),

    select: tool({
      description: "Select an option from a dropdown",
      inputSchema: z.object({
        ref: z.string().describe("Element reference from page snapshot (e.g., s1e23)"),
        value: z.string().describe("Option to select"),
      }),
      execute: async ({ ref, value }) => {
        emitBrowserActionStarted("select", ref, value);
        await performActionWithValidation(ref, PageAction.Select, context.browser, value);
        emitBrowserActionCompleted("select");
        return { success: true, action: "select", ref, value };
      },
    }),

    hover: tool({
      description: "Hover over an element",
      inputSchema: z.object({
        ref: z.string().describe("Element reference from page snapshot (e.g., s1e23)"),
      }),
      execute: async ({ ref }) => {
        emitBrowserActionStarted("hover", ref);
        await performActionWithValidation(ref, PageAction.Hover, context.browser);
        emitBrowserActionCompleted("hover");
        return { success: true, action: "hover", ref };
      },
    }),

    check: tool({
      description: "Check a checkbox",
      inputSchema: z.object({
        ref: z.string().describe("Element reference from page snapshot (e.g., s1e23)"),
      }),
      execute: async ({ ref }) => {
        emitBrowserActionStarted("check", ref);
        await performActionWithValidation(ref, PageAction.Check, context.browser);
        emitBrowserActionCompleted("check");
        return { success: true, action: "check", ref };
      },
    }),

    uncheck: tool({
      description: "Uncheck a checkbox",
      inputSchema: z.object({
        ref: z.string().describe("Element reference from page snapshot (e.g., s1e23)"),
      }),
      execute: async ({ ref }) => {
        emitBrowserActionStarted("uncheck", ref);
        await performActionWithValidation(ref, PageAction.Uncheck, context.browser);
        emitBrowserActionCompleted("uncheck");
        return { success: true, action: "uncheck", ref };
      },
    }),

    focus: tool({
      description: "Focus on an element",
      inputSchema: z.object({
        ref: z.string().describe("Element reference from page snapshot (e.g., s1e23)"),
      }),
      execute: async ({ ref }) => {
        emitBrowserActionStarted("focus", ref);
        await performActionWithValidation(ref, PageAction.Focus, context.browser);
        emitBrowserActionCompleted("focus");
        return { success: true, action: "focus", ref };
      },
    }),

    enter: tool({
      description: "Press Enter key on an element (useful for form submission)",
      inputSchema: z.object({
        ref: z.string().describe("Element reference from page snapshot (e.g., s1e23)"),
      }),
      execute: async ({ ref }) => {
        emitBrowserActionStarted("enter", ref);
        await performActionWithValidation(ref, PageAction.Enter, context.browser);
        emitBrowserActionCompleted("enter");
        return { success: true, action: "enter", ref };
      },
    }),

    fill_and_enter: tool({
      description: "Fill text into an input field and press Enter (useful for search boxes)",
      inputSchema: z.object({
        ref: z.string().describe("Element reference from page snapshot (e.g., s1e23)"),
        value: z.string().describe("Text to enter into the field"),
      }),
      execute: async ({ ref, value }) => {
        emitBrowserActionStarted("fill_and_enter", ref, value);
        await performActionWithValidation(ref, PageAction.Fill, context.browser, value);
        await performActionWithValidation(ref, PageAction.Enter, context.browser);
        emitBrowserActionCompleted("fill_and_enter");
        return { success: true, action: "fill_and_enter", ref, value };
      },
    }),

    wait: tool({
      description: "Wait for a specified number of seconds",
      inputSchema: z.object({
        seconds: z.number().min(0).max(30).describe("Number of seconds to wait (0-30)"),
      }),
      execute: async ({ seconds }) => {
        emitAgentAction("wait", undefined, seconds);
        context.eventEmitter.emit(WebAgentEventType.AGENT_WAITING, { seconds });
        await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
        return { success: true, action: "wait", seconds };
      },
    }),

    goto: tool({
      description: "Navigate to a URL that was previously seen in the conversation",
      inputSchema: z.object({
        url: z.url().describe("URL to navigate to (must be previously seen)"),
      }),
      execute: async ({ url }) => {
        emitBrowserActionStarted("goto", undefined, url);
        await context.browser.goto(url);
        const [title, currentUrl] = await Promise.all([
          context.browser.getTitle(),
          context.browser.getUrl(),
        ]);
        emitBrowserActionCompleted("goto");
        context.eventEmitter.emit(WebAgentEventType.BROWSER_NAVIGATED, { title, url: currentUrl });
        return { success: true, action: "goto", url, title };
      },
    }),

    back: tool({
      description: "Go back to the previous page",
      inputSchema: z.object({}),
      execute: async () => {
        emitBrowserActionStarted("back");
        await context.browser.goBack();
        const [title, url] = await Promise.all([
          context.browser.getTitle(),
          context.browser.getUrl(),
        ]);
        emitBrowserActionCompleted("back");
        context.eventEmitter.emit(WebAgentEventType.BROWSER_NAVIGATED, { title, url });
        return { success: true, action: "back" };
      },
    }),

    forward: tool({
      description: "Go forward to the next page",
      inputSchema: z.object({}),
      execute: async () => {
        emitBrowserActionStarted("forward");
        await context.browser.goForward();
        const [title, url] = await Promise.all([
          context.browser.getTitle(),
          context.browser.getUrl(),
        ]);
        emitBrowserActionCompleted("forward");
        context.eventEmitter.emit(WebAgentEventType.BROWSER_NAVIGATED, { title, url });
        return { success: true, action: "forward" };
      },
    }),

    extract: tool({
      description: "Extract specific data from the current page for later reference",
      inputSchema: z.object({
        description: z
          .string()
          .describe("Precise description of the data to extract. DO NOT use `ref` values."),
      }),
      execute: async ({ description }) => {
        emitAgentAction("extract", undefined, description);

        // Get the page markdown content
        const markdown = await context.browser.getMarkdown();

        // Build extraction prompt
        const prompt = buildExtractionPrompt(description, markdown);

        // Use the provider to extract the data
        const extractResponse = await generateText({
          model: context.provider,
          prompt,
          maxOutputTokens: 5000,
          abortSignal: context.abortSignal,
        });

        // Emit the extracted data event
        context.eventEmitter.emit(WebAgentEventType.AGENT_EXTRACTED, {
          extractedData: extractResponse.text,
        });

        return {
          success: true,
          action: "extract",
          description,
          extractedData: extractResponse.text,
        };
      },
    }),

    done: tool({
      description:
        "Mark the entire task as complete with final results that directly address ALL parts of the original task",
      inputSchema: z.object({
        result: z
          .string()
          .describe(
            "A summary of the steps you took to complete the task and the final results that directly address ALL parts of the original task",
          ),
      }),
      execute: async ({ result }) => {
        emitAgentAction("done", undefined, result);
        return { success: true, action: "done", result, isTerminal: true };
      },
    }),

    abort: tool({
      description:
        "Abort the task when it cannot be completed due to site issues, blocking, or missing data",
      inputSchema: z.object({
        description: z
          .string()
          .describe(
            "A description of what has been attempted so far and why the task cannot be completed (e.g., site is down, access blocked, required data unavailable)",
          ),
      }),
      execute: async ({ description }) => {
        emitAgentAction("abort", undefined, description);
        return { success: true, action: "abort", reason: description, isTerminal: true };
      },
    }),
  };
}

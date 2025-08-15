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
  return {
    click: tool({
      description: "Click on an element on the page",
      inputSchema: z.object({
        ref: z.string().describe("Element reference from page snapshot (e.g., s1e23)"),
      }),
      execute: async ({ ref }) => {
        await performActionWithValidation(ref, PageAction.Click, context.browser);
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
        await performActionWithValidation(ref, PageAction.Fill, context.browser, value);
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
        await performActionWithValidation(ref, PageAction.Select, context.browser, value);
        return { success: true, action: "select", ref, value };
      },
    }),

    hover: tool({
      description: "Hover over an element",
      inputSchema: z.object({
        ref: z.string().describe("Element reference from page snapshot (e.g., s1e23)"),
      }),
      execute: async ({ ref }) => {
        await performActionWithValidation(ref, PageAction.Hover, context.browser);
        return { success: true, action: "hover", ref };
      },
    }),

    check: tool({
      description: "Check a checkbox",
      inputSchema: z.object({
        ref: z.string().describe("Element reference from page snapshot (e.g., s1e23)"),
      }),
      execute: async ({ ref }) => {
        await performActionWithValidation(ref, PageAction.Check, context.browser);
        return { success: true, action: "check", ref };
      },
    }),

    uncheck: tool({
      description: "Uncheck a checkbox",
      inputSchema: z.object({
        ref: z.string().describe("Element reference from page snapshot (e.g., s1e23)"),
      }),
      execute: async ({ ref }) => {
        await performActionWithValidation(ref, PageAction.Uncheck, context.browser);
        return { success: true, action: "uncheck", ref };
      },
    }),

    focus: tool({
      description: "Focus on an element",
      inputSchema: z.object({
        ref: z.string().describe("Element reference from page snapshot (e.g., s1e23)"),
      }),
      execute: async ({ ref }) => {
        await performActionWithValidation(ref, PageAction.Focus, context.browser);
        return { success: true, action: "focus", ref };
      },
    }),

    enter: tool({
      description: "Press Enter key on an element (useful for form submission)",
      inputSchema: z.object({
        ref: z.string().describe("Element reference from page snapshot (e.g., s1e23)"),
      }),
      execute: async ({ ref }) => {
        await performActionWithValidation(ref, PageAction.Enter, context.browser);
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
        await performActionWithValidation(ref, PageAction.Fill, context.browser, value);
        await performActionWithValidation(ref, PageAction.Enter, context.browser);
        return { success: true, action: "fill_and_enter", ref, value };
      },
    }),

    wait: tool({
      description: "Wait for a specified number of seconds",
      inputSchema: z.object({
        seconds: z.number().min(0).max(30).describe("Number of seconds to wait (0-30)"),
      }),
      execute: async ({ seconds }) => {
        context.eventEmitter.emit(WebAgentEventType.AGENT_WAITING, { seconds });
        await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
        return { success: true, action: "wait", seconds };
      },
    }),

    goto: tool({
      description: "Navigate to a URL that was previously seen in the conversation",
      inputSchema: z.object({
        url: z.string().url().describe("URL to navigate to (must be previously seen)"),
      }),
      execute: async ({ url }) => {
        await context.browser.goto(url);
        const [title, currentUrl] = await Promise.all([
          context.browser.getTitle(),
          context.browser.getUrl(),
        ]);
        context.eventEmitter.emit(WebAgentEventType.BROWSER_NAVIGATED, { title, url: currentUrl });
        return { success: true, action: "goto", url, title };
      },
    }),

    back: tool({
      description: "Go back to the previous page",
      inputSchema: z.object({}),
      execute: async () => {
        await context.browser.goBack();
        const [title, url] = await Promise.all([
          context.browser.getTitle(),
          context.browser.getUrl(),
        ]);
        context.eventEmitter.emit(WebAgentEventType.BROWSER_NAVIGATED, { title, url });
        return { success: true, action: "back" };
      },
    }),

    forward: tool({
      description: "Go forward to the next page",
      inputSchema: z.object({}),
      execute: async () => {
        await context.browser.goForward();
        const [title, url] = await Promise.all([
          context.browser.getTitle(),
          context.browser.getUrl(),
        ]);
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
        return { success: true, action: "abort", reason: description, isTerminal: true };
      },
    }),
  };
}

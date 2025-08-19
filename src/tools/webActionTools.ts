/**
 * Web Action Tools
 *
 * Defines browser automation tools using AI SDK's tool() helper.
 * Each tool includes description, inputSchema, and execute function.
 */

import { tool, generateText } from "ai";
import { z } from "zod";
import { AriaBrowser, PageAction } from "../browser/ariaBrowser.js";
import { WebAgentEventEmitter, WebAgentEventType } from "../events.js";
import { buildExtractionPrompt, TOOL_STRINGS } from "../prompts.js";
import type { ProviderConfig } from "../provider.js";
import { BrowserException } from "../errors.js";

interface WebActionContext {
  browser: AriaBrowser;
  eventEmitter: WebAgentEventEmitter;
  providerConfig: ProviderConfig;
  abortSignal?: AbortSignal;
}

/**
 * Tool output structure for browser actions
 * This structure is guaranteed to be consistent for easy error checking:
 * - success: always present, indicates if action succeeded
 * - action: always present, the action that was attempted
 * - error: present when success is false, contains error message
 * - isRecoverable: present when error is recoverable (browser exceptions)
 * - ref/value: present when provided as input
 */
type ActionResult = {
  success: boolean;
  action: string;
  ref?: string;
  value?: string | number;
  error?: string;
  isRecoverable?: boolean;
};

/**
 * Helper function to perform an action with full error handling and logging
 * Handles browser exceptions and converts them to recoverable errors for the agent
 *
 * IMPORTANT: When this returns an error (success: false), the error is already
 * included in the tool result that the LLM sees. The agent layer should NOT
 * add a duplicate user message for these errors.
 */
async function performActionWithValidation(
  action: PageAction,
  context: WebActionContext,
  ref?: string,
  value?: string,
): Promise<ActionResult> {
  try {
    // Emit action started events
    context.eventEmitter.emit(WebAgentEventType.AGENT_ACTION, {
      action,
      ref,
      value,
    });

    context.eventEmitter.emit(WebAgentEventType.BROWSER_ACTION_STARTED, {
      action,
      ref,
      value,
    });

    // Perform the action
    await context.browser.performAction(ref || "", action, value);

    // Emit success
    context.eventEmitter.emit(WebAgentEventType.BROWSER_ACTION_COMPLETED, {
      success: true,
      action,
    });

    return { success: true, action, ...(ref && { ref }), ...(value !== undefined && { value }) };
  } catch (error) {
    // Emit failure
    context.eventEmitter.emit(WebAgentEventType.BROWSER_ACTION_COMPLETED, {
      success: false,
      action,
    });

    // For browser exceptions, return error info with recoverable flag
    if (error instanceof BrowserException) {
      return {
        success: false,
        action,
        ...(ref && { ref }),
        ...(value !== undefined && { value }),
        error: error.message,
        isRecoverable: true,
      };
    }

    // Re-throw non-browser errors
    throw error;
  }
}

export function createWebActionTools(context: WebActionContext) {
  return {
    click: tool({
      description: TOOL_STRINGS.webActions.click.description,
      inputSchema: z.object({
        ref: z.string().describe(TOOL_STRINGS.webActions.common.elementRef),
      }),
      execute: async ({ ref }) => {
        return await performActionWithValidation(PageAction.Click, context, ref);
      },
    }),

    fill: tool({
      description: TOOL_STRINGS.webActions.fill.description,
      inputSchema: z.object({
        ref: z.string().describe(TOOL_STRINGS.webActions.common.elementRef),
        value: z.string().describe(TOOL_STRINGS.webActions.common.textValue),
      }),
      execute: async ({ ref, value }) => {
        return await performActionWithValidation(PageAction.Fill, context, ref, value);
      },
    }),

    select: tool({
      description: TOOL_STRINGS.webActions.select.description,
      inputSchema: z.object({
        ref: z.string().describe(TOOL_STRINGS.webActions.common.elementRef),
        value: z.string().describe(TOOL_STRINGS.webActions.select.value),
      }),
      execute: async ({ ref, value }) => {
        return await performActionWithValidation(PageAction.Select, context, ref, value);
      },
    }),

    hover: tool({
      description: TOOL_STRINGS.webActions.hover.description,
      inputSchema: z.object({
        ref: z.string().describe(TOOL_STRINGS.webActions.common.elementRef),
      }),
      execute: async ({ ref }) => {
        return await performActionWithValidation(PageAction.Hover, context, ref);
      },
    }),

    check: tool({
      description: TOOL_STRINGS.webActions.check.description,
      inputSchema: z.object({
        ref: z.string().describe(TOOL_STRINGS.webActions.common.elementRef),
      }),
      execute: async ({ ref }) => {
        return await performActionWithValidation(PageAction.Check, context, ref);
      },
    }),

    uncheck: tool({
      description: TOOL_STRINGS.webActions.uncheck.description,
      inputSchema: z.object({
        ref: z.string().describe(TOOL_STRINGS.webActions.common.elementRef),
      }),
      execute: async ({ ref }) => {
        return await performActionWithValidation(PageAction.Uncheck, context, ref);
      },
    }),

    focus: tool({
      description: TOOL_STRINGS.webActions.focus.description,
      inputSchema: z.object({
        ref: z.string().describe(TOOL_STRINGS.webActions.common.elementRef),
      }),
      execute: async ({ ref }) => {
        return await performActionWithValidation(PageAction.Focus, context, ref);
      },
    }),

    enter: tool({
      description: TOOL_STRINGS.webActions.enter.description,
      inputSchema: z.object({
        ref: z.string().describe(TOOL_STRINGS.webActions.common.elementRef),
      }),
      execute: async ({ ref }) => {
        return await performActionWithValidation(PageAction.Enter, context, ref);
      },
    }),

    fill_and_enter: tool({
      description: TOOL_STRINGS.webActions.fill_and_enter.description,
      inputSchema: z.object({
        ref: z.string().describe(TOOL_STRINGS.webActions.common.elementRef),
        value: z.string().describe(TOOL_STRINGS.webActions.common.textValue),
      }),
      execute: async ({ ref, value }) => {
        return await performActionWithValidation(PageAction.FillAndEnter, context, ref, value);
      },
    }),

    wait: tool({
      description: TOOL_STRINGS.webActions.wait.description,
      inputSchema: z.object({
        seconds: z.number().min(0).max(30).describe(TOOL_STRINGS.webActions.wait.seconds),
      }),
      execute: async ({ seconds }) => {
        // Wait uses browser.performAction which expects value as string
        const result = await performActionWithValidation(
          PageAction.Wait,
          context,
          undefined,
          String(seconds),
        );

        if (result.success) {
          context.eventEmitter.emit(WebAgentEventType.AGENT_WAITING, { seconds });
        }

        return result;
      },
    }),

    goto: tool({
      description: TOOL_STRINGS.webActions.goto.description,
      inputSchema: z.object({
        url: z.url().describe(TOOL_STRINGS.webActions.goto.url),
      }),
      execute: async ({ url }) => {
        const result = await performActionWithValidation(PageAction.Goto, context, undefined, url);

        if (result.success) {
          // Get page info after navigation
          const [title, currentUrl] = await Promise.all([
            context.browser.getTitle(),
            context.browser.getUrl(),
          ]);
          context.eventEmitter.emit(WebAgentEventType.BROWSER_NAVIGATED, {
            title,
            url: currentUrl,
          });
          return { ...result, title };
        }

        return result;
      },
    }),

    back: tool({
      description: TOOL_STRINGS.webActions.back.description,
      inputSchema: z.object({}),
      execute: async () => {
        const result = await performActionWithValidation(PageAction.Back, context);

        if (result.success) {
          // Get page info after navigation
          const [title, url] = await Promise.all([
            context.browser.getTitle(),
            context.browser.getUrl(),
          ]);
          context.eventEmitter.emit(WebAgentEventType.BROWSER_NAVIGATED, { title, url });
        }

        return result;
      },
    }),

    forward: tool({
      description: TOOL_STRINGS.webActions.forward.description,
      inputSchema: z.object({}),
      execute: async () => {
        const result = await performActionWithValidation(PageAction.Forward, context);

        if (result.success) {
          // Get page info after navigation
          const [title, url] = await Promise.all([
            context.browser.getTitle(),
            context.browser.getUrl(),
          ]);
          context.eventEmitter.emit(WebAgentEventType.BROWSER_NAVIGATED, { title, url });
        }

        return result;
      },
    }),

    extract: tool({
      description: TOOL_STRINGS.webActions.extract.description,
      inputSchema: z.object({
        description: z.string().describe(TOOL_STRINGS.webActions.extract.dataDescription),
      }),
      execute: async ({ description }) => {
        // Extract doesn't use browser.performAction - it's a special AI operation
        context.eventEmitter.emit(WebAgentEventType.AGENT_ACTION, {
          action: "extract",
          value: description,
        });

        // Get the page markdown content
        const markdown = await context.browser.getMarkdown();

        // Build extraction prompt
        const prompt = buildExtractionPrompt(description, markdown);

        // Use the provider to extract the data
        const extractResponse = await generateText({
          ...context.providerConfig,
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
      description: TOOL_STRINGS.webActions.done.description,
      inputSchema: z.object({
        result: z.string().describe(TOOL_STRINGS.webActions.done.result),
      }),
      execute: async ({ result }) => {
        // Done is a terminal action - doesn't interact with browser
        context.eventEmitter.emit(WebAgentEventType.AGENT_ACTION, {
          action: "done",
          value: result,
        });
        return { success: true, action: "done", result, isTerminal: true };
      },
    }),

    abort: tool({
      description: TOOL_STRINGS.webActions.abort.description,
      inputSchema: z.object({
        reason: z.string().describe(TOOL_STRINGS.webActions.abort.reason),
      }),
      execute: async ({ reason }) => {
        // Abort is a terminal action - doesn't interact with browser
        context.eventEmitter.emit(WebAgentEventType.AGENT_ACTION, {
          action: "abort",
          value: reason,
        });
        return { success: true, action: "abort", reason, isTerminal: true };
      },
    }),
  };
}

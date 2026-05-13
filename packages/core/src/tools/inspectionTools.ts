/**
 * Inspection Tools
 *
 * Zero-LLM page-inspection tools — fast, deterministic primitives the agent
 * can call before falling back to LLM-driven extraction. `search_page` walks
 * visible page text and returns matches with surrounding context and the
 * nearest `data-pilo-ref` ancestor. `find_elements` queries by CSS selector
 * and returns each match's tag, text, requested attributes (with `href`/`src`
 * auto-resolved to absolute URLs), and the nearest `data-pilo-ref` ancestor.
 */

import { tool } from "ai";
import { z } from "zod";
import type { AriaBrowser } from "../browser/ariaBrowser.js";
import { WebAgentEventEmitter, WebAgentEventType } from "../events.js";
import { TOOL_STRINGS } from "../prompts.js";

interface InspectionToolContext {
  browser: AriaBrowser;
  eventEmitter: WebAgentEventEmitter;
}

export function createInspectionTools(context: InspectionToolContext) {
  return {
    search_page: tool({
      description: TOOL_STRINGS.webActions.searchPage.description,
      inputSchema: z.object({
        pattern: z.string().describe(TOOL_STRINGS.webActions.searchPage.pattern),
        regex: z.boolean().default(false).describe(TOOL_STRINGS.webActions.searchPage.regex),
        caseSensitive: z
          .boolean()
          .default(false)
          .describe(TOOL_STRINGS.webActions.searchPage.caseSensitive),
        contextChars: z
          .number()
          .min(0)
          .max(500)
          .default(80)
          .describe(TOOL_STRINGS.webActions.searchPage.contextChars),
        maxResults: z
          .number()
          .min(1)
          .max(50)
          .default(10)
          .describe(TOOL_STRINGS.webActions.searchPage.maxResults),
      }),
      execute: async ({ pattern, regex, caseSensitive, contextChars, maxResults }) => {
        context.eventEmitter.emit(WebAgentEventType.AGENT_ACTION, {
          action: "search_page",
          value: pattern,
        });

        try {
          const result = await context.browser.searchPage({
            pattern,
            regex,
            caseSensitive,
            contextChars,
            maxResults,
          });

          context.eventEmitter.emit(WebAgentEventType.BROWSER_ACTION_COMPLETED, {
            success: true,
            action: "search_page",
          });

          return {
            success: true,
            action: "search_page",
            pattern,
            ...result,
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);

          context.eventEmitter.emit(WebAgentEventType.BROWSER_ACTION_COMPLETED, {
            success: false,
            action: "search_page",
            error: errorMessage,
            isRecoverable: true,
          });

          return {
            success: false,
            action: "search_page",
            pattern,
            error: errorMessage,
            isRecoverable: true,
          };
        }
      },
    }),
    find_elements: tool({
      description: TOOL_STRINGS.webActions.findElements.description,
      inputSchema: z.object({
        selector: z.string().describe(TOOL_STRINGS.webActions.findElements.selector),
        withinRef: z.string().optional().describe(TOOL_STRINGS.webActions.findElements.withinRef),
        attributes: z
          .array(z.string())
          .optional()
          .describe(TOOL_STRINGS.webActions.findElements.attributes),
        maxResults: z
          .number()
          .min(1)
          .max(100)
          .default(20)
          .describe(TOOL_STRINGS.webActions.findElements.maxResults),
        includeText: z
          .boolean()
          .default(true)
          .describe(TOOL_STRINGS.webActions.findElements.includeText),
      }),
      execute: async ({ selector, withinRef, attributes, maxResults, includeText }) => {
        context.eventEmitter.emit(WebAgentEventType.AGENT_ACTION, {
          action: "find_elements",
          value: selector,
        });

        try {
          const result = await context.browser.findElements({
            selector,
            withinRef,
            attributes,
            maxResults,
            includeText,
          });

          context.eventEmitter.emit(WebAgentEventType.BROWSER_ACTION_COMPLETED, {
            success: true,
            action: "find_elements",
          });

          return {
            success: true,
            action: "find_elements",
            selector,
            ...result,
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);

          context.eventEmitter.emit(WebAgentEventType.BROWSER_ACTION_COMPLETED, {
            success: false,
            action: "find_elements",
            error: errorMessage,
            isRecoverable: true,
          });

          return {
            success: false,
            action: "find_elements",
            selector,
            error: errorMessage,
            isRecoverable: true,
          };
        }
      },
    }),
  };
}

/**
 * Search Tools
 *
 * Defines the webSearch tool for web search functionality.
 * Returns markdown that the LLM parses like any other web page.
 */

import { tool } from "ai";
import { z } from "zod";
import type { SearchService } from "../search/searchService.js";
import { WebAgentEventEmitter, WebAgentEventType } from "../events.js";
import { TOOL_STRINGS } from "../prompts.js";

interface SearchToolContext {
  searchService: SearchService;
  eventEmitter: WebAgentEventEmitter;
}

export function createSearchTools(context: SearchToolContext) {
  return {
    webSearch: tool({
      description: TOOL_STRINGS.webActions.webSearch.description,
      inputSchema: z.object({
        query: z.string().describe(TOOL_STRINGS.webActions.webSearch.query),
      }),
      execute: async ({ query }) => {
        context.eventEmitter.emit(WebAgentEventType.AGENT_ACTION, {
          action: "webSearch",
          value: query,
        });

        try {
          const markdown = await context.searchService.search(query);

          context.eventEmitter.emit(WebAgentEventType.BROWSER_ACTION_COMPLETED, {
            success: true,
            action: "webSearch",
          });

          return {
            success: true,
            action: "webSearch",
            query,
            markdown,
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);

          context.eventEmitter.emit(WebAgentEventType.BROWSER_ACTION_COMPLETED, {
            success: false,
            action: "webSearch",
            error: errorMessage,
            isRecoverable: true,
          });

          return {
            success: false,
            action: "webSearch",
            query,
            error: errorMessage,
            isRecoverable: true,
          };
        }
      },
    }),
  };
}

/**
 * Search Tools
 *
 * Defines the webSearch tool for web search functionality.
 * Returns markdown that the LLM parses like any other web page.
 */

import { tool } from "ai";
import { z } from "zod";
import type { AriaBrowser } from "../browser/ariaBrowser.js";
import type { SearchProviderName } from "../configDefaults.js";
import { WebAgentEventEmitter, WebAgentEventType } from "../events.js";
import { createSearchProvider } from "../search/searchProvider.js";
import { TOOL_STRINGS } from "../prompts.js";

interface SearchToolContext {
  browser: AriaBrowser;
  eventEmitter: WebAgentEventEmitter;
  searchProvider: Exclude<SearchProviderName, "none">;
  /** API key for search providers that require authentication */
  searchApiKey?: string;
}

export function createSearchTools(context: SearchToolContext) {
  // Create provider once at tool-creation time instead of per-invocation
  const providerPromise = createSearchProvider(context.searchProvider, {
    apiKey: context.searchApiKey,
  });

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
          const provider = await providerPromise;

          const browser = provider.requiresBrowser ? context.browser : undefined;
          const markdown = await provider.search(query, browser);

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

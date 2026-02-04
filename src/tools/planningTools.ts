/**
 * Planning Tools
 *
 * Tools for task planning and URL determination.
 *
 * There are three planning tools, used in different scenarios:
 *
 * 1. `create_plan` - Used when user provides a starting URL via --starting-url.
 *    The planner just creates a plan, no URL determination needed.
 *
 * 2. `create_plan_with_url` - Used when no starting URL and webSearch is disabled.
 *    The planner must determine the best starting URL.
 *
 * 3. `create_plan_with_search_or_url` - Used when no starting URL and webSearch is enabled.
 *    The planner chooses to either start with a web search OR navigate to a URL.
 *    This makes the choice explicit rather than hinting.
 */

import { tool } from "ai";
import { z } from "zod";
import { TOOL_STRINGS } from "../prompts.js";

/**
 * Creates the standard planning tools (create_plan, create_plan_with_url).
 * Used when webSearch is not available.
 */
export function createPlanningTools() {
  return {
    create_plan: tool({
      description: TOOL_STRINGS.planning.create_plan.description,
      inputSchema: z.object({
        successCriteria: z.string().describe(TOOL_STRINGS.planning.common.successCriteria),
        plan: z.string().describe(TOOL_STRINGS.planning.common.plan),
        actionItems: z
          .array(z.string())
          .optional()
          .describe(TOOL_STRINGS.planning.common.actionItems),
      }),
      execute: async ({ successCriteria, plan, actionItems }) => {
        return { successCriteria, plan, ...(actionItems && { actionItems }) };
      },
    }),

    create_plan_with_url: tool({
      description: TOOL_STRINGS.planning.create_plan_with_url.description,
      inputSchema: z.object({
        successCriteria: z.string().describe(TOOL_STRINGS.planning.common.successCriteria),
        plan: z.string().describe(TOOL_STRINGS.planning.common.plan),
        url: z.string().describe(TOOL_STRINGS.planning.create_plan_with_url.url),
        actionItems: z
          .array(z.string())
          .optional()
          .describe(TOOL_STRINGS.planning.common.actionItems),
      }),
      execute: async ({ successCriteria, plan, url, actionItems }) => {
        return { successCriteria, plan, url, ...(actionItems && { actionItems }) };
      },
    }),
  };
}

/**
 * Creates the search-or-url planning tool.
 * Used when webSearch is available and no starting URL is provided.
 * Forces the planner to explicitly choose between starting with a search or a URL.
 */
export function createSearchOrUrlPlanningTools() {
  return {
    create_plan_with_search_or_url: tool({
      description: TOOL_STRINGS.planning.create_plan_with_search_or_url.description,
      inputSchema: z
        .object({
          successCriteria: z.string().describe(TOOL_STRINGS.planning.common.successCriteria),
          plan: z.string().describe(TOOL_STRINGS.planning.common.plan),
          actionItems: z
            .array(z.string())
            .optional()
            .describe(TOOL_STRINGS.planning.common.actionItems),
          url: z
            .string()
            .optional()
            .describe(TOOL_STRINGS.planning.create_plan_with_search_or_url.url),
          searchQuery: z
            .string()
            .optional()
            .describe(TOOL_STRINGS.planning.create_plan_with_search_or_url.searchQuery),
        })
        .refine(
          (data) => Boolean(data.url) !== Boolean(data.searchQuery),
          "Provide either url OR searchQuery, not both"
        ),
      execute: async ({ successCriteria, plan, actionItems, url, searchQuery }) => {
        return {
          successCriteria,
          plan,
          ...(actionItems && { actionItems }),
          ...(url && { url }),
          ...(searchQuery && { searchQuery }),
        };
      },
    }),
  };
}

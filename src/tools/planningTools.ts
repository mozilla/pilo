/**
 * Planning Tools
 *
 * Single `create_plan` tool with an optional `url` field.
 * When the user provides a starting URL, the planner omits url.
 * When no starting URL is provided, the planner determines the best url.
 */

import { tool } from "ai";
import { z } from "zod";
import { TOOL_STRINGS } from "../prompts.js";

/**
 * Creates the planning tool: `create_plan` with optional `url`.
 */
export function createPlanningTools() {
  return {
    create_plan: tool({
      description: TOOL_STRINGS.planning.create_plan.description,
      inputSchema: z.object({
        successCriteria: z.string().describe(TOOL_STRINGS.planning.common.successCriteria),
        plan: z.string().describe(TOOL_STRINGS.planning.common.plan),
        url: z.string().url().optional().describe(TOOL_STRINGS.planning.create_plan.url),
        actionItems: z
          .array(z.string())
          .optional()
          .describe(TOOL_STRINGS.planning.common.actionItems),
      }),
      execute: async ({ successCriteria, plan, url, actionItems }) => {
        return {
          successCriteria,
          plan,
          ...(url && { url }),
          ...(actionItems && { actionItems }),
        };
      },
    }),
  };
}

/**
 * Planning Tools
 *
 * Tools for task planning and URL determination.
 */

import { tool } from "ai";
import { z } from "zod";
import { TOOL_STRINGS } from "../prompts.js";

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

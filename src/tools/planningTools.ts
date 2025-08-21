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
      }),
      execute: async ({ successCriteria, plan }) => {
        return { successCriteria, plan };
      },
    }),

    create_plan_with_url: tool({
      description: TOOL_STRINGS.planning.create_plan_with_url.description,
      inputSchema: z.object({
        successCriteria: z.string().describe(TOOL_STRINGS.planning.common.successCriteria),
        plan: z.string().describe(TOOL_STRINGS.planning.common.plan),
        url: z.string().describe(TOOL_STRINGS.planning.create_plan_with_url.url),
      }),
      execute: async ({ successCriteria, plan, url }) => {
        return { successCriteria, plan, url };
      },
    }),
  };
}

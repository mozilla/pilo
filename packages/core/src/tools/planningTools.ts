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

/**
 * Creates the mid-task replanning tool: `revise_plan`.
 *
 * This is a pure-echo tool — it returns its inputs tagged with the action name.
 * All effects (cap enforcement, instance-state mutation, PLAN_REVISED event, and
 * the appended conversation note) are handled by WebAgent.generateAndProcessAction
 * so they are exercised by the test harness, which mocks streamText.
 */
export function createReplanningTools() {
  return {
    revise_plan: tool({
      description: TOOL_STRINGS.planning.revise_plan.description,
      inputSchema: z.object({
        revisedPlan: z.string().describe(TOOL_STRINGS.planning.common.plan),
        reason: z.string().describe(TOOL_STRINGS.planning.revise_plan.reason),
        revisedSuccessCriteria: z
          .string()
          .optional()
          .describe(TOOL_STRINGS.planning.common.successCriteria),
        revisedActionItems: z
          .array(z.string())
          .optional()
          .describe(TOOL_STRINGS.planning.common.actionItems),
      }),
      execute: async ({ revisedPlan, reason, revisedSuccessCriteria, revisedActionItems }) => {
        // Unlike create_plan (a bare echo), this output is tagged with `success`
        // and `action` because generateAndProcessAction keys on `action` to apply
        // the revision. Keep the tag — don't flatten it to match create_plan.
        return {
          success: true,
          action: "revise_plan",
          revisedPlan,
          reason,
          ...(revisedSuccessCriteria && { revisedSuccessCriteria }),
          ...(revisedActionItems && { revisedActionItems }),
        };
      },
    }),
  };
}

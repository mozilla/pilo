/**
 * Planning Tools
 *
 * Tools for task planning and URL determination.
 */

import { tool } from "ai";
import { z } from "zod";

export function createPlanningTools() {
  return {
    create_plan: tool({
      description: "Create a step-by-step plan for completing the task",
      inputSchema: z.object({
        explanation: z.string().describe("Task explanation in agent's own words"),
        plan: z.string().describe("Step-by-step plan for the task"),
      }),
      execute: async ({ explanation, plan }) => {
        return { explanation, plan };
      },
    }),

    create_plan_with_url: tool({
      description: "Create a step-by-step plan and determine the best starting URL",
      inputSchema: z.object({
        explanation: z.string().describe("Task explanation in agent's own words"),
        plan: z.string().describe("Step-by-step plan for the task"),
        url: z.string().describe("Starting URL for the task"),
      }),
      execute: async ({ explanation, plan, url }) => {
        return { explanation, plan, url };
      },
    }),
  };
}

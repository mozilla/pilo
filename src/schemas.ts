import { z } from "zod";

// Schema for the initial plan creation
export const planSchema = z.object({
  explanation: z
    .string()
    .describe("Restate the task concisely but include all relevant details"),
  plan: z
    .string()
    .describe(
      "Create a high-level plan for this web navigation task. Focus on general steps without assuming specific page features. One step per line."
    ),
  url: z
    .string()
    .describe(
      "Must be a real top-level domain with no path OR a web search: https://duckduckgo.com/?q=search+query"
    ),
});

// Schema for the action loop responses
export const actionSchema = z.object({
  observation: z
    .string()
    .describe(
      "Brief assessment of previous step's outcome. Note important information you might need to complete the task."
    ),
  thought: z
    .string()
    .describe(
      "Reasoning for your next action. If an action fails, retry once then try an alternative"
    ),
  action: z
    .object({
      action: z
        .enum([
          "select", // Choose from dropdown
          "fill", // Enter text
          "click", // Click element
          "hover", // Move mouse over element
          "check", // Check a checkbox
          "uncheck", // Uncheck a checkbox
          "wait", // Pause execution
          "done", // Complete task
          "goto", // Navigate to URL
          "back", // Go to previous page
        ])
        .describe("The type of action to perform"),
      ref: z
        .string()
        .optional()
        .describe(
          "Aria reference (e.g., 's1e33') from the page snapshot. Not needed for done/wait/goto/back"
        ),
      value: z
        .string()
        .optional()
        .describe(
          "Required for fill/select/goto, seconds for wait, result for done"
        ),
    })
    .describe("The action to perform on the page"),
});

// Export the types
export type Plan = z.infer<typeof planSchema>;
export type Action = z.infer<typeof actionSchema>;

/**
 * Validation Tools
 *
 * Tools for validating task completion quality.
 */

import { tool } from "ai";
import { z } from "zod";
import { TOOL_STRINGS } from "../prompts.js";

export function createValidationTools() {
  return {
    validate_task: tool({
      description: TOOL_STRINGS.validation.validate_task.description,
      inputSchema: z.object({
        taskAssessment: z.string().describe(TOOL_STRINGS.validation.validate_task.taskAssessment),
        completionQuality: z
          .enum(["failed", "partial", "complete", "excellent"])
          .describe(TOOL_STRINGS.validation.validate_task.completionQuality),
        feedback: z.string().optional().describe(TOOL_STRINGS.validation.validate_task.feedback),
      }),
      execute: async ({ taskAssessment, completionQuality, feedback }) => {
        return { taskAssessment, completionQuality, feedback };
      },
    }),
  };
}

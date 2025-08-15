/**
 * Validation Tools
 *
 * Tools for validating task completion quality.
 */

import { tool } from "ai";
import { z } from "zod";

export function createValidationTools() {
  return {
    validate_task: tool({
      description: "Validate if the task has been completed successfully",
      inputSchema: z.object({
        taskAssessment: z.string().describe("Brief assessment of how well the task was completed"),
        completionQuality: z
          .enum(["failed", "partial", "complete", "excellent"])
          .describe(
            "Quality of task completion: failed (not done), partial (incomplete), complete (done adequately), excellent (done very well)",
          ),
        feedback: z
          .string()
          .optional()
          .describe("Specific feedback on what needs improvement (if not complete/excellent)"),
      }),
      execute: async ({ taskAssessment, completionQuality, feedback }) => {
        return { taskAssessment, completionQuality, feedback };
      },
    }),
  };
}

import { z } from "zod";
import { PageAction } from "./browser/ariaBrowser.js";

// Simple action result type used internally by ActionValidator
export type Action = {
  observation: string;
  observationStatusMessage: string;
  action: {
    action: PageAction;
    ref?: string;
    value?: string;
  };
  actionStatusMessage: string;
};

// Schema for task validation results
export const taskValidationSchema = z.object({
  taskAssessment: z
    .string()
    .describe("Assessment of whether the result accomplishes the requested task"),
  completionQuality: z
    .enum(["failed", "partial", "complete", "excellent"])
    .describe("Quality level of task completion"),
  feedback: z.string().optional().describe("What is missing to complete the task"),
});

// Export the type for task validation result
export type TaskValidationResult = z.infer<typeof taskValidationSchema>;

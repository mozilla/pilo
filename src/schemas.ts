import { z } from "zod";
import { PageAction } from "./browser/ariaBrowser.js";

// Schema for plan creation (without URL)
export const planSchema = z.object({
  explanation: z.string().describe("Task explanation in agent's own words"),
  plan: z.string().describe("Step-by-step plan for the task"),
});

// Schema for plan creation with URL
export const planAndUrlSchema = z.object({
  explanation: z.string().describe("Task explanation in agent's own words"),
  plan: z.string().describe("Step-by-step plan for the task"),
  url: z.string().describe("Starting URL for the task"),
});

// Schema for the action loop responses
export const actionSchema = z.object({
  observation: z.string().describe("Assessment of previous step outcome and reasoning for next action"),
  observationStatusMessage: z.string().describe("Short friendly message about observation"),
  action: z
    .object({
      action: z.nativeEnum(PageAction).describe("Action to perform"),
      ref: z.string().optional().describe("Element reference when needed"),
      value: z.string().optional().describe("Value for action when needed"),
    })
    .describe("Browser action to execute"),
  actionStatusMessage: z.string().describe("Short friendly status about action"),
});

// Export the types
export type Plan = z.infer<typeof planSchema>;
export type PlanAndUrl = z.infer<typeof planAndUrlSchema>;
export type Action = z.infer<typeof actionSchema>;

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

/**
 * Get the field order from the action schema for streaming response processing
 *
 * This extracts the field names in the order they appear in the schema definition,
 * ensuring the streaming field order stays in sync with the schema automatically.
 *
 * @returns Array of field names in schema order
 */
export function getActionSchemaFieldOrder(): (keyof Action)[] {
  // Extract keys from the schema shape in definition order
  return Object.keys(actionSchema.shape) as (keyof Action)[];
}

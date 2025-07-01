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
  currentStep: z.string().describe("Current progress status in the plan"),
  extractedData: z.string().describe("Data extracted from the current page"),
  extractedDataStatusMessage: z.string().describe("Brief status about data extraction"),
  observation: z.string().describe("Assessment of previous step outcome"),
  observationStatusMessage: z.string().describe("Short friendly message about observation"),
  thought: z.string().describe("Reasoning for next action"),
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
  observation: z.string().describe("Analysis of agent's approach and actions"),
  completionQuality: z
    .enum(["failed", "partial", "complete", "excellent"])
    .describe("Quality level of task completion"),
  feedback: z.string().optional().describe("Actionable guidance for improvement"),
});

// Export the type for task validation result
export type TaskValidationResult = z.infer<typeof taskValidationSchema>;

import { z } from "zod";
import { PageAction } from "./browser/ariaBrowser.js";

// Schema for plan creation (without URL)
export const planSchema = z.object({
  explanation: z.string(),
  plan: z.string(),
});

// Schema for plan creation with URL
export const planAndUrlSchema = z.object({
  explanation: z.string(),
  plan: z.string(),
  url: z.string(),
});

// Schema for the action loop responses
export const actionSchema = z.object({
  currentStep: z.string(),
  observation: z.string(),
  observationStatusMessage: z.string(),
  extractedData: z.string().optional(),
  extractedDataStatusMessage: z.string().optional(),
  thought: z.string(),
  action: z.object({
    action: z.nativeEnum(PageAction),
    ref: z.string().optional(),
    value: z.string().optional(),
  }),
  actionStatusMessage: z.string(),
});

// Export the types
export type Plan = z.infer<typeof planSchema>;
export type PlanAndUrl = z.infer<typeof planAndUrlSchema>;
export type Action = z.infer<typeof actionSchema>;

// Schema for task validation results
export const taskValidationSchema = z.object({
  observation: z.string(),
  completionQuality: z.enum(["failed", "partial", "complete", "excellent"]),
  feedback: z.string().optional(),
});

// Export the type for task validation result
export type TaskValidationResult = z.infer<typeof taskValidationSchema>;

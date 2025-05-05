import { z } from "zod";
import { PageAction } from "./browser/ariaBrowser.js";

// Schema for the initial plan creation
export const planSchema = z.object({
  explanation: z.string(),
  plan: z.string(),
  url: z.string(),
});

// Schema for the action loop responses
export const actionSchema = z.object({
  currentStep: z.string(),
  observation: z.string(),
  thought: z.string(),
  action: z.object({
    action: z.nativeEnum(PageAction),
    ref: z.string().optional(),
    value: z.string().optional(),
  }),
});

// Export the types
export type Plan = z.infer<typeof planSchema>;
export type Action = z.infer<typeof actionSchema>;

// Schema for task validation results
export const taskValidationSchema = z.object({
  isValid: z.boolean(),
  feedback: z.string().optional(),
});

// Export the type for task validation result
export type TaskValidationResult = z.infer<typeof taskValidationSchema>;

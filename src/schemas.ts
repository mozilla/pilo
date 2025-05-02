import { z } from "zod";

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
    action: z.enum([
      "select", // Choose from dropdown
      "fill", // Enter text
      "click", // Click element
      "hover", // Move mouse over element
      "check", // Check a checkbox
      "uncheck", // Uncheck a checkbox
      "wait", // Pause execution
      "goto", // Navigate to URL
      "back", // Go to previous page
      "forward", // Go to next page
      "done", // Complete task
    ]),
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

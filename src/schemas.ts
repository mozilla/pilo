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
  observation: z
    .string()
    .describe("Assessment of previous step outcome and reasoning for next action"),
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

// Function call schemas for web actions
export const webActionFunctions = {
  click: {
    name: "click",
    description: "Click on an element on the page",
    parameters: z.object({
      ref: z.string().describe("Element reference from page snapshot (e.g., s1e23)"),
    }),
  },

  fill: {
    name: "fill",
    description: "Fill text into an input field",
    parameters: z.object({
      ref: z.string().describe("Element reference from page snapshot (e.g., s1e23)"),
      value: z.string().describe("Text to enter into the field"),
    }),
  },

  select: {
    name: "select",
    description: "Select an option from a dropdown",
    parameters: z.object({
      ref: z.string().describe("Element reference from page snapshot (e.g., s1e23)"),
      value: z.string().describe("Option to select"),
    }),
  },

  hover: {
    name: "hover",
    description: "Hover over an element",
    parameters: z.object({
      ref: z.string().describe("Element reference from page snapshot (e.g., s1e23)"),
    }),
  },

  check: {
    name: "check",
    description: "Check a checkbox",
    parameters: z.object({
      ref: z.string().describe("Element reference from page snapshot (e.g., s1e23)"),
    }),
  },

  uncheck: {
    name: "uncheck",
    description: "Uncheck a checkbox",
    parameters: z.object({
      ref: z.string().describe("Element reference from page snapshot (e.g., s1e23)"),
    }),
  },

  focus: {
    name: "focus",
    description: "Focus on an element",
    parameters: z.object({
      ref: z.string().describe("Element reference from page snapshot (e.g., s1e23)"),
    }),
  },

  enter: {
    name: "enter",
    description: "Press Enter key on an element (useful for form submission)",
    parameters: z.object({
      ref: z.string().describe("Element reference from page snapshot (e.g., s1e23)"),
    }),
  },

  fill_and_enter: {
    name: "fill_and_enter",
    description: "Fill text into an input field and press Enter (useful for search boxes)",
    parameters: z.object({
      ref: z.string().describe("Element reference from page snapshot (e.g., s1e23)"),
      value: z.string().describe("Text to enter into the field"),
    }),
  },

  wait: {
    name: "wait",
    description: "Wait for a specified number of seconds",
    parameters: z.object({
      seconds: z.number().describe("Number of seconds to wait"),
    }),
  },

  goto: {
    name: "goto",
    description: "Navigate to a URL that was previously seen in the conversation",
    parameters: z.object({
      url: z.string().describe("URL to navigate to (must be previously seen)"),
    }),
  },

  back: {
    name: "back",
    description: "Go back to the previous page",
    parameters: z.object({}),
  },

  forward: {
    name: "forward",
    description: "Go forward to the next page",
    parameters: z.object({}),
  },

  extract: {
    name: "extract",
    description: "Extract specific data from the current page",
    parameters: z.object({
      description: z.string().describe("Description of what data to extract"),
    }),
  },

  done: {
    name: "done",
    description:
      "Mark the entire task as complete with final results that directly address ALL parts of the original task",
    parameters: z.object({
      result: z
        .string()
        .describe(
          "A summary of the steps you took to complete the task and the final results that directly address ALL parts of the original task",
        ),
    }),
  },
};

// Function calling schemas for planning
export const planningFunctions = {
  create_plan: {
    name: "create_plan",
    description: "Create a step-by-step plan for completing the task",
    parameters: z.object({
      explanation: z.string().describe("Task explanation in agent's own words"),
      plan: z.string().describe("Step-by-step plan for the task"),
    }),
  },

  create_plan_with_url: {
    name: "create_plan_with_url", 
    description: "Create a step-by-step plan and determine the best starting URL",
    parameters: z.object({
      explanation: z.string().describe("Task explanation in agent's own words"),
      plan: z.string().describe("Step-by-step plan for the task"),
      url: z.string().describe("Starting URL for the task"),
    }),
  },
};

// Function calling schemas for task validation
export const validationFunctions = {
  validate_task: {
    name: "validate_task",
    description: "Evaluate how well the task result accomplishes what the user requested",
    parameters: z.object({
      taskAssessment: z.string().describe("Assessment of whether the result accomplishes the requested task"),
      completionQuality: z.enum(["failed", "partial", "complete", "excellent"]).describe("Quality level of task completion"),
      feedback: z.string().optional().describe("What is missing to complete the task"),
    }),
  },
};

// Function calling schemas for data extraction  
export const extractionFunctions = {
  extract_data: {
    name: "extract_data",
    description: "Extract the requested data from the page content",
    parameters: z.object({
      extractedData: z.string().describe("The extracted data in simple, compact format"),
    }),
  },
};

// Convert function definitions to tools format for AI SDK
export const webActionTools = Object.fromEntries(
  Object.entries(webActionFunctions).map(([key, func]) => [
    key,
    {
      description: func.description,
      parameters: func.parameters,
    },
  ]),
);

export const planningTools = Object.fromEntries(
  Object.entries(planningFunctions).map(([key, func]) => [
    key,
    {
      description: func.description,
      parameters: func.parameters,
    },
  ]),
);

export const validationTools = Object.fromEntries(
  Object.entries(validationFunctions).map(([key, func]) => [
    key,
    {
      description: func.description,
      parameters: func.parameters,
    },
  ]),
);

export const extractionTools = Object.fromEntries(
  Object.entries(extractionFunctions).map(([key, func]) => [
    key,
    {
      description: func.description,
      parameters: func.parameters,
    },
  ]),
);

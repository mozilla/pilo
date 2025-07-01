import { describe, it, expect } from "vitest";
import {
  planSchema,
  planAndUrlSchema,
  actionSchema,
  taskValidationSchema,
  Plan,
  PlanAndUrl,
  Action,
  TaskValidationResult,
} from "../src/schemas.js";
import { PageAction } from "../src/browser/ariaBrowser.js";

describe("schemas", () => {
  describe("planSchema", () => {
    it("should validate valid plan data", () => {
      const validPlan = {
        explanation: "This is a valid explanation",
        plan: "1. Step one\n2. Step two\n3. Step three",
      };

      const result = planSchema.safeParse(validPlan);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validPlan);
      }
    });

    it("should reject plan with missing explanation", () => {
      const invalidPlan = {
        plan: "1. Step one\n2. Step two",
      };

      const result = planSchema.safeParse(invalidPlan);
      expect(result.success).toBe(false);
    });

    it("should reject plan with missing plan", () => {
      const invalidPlan = {
        explanation: "This is an explanation",
      };

      const result = planSchema.safeParse(invalidPlan);
      expect(result.success).toBe(false);
    });

    it("should reject plan with non-string fields", () => {
      const invalidPlan = {
        explanation: 123,
        plan: ["step1", "step2"],
      };

      const result = planSchema.safeParse(invalidPlan);
      expect(result.success).toBe(false);
    });
  });

  describe("planAndUrlSchema", () => {
    it("should validate valid plan and URL data", () => {
      const validPlanAndUrl = {
        explanation: "This is a valid explanation",
        plan: "1. Step one\n2. Step two\n3. Step three",
        url: "https://example.com",
      };

      const result = planAndUrlSchema.safeParse(validPlanAndUrl);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validPlanAndUrl);
      }
    });

    it("should reject plan and URL with missing URL", () => {
      const invalidPlanAndUrl = {
        explanation: "This is an explanation",
        plan: "1. Step one\n2. Step two",
      };

      const result = planAndUrlSchema.safeParse(invalidPlanAndUrl);
      expect(result.success).toBe(false);
    });

    it("should reject plan and URL with non-string URL", () => {
      const invalidPlanAndUrl = {
        explanation: "This is an explanation",
        plan: "1. Step one\n2. Step two",
        url: 123,
      };

      const result = planAndUrlSchema.safeParse(invalidPlanAndUrl);
      expect(result.success).toBe(false);
    });
  });

  describe("actionSchema", () => {
    it("should validate click action", () => {
      const validAction = {
        currentStep: "Working on Step 1: Click the login button",
        observation: "Found the login button on the page",
        observationStatusMessage: "Found login button",
        extractedData: "Found login page with username field and login button",
        thought: "I need to click the login button to proceed",
        action: {
          action: PageAction.Click,
          ref: "s1e23",
        },
        actionStatusMessage: "Clicking login button",
      };

      const result = actionSchema.safeParse(validAction);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validAction);
      }
    });

    it("should validate fill action with value", () => {
      const validAction = {
        currentStep: "Working on Step 2: Fill in username",
        observation: "Found the username field",
        observationStatusMessage: "Found username field",
        extractedData: "Login form with username field ready for input",
        thought: "I need to enter the username",
        action: {
          action: PageAction.Fill,
          ref: "s2e45",
          value: "testuser@example.com",
        },
        actionStatusMessage: "Filling username field",
      };

      const result = actionSchema.safeParse(validAction);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validAction);
      }
    });

    it("should validate wait action", () => {
      const validAction = {
        currentStep: "Working on Step 3: Wait for page load",
        observation: "Page is loading",
        observationStatusMessage: "Page loading detected",
        extractedData: "Page showing loading spinner, content not yet fully loaded",
        thought: "Need to wait for the page to finish loading",
        action: {
          action: PageAction.Wait,
          value: "3",
        },
        actionStatusMessage: "Waiting for page load",
      };

      const result = actionSchema.safeParse(validAction);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validAction);
      }
    });

    it("should validate done action", () => {
      const validAction = {
        currentStep: "Completing: Task finished",
        observation: "Successfully completed the task",
        observationStatusMessage: "Task completed successfully",
        extractedData: "Final result data",
        thought: "The task has been completed successfully",
        action: {
          action: PageAction.Done,
          value: "Task completed successfully",
        },
        actionStatusMessage: "Finishing task",
      };

      const result = actionSchema.safeParse(validAction);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validAction);
      }
    });

    it("should validate goto action", () => {
      const validAction = {
        currentStep: "Working on Step 1: Navigate to login page",
        observation: "Need to go to the login page",
        observationStatusMessage: "Navigation required",
        extractedData: "Current page has login link, need to navigate to login form",
        thought: "I need to navigate to the login URL",
        action: {
          action: PageAction.Goto,
          value: "https://example.com/login",
        },
        actionStatusMessage: "Navigating to login page",
      };

      const result = actionSchema.safeParse(validAction);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validAction);
      }
    });

    it("should validate action with optional extractedData", () => {
      const validActionWithoutExtractedData = {
        currentStep: "Working on Step 1: Click the button",
        observation: "Found the button",
        observationStatusMessage: "Found clickable button",
        extractedData: "Button available for clicking",
        thought: "I need to click the button",
        action: {
          action: PageAction.Click,
          ref: "s1e23",
        },
        actionStatusMessage: "Clicking button",
      };

      const result = actionSchema.safeParse(validActionWithoutExtractedData);
      expect(result.success).toBe(true);
    });

    it("should reject action with missing required fields", () => {
      const invalidAction = {
        currentStep: "Working on Step 1",
        // Missing observation, observationStatusMessage, thought, actionStatusMessage
        action: {
          action: PageAction.Click,
          ref: "s1e23",
        },
      };

      const result = actionSchema.safeParse(invalidAction);
      expect(result.success).toBe(false);
    });

    it("should reject action with invalid action type", () => {
      const invalidAction = {
        currentStep: "Working on Step 1",
        observation: "Found element",
        observationStatusMessage: "Found element",
        thought: "Need to interact",
        action: {
          action: "invalid_action",
          ref: "s1e23",
        },
        actionStatusMessage: "Performing action",
      };

      const result = actionSchema.safeParse(invalidAction);
      expect(result.success).toBe(false);
    });

    it("should validate back and forward actions without ref or value", () => {
      const backAction = {
        currentStep: "Working on Step 1: Go back",
        observation: "Need to go back",
        observationStatusMessage: "Navigation required",
        extractedData: "Current page doesn't have needed info, going back",
        thought: "Going back to previous page",
        action: {
          action: PageAction.Back,
        },
        actionStatusMessage: "Going back",
      };

      const forwardAction = {
        currentStep: "Working on Step 2: Go forward",
        observation: "Need to go forward",
        observationStatusMessage: "Forward navigation needed",
        extractedData: "Ready to proceed to next page in workflow",
        thought: "Going forward to next page",
        action: {
          action: PageAction.Forward,
        },
        actionStatusMessage: "Going forward",
      };

      expect(actionSchema.safeParse(backAction).success).toBe(true);
      expect(actionSchema.safeParse(forwardAction).success).toBe(true);
    });

    it("should validate all PageAction enum values", () => {
      const actions = Object.values(PageAction);

      actions.forEach((actionType) => {
        const validAction = {
          currentStep: `Working on: ${actionType}`,
          observation: "Valid observation",
          observationStatusMessage: "Page analyzed",
          extractedData: `Data relevant to ${actionType} action`,
          thought: "Valid thought",
          action: {
            action: actionType,
            ...(["click", "fill", "select", "hover", "check", "uncheck", "enter"].includes(
              actionType,
            ) && {
              ref: "s1e23",
            }),
            ...(["fill", "select", "wait", "goto", "done"].includes(actionType) && {
              value: "test value",
            }),
          },
          actionStatusMessage: `Performing ${actionType}`,
        };

        const result = actionSchema.safeParse(validAction);
        expect(result.success).toBe(true);
      });
    });

    it("should validate action with extractedData", () => {
      const actionWithExtractedData = {
        currentStep: "Working on Step 1",
        observation: "Found data",
        observationStatusMessage: "Data found",
        extractedData: "Some important data",
        thought: "Processing data",
        action: {
          action: PageAction.Click,
          ref: "s1e23",
        },
        actionStatusMessage: "Clicking element",
      };

      const result = actionSchema.safeParse(actionWithExtractedData);
      expect(result.success).toBe(true);
    });

    it("should validate action with fallback extractedData", () => {
      const actionWithFallbackData = {
        currentStep: "Working on Step 1",
        observation: "No data found",
        observationStatusMessage: "Page analyzed",
        extractedData: "No task related data.",
        thought: "Moving on",
        action: {
          action: PageAction.Click,
          ref: "s1e23",
        },
        actionStatusMessage: "Clicking element",
      };

      const result = actionSchema.safeParse(actionWithFallbackData);
      expect(result.success).toBe(true);
    });
  });

  describe("taskValidationSchema", () => {
    it("should validate valid task validation result", () => {
      const validResult = {
        observation: "The agent followed a logical sequence and completed the task efficiently",
        completionQuality: "excellent" as const,
        feedback: "Task completed successfully",
      };

      const result = taskValidationSchema.safeParse(validResult);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validResult);
      }
    });

    it("should validate task validation without feedback", () => {
      const validResult = {
        observation: "The agent made some progress but did not complete the main objective",
        completionQuality: "partial" as const,
      };

      const result = taskValidationSchema.safeParse(validResult);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.completionQuality).toBe("partial");
        expect(result.data.feedback).toBeUndefined();
      }
    });

    it("should reject task validation with missing completionQuality", () => {
      const invalidResult = {
        observation: "Some observation",
        feedback: "Some feedback",
      };

      const result = taskValidationSchema.safeParse(invalidResult);
      expect(result.success).toBe(false);
    });

    it("should reject task validation with invalid completionQuality", () => {
      const invalidResult = {
        observation: "Some observation",
        completionQuality: "invalid_quality",
        feedback: "Some feedback",
      };

      const result = taskValidationSchema.safeParse(invalidResult);
      expect(result.success).toBe(false);
    });

    it("should reject task validation with non-string feedback", () => {
      const invalidResult = {
        observation: "Some observation",
        completionQuality: "complete",
        feedback: 123,
      };

      const result = taskValidationSchema.safeParse(invalidResult);
      expect(result.success).toBe(false);
    });

    it("should validate all completion quality levels", () => {
      const qualities = ["failed", "partial", "complete", "excellent"] as const;

      qualities.forEach((quality) => {
        const validResult = {
          observation: "Test observation",
          completionQuality: quality,
        };

        const result = taskValidationSchema.safeParse(validResult);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.completionQuality).toBe(quality);
        }
      });
    });
  });

  describe("Type exports", () => {
    it("should export correct TypeScript types", () => {
      // This test ensures the types are exported correctly
      const plan: Plan = {
        explanation: "test",
        plan: "test plan",
      };

      const planAndUrl: PlanAndUrl = {
        explanation: "test",
        plan: "test plan",
        url: "https://example.com",
      };

      const action: Action = {
        currentStep: "test",
        observation: "test",
        observationStatusMessage: "test status",
        extractedData: "test",
        thought: "test",
        action: {
          action: PageAction.Click,
          ref: "s1e23",
        },
        actionStatusMessage: "clicking element",
      };

      const validation: TaskValidationResult = {
        observation: "test observation",
        completionQuality: "complete",
        feedback: "test",
      };

      // If this compiles, the types are exported correctly
      expect(plan).toBeDefined();
      expect(planAndUrl).toBeDefined();
      expect(action).toBeDefined();
      expect(validation).toBeDefined();
    });
  });
});

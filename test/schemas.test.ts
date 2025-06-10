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
        extractedData: "",
        thought: "I need to click the login button to proceed",
        action: {
          action: PageAction.Click,
          ref: "s1e23",
        },
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
        extractedData: "",
        thought: "I need to enter the username",
        action: {
          action: PageAction.Fill,
          ref: "s2e45",
          value: "testuser@example.com",
        },
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
        extractedData: "",
        thought: "Need to wait for the page to finish loading",
        action: {
          action: PageAction.Wait,
          value: "3",
        },
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
        extractedData: "Final result data",
        thought: "The task has been completed successfully",
        action: {
          action: PageAction.Done,
          value: "Task completed successfully",
        },
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
        extractedData: "",
        thought: "I need to navigate to the login URL",
        action: {
          action: PageAction.Goto,
          value: "https://example.com/login",
        },
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
        thought: "I need to click the button",
        action: {
          action: PageAction.Click,
          ref: "s1e23",
        },
      };

      const result = actionSchema.safeParse(validActionWithoutExtractedData);
      expect(result.success).toBe(true);
    });

    it("should reject action with missing required fields", () => {
      const invalidAction = {
        currentStep: "Working on Step 1",
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
        thought: "Need to interact",
        action: {
          action: "invalid_action",
          ref: "s1e23",
        },
      };

      const result = actionSchema.safeParse(invalidAction);
      expect(result.success).toBe(false);
    });

    it("should validate back and forward actions without ref or value", () => {
      const backAction = {
        currentStep: "Working on Step 1: Go back",
        observation: "Need to go back",
        extractedData: "",
        thought: "Going back to previous page",
        action: {
          action: PageAction.Back,
        },
      };

      const forwardAction = {
        currentStep: "Working on Step 2: Go forward",
        observation: "Need to go forward",
        extractedData: "",
        thought: "Going forward to next page",
        action: {
          action: PageAction.Forward,
        },
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
          extractedData: "",
          thought: "Valid thought",
          action: {
            action: actionType,
            ...(["click", "fill", "select", "hover", "check", "uncheck"].includes(actionType) && {
              ref: "s1e23",
            }),
            ...(["fill", "select", "wait", "goto", "done"].includes(actionType) && {
              value: "test value",
            }),
          },
        };

        const result = actionSchema.safeParse(validAction);
        expect(result.success).toBe(true);
      });
    });
  });

  describe("taskValidationSchema", () => {
    it("should validate valid task validation result", () => {
      const validResult = {
        isValid: true,
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
        isValid: false,
      };

      const result = taskValidationSchema.safeParse(validResult);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isValid).toBe(false);
        expect(result.data.feedback).toBeUndefined();
      }
    });

    it("should reject task validation with missing isValid", () => {
      const invalidResult = {
        feedback: "Some feedback",
      };

      const result = taskValidationSchema.safeParse(invalidResult);
      expect(result.success).toBe(false);
    });

    it("should reject task validation with non-boolean isValid", () => {
      const invalidResult = {
        isValid: "true",
        feedback: "Some feedback",
      };

      const result = taskValidationSchema.safeParse(invalidResult);
      expect(result.success).toBe(false);
    });

    it("should reject task validation with non-string feedback", () => {
      const invalidResult = {
        isValid: true,
        feedback: 123,
      };

      const result = taskValidationSchema.safeParse(invalidResult);
      expect(result.success).toBe(false);
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
        extractedData: "test",
        thought: "test",
        action: {
          action: PageAction.Click,
          ref: "s1e23",
        },
      };

      const validation: TaskValidationResult = {
        isValid: true,
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

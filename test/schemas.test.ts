import { describe, it, expect } from "vitest";
import {
  webActionFunctions,
  planningFunctions,
  validationFunctions,
  extractionFunctions,
  webActionTools,
  planningTools,
  validationTools,
  extractionTools,
} from "../src/schemas.js";

describe("Function Call Schemas", () => {
  describe("webActionFunctions", () => {
    it("should have all required web action functions", () => {
      const expectedActions = [
        "click",
        "fill",
        "select",
        "hover",
        "check",
        "uncheck",
        "focus",
        "enter",
        "fill_and_enter",
        "wait",
        "goto",
        "back",
        "forward",
        "extract",
        "done",
      ];

      expectedActions.forEach((action) => {
        expect(webActionFunctions).toHaveProperty(action);
        expect(webActionFunctions[action]).toHaveProperty("description");
        expect(webActionFunctions[action]).toHaveProperty("parameters");
      });
    });

    it("should validate click function parameters", () => {
      const clickParams = webActionFunctions.click.parameters;
      const validParams = { ref: "s1e23" };
      const result = clickParams.safeParse(validParams);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validParams);
      }
    });

    it("should reject click function with missing ref", () => {
      const clickParams = webActionFunctions.click.parameters;
      const invalidParams = {};
      const result = clickParams.safeParse(invalidParams);

      expect(result.success).toBe(false);
    });

    it("should validate fill function parameters", () => {
      const fillParams = webActionFunctions.fill.parameters;
      const validParams = { ref: "s1e23", value: "test input" };
      const result = fillParams.safeParse(validParams);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validParams);
      }
    });

    it("should reject fill function with missing value", () => {
      const fillParams = webActionFunctions.fill.parameters;
      const invalidParams = { ref: "s1e23" };
      const result = fillParams.safeParse(invalidParams);

      expect(result.success).toBe(false);
    });

    it("should validate wait function parameters", () => {
      const waitParams = webActionFunctions.wait.parameters;
      const validParams = { seconds: 3 };
      const result = waitParams.safeParse(validParams);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validParams);
      }
    });

    it("should reject wait function with non-number seconds", () => {
      const waitParams = webActionFunctions.wait.parameters;
      const invalidParams = { seconds: "three" };
      const result = waitParams.safeParse(invalidParams);

      expect(result.success).toBe(false);
    });

    it("should validate goto function parameters", () => {
      const gotoParams = webActionFunctions.goto.parameters;
      const validParams = { url: "https://example.com" };
      const result = gotoParams.safeParse(validParams);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validParams);
      }
    });

    it("should validate done function parameters", () => {
      const doneParams = webActionFunctions.done.parameters;
      const validParams = { result: "Task completed successfully with all requirements met" };
      const result = doneParams.safeParse(validParams);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validParams);
      }
    });

    it("should validate back and forward functions with empty parameters", () => {
      const backParams = webActionFunctions.back.parameters;
      const forwardParams = webActionFunctions.forward.parameters;
      const emptyParams = {};

      expect(backParams.safeParse(emptyParams).success).toBe(true);
      expect(forwardParams.safeParse(emptyParams).success).toBe(true);
    });
  });

  describe("planningFunctions", () => {
    it("should have planning functions", () => {
      expect(planningFunctions).toHaveProperty("create_plan");
      expect(planningFunctions).toHaveProperty("create_plan_with_url");
    });

    it("should validate create_plan parameters", () => {
      const planParams = planningFunctions.create_plan.parameters;
      const validParams = {
        explanation: "This task requires navigating to a website",
        plan: "1. Go to website\n2. Find login\n3. Enter credentials",
      };
      const result = planParams.safeParse(validParams);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validParams);
      }
    });

    it("should validate create_plan_with_url parameters", () => {
      const planParams = planningFunctions.create_plan_with_url.parameters;
      const validParams = {
        explanation: "This task requires navigating to a website",
        plan: "1. Go to website\n2. Find login\n3. Enter credentials",
        url: "https://example.com",
      };
      const result = planParams.safeParse(validParams);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validParams);
      }
    });
  });

  describe("validationFunctions", () => {
    it("should have validate_task function", () => {
      expect(validationFunctions).toHaveProperty("validate_task");
    });

    it("should validate task validation parameters", () => {
      const validationParams = validationFunctions.validate_task.parameters;
      const validParams = {
        taskAssessment: "The task was completed successfully",
        completionQuality: "complete",
        feedback: "All requirements were met",
      };
      const result = validationParams.safeParse(validParams);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validParams);
      }
    });

    it("should validate all completion quality levels", () => {
      const validationParams = validationFunctions.validate_task.parameters;
      const qualities = ["failed", "partial", "complete", "excellent"];

      qualities.forEach((quality) => {
        const params = {
          taskAssessment: "Test assessment",
          completionQuality: quality,
        };
        const result = validationParams.safeParse(params);
        expect(result.success).toBe(true);
      });
    });

    it("should reject invalid completion quality", () => {
      const validationParams = validationFunctions.validate_task.parameters;
      const invalidParams = {
        taskAssessment: "Test assessment",
        completionQuality: "invalid_quality",
      };
      const result = validationParams.safeParse(invalidParams);

      expect(result.success).toBe(false);
    });

    it("should allow optional feedback", () => {
      const validationParams = validationFunctions.validate_task.parameters;
      const paramsWithoutFeedback = {
        taskAssessment: "Test assessment",
        completionQuality: "complete",
      };
      const result = validationParams.safeParse(paramsWithoutFeedback);

      expect(result.success).toBe(true);
    });
  });

  describe("extractionFunctions", () => {
    it("should have extract_data function", () => {
      expect(extractionFunctions).toHaveProperty("extract_data");
    });

    it("should validate extraction parameters", () => {
      const extractionParams = extractionFunctions.extract_data.parameters;
      const validParams = {
        extractedData: "Product name: Widget A, Price: $29.99",
      };
      const result = extractionParams.safeParse(validParams);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validParams);
      }
    });
  });

  describe("Tool Format Conversion", () => {
    it("should convert web action functions to tools format", () => {
      expect(webActionTools).toBeDefined();
      expect(webActionTools.click).toHaveProperty("description");
      expect(webActionTools.click).toHaveProperty("inputSchema");
      expect(webActionTools.click).not.toHaveProperty("name");
    });

    it("should convert planning functions to tools format", () => {
      expect(planningTools).toBeDefined();
      expect(planningTools.create_plan).toHaveProperty("description");
      expect(planningTools.create_plan).toHaveProperty("inputSchema");
      expect(planningTools.create_plan).not.toHaveProperty("name");
    });

    it("should convert validation functions to tools format", () => {
      expect(validationTools).toBeDefined();
      expect(validationTools.validate_task).toHaveProperty("description");
      expect(validationTools.validate_task).toHaveProperty("inputSchema");
      expect(validationTools.validate_task).not.toHaveProperty("name");
    });

    it("should convert extraction functions to tools format", () => {
      expect(extractionTools).toBeDefined();
      expect(extractionTools.extract_data).toHaveProperty("description");
      expect(extractionTools.extract_data).toHaveProperty("inputSchema");
      expect(extractionTools.extract_data).not.toHaveProperty("name");
    });
  });

  describe("Function Parameter Validation", () => {
    it("should validate all action functions that require ref", () => {
      const refRequiredActions = [
        "click",
        "fill",
        "select",
        "hover",
        "check",
        "uncheck",
        "focus",
        "enter",
        "fill_and_enter",
      ];

      refRequiredActions.forEach((action) => {
        const params = webActionFunctions[action].parameters;
        const validParams =
          action === "fill" || action === "select" || action === "fill_and_enter"
            ? { ref: "s1e23", value: "test" }
            : { ref: "s1e23" };

        const result = params.safeParse(validParams);
        expect(result.success).toBe(true);

        // Test missing ref
        const invalidParams =
          action === "fill" || action === "select" || action === "fill_and_enter"
            ? { value: "test" }
            : {};
        const invalidResult = params.safeParse(invalidParams);
        expect(invalidResult.success).toBe(false);
      });
    });

    it("should validate all action functions that require value", () => {
      const valueRequiredActions = [
        "fill",
        "select",
        "fill_and_enter",
        "wait",
        "goto",
        "extract",
        "done",
      ];

      valueRequiredActions.forEach((action) => {
        const params = webActionFunctions[action].parameters;
        let validParams;

        if (action === "wait") {
          validParams = { seconds: 3 };
        } else if (action === "fill" || action === "select" || action === "fill_and_enter") {
          validParams = { ref: "s1e23", value: "test" };
        } else if (action === "goto") {
          validParams = { url: "https://example.com" };
        } else if (action === "extract") {
          validParams = { description: "extract data" };
        } else if (action === "done") {
          validParams = { result: "task complete" };
        }

        const result = params.safeParse(validParams);
        expect(result.success).toBe(true);
      });
    });
  });
});

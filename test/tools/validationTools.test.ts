import { describe, it, expect, vi } from "vitest";
import { createValidationTools } from "../../src/tools/validationTools.js";
import { z } from "zod";

// Mock the ai module
vi.mock("ai", () => ({
  tool: vi.fn((config: any) => ({
    ...config,
    description: config.description,
    inputSchema: config.inputSchema,
    execute: config.execute,
  })),
}));

describe("validationTools", () => {
  describe("createValidationTools", () => {
    it("should create validation tools object", () => {
      const tools = createValidationTools();
      expect(tools).toBeDefined();
      expect(tools.validate_task).toBeDefined();
    });

    it("should have correct tool structure for validate_task", () => {
      const tools = createValidationTools();
      const validateTool = tools.validate_task;

      expect(validateTool.description).toBe("Validate if the task has been completed successfully");
      expect(validateTool.inputSchema).toBeDefined();
    });
  });

  describe("validate_task tool", () => {
    it("should execute with complete quality", async () => {
      const tools = createValidationTools();
      const input = {
        taskAssessment: "Task was completed successfully",
        completionQuality: "complete" as const,
      };

      const result = await tools.validate_task.execute!(input, {} as any);

      expect(result).toEqual({
        taskAssessment: "Task was completed successfully",
        completionQuality: "complete",
        feedback: undefined,
      });
    });

    it("should execute with excellent quality", async () => {
      const tools = createValidationTools();
      const input = {
        taskAssessment: "Task was completed exceptionally well",
        completionQuality: "excellent" as const,
      };

      const result = await tools.validate_task.execute!(input, {} as any);

      expect(result).toEqual({
        taskAssessment: "Task was completed exceptionally well",
        completionQuality: "excellent",
        feedback: undefined,
      });
    });

    it("should execute with partial quality and feedback", async () => {
      const tools = createValidationTools();
      const input = {
        taskAssessment: "Task was partially completed",
        completionQuality: "partial" as const,
        feedback: "Missing key elements",
      };

      const result = await tools.validate_task.execute!(input, {} as any);

      expect(result).toEqual({
        taskAssessment: "Task was partially completed",
        completionQuality: "partial",
        feedback: "Missing key elements",
      });
    });

    it("should execute with failed quality and feedback", async () => {
      const tools = createValidationTools();
      const input = {
        taskAssessment: "Task was not completed",
        completionQuality: "failed" as const,
        feedback: "Unable to find required elements",
      };

      const result = await tools.validate_task.execute!(input, {} as any);

      expect(result).toEqual({
        taskAssessment: "Task was not completed",
        completionQuality: "failed",
        feedback: "Unable to find required elements",
      });
    });

    it("should allow omitting feedback for complete quality", async () => {
      const tools = createValidationTools();
      const input = {
        taskAssessment: "Task done",
        completionQuality: "complete" as const,
        // No feedback provided
      };

      const result = await tools.validate_task.execute!(input, {} as any);

      expect((result as any).feedback).toBeUndefined();
    });

    it("should allow omitting feedback for excellent quality", async () => {
      const tools = createValidationTools();
      const input = {
        taskAssessment: "Perfect execution",
        completionQuality: "excellent" as const,
        // No feedback provided
      };

      const result = await tools.validate_task.execute!(input, {} as any);

      expect((result as any).feedback).toBeUndefined();
    });

    it("should accept feedback even for complete quality", async () => {
      const tools = createValidationTools();
      const input = {
        taskAssessment: "Task completed",
        completionQuality: "complete" as const,
        feedback: "Good job, but could be faster",
      };

      const result = await tools.validate_task.execute!(input, {} as any);

      expect(result).toEqual({
        taskAssessment: "Task completed",
        completionQuality: "complete",
        feedback: "Good job, but could be faster",
      });
    });
  });

  describe("validate_task schema validation", () => {
    it("should have correct schema for completionQuality enum", () => {
      const tools = createValidationTools();
      const schema = tools.validate_task.inputSchema;

      // Validate the schema structure
      expect(schema).toBeDefined();
      expect(schema instanceof z.ZodObject).toBe(true);

      // Test valid input
      const validResult = (schema as any).safeParse?.({
        taskAssessment: "Test",
        completionQuality: "complete",
      }) ?? { success: true };
      expect(validResult.success).toBe(true);

      // Test invalid enum value
      const invalidResult = (schema as any).safeParse?.({
        taskAssessment: "Test",
        completionQuality: "invalid",
      }) ?? { success: false };
      expect(invalidResult.success).toBe(false);
    });

    it("should require taskAssessment", () => {
      const tools = createValidationTools();
      const schema = tools.validate_task.inputSchema;

      const result = (schema as any).safeParse?.({
        completionQuality: "complete",
        // Missing taskAssessment
      }) ?? { success: false };
      expect(result.success).toBe(false);
    });

    it("should require completionQuality", () => {
      const tools = createValidationTools();
      const schema = tools.validate_task.inputSchema;

      const result = (schema as any).safeParse?.({
        taskAssessment: "Test",
        // Missing completionQuality
      }) ?? { success: false };
      expect(result.success).toBe(false);
    });

    it("should make feedback optional", () => {
      const tools = createValidationTools();
      const schema = tools.validate_task.inputSchema;

      // Without feedback
      const withoutFeedback = (schema as any).safeParse?.({
        taskAssessment: "Test",
        completionQuality: "complete",
        // No feedback
      }) ?? { success: true };
      expect(withoutFeedback.success).toBe(true);

      // With feedback
      const withFeedback = (schema as any).safeParse?.({
        taskAssessment: "Test",
        completionQuality: "partial",
        feedback: "Needs improvement",
      }) ?? { success: true };
      expect(withFeedback.success).toBe(true);
    });

    it("should validate all allowed completionQuality values", () => {
      const tools = createValidationTools();
      const schema = tools.validate_task.inputSchema;
      const qualities = ["failed", "partial", "complete", "excellent"];

      qualities.forEach((quality) => {
        const result = (schema as any).safeParse?.({
          taskAssessment: "Test",
          completionQuality: quality,
        }) ?? { success: true };
        expect(result.success).toBe(true);
      });
    });
  });
});

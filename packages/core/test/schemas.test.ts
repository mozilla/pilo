import { describe, it, expect } from "vitest";
import { taskValidationSchema } from "../src/schemas.js";

describe("Schema Types", () => {
  describe("taskValidationSchema", () => {
    it("should validate a complete task validation result", () => {
      const validResult = {
        taskAssessment: "Task completed successfully",
        completionQuality: "complete" as const,
        feedback: undefined,
      };

      const result = taskValidationSchema.safeParse(validResult);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.completionQuality).toBe("complete");
      }
    });

    it("should validate a partial task validation result with feedback", () => {
      const validResult = {
        taskAssessment: "Task partially completed",
        completionQuality: "partial" as const,
        feedback: "Need to complete the final step",
      };

      const result = taskValidationSchema.safeParse(validResult);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.completionQuality).toBe("partial");
        expect(result.data.feedback).toBe("Need to complete the final step");
      }
    });

    it("should reject invalid completion quality", () => {
      const invalidResult = {
        taskAssessment: "Task assessment",
        completionQuality: "invalid",
        feedback: undefined,
      };

      const result = taskValidationSchema.safeParse(invalidResult);
      expect(result.success).toBe(false);
    });

    it("should accept all valid completion quality values", () => {
      const qualities = ["failed", "partial", "complete", "excellent"];

      qualities.forEach((quality) => {
        const validResult = {
          taskAssessment: "Task assessment",
          completionQuality: quality,
        };

        const result = taskValidationSchema.safeParse(validResult);
        expect(result.success).toBe(true);
      });
    });
  });
});

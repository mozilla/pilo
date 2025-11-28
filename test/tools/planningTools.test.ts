import { describe, it, expect, vi } from "vitest";
import { createPlanningTools } from "../../src/tools/planningTools.js";
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

describe("Planning Tools", () => {
  describe("createPlanningTools", () => {
    it("should create planning tools with correct structure", () => {
      const tools = createPlanningTools();

      expect(tools).toBeDefined();
      expect(tools.create_plan).toBeDefined();
      expect(tools.create_plan_with_url).toBeDefined();
    });

    it("should have correct description for create_plan", () => {
      const tools = createPlanningTools();

      expect(tools.create_plan.description).toBe(
        "Create a step-by-step plan for completing the task, MUST be formatted as VALID Markdown",
      );
    });

    it("should have correct description for create_plan_with_url", () => {
      const tools = createPlanningTools();

      expect(tools.create_plan_with_url.description).toBe(
        "Create a step-by-step plan, MUST be formatted as VALID Markdown and determine the best starting URL",
      );
    });

    it("should have correct input schema for create_plan", () => {
      const tools = createPlanningTools();
      const schema = tools.create_plan.inputSchema;

      // Validate the schema structure
      expect(schema).toBeDefined();
      expect(schema instanceof z.ZodObject).toBe(true);

      // Test valid input
      const validInput = {
        successCriteria: "I need to search for information",
        plan: "1. Navigate to search\n2. Enter query\n3. Review results",
      };

      const result = (schema as any).safeParse?.(validInput) ?? { success: true };
      expect(result.success).toBe(true);
    });

    it("should have correct input schema for create_plan_with_url", () => {
      const tools = createPlanningTools();
      const schema = tools.create_plan_with_url.inputSchema;

      // Validate the schema structure
      expect(schema).toBeDefined();
      expect(schema instanceof z.ZodObject).toBe(true);

      // Test valid input
      const validInput = {
        successCriteria: "I need to search for flights",
        plan: "1. Go to travel site\n2. Enter dates\n3. Search flights",
        url: "https://travel-site.com",
      };

      const result = (schema as any).safeParse?.(validInput) ?? { success: true };
      expect(result.success).toBe(true);
    });

    it("should reject invalid input for create_plan", () => {
      const tools = createPlanningTools();
      const schema = tools.create_plan.inputSchema;

      // Missing required fields
      const invalidInput = {
        successCriteria: "Test",
        // missing plan
      };

      const result = (schema as any).safeParse?.(invalidInput) ?? { success: false };
      expect(result.success).toBe(false);
    });

    it("should reject invalid input for create_plan_with_url", () => {
      const tools = createPlanningTools();
      const schema = tools.create_plan_with_url.inputSchema;

      // Missing required fields
      const invalidInput = {
        successCriteria: "Test",
        plan: "1. Do something",
        // missing url
      };

      const result = (schema as any).safeParse?.(invalidInput) ?? { success: false };
      expect(result.success).toBe(false);
    });

    it("should execute create_plan and return input", async () => {
      const tools = createPlanningTools();

      const input = {
        successCriteria: "Test successCriteria",
        plan: "Test plan",
      };

      const result = await tools.create_plan.execute!(input, {} as any);

      expect(result).toEqual(input);
      expect((result as any).successCriteria).toBe("Test successCriteria");
      expect((result as any).plan).toBe("Test plan");
    });

    it("should execute create_plan_with_url and return input", async () => {
      const tools = createPlanningTools();

      const input = {
        successCriteria: "Test successCriteria",
        plan: "Test plan",
        url: "https://example.com",
      };

      const result = await tools.create_plan_with_url.execute!(input, {} as any);

      expect(result).toEqual(input);
      expect((result as any).successCriteria).toBe("Test successCriteria");
      expect((result as any).plan).toBe("Test plan");
      expect((result as any).url).toBe("https://example.com");
    });

    it("should handle empty strings in input", async () => {
      const tools = createPlanningTools();

      const input = {
        successCriteria: "",
        plan: "",
      };

      const result = await tools.create_plan.execute!(input, {} as any);

      expect(result).toEqual(input);
      expect((result as any).successCriteria).toBe("");
      expect((result as any).plan).toBe("");
    });

    it("should handle long multi-line plans", async () => {
      const tools = createPlanningTools();

      const longPlan = `
        1. First step with detailed explanation
        2. Second step with multiple sub-steps:
           a. Sub-step one
           b. Sub-step two
           c. Sub-step three
        3. Third step with additional context
        4. Final step with conclusion
      `.trim();

      const input = {
        successCriteria: "Complex task requiring multiple steps",
        plan: longPlan,
      };

      const result = await tools.create_plan.execute!(input, {} as any);

      expect((result as any).plan).toBe(longPlan);
    });

    it("should handle URLs with query parameters", async () => {
      const tools = createPlanningTools();

      const input = {
        successCriteria: "Search task",
        plan: "1. Search for item",
        url: "https://example.com/search?q=test&filter=true&page=1",
      };

      const result = await tools.create_plan_with_url.execute!(input, {} as any);

      expect((result as any).url).toBe("https://example.com/search?q=test&filter=true&page=1");
    });

    it("should handle international characters in input", async () => {
      const tools = createPlanningTools();

      const input = {
        successCriteria: "Tâche en français",
        plan: "1. Étape un\n2. Étape deux\n3. 完成任务",
        url: "https://example.com/fr",
      };

      const result = await tools.create_plan_with_url.execute!(input, {} as any);

      expect((result as any).successCriteria).toBe("Tâche en français");
      expect((result as any).plan).toContain("Étape");
      expect((result as any).plan).toContain("完成任务");
    });
  });
});

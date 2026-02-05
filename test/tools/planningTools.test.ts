import { describe, it, expect } from "vitest";
import { createPlanningTools } from "../../src/tools/planningTools.js";
import { z } from "zod";
import type { CoreMessage } from "ai";

interface CreatePlanResult {
  successCriteria: string;
  plan: string;
  url?: string;
  actionItems?: string[];
}

describe("Planning Tools", () => {
  describe("createPlanningTools", () => {
    it("should create planning tools with correct structure", () => {
      const tools = createPlanningTools();

      expect(tools).toBeDefined();
      expect(tools.create_plan).toBeDefined();
    });

    it("should have correct description for create_plan", () => {
      const tools = createPlanningTools();

      expect(tools.create_plan.description).toBe(
        "Create a step-by-step plan for completing the task, MUST be formatted as VALID Markdown",
      );
    });

    it("should have correct input schema for create_plan", () => {
      const tools = createPlanningTools();
      const schema = tools.create_plan.inputSchema;

      // Validate the schema structure
      expect(schema).toBeDefined();
      expect(schema instanceof z.ZodObject).toBe(true);

      // Test valid input without url
      const validInput = {
        successCriteria: "I need to search for information",
        plan: "1. Navigate to search\n2. Enter query\n3. Review results",
      };

      const zodSchema = schema as unknown as z.ZodObject<z.ZodRawShape>;
      const result = zodSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it("should accept create_plan with optional url", () => {
      const tools = createPlanningTools();
      const schema = tools.create_plan.inputSchema;

      const validInput = {
        successCriteria: "I need to search for flights",
        plan: "1. Go to travel site\n2. Enter dates\n3. Search flights",
        url: "https://travel-site.com",
      };

      const zodSchema = schema as unknown as z.ZodObject<z.ZodRawShape>;
      const result = zodSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it("should accept create_plan without url", () => {
      const tools = createPlanningTools();
      const schema = tools.create_plan.inputSchema;

      const validInput = {
        successCriteria: "I need to search for information",
        plan: "1. Navigate to search\n2. Enter query\n3. Review results",
      };

      const zodSchema = schema as unknown as z.ZodObject<z.ZodRawShape>;
      const result = zodSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it("should reject invalid url in create_plan", () => {
      const tools = createPlanningTools();
      const schema = tools.create_plan.inputSchema;

      const invalidInput = {
        successCriteria: "Test",
        plan: "1. Do something",
        url: "not-a-url",
      };

      const zodSchema = schema as unknown as z.ZodObject<z.ZodRawShape>;
      const result = zodSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it("should reject empty string url in create_plan", () => {
      const tools = createPlanningTools();
      const schema = tools.create_plan.inputSchema;

      const invalidInput = {
        successCriteria: "Test",
        plan: "1. Do something",
        url: "",
      };

      const zodSchema = schema as unknown as z.ZodObject<z.ZodRawShape>;
      const result = zodSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it("should reject invalid input for create_plan", () => {
      const tools = createPlanningTools();
      const schema = tools.create_plan.inputSchema;

      // Missing required fields
      const invalidInput = {
        successCriteria: "Test",
        // missing plan
      };

      const zodSchema = schema as unknown as z.ZodObject<z.ZodRawShape>;
      const result = zodSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it("should execute create_plan and return input without url", async () => {
      const tools = createPlanningTools();

      const input = {
        successCriteria: "Test successCriteria",
        plan: "Test plan",
      };

      const result = (await tools.create_plan.execute!(input, {
        toolCallId: "test",
        messages: [] as CoreMessage[],
      })) as CreatePlanResult;

      expect(result).toEqual(input);
      expect(result.successCriteria).toBe("Test successCriteria");
      expect(result.plan).toBe("Test plan");
      expect(result.url).toBeUndefined();
    });

    it("should execute create_plan and return input with url", async () => {
      const tools = createPlanningTools();

      const input = {
        successCriteria: "Test successCriteria",
        plan: "Test plan",
        url: "https://example.com",
      };

      const result = (await tools.create_plan.execute!(input, {
        toolCallId: "test",
        messages: [] as CoreMessage[],
      })) as CreatePlanResult;

      expect(result.successCriteria).toBe("Test successCriteria");
      expect(result.plan).toBe("Test plan");
      expect(result.url).toBe("https://example.com");
    });

    it("should handle empty strings in input", async () => {
      const tools = createPlanningTools();

      const input = {
        successCriteria: "",
        plan: "",
      };

      const result = (await tools.create_plan.execute!(input, {
        toolCallId: "test",
        messages: [] as CoreMessage[],
      })) as CreatePlanResult;

      expect(result).toEqual(input);
      expect(result.successCriteria).toBe("");
      expect(result.plan).toBe("");
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

      const result = (await tools.create_plan.execute!(input, {
        toolCallId: "test",
        messages: [] as CoreMessage[],
      })) as CreatePlanResult;

      expect(result.plan).toBe(longPlan);
    });

    it("should handle URLs with query parameters", async () => {
      const tools = createPlanningTools();

      const input = {
        successCriteria: "Search task",
        plan: "1. Search for item",
        url: "https://example.com/search?q=test&filter=true&page=1",
      };

      const result = (await tools.create_plan.execute!(input, {
        toolCallId: "test",
        messages: [] as CoreMessage[],
      })) as CreatePlanResult;

      expect(result.url).toBe("https://example.com/search?q=test&filter=true&page=1");
    });

    it("should handle international characters in input", async () => {
      const tools = createPlanningTools();

      const input = {
        successCriteria: "Tâche en français",
        plan: "1. Étape un\n2. Étape deux\n3. 完成任务",
        url: "https://example.com/fr",
      };

      const result = (await tools.create_plan.execute!(input, {
        toolCallId: "test",
        messages: [] as CoreMessage[],
      })) as CreatePlanResult;

      expect(result.successCriteria).toBe("Tâche en français");
      expect(result.plan).toContain("Étape");
      expect(result.plan).toContain("完成任务");
    });

    it("should accept actionItems array in create_plan", () => {
      const tools = createPlanningTools();
      const schema = tools.create_plan.inputSchema;

      const validInput = {
        successCriteria: "I need to search for information",
        plan: "1. Navigate to search\n2. Enter query\n3. Review results",
        actionItems: ["Navigate to search", "Enter query", "Review results"],
      };

      const zodSchema = schema as unknown as z.ZodObject<z.ZodRawShape>;
      const result = zodSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it("should reject invalid actionItems (non-array) in create_plan", () => {
      const tools = createPlanningTools();
      const schema = tools.create_plan.inputSchema;

      const invalidInput = {
        successCriteria: "Test",
        plan: "1. Do something",
        actionItems: "not an array", // should be array
      };

      const zodSchema = schema as unknown as z.ZodObject<z.ZodRawShape>;
      const result = zodSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it("should reject invalid actionItems (non-string elements) in create_plan", () => {
      const tools = createPlanningTools();
      const schema = tools.create_plan.inputSchema;

      const invalidInput = {
        successCriteria: "Test",
        plan: "1. Do something",
        actionItems: [123, true, { item: "wrong" }], // should be string array
      };

      const zodSchema = schema as unknown as z.ZodObject<z.ZodRawShape>;
      const result = zodSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it("should return actionItems when provided to create_plan", async () => {
      const tools = createPlanningTools();

      const input = {
        successCriteria: "Test successCriteria",
        plan: "Test plan",
        actionItems: ["Action 1", "Action 2", "Action 3"],
      };

      const result = (await tools.create_plan.execute!(input, {
        toolCallId: "test",
        messages: [] as CoreMessage[],
      })) as CreatePlanResult;

      expect(result).toEqual(input);
      expect(result.actionItems).toEqual(["Action 1", "Action 2", "Action 3"]);
    });

    it("should work without actionItems (optional field)", async () => {
      const tools = createPlanningTools();

      const input = {
        successCriteria: "Test",
        plan: "Plan without action items",
      };

      const result = (await tools.create_plan.execute!(input, {
        toolCallId: "test",
        messages: [] as CoreMessage[],
      })) as CreatePlanResult;

      expect(result).toEqual(input);
      expect(result.actionItems).toBeUndefined();
    });
  });
});

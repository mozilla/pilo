import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  buildPlanAndUrlPrompt,
  buildPlanPrompt,
  actionLoopSystemPrompt,
  buildTaskAndPlanPrompt,
  buildPageSnapshotPrompt,
  buildStepErrorFeedbackPrompt,
  buildTaskValidationPrompt,
} from "../src/prompts.js";

// Mock Date for consistent test results
const mockDate = new Date("2024-01-15T10:00:00Z");

describe("prompts", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("buildPlanAndUrlPrompt", () => {
    it("should generate prompt for plan with URL", () => {
      const task = "Book a flight from NYC to Paris";
      const prompt = buildPlanAndUrlPrompt(task);

      expect(prompt).toContain("Create a plan for this web navigation task");
      expect(prompt).toContain("Book a flight from NYC to Paris");
      expect(prompt).toContain("Jan 15, 2024");
      expect(prompt).toContain("create_plan_with_url()");
      expect(prompt).toContain("step-by-step plan, and starting URL");
    });

    it("should contain required instructions", () => {
      const task = "Test task";
      const prompt = buildPlanAndUrlPrompt(task);

      // Verify youArePrompt content is included
      expect(prompt).toContain("You are an expert at completing tasks using a web browser");
      // Verify tool call instruction is included
      expect(prompt).toContain("You MUST use exactly one tool with the required parameters");
    });

    it("should include current date in prompt", () => {
      const task = "Find weather forecast";
      const prompt = buildPlanAndUrlPrompt(task);

      expect(prompt).toContain("Today's Date: Jan 15, 2024");
    });

    it("should include JSON schema for plan with URL", () => {
      const task = "Search for hotels";
      const prompt = buildPlanAndUrlPrompt(task);

      expect(prompt).toContain("explanation");
      expect(prompt).toContain("plan");
      expect(prompt).toContain("url");
      expect(prompt).toContain("duckduckgo.com");
    });

    it("should handle special characters in task", () => {
      const task = 'Find "best restaurants" in NYC & book a table';
      const prompt = buildPlanAndUrlPrompt(task);

      expect(prompt).toContain('Find "best restaurants" in NYC & book a table');
    });
  });

  describe("buildPlanPrompt", () => {
    it("should generate prompt for plan without URL", () => {
      const task = "Fill out contact form";
      const prompt = buildPlanPrompt(task);

      expect(prompt).toContain("Create a plan for this web navigation task");
      expect(prompt).toContain("Fill out contact form");
      expect(prompt).toContain("Jan 15, 2024");
      expect(prompt).not.toContain('"url"');
      expect(prompt).toContain("step-by-step plan");
      expect(prompt).not.toContain("starting URL");
    });

    it("should contain required instructions", () => {
      const task = "Test task";
      const prompt = buildPlanPrompt(task);

      // Verify youArePrompt content is included
      expect(prompt).toContain("You are an expert at completing tasks using a web browser");
      // Verify tool call instruction is included
      expect(prompt).toContain("You MUST use exactly one tool with the required parameters");
    });

    it("should include starting URL when provided", () => {
      const task = "Submit feedback form";
      const startingUrl = "https://example.com/feedback";
      const prompt = buildPlanPrompt(task, startingUrl);

      expect(prompt).toContain("Submit feedback form");
      expect(prompt).toContain("Starting URL: https://example.com/feedback");
      expect(prompt).toContain("Use the provided starting URL");
    });

    it("should not include starting URL when not provided", () => {
      const task = "Submit feedback form";
      const prompt = buildPlanPrompt(task);

      expect(prompt).not.toContain("Starting URL:");
      expect(prompt).not.toContain("Use the provided starting URL");
    });

    it("should include JSON schema for plan without URL", () => {
      const task = "Update profile information";
      const prompt = buildPlanPrompt(task);

      expect(prompt).toContain("explanation");
      expect(prompt).toContain("plan");
      expect(prompt).toContain("create_plan()");
    });
  });

  describe("actionLoopSystemPrompt", () => {
    it("should contain action loop instructions", () => {
      expect(actionLoopSystemPrompt).toContain("Analyze the current page state");
      expect(actionLoopSystemPrompt).toContain("Available Tools:");
      expect(actionLoopSystemPrompt).toContain("Core Rules:");
      expect(actionLoopSystemPrompt).toContain("Best Practices:");
    });

    it("should contain required instructions", () => {
      // Verify youArePrompt content is included
      expect(actionLoopSystemPrompt).toContain(
        "You are an expert at completing tasks using a web browser",
      );
      // Verify tool call instruction is included
      expect(actionLoopSystemPrompt).toContain(
        "You MUST use exactly one tool with the required parameters",
      );
    });

    it("should list all available actions", () => {
      const expectedActions = [
        "select",
        "fill",
        "click",
        "hover",
        "check",
        "uncheck",
        "wait",
        "goto",
        "back",
        "forward",
        "done",
        "abort",
      ];

      expectedActions.forEach((action) => {
        expect(actionLoopSystemPrompt).toContain(`${action}(`);
      });
    });

    it("should include tool call format instructions", () => {
      expect(actionLoopSystemPrompt).toContain(
        "You MUST use exactly one tool with the required parameters",
      );
      expect(actionLoopSystemPrompt).toContain("Use valid JSON format for all arguments");
      expect(actionLoopSystemPrompt).toContain("Execute EXACTLY ONE tool per turn");
    });

    it("should include ref format examples", () => {
      expect(actionLoopSystemPrompt).toContain("s1e33");
      expect(actionLoopSystemPrompt).toContain("element refs from page snapshot");
    });

    it("should include goto restrictions", () => {
      expect(actionLoopSystemPrompt).toContain("only previously seen URLs");
      expect(actionLoopSystemPrompt).toContain("goto() only accepts URLs");
    });
  });

  describe("buildTaskAndPlanPrompt", () => {
    it("should combine task, explanation, and plan", () => {
      const task = "Book a hotel room";
      const explanation = "Find and reserve accommodation for travel";
      const plan = "1. Search hotels\n2. Compare prices\n3. Make reservation";

      const prompt = buildTaskAndPlanPrompt(task, explanation, plan);

      expect(prompt).toContain("Task: Book a hotel room");
      expect(prompt).toContain("Explanation: Find and reserve accommodation");
      expect(prompt).toContain("Plan: 1. Search hotels");
      expect(prompt).toContain("Today's Date: Jan 15, 2024");
    });

    it("should handle multiline plans", () => {
      const task = "Complete checkout";
      const explanation = "Purchase items in shopping cart";
      const plan =
        "1. Review cart items\n2. Enter shipping info\n3. Select payment method\n4. Confirm order";

      const prompt = buildTaskAndPlanPrompt(task, explanation, plan);

      expect(prompt).toContain("1. Review cart items");
      expect(prompt).toContain("2. Enter shipping info");
      expect(prompt).toContain("3. Select payment method");
      expect(prompt).toContain("4. Confirm order");
    });

    it("should handle empty strings", () => {
      const prompt = buildTaskAndPlanPrompt("", "", "");

      expect(prompt).toContain("Task: ");
      expect(prompt).toContain("Explanation: ");
      expect(prompt).toContain("Plan: ");
      expect(prompt).toContain("Today's Date: Jan 15, 2024");
    });

    it("should include data when provided", () => {
      const task = "Book a flight";
      const explanation = "Reserve airline tickets";
      const plan = "1. Search flights\n2. Select flight\n3. Book";
      const data = {
        departure: "NYC",
        destination: "LAX",
        date: "2024-12-25",
        passengers: 2,
      };

      const prompt = buildTaskAndPlanPrompt(task, explanation, plan, data);

      expect(prompt).toContain("Input Data:");
      expect(prompt).toContain("```json");
      expect(prompt).toContain('"departure": "NYC"');
      expect(prompt).toContain('"destination": "LAX"');
      expect(prompt).toContain('"date": "2024-12-25"');
      expect(prompt).toContain('"passengers": 2');
      expect(prompt).toContain("```");
    });

    it("should not include data section when data is null", () => {
      const task = "Search for hotels";
      const explanation = "Find accommodation";
      const plan = "1. Search\n2. Compare\n3. Select";

      const prompt = buildTaskAndPlanPrompt(task, explanation, plan, null);

      expect(prompt).not.toContain("Input Data:");
      expect(prompt).not.toContain("```json");
    });

    it("should not include data section when data is undefined", () => {
      const task = "Search for hotels";
      const explanation = "Find accommodation";
      const plan = "1. Search\n2. Compare\n3. Select";

      const prompt = buildTaskAndPlanPrompt(task, explanation, plan);

      expect(prompt).not.toContain("Input Data:");
      expect(prompt).not.toContain("```json");
    });

    it("should handle complex nested data objects", () => {
      const task = "Complete booking";
      const explanation = "Finalize reservation";
      const plan = "1. Review\n2. Pay\n3. Confirm";
      const data = {
        booking: {
          flight: {
            departure: { city: "NYC", time: "9:00 AM" },
            arrival: { city: "LAX", time: "12:00 PM" },
          },
          hotel: {
            name: "Grand Hotel",
            checkIn: "2024-12-25",
            checkOut: "2024-12-27",
          },
        },
        travelers: [
          { name: "John Doe", age: 30 },
          { name: "Jane Doe", age: 28 },
        ],
      };

      const prompt = buildTaskAndPlanPrompt(task, explanation, plan, data);

      expect(prompt).toContain("Input Data:");
      expect(prompt).toContain("```json");
      expect(prompt).toContain('"departure"');
      expect(prompt).toContain('"NYC"');
      expect(prompt).toContain('"Grand Hotel"');
      expect(prompt).toContain('"John Doe"');
      expect(prompt).toContain('"travelers"');
    });

    it("should format data with proper JSON indentation", () => {
      const task = "Test task";
      const explanation = "Test explanation";
      const plan = "Test plan";
      const data = {
        level1: {
          level2: {
            value: "nested",
          },
        },
      };

      const prompt = buildTaskAndPlanPrompt(task, explanation, plan, data);

      // Check that JSON is properly indented (2 spaces)
      expect(prompt).toContain(
        '{\n  "level1": {\n    "level2": {\n      "value": "nested"\n    }\n  }\n}',
      );
    });

    it("should handle data with special characters", () => {
      const task = "Special chars test";
      const explanation = "Test special characters";
      const plan = "Handle special chars";
      const data = {
        message: 'Hello "world" & <test>',
        symbols: "!@#$%^&*()",
        unicode: "café naïve résumé",
      };

      const prompt = buildTaskAndPlanPrompt(task, explanation, plan, data);

      expect(prompt).toContain("Input Data:");
      expect(prompt).toContain('"Hello \\"world\\" & <test>"');
      expect(prompt).toContain('"!@#$%^&*()"');
      expect(prompt).toContain('"café naïve résumé"');
    });
  });

  describe("buildPageSnapshotPrompt", () => {
    it("should format page snapshot with title and URL", () => {
      const title = "Contact Us - Example Company";
      const url = "https://example.com/contact";
      const snapshot = "button 'Submit' [ref=s1e23]\ninput 'Email' [ref=s2e45]";

      const prompt = buildPageSnapshotPrompt(title, url, snapshot);

      expect(prompt).toContain("Title: Contact Us - Example Company");
      expect(prompt).toContain("URL: https://example.com/contact");
      expect(prompt).toContain("button 'Submit' [ref=s1e23]");
      expect(prompt).toContain("input 'Email' [ref=s2e45]");
    });

    it("should include guidance text", () => {
      const prompt = buildPageSnapshotPrompt("Test", "https://test.com", "content");

      expect(prompt).toContain("This accessibility tree shows the complete current page content");
      expect(prompt).toContain("Analyze the current state");
      expect(prompt).toContain("most relevant elements");
      expect(prompt).toContain("If an action fails, adapt immediately");
    });

    it("should handle empty snapshot", () => {
      const prompt = buildPageSnapshotPrompt("Empty Page", "https://empty.com", "");

      expect(prompt).toContain("Title: Empty Page");
      expect(prompt).toContain("URL: https://empty.com");
      expect(prompt).toContain("```\n\n```");
    });

    it("should handle special characters in title and URL", () => {
      const title = "Page with & special < characters >";
      const url = "https://example.com/path?param=value&other=test";
      const snapshot = "content here";

      const prompt = buildPageSnapshotPrompt(title, url, snapshot);

      expect(prompt).toContain("Page with & special < characters >");
      expect(prompt).toContain("https://example.com/path?param=value&other=test");
    });
  });

  describe("buildStepErrorFeedbackPrompt", () => {
    it("should format error message", () => {
      const error = "Missing ref field\nInvalid action type\nValue is required";
      const prompt = buildStepErrorFeedbackPrompt(error);

      expect(prompt).toContain("Error Occurred");
      expect(prompt).toContain("Missing ref field");
      expect(prompt).toContain("Invalid action type");
      expect(prompt).toContain("Value is required");
    });

    it("should include tool call instruction", () => {
      const error = "Some error";
      const prompt = buildStepErrorFeedbackPrompt(error);

      expect(prompt).toContain("You MUST use exactly one tool");
      expect(prompt).toContain("Use valid JSON format");
      expect(prompt).toContain("CRITICAL: Use each tool exactly ONCE");
    });

    it("should include error message", () => {
      const error = "Test error";
      const prompt = buildStepErrorFeedbackPrompt(error);

      expect(prompt).toContain("Error Occurred");
      expect(prompt).toContain("Test error");
    });

    it("should handle empty errors", () => {
      const prompt = buildStepErrorFeedbackPrompt("");

      expect(prompt).toContain("Error Occurred");
      expect(prompt).toContain("You MUST use exactly one tool");
    });
  });

  describe("buildTaskValidationPrompt", () => {
    it("should format task and final answer", () => {
      const task = "Submit contact form";
      const finalAnswer = "Form submitted successfully with ID: 12345";

      const prompt = buildTaskValidationPrompt(task, finalAnswer, "conversation history");

      expect(prompt).toContain("Evaluate how well the task result accomplishes");
      expect(prompt).toContain("Task: Submit contact form");
      expect(prompt).toContain("Result: Form submitted successfully with ID: 12345");
    });

    it("should include validation criteria", () => {
      const prompt = buildTaskValidationPrompt("test task", "test answer", "conversation history");

      expect(prompt).toContain("Does the result accomplish what the user requested");
      expect(prompt).toContain("Task partially completed but result is missing key elements");
      expect(prompt).toContain("Task fully completed and result accomplishes what was requested");
    });

    it("should contain required instructions", () => {
      const prompt = buildTaskValidationPrompt("test task", "test answer", "conversation history");

      // Verify tool call instruction is included
      expect(prompt).toContain("You MUST use exactly one tool with the required parameters");
    });

    it("should include feedback instruction", () => {
      const prompt = buildTaskValidationPrompt("test task", "test answer", "conversation history");

      expect(prompt).toContain("Only for 'failed' or 'partial'");
      expect(prompt).toContain("What is still missing to complete the task");
    });

    it("should handle empty inputs", () => {
      const prompt = buildTaskValidationPrompt("", "", "");

      expect(prompt).toContain("Task: ");
      expect(prompt).toContain("Result: ");
    });

    it("should handle special characters", () => {
      const task = 'Find "best price" for product & purchase';
      const finalAnswer = "Found item for $29.99 & completed checkout";

      const prompt = buildTaskValidationPrompt(task, finalAnswer, "conversation history");

      expect(prompt).toContain('Find "best price" for product & purchase');
      expect(prompt).toContain("Found item for $29.99 & completed checkout");
    });
  });

  describe("Date formatting", () => {
    it("should format dates consistently across functions", () => {
      const task = "test task";

      const planPrompt = buildPlanPrompt(task);
      const planAndUrlPrompt = buildPlanAndUrlPrompt(task);
      const taskAndPlanPrompt = buildTaskAndPlanPrompt(task, "explanation", "plan");

      expect(planPrompt).toContain("Jan 15, 2024");
      expect(planAndUrlPrompt).toContain("Jan 15, 2024");
      expect(taskAndPlanPrompt).toContain("Jan 15, 2024");
    });

    it("should handle different dates", () => {
      const christmasDate = new Date("2024-12-25T10:00:00Z");
      vi.setSystemTime(christmasDate);

      const prompt = buildPlanPrompt("test task");
      expect(prompt).toContain("Dec 25, 2024");
    });

    it("should handle leap year dates", () => {
      const leapYearDate = new Date("2024-02-29T10:00:00Z");
      vi.setSystemTime(leapYearDate);

      const prompt = buildPlanPrompt("test task");
      expect(prompt).toContain("Feb 29, 2024");
    });
  });

  describe("Template consistency", () => {
    it("should use consistent prompt style across functions", () => {
      const prompts = [
        buildPlanPrompt("test"),
        buildPlanAndUrlPrompt("test"),
        actionLoopSystemPrompt,
        buildTaskAndPlanPrompt("test", "explanation", "plan"),
        buildPageSnapshotPrompt("title", "url", "snapshot"),
        buildStepErrorFeedbackPrompt("errors"),
        buildTaskValidationPrompt("task", "answer", "conversation history"),
      ];

      // All prompts should be non-empty strings
      prompts.forEach((prompt) => {
        expect(typeof prompt).toBe("string");
        expect(prompt.length).toBeGreaterThan(0);
      });
    });

    it("should maintain tool call format consistency", () => {
      const toolCallPrompts = [
        buildPlanPrompt("test"),
        buildPlanAndUrlPrompt("test"),
        actionLoopSystemPrompt,
        buildStepErrorFeedbackPrompt("errors"),
      ];

      // Check that most prompts contain tool call instructions
      const promptsWithCallInstructions = toolCallPrompts.filter(
        (prompt) =>
          prompt.includes("use exactly one tool") ||
          prompt.includes("tool") ||
          prompt.includes("use the correct tool"),
      );
      expect(promptsWithCallInstructions.length).toBeGreaterThan(toolCallPrompts.length / 2);
    });
  });
});

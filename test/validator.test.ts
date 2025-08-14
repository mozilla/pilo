import { describe, it, expect, vi, beforeEach } from "vitest";
import { Validator } from "../src/validator.js";
import { generateText } from "ai";

// Mock the AI functions
vi.mock("ai", () => ({
  generateText: vi.fn(),
}));

const mockGenerateText = vi.mocked(generateText);

describe("Validator", () => {
  let validator: Validator;

  beforeEach(() => {
    validator = new Validator();
    vi.clearAllMocks();
  });

  describe("checkAction", () => {
    const sampleSnapshot = `
      <div>
        <button [ref=btn1]>Click me</button>
        <input [ref=input1] type="text" />
        <select [ref=select1]>
          <option>Option 1</option>
        </select>
        <a [ref=link1] href="/about">About</a>
      </div>
    `;

    it("should return null for valid action with existing ref", () => {
      const action = { type: "click", ref: "btn1" };
      const result = validator.checkAction(action, sampleSnapshot);
      expect(result).toBeNull();
    });

    it("should return error for action with non-existent ref", () => {
      const action = { type: "click", ref: "nonexistent" };
      const result = validator.checkAction(action, sampleSnapshot);
      expect(result).toBe(
        'Can\'t find ref "nonexistent" on the page. Pick a valid ref from the snapshot.',
      );
    });

    it("should validate ref with [ref=xxx] format", () => {
      const action = { type: "fill", ref: "input1", value: "test" };
      const result = validator.checkAction(action, sampleSnapshot);
      expect(result).toBeNull();
    });

    it("should validate ref with [xxx] format", () => {
      const snapshot = "<button [btn2]>Another button</button>";
      const action = { type: "click", ref: "btn2" };
      const result = validator.checkAction(action, snapshot);
      expect(result).toBeNull();
    });

    it("should allow actions without ref", () => {
      const action = { type: "back" };
      const result = validator.checkAction(action, sampleSnapshot);
      expect(result).toBeNull();
    });

    describe("wait action validation", () => {
      it("should allow reasonable wait times", () => {
        const action = { type: "wait", seconds: 5 };
        const result = validator.checkAction(action, sampleSnapshot);
        expect(result).toBeNull();
      });

      it("should reject wait times over 30 seconds", () => {
        const action = { type: "wait", seconds: 35 };
        const result = validator.checkAction(action, sampleSnapshot);
        expect(result).toBe("Wait time too long. Use a shorter wait time.");
      });

      it("should handle wait with value field instead of seconds", () => {
        const action = { type: "wait", value: "31" };
        const result = validator.checkAction(action, sampleSnapshot);
        expect(result).toBe("Wait time too long. Use a shorter wait time.");
      });

      it("should handle wait with both seconds and value (seconds takes precedence)", () => {
        const action = { type: "wait", seconds: 10, value: "50" };
        const result = validator.checkAction(action, sampleSnapshot);
        expect(result).toBeNull();
      });

      it("should handle wait with exactly 30 seconds", () => {
        const action = { type: "wait", seconds: 30 };
        const result = validator.checkAction(action, sampleSnapshot);
        expect(result).toBeNull();
      });
    });

    describe("various action types", () => {
      it("should validate fill action with ref", () => {
        const action = { type: "fill", ref: "input1", value: "test text" };
        const result = validator.checkAction(action, sampleSnapshot);
        expect(result).toBeNull();
      });

      it("should validate select action with ref", () => {
        const action = { type: "select", ref: "select1", value: "Option 1" };
        const result = validator.checkAction(action, sampleSnapshot);
        expect(result).toBeNull();
      });

      it("should validate goto action without ref", () => {
        const action = { type: "goto", url: "https://example.com" };
        const result = validator.checkAction(action, sampleSnapshot);
        expect(result).toBeNull();
      });

      it("should validate done action without ref", () => {
        const action = { type: "done", result: "Task completed" };
        const result = validator.checkAction(action, sampleSnapshot);
        expect(result).toBeNull();
      });
    });
  });

  describe("checkTaskComplete", () => {
    const mockProvider = {} as any;

    it("should return complete when completionQuality is 'complete'", async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: "Validation complete",
        toolCalls: [
          {
            toolName: "validate_task",
            input: {
              completionQuality: "complete",
              taskAssessment: "Task successfully completed",
            },
          },
        ],
      } as any);

      const result = await validator.checkTaskComplete(
        "Click the button",
        "Button was clicked",
        mockProvider,
      );

      expect(result.isComplete).toBe(true);
      expect(result.feedback).toBeUndefined();
    });

    it("should return complete when completionQuality is 'excellent'", async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: "Validation complete",
        toolCalls: [
          {
            toolName: "validate_task",
            input: {
              completionQuality: "excellent",
              taskAssessment: "Task completed excellently",
            },
          },
        ],
      } as any);

      const result = await validator.checkTaskComplete(
        "Fill the form",
        "Form filled and submitted",
        mockProvider,
      );

      expect(result.isComplete).toBe(true);
      expect(result.feedback).toBeUndefined();
    });

    it("should return incomplete when completionQuality is 'partial'", async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: "Validation complete",
        toolCalls: [
          {
            toolName: "validate_task",
            input: {
              completionQuality: "partial",
              taskAssessment: "Task partially completed",
              feedback: "Need to complete remaining fields",
            },
          },
        ],
      } as any);

      const result = await validator.checkTaskComplete(
        "Complete the form",
        "Some fields filled",
        mockProvider,
      );

      expect(result.isComplete).toBe(false);
      expect(result.feedback).toBe("Need to complete remaining fields");
    });

    it("should return incomplete when completionQuality is 'failed'", async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: "Validation complete",
        toolCalls: [
          {
            toolName: "validate_task",
            input: {
              completionQuality: "failed",
              taskAssessment: "Task failed",
              feedback: "Wrong button clicked",
            },
          },
        ],
      } as any);

      const result = await validator.checkTaskComplete(
        "Click submit button",
        "Cancel button clicked",
        mockProvider,
      );

      expect(result.isComplete).toBe(false);
      expect(result.feedback).toBe("Wrong button clicked");
    });

    it("should throw error when missing tool calls", async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: "No tool call",
        toolCalls: [],
      } as any);

      await expect(
        validator.checkTaskComplete("Do something", "Something done", mockProvider),
      ).rejects.toThrow("No valid tool call in validation response");
    });

    it("should throw error when tool calls undefined", async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: "No tool call",
      } as any);

      await expect(
        validator.checkTaskComplete("Do something", "Something done", mockProvider),
      ).rejects.toThrow("No valid tool call in validation response");
    });

    it("should propagate API errors", async () => {
      const errorMessage = "API error occurred";
      mockGenerateText.mockRejectedValueOnce(new Error(errorMessage));

      await expect(
        validator.checkTaskComplete("Perform task", "Task result", mockProvider),
      ).rejects.toThrow(errorMessage);
    });

    it("should propagate non-Error exceptions", async () => {
      mockGenerateText.mockRejectedValueOnce("String error");

      await expect(
        validator.checkTaskComplete("Perform task", "Task result", mockProvider),
      ).rejects.toThrow("String error");
    });

    it("should pass correct parameters to generateText", async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: "Validation complete",
        toolCalls: [
          {
            toolName: "validate_task",
            input: {
              completionQuality: "complete",
              taskAssessment: "Done",
            },
          },
        ],
      } as any);

      await validator.checkTaskComplete("Test task", "Test result", mockProvider);

      expect(mockGenerateText).toHaveBeenCalledWith(
        expect.objectContaining({
          model: mockProvider,
          toolChoice: { type: "tool", toolName: "validate_task" },
          maxOutputTokens: 1000,
        }),
      );
    });
  });

  describe("giveFeedback", () => {
    it("should add user message with feedback to messages array", () => {
      const messages: any[] = [];
      const feedback = "Please try a different approach";

      validator.giveFeedback(messages, feedback);

      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual({
        role: "user",
        content: feedback,
      });
    });

    it("should append to existing messages", () => {
      const messages: any[] = [
        { role: "user", content: "Initial message" },
        { role: "assistant", content: "Response" },
      ];
      const feedback = "That didn't work, try again";

      validator.giveFeedback(messages, feedback);

      expect(messages).toHaveLength(3);
      expect(messages[2]).toEqual({
        role: "user",
        content: feedback,
      });
    });

    it("should handle empty feedback string", () => {
      const messages: any[] = [];
      const feedback = "";

      validator.giveFeedback(messages, feedback);

      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual({
        role: "user",
        content: "",
      });
    });
  });
});

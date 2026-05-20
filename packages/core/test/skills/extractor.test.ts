import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ModelMessage } from "ai";
import { generateTextWithRetry } from "../../src/utils/retry.js";
import { extractSkill } from "../../src/skills/extractor.js";
import type { ProviderConfig } from "../../src/provider.js";

vi.mock("../../src/utils/retry.js", () => ({
  generateTextWithRetry: vi.fn(),
}));

const mockGenerateTextWithRetry = vi.mocked(generateTextWithRetry);

// Minimal provider config stub — only the spread shape matters for these tests.
const providerConfig = {
  model: "stub-model" as any,
  providerOptions: { foo: "bar" },
} as unknown as ProviderConfig;

function mockResponse(text: string) {
  // generateText returns many fields; we only use `.text` in the extractor.
  return { text } as any;
}

describe("skills/extractor", () => {
  beforeEach(() => {
    mockGenerateTextWithRetry.mockReset();
  });

  describe("happy path", () => {
    it("returns hint and taskHeadline on a normal LLM response", async () => {
      mockGenerateTextWithRetry.mockResolvedValueOnce(
        mockResponse("When you visit example.com, the search bar is in the top nav."),
      );

      const result = await extractSkill({
        task: "Find a product",
        host: "example.com",
        messages: [],
        providerConfig,
      });

      expect(result).toEqual({
        hint: "When you visit example.com, the search bar is in the top nav.",
        taskHeadline: "Find a product",
      });
    });

    it("trims whitespace from the LLM response", async () => {
      mockGenerateTextWithRetry.mockResolvedValueOnce(mockResponse("  some hint\n\n  "));

      const result = await extractSkill({
        task: "Task",
        host: "example.com",
        messages: [],
        providerConfig,
      });

      expect(result?.hint).toBe("some hint");
    });
  });

  describe("null / skip cases", () => {
    it("returns null when LLM responds with exact 'SKIP'", async () => {
      mockGenerateTextWithRetry.mockResolvedValueOnce(mockResponse("SKIP"));

      const result = await extractSkill({
        task: "Task",
        host: "example.com",
        messages: [],
        providerConfig,
      });

      expect(result).toBeNull();
    });

    it("returns null when LLM responds with SKIP after trim", async () => {
      mockGenerateTextWithRetry.mockResolvedValueOnce(mockResponse("  SKIP  \n"));

      const result = await extractSkill({
        task: "Task",
        host: "example.com",
        messages: [],
        providerConfig,
      });

      expect(result).toBeNull();
    });

    it("returns null when LLM responds with whitespace-only text", async () => {
      mockGenerateTextWithRetry.mockResolvedValueOnce(mockResponse("   \n\t  "));

      const result = await extractSkill({
        task: "Task",
        host: "example.com",
        messages: [],
        providerConfig,
      });

      expect(result).toBeNull();
    });

    it("returns null when LLM response has no text field", async () => {
      mockGenerateTextWithRetry.mockResolvedValueOnce({} as any);

      const result = await extractSkill({
        task: "Task",
        host: "example.com",
        messages: [],
        providerConfig,
      });

      expect(result).toBeNull();
    });

    it("returns null (does not throw) when generateTextWithRetry throws", async () => {
      mockGenerateTextWithRetry.mockRejectedValueOnce(new Error("LLM exploded"));

      const result = await extractSkill({
        task: "Task",
        host: "example.com",
        messages: [],
        providerConfig,
      });

      expect(result).toBeNull();
    });
  });

  describe("headline handling", () => {
    it("truncates a task longer than 80 chars with '...' ending", async () => {
      mockGenerateTextWithRetry.mockResolvedValueOnce(mockResponse("hint"));

      const longTask =
        "This is a very long task description that goes on and on and on and exceeds the limit for sure";
      const result = await extractSkill({
        task: longTask,
        host: "example.com",
        messages: [],
        providerConfig,
      });

      expect(result?.taskHeadline.length).toBe(80);
      expect(result?.taskHeadline.endsWith("...")).toBe(true);
      expect(result?.taskHeadline.startsWith("This is a very long task")).toBe(true);
    });

    it("collapses multi-line task into a single line", async () => {
      mockGenerateTextWithRetry.mockResolvedValueOnce(mockResponse("hint"));

      const result = await extractSkill({
        task: "First line\n\nSecond line   with   spaces\n\tThird line",
        host: "example.com",
        messages: [],
        providerConfig,
      });

      expect(result?.taskHeadline).toBe("First line Second line with spaces Third line");
      expect(result?.taskHeadline).not.toContain("\n");
      expect(result?.taskHeadline).not.toContain("\t");
    });

    it("does not truncate a short task", async () => {
      mockGenerateTextWithRetry.mockResolvedValueOnce(mockResponse("hint"));

      const result = await extractSkill({
        task: "Short task",
        host: "example.com",
        messages: [],
        providerConfig,
      });

      expect(result?.taskHeadline).toBe("Short task");
    });

    it("treats exactly 80 chars as no truncation", async () => {
      mockGenerateTextWithRetry.mockResolvedValueOnce(mockResponse("hint"));

      const eightyCharTask = "a".repeat(80);
      const result = await extractSkill({
        task: eightyCharTask,
        host: "example.com",
        messages: [],
        providerConfig,
      });

      expect(result?.taskHeadline).toBe(eightyCharTask);
      expect(result?.taskHeadline.endsWith("...")).toBe(false);
    });
  });

  describe("call params", () => {
    it("passes provider config, prompt, default maxOutputTokens, and abortSignal", async () => {
      mockGenerateTextWithRetry.mockResolvedValueOnce(mockResponse("hint"));
      const abortController = new AbortController();

      await extractSkill({
        task: "Find a thing",
        host: "example.com",
        messages: [],
        providerConfig,
        abortSignal: abortController.signal,
      });

      expect(mockGenerateTextWithRetry).toHaveBeenCalledTimes(1);
      const [params, retryOpts] = mockGenerateTextWithRetry.mock.calls[0];

      expect(params).toMatchObject({
        model: "stub-model",
        providerOptions: { foo: "bar" },
        maxOutputTokens: 600,
        abortSignal: abortController.signal,
      });
      expect(typeof params.prompt).toBe("string");
      expect(params.prompt).toContain("example.com");
      expect(params.prompt).toContain("Find a thing");

      expect(retryOpts).toEqual({ maxAttempts: 2 });
    });

    it("passes custom maxOutputTokens when provided", async () => {
      mockGenerateTextWithRetry.mockResolvedValueOnce(mockResponse("hint"));

      await extractSkill({
        task: "Task",
        host: "example.com",
        messages: [],
        providerConfig,
        maxOutputTokens: 1200,
      });

      const [params] = mockGenerateTextWithRetry.mock.calls[0];
      expect(params.maxOutputTokens).toBe(1200);
    });
  });

  describe("trajectory summarization", () => {
    it("compresses user, assistant tool-call, and tool result messages", async () => {
      mockGenerateTextWithRetry.mockResolvedValueOnce(mockResponse("hint"));

      const messages: ModelMessage[] = [
        { role: "user", content: "Open the store page" },
        {
          role: "assistant",
          content: [
            { type: "text", text: "I will click the search button." },
            {
              type: "tool-call",
              toolCallId: "1",
              toolName: "click",
              input: { ref: "E5" },
            },
          ],
        },
        {
          role: "tool",
          content: [
            {
              type: "tool-result",
              toolCallId: "1",
              toolName: "click",
              output: { type: "json", value: { ok: true } },
            },
          ],
        },
      ];

      await extractSkill({
        task: "Task",
        host: "example.com",
        messages,
        providerConfig,
      });

      const [params] = mockGenerateTextWithRetry.mock.calls[0];
      const prompt = params.prompt as string;

      expect(prompt).toContain("USER: Open the store page");
      // Assistant `type: "text"` parts are spoken text, not reasoning.
      expect(prompt).toContain("ASSISTANT: I will click the search button.");
      expect(prompt).toContain('TOOL: click({"ref":"E5"})');
      expect(prompt).toContain("RESULT: click");
    });

    it("renders an empty messages array as an empty trajectory in the prompt", async () => {
      mockGenerateTextWithRetry.mockResolvedValueOnce(mockResponse("hint"));

      await extractSkill({
        task: "Task",
        host: "example.com",
        messages: [],
        providerConfig,
      });

      const [params] = mockGenerateTextWithRetry.mock.calls[0];
      const prompt = params.prompt as string;

      // No USER:/TOOL:/RESULT: lines should appear
      expect(prompt).not.toContain("USER:");
      expect(prompt).not.toContain("TOOL:");
      expect(prompt).not.toContain("RESULT:");
      // Still has the structural template instructions
      expect(prompt).toContain("SKIP");
    });

    it("truncates user content longer than 200 chars with '...'", async () => {
      mockGenerateTextWithRetry.mockResolvedValueOnce(mockResponse("hint"));

      const longUserContent = "x".repeat(500);
      const messages: ModelMessage[] = [{ role: "user", content: longUserContent }];

      await extractSkill({
        task: "Task",
        host: "example.com",
        messages,
        providerConfig,
      });

      const [params] = mockGenerateTextWithRetry.mock.calls[0];
      const prompt = params.prompt as string;

      // Should contain a truncated USER: line with exactly 200 x's + "..."
      expect(prompt).toContain(`USER: ${"x".repeat(200)}...`);
      // Should not contain the full 500-char string
      expect(prompt).not.toContain("x".repeat(201));
    });

    it("represents non-string user content as a placeholder", async () => {
      mockGenerateTextWithRetry.mockResolvedValueOnce(mockResponse("hint"));

      const messages: ModelMessage[] = [
        {
          role: "user",
          content: [{ type: "text", text: "some text" }],
        },
      ];

      await extractSkill({
        task: "Task",
        host: "example.com",
        messages,
        providerConfig,
      });

      const [params] = mockGenerateTextWithRetry.mock.calls[0];
      const prompt = params.prompt as string;

      expect(prompt).toContain("USER: [non-text content]");
    });

    it("renders an assistant message with content: string as an ASSISTANT: line", async () => {
      mockGenerateTextWithRetry.mockResolvedValueOnce(mockResponse("hint"));

      const messages: ModelMessage[] = [
        { role: "assistant", content: "Here is the final answer." },
      ];

      await extractSkill({
        task: "Task",
        host: "example.com",
        messages,
        providerConfig,
      });

      const [params] = mockGenerateTextWithRetry.mock.calls[0];
      const prompt = params.prompt as string;

      expect(prompt).toContain("ASSISTANT: Here is the final answer.");
    });

    it("truncates assistant string content longer than 200 chars with '...'", async () => {
      mockGenerateTextWithRetry.mockResolvedValueOnce(mockResponse("hint"));

      const longContent = "y".repeat(500);
      const messages: ModelMessage[] = [{ role: "assistant", content: longContent }];

      await extractSkill({
        task: "Task",
        host: "example.com",
        messages,
        providerConfig,
      });

      const [params] = mockGenerateTextWithRetry.mock.calls[0];
      const prompt = params.prompt as string;

      expect(prompt).toContain(`ASSISTANT: ${"y".repeat(200)}...`);
      expect(prompt).not.toContain("y".repeat(201));
    });

    it("renders assistant 'reasoning' parts as REASONING: lines", async () => {
      mockGenerateTextWithRetry.mockResolvedValueOnce(mockResponse("hint"));

      const messages: ModelMessage[] = [
        {
          role: "assistant",
          content: [{ type: "reasoning", text: "Thinking about the next step." } as any],
        },
      ];

      await extractSkill({
        task: "Task",
        host: "example.com",
        messages,
        providerConfig,
      });

      const [params] = mockGenerateTextWithRetry.mock.calls[0];
      const prompt = params.prompt as string;

      expect(prompt).toContain("REASONING: Thinking about the next step.");
    });

    it("silently drops role: 'system' messages", async () => {
      mockGenerateTextWithRetry.mockResolvedValueOnce(mockResponse("hint"));

      const messages: ModelMessage[] = [
        { role: "system", content: "You are a helpful agent." },
        { role: "user", content: "Open the page" },
      ];

      await extractSkill({
        task: "Task",
        host: "example.com",
        messages,
        providerConfig,
      });

      const [params] = mockGenerateTextWithRetry.mock.calls[0];
      const prompt = params.prompt as string;

      expect(prompt).not.toContain("SYSTEM:");
      expect(prompt).not.toContain("You are a helpful agent.");
      // The user line should still be present so we know we ran the loop.
      expect(prompt).toContain("USER: Open the page");
    });
  });
});

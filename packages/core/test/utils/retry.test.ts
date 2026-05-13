/**
 * Tests for retry utilities
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateTextWithRetry } from "../../src/utils/retry.js";
import { generateText } from "ai";

// Mock the ai module
vi.mock("ai", () => ({
  generateText: vi.fn(),
}));

describe("generateTextWithRetry", () => {
  const mockGenerateText = generateText as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should succeed on first attempt", async () => {
    const expectedResult = {
      text: "Success",
      toolResults: [{ output: { plan: "test" } }],
    };
    mockGenerateText.mockResolvedValueOnce(expectedResult);

    const result = await generateTextWithRetry({
      prompt: "test",
      model: "test-model",
    });

    expect(result).toEqual(expectedResult);
    expect(mockGenerateText).toHaveBeenCalledTimes(1);
  });

  it("should retry on transient error and succeed", async () => {
    const expectedResult = {
      text: "Success",
      toolResults: [{ output: { plan: "test" } }],
    };
    const transientError = new Error("Network error");

    mockGenerateText.mockRejectedValueOnce(transientError).mockResolvedValueOnce(expectedResult);

    const onRetry = vi.fn();
    const result = await generateTextWithRetry(
      {
        prompt: "test",
        model: "test-model",
      },
      {
        maxAttempts: 3,
        initialDelay: 10, // Short delay for testing
        onRetry,
      },
    );

    expect(result).toEqual(expectedResult);
    expect(mockGenerateText).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledWith(1, transientError);
  });

  it("should not retry on non-retryable error (401)", async () => {
    const authError = new Error("Unauthorized") as any;
    authError.status = 401;

    mockGenerateText.mockRejectedValueOnce(authError);

    await expect(
      generateTextWithRetry({
        prompt: "test",
        model: "test-model",
      }),
    ).rejects.toThrow("Unauthorized");

    expect(mockGenerateText).toHaveBeenCalledTimes(1);
  });

  it("should retry on rate limit error (429)", async () => {
    const expectedResult = {
      text: "Success",
      toolResults: [{ output: { plan: "test" } }],
    };
    const rateLimitError = new Error("Rate limit exceeded") as any;
    rateLimitError.status = 429;

    mockGenerateText.mockRejectedValueOnce(rateLimitError).mockResolvedValueOnce(expectedResult);

    const result = await generateTextWithRetry(
      {
        prompt: "test",
        model: "test-model",
      },
      {
        maxAttempts: 3,
        initialDelay: 10,
      },
    );

    expect(result).toEqual(expectedResult);
    expect(mockGenerateText).toHaveBeenCalledTimes(2);
  });

  it("should throw last error after max attempts", async () => {
    const persistentError = new Error("Persistent error");

    mockGenerateText
      .mockRejectedValueOnce(persistentError)
      .mockRejectedValueOnce(persistentError)
      .mockRejectedValueOnce(persistentError);

    await expect(
      generateTextWithRetry(
        {
          prompt: "test",
          model: "test-model",
        },
        {
          maxAttempts: 3,
          initialDelay: 10,
        },
      ),
    ).rejects.toThrow("Persistent error");

    expect(mockGenerateText).toHaveBeenCalledTimes(3);
  });

  it("should throw with text preview and finishReason when toolChoice required and model returned text", async () => {
    mockGenerateText.mockResolvedValue({
      text: "I cannot help with that request.",
      toolResults: [],
      finishReason: "stop",
    });

    await expect(
      generateTextWithRetry(
        {
          prompt: "Plan this task",
          model: "test-model" as any,
          toolChoice: "required",
        },
        { maxAttempts: 1, initialDelay: 1 },
      ),
    ).rejects.toThrow(/Tool call was required.*finishReason=stop.*I cannot help/);
  });

  it("should augment prompt with corrective reminder after tool-required failure", async () => {
    mockGenerateText
      .mockResolvedValueOnce({
        text: "Here is a plan in prose...",
        toolResults: [],
        finishReason: "stop",
      })
      .mockResolvedValueOnce({
        text: "ok",
        toolResults: [{ output: { plan: "test" } }],
        finishReason: "tool-calls",
      });

    const result = await generateTextWithRetry(
      {
        prompt: "Plan this task",
        model: "test-model" as any,
        toolChoice: "required",
      },
      { maxAttempts: 3, initialDelay: 1 },
    );

    expect(result.toolResults).toHaveLength(1);
    expect(mockGenerateText).toHaveBeenCalledTimes(2);
    const secondCallParams = mockGenerateText.mock.calls[1][0];
    expect(secondCallParams.prompt).toMatch(/Plan this task/);
    expect(secondCallParams.prompt).toMatch(/MUST respond by invoking one of the provided tools/);
  });

  it("should augment messages with corrective reminder after tool-required failure", async () => {
    const baseMessages = [
      { role: "system", content: "you are an agent" },
      { role: "user", content: "do the thing" },
    ];

    mockGenerateText
      .mockResolvedValueOnce({
        text: "prose response",
        toolResults: [],
        finishReason: "stop",
      })
      .mockResolvedValueOnce({
        text: "ok",
        toolResults: [{ output: { plan: "test" } }],
        finishReason: "tool-calls",
      });

    await generateTextWithRetry(
      {
        messages: baseMessages,
        model: "test-model" as any,
        toolChoice: "required",
      } as any,
      { maxAttempts: 3, initialDelay: 1 },
    );

    expect(mockGenerateText).toHaveBeenCalledTimes(2);
    const secondCallParams = mockGenerateText.mock.calls[1][0];
    expect(secondCallParams.messages).toHaveLength(baseMessages.length + 1);
    const appended = secondCallParams.messages[secondCallParams.messages.length - 1];
    expect(appended.role).toBe("user");
    expect(appended.content).toMatch(/MUST respond by invoking one of the provided tools/);
  });

  it("should only append the corrective reminder once across multiple retries", async () => {
    mockGenerateText
      .mockResolvedValueOnce({ text: "prose 1", toolResults: [], finishReason: "stop" })
      .mockResolvedValueOnce({ text: "prose 2", toolResults: [], finishReason: "stop" })
      .mockResolvedValueOnce({
        text: "ok",
        toolResults: [{ output: { plan: "test" } }],
        finishReason: "tool-calls",
      });

    await generateTextWithRetry(
      {
        prompt: "Plan this",
        model: "test-model" as any,
        toolChoice: "required",
      },
      { maxAttempts: 3, initialDelay: 1 },
    );

    expect(mockGenerateText).toHaveBeenCalledTimes(3);
    const secondPrompt = mockGenerateText.mock.calls[1][0].prompt;
    const thirdPrompt = mockGenerateText.mock.calls[2][0].prompt;
    expect(secondPrompt).toBe(thirdPrompt);
    expect((secondPrompt.match(/MUST respond by invoking/g) ?? []).length).toBe(1);
  });

  it("should apply exponential backoff", async () => {
    const expectedResult = { text: "Success" };
    const error = new Error("Temporary error");

    mockGenerateText
      .mockRejectedValueOnce(error)
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce(expectedResult);

    const start = Date.now();
    const result = await generateTextWithRetry(
      {
        prompt: "test",
        model: "test-model",
      },
      {
        maxAttempts: 3,
        initialDelay: 50,
        backoffFactor: 2,
      },
    );

    const elapsed = Date.now() - start;

    // Should have waited at least initialDelay + (initialDelay * backoffFactor)
    // Plus some jitter, but we'll check minimum time
    expect(elapsed).toBeGreaterThanOrEqual(50 + 100); // 50ms + 100ms
    expect(result).toEqual(expectedResult);
    expect(mockGenerateText).toHaveBeenCalledTimes(3);
  });
});

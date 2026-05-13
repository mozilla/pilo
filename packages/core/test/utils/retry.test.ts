/**
 * Tests for retry utilities
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateTextWithRetry, generateObjectWithRetry } from "../../src/utils/retry.js";
import { generateText, generateObject, NoObjectGeneratedError } from "ai";

// Mock the ai module, but keep the real error classes so `instanceof` checks in
// `isRetryableError` behave correctly against errors constructed in tests.
vi.mock("ai", async () => {
  const actual = await vi.importActual<typeof import("ai")>("ai");
  return {
    ...actual,
    generateText: vi.fn(),
    generateObject: vi.fn(),
  };
});

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

describe("generateObjectWithRetry", () => {
  const mockGenerateObject = generateObject as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should succeed on first attempt and return the result", async () => {
    const expectedResult = {
      object: { title: "Hello", count: 42 },
      finishReason: "stop",
    };
    mockGenerateObject.mockResolvedValueOnce(expectedResult);

    const result = await generateObjectWithRetry({
      prompt: "test",
      model: "test-model",
      schema: { jsonSchema: { type: "object" } } as any,
    } as any);

    expect(result).toEqual(expectedResult);
    expect(mockGenerateObject).toHaveBeenCalledTimes(1);
    expect(mockGenerateObject).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: "test",
        model: "test-model",
      }),
    );
  });

  it("should retry on transient error and succeed", async () => {
    const expectedResult = {
      object: { ok: true },
      finishReason: "stop",
    };
    const transientError = new Error("Network error");

    mockGenerateObject.mockRejectedValueOnce(transientError).mockResolvedValueOnce(expectedResult);

    const onRetry = vi.fn();
    const result = await generateObjectWithRetry(
      {
        prompt: "test",
        model: "test-model",
        schema: { jsonSchema: { type: "object" } } as any,
      } as any,
      {
        maxAttempts: 3,
        initialDelay: 10,
        onRetry,
      },
    );

    expect(result).toEqual(expectedResult);
    expect(mockGenerateObject).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledWith(1, transientError);
  });

  it("should not retry on non-retryable error (401)", async () => {
    const authError = new Error("Unauthorized") as any;
    authError.status = 401;

    mockGenerateObject.mockRejectedValueOnce(authError);

    await expect(
      generateObjectWithRetry({
        prompt: "test",
        model: "test-model",
        schema: { jsonSchema: { type: "object" } } as any,
      } as any),
    ).rejects.toThrow("Unauthorized");

    expect(mockGenerateObject).toHaveBeenCalledTimes(1);
  });

  it("should retry on rate limit error (429)", async () => {
    const expectedResult = {
      object: { ok: true },
      finishReason: "stop",
    };
    const rateLimitError = new Error("Rate limit exceeded") as any;
    rateLimitError.status = 429;

    mockGenerateObject.mockRejectedValueOnce(rateLimitError).mockResolvedValueOnce(expectedResult);

    const result = await generateObjectWithRetry(
      {
        prompt: "test",
        model: "test-model",
        schema: { jsonSchema: { type: "object" } } as any,
      } as any,
      {
        maxAttempts: 3,
        initialDelay: 10,
      },
    );

    expect(result).toEqual(expectedResult);
    expect(mockGenerateObject).toHaveBeenCalledTimes(2);
  });

  it("should throw last error after max attempts", async () => {
    const persistentError = new Error("Persistent error");

    mockGenerateObject
      .mockRejectedValueOnce(persistentError)
      .mockRejectedValueOnce(persistentError)
      .mockRejectedValueOnce(persistentError);

    await expect(
      generateObjectWithRetry(
        {
          prompt: "test",
          model: "test-model",
          schema: { jsonSchema: { type: "object" } } as any,
        } as any,
        {
          maxAttempts: 3,
          initialDelay: 10,
        },
      ),
    ).rejects.toThrow("Persistent error");

    expect(mockGenerateObject).toHaveBeenCalledTimes(3);
  });

  it("should not retry on NoObjectGeneratedError (schema validation failure)", async () => {
    // The AI SDK throws NoObjectGeneratedError when the model returns JSON that
    // fails schema validation or fails to parse. Retrying the same prompt+schema
    // wastes tokens, so we surface it immediately as non-retryable.
    const schemaError = new NoObjectGeneratedError({
      message: "Model output failed schema validation",
      text: '{"bad": "shape"}',
      response: {} as any,
      usage: {} as any,
      finishReason: "stop",
    });

    mockGenerateObject.mockRejectedValueOnce(schemaError);

    await expect(
      generateObjectWithRetry(
        {
          prompt: "test",
          model: "test-model",
          schema: { jsonSchema: { type: "object" } } as any,
        } as any,
        {
          maxAttempts: 3,
          initialDelay: 10,
        },
      ),
    ).rejects.toThrow("Model output failed schema validation");

    expect(mockGenerateObject).toHaveBeenCalledTimes(1);
  });
});

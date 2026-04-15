import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Shared mock state for WebAgent so tests can override behavior
let mockExecute = vi.fn().mockResolvedValue({
  success: true,
  finalAnswer: "Task completed",
  stats: { actions: 1, iterations: 1 },
});
let mockClose = vi.fn().mockResolvedValue(undefined);
let mockConstructorSpy = vi.fn();

vi.mock("pilo-core", () => {
  class MockWebAgent {
    constructor(_browser: any, opts: any) {
      mockConstructorSpy(opts);
    }
    execute = (...args: any[]) => mockExecute(...args);
    close = (...args: any[]) => mockClose(...args);
  }
  class MockPlaywrightBrowser {}

  return {
    WebAgent: MockWebAgent,
    PlaywrightBrowser: MockPlaywrightBrowser,
    config: {
      getConfig: vi.fn(() => ({
        provider: "openai",
        openai_api_key: "sk-test123",
        browser: "firefox",
        headless: true,
      })),
    },
    createAIProvider: vi.fn(() => ({})),
    getAIProviderInfo: vi.fn(() => ({
      provider: "openai",
      model: "gpt-4.1",
      hasApiKey: true,
      keySource: "env",
    })),
    createNavigationRetryConfig: vi.fn((overrides) => ({
      baseTimeoutMs: overrides?.baseTimeoutMs ?? 30000,
      maxTimeoutMs: overrides?.maxTimeoutMs ?? 120000,
      maxAttempts: overrides?.maxAttempts ?? 3,
      timeoutMultiplier: overrides?.timeoutMultiplier ?? 2,
    })),
    SEARCH_PROVIDERS: ["none", "duckduckgo", "google", "bing", "parallel-api"],
    PLAYWRIGHT_BROWSERS: ["firefox", "chrome", "chromium", "safari", "webkit", "edge"],
  };
});

vi.mock("./StreamLogger.js", () => ({
  StreamLogger: class MockStreamLogger {},
}));

import { validateTaskRequest, createErrorResponse, errorToString, runTask } from "./taskRunner.js";

describe("taskRunner", () => {
  describe("errorToString", () => {
    it("should return error name for Error instances", () => {
      expect(errorToString(new Error("something broke"))).toBe("Error");
    });

    it("should return error name for typed errors", () => {
      expect(errorToString(new TypeError("bad type"))).toBe("TypeError");
    });

    it("should return 'Unknown error' for non-Error values", () => {
      expect(errorToString("a string")).toBe("Unknown error");
      expect(errorToString(null)).toBe("Unknown error");
      expect(errorToString(undefined)).toBe("Unknown error");
      expect(errorToString(42)).toBe("Unknown error");
    });
  });

  describe("createErrorResponse", () => {
    it("should create a properly shaped error response", () => {
      const res = createErrorResponse("something failed", "SOME_CODE");
      expect(res.success).toBe(false);
      expect(res.error.message).toBe("something failed");
      expect(res.error.code).toBe("SOME_CODE");
      expect(res.error.timestamp).toBeDefined();
    });

    it("should have a valid ISO timestamp", () => {
      const res = createErrorResponse("msg", "CODE");
      const parsed = new Date(res.error.timestamp);
      expect(parsed.getTime()).not.toBeNaN();
    });
  });

  describe("validateTaskRequest", () => {
    beforeEach(async () => {
      process.env.OPENAI_API_KEY = "test-key";
      const { getAIProviderInfo } = await import("pilo-core");
      vi.mocked(getAIProviderInfo).mockReturnValue({
        provider: "openai",
        model: "gpt-4.1",
        hasApiKey: true,
        keySource: "env",
      });
    });

    afterEach(() => {
      delete process.env.OPENAI_API_KEY;
    });

    it("should return error when task is missing", () => {
      const result = validateTaskRequest({ task: "" });
      expect(result).not.toBeNull();
      expect(result!.status).toBe(400);
      expect(result!.response.error.code).toBe("MISSING_TASK");
    });

    it("should return null for a valid request", () => {
      const result = validateTaskRequest({ task: "do something" });
      expect(result).toBeNull();
    });

    it("should return error for invalid search provider", () => {
      const result = validateTaskRequest({
        task: "test",
        searchProvider: "invalid-provider" as any,
      });
      expect(result).not.toBeNull();
      expect(result!.status).toBe(400);
      expect(result!.response.error.code).toBe("INVALID_SEARCH_PROVIDER");
      expect(result!.response.error.message).toContain("invalid-provider");
    });

    it("should accept valid search providers", () => {
      for (const provider of ["none", "duckduckgo", "google", "bing"] as const) {
        const result = validateTaskRequest({ task: "test", searchProvider: provider });
        expect(result).toBeNull();
      }
    });

    it("should return error when AI provider is not configured", async () => {
      const { getAIProviderInfo } = await import("pilo-core");
      vi.mocked(getAIProviderInfo).mockImplementation(() => {
        throw new Error("No API key found");
      });

      const result = validateTaskRequest({ task: "test" });
      expect(result).not.toBeNull();
      expect(result!.status).toBe(500);
      expect(result!.response.error.code).toBe("MISSING_API_KEY");
    });
  });

  describe("runTask", () => {
    beforeEach(() => {
      process.env.OPENAI_API_KEY = "test-key";
      mockExecute = vi.fn().mockResolvedValue({
        success: true,
        finalAnswer: "Task completed",
        stats: { actions: 1, iterations: 1 },
      });
      mockClose = vi.fn().mockResolvedValue(undefined);
      mockConstructorSpy = vi.fn();
    });

    afterEach(() => {
      delete process.env.OPENAI_API_KEY;
    });

    it("should execute a task and return the result", async () => {
      const result = await runTask({
        body: { task: "test task" },
        sendEvent: vi.fn(),
        abortSignal: new AbortController().signal,
      });

      expect(result.success).toBe(true);
    });

    it("should pass task and url to agent.execute", async () => {
      await runTask({
        body: { task: "fill the form", url: "https://example.com" },
        sendEvent: vi.fn(),
        abortSignal: new AbortController().signal,
      });

      expect(mockExecute).toHaveBeenCalledWith("fill the form", {
        startingUrl: "https://example.com",
        data: undefined,
        abortSignal: expect.any(AbortSignal),
      });
    });

    it("should pass onUserDataRequired callback to WebAgent", async () => {
      const callback = vi.fn();
      await runTask({
        body: { task: "test" },
        sendEvent: vi.fn(),
        abortSignal: new AbortController().signal,
        onUserDataRequired: callback,
      });

      expect(mockConstructorSpy).toHaveBeenCalledWith(
        expect.objectContaining({ onUserDataRequired: callback }),
      );
    });

    it("should close the agent even when execute throws", async () => {
      mockExecute = vi.fn().mockRejectedValue(new Error("task failed"));

      await expect(
        runTask({
          body: { task: "test" },
          sendEvent: vi.fn(),
          abortSignal: new AbortController().signal,
        }),
      ).rejects.toThrow("task failed");

      expect(mockClose).toHaveBeenCalled();
    });

    it("should not throw when agent.close fails", async () => {
      mockClose = vi.fn().mockRejectedValue(new Error("close failed"));

      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

      const result = await runTask({
        body: { task: "test" },
        sendEvent: vi.fn(),
        abortSignal: new AbortController().signal,
      });

      expect(result.success).toBe(true);
      expect(consoleError).toHaveBeenCalledWith("Error closing agent:", expect.any(Error));
      consoleError.mockRestore();
    });
  });
});

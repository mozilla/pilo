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

  class RecoverableError extends Error {}

  return {
    WebAgent: MockWebAgent,
    PlaywrightBrowser: MockPlaywrightBrowser,
    RecoverableError,
    config: {
      getConfig: vi.fn(() => ({
        provider: "openai",
        openai_api_key: "sk-test123",
        browser: "firefox",
        headless: true,
        llm_provider_timeout_ms: 90000,
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

import {
  validateTaskRequest,
  createErrorResponse,
  errorResponseFromError,
  runTask,
} from "./taskRunner.js";

describe("taskRunner", () => {
  describe("createErrorResponse", () => {
    it("should build the structured error shape from explicit fields", () => {
      const res = createErrorResponse({
        message: "something failed",
        class: "CustomError",
        code: "SOME_CODE",
        reason: "INVALID_REQUEST",
        recoverable: false,
        phase: "setup",
        taskId: "task-abc-123",
      });
      expect(res.success).toBe(false);
      expect(res.error.message).toBe("something failed");
      expect(res.error.class).toBe("CustomError");
      expect(res.error.code).toBe("SOME_CODE");
      expect(res.error.reason).toBe("INVALID_REQUEST");
      expect(res.error.recoverable).toBe(false);
      expect(res.error.phase).toBe("setup");
      expect(res.error.taskId).toBe("task-abc-123");
      expect(res.error.timestamp).toBeDefined();
    });

    it("should produce a valid ISO timestamp", () => {
      const res = createErrorResponse({
        message: "msg",
        code: "CODE",
        reason: "INTERNAL_ERROR",
      });
      const parsed = new Date(res.error.timestamp);
      expect(parsed.getTime()).not.toBeNaN();
    });

    it("should default class to 'Error' when not provided", () => {
      const res = createErrorResponse({
        message: "msg",
        code: "CODE",
        reason: "INTERNAL_ERROR",
      });
      expect(res.error.class).toBe("Error");
    });

    it("should default recoverable to false when not provided", () => {
      const res = createErrorResponse({
        message: "msg",
        code: "CODE",
        reason: "INTERNAL_ERROR",
      });
      expect(res.error.recoverable).toBe(false);
    });

    it("should omit taskId when not provided", () => {
      const res = createErrorResponse({
        message: "msg",
        code: "CODE",
        reason: "INTERNAL_ERROR",
      });
      expect(res.error.taskId).toBeUndefined();
    });

    it("should omit phase when not provided", () => {
      const res = createErrorResponse({
        message: "msg",
        code: "CODE",
        reason: "INTERNAL_ERROR",
      });
      expect(res.error.phase).toBeUndefined();
    });
  });

  describe("errorResponseFromError", () => {
    it("should derive class from error constructor name", () => {
      const res = errorResponseFromError(new TypeError("bad"), {
        code: "TASK_EXECUTION_FAILED",
        phase: "execution",
      });
      expect(res.error.class).toBe("TypeError");
    });

    it("should never forward error.message to the response", () => {
      const res = errorResponseFromError(new Error("DO NOT LOG THIS SENTINEL"), {
        code: "TASK_EXECUTION_FAILED",
        phase: "execution",
      });
      const json = JSON.stringify(res);
      expect(json).not.toContain("DO NOT LOG THIS SENTINEL");
    });

    it("should set message from the reason hint map (not error.message)", () => {
      const res = errorResponseFromError(new Error("ignored dynamic detail"), {
        code: "TASK_EXECUTION_FAILED",
        phase: "execution",
      });
      // INTERNAL_ERROR hint
      expect(res.error.message).toBe("The task failed due to an internal error.");
    });

    it("should classify unknown errors as INTERNAL_ERROR, not recoverable", () => {
      const res = errorResponseFromError(new Error("boom"), {
        code: "TASK_EXECUTION_FAILED",
        phase: "execution",
      });
      expect(res.error.reason).toBe("INTERNAL_ERROR");
      expect(res.error.recoverable).toBe(false);
    });

    it("should classify non-Error throws as INTERNAL_ERROR with class Unknown", () => {
      const res = errorResponseFromError("a string", {
        code: "TASK_EXECUTION_FAILED",
        phase: "execution",
      });
      expect(res.error.class).toBe("Unknown");
      expect(res.error.reason).toBe("INTERNAL_ERROR");
      expect(res.error.recoverable).toBe(false);
    });

    it("should include the phase passed in opts", () => {
      const res = errorResponseFromError(new Error(), {
        code: "TASK_EXECUTION_FAILED",
        phase: "execution",
      });
      expect(res.error.phase).toBe("execution");
    });

    it("should include taskId when provided", () => {
      const res = errorResponseFromError(new Error(), {
        code: "TASK_EXECUTION_FAILED",
        phase: "execution",
        taskId: "task-abc-123",
      });
      expect(res.error.taskId).toBe("task-abc-123");
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

    it("should return INVALID_REQUEST when task is missing", () => {
      const result = validateTaskRequest({ task: "" });
      expect(result).not.toBeNull();
      expect(result!.status).toBe(400);
      expect(result!.response.error.message).toBe("Task is required");
      expect(result!.response.error.code).toBe("MISSING_TASK");
      expect(result!.response.error.reason).toBe("INVALID_REQUEST");
      expect(result!.response.error.phase).toBe("setup");
    });

    it("should return null for a valid request", () => {
      const result = validateTaskRequest({ task: "do something" });
      expect(result).toBeNull();
    });

    it("should return INVALID_REQUEST for invalid search provider", () => {
      const result = validateTaskRequest({
        task: "test",
        searchProvider: "invalid-provider" as any,
      });
      expect(result).not.toBeNull();
      expect(result!.status).toBe(400);
      expect(result!.response.error.code).toBe("INVALID_SEARCH_PROVIDER");
      expect(result!.response.error.reason).toBe("INVALID_REQUEST");
      expect(result!.response.error.message).toContain("Must be one of");
      // Must not echo the user-provided value back
      expect(result!.response.error.message).not.toContain("invalid-provider");
    });

    it("should accept valid search providers", () => {
      for (const provider of ["none", "duckduckgo", "google", "bing"] as const) {
        const result = validateTaskRequest({ task: "test", searchProvider: provider });
        expect(result).toBeNull();
      }
    });

    it("should return PROVIDER_UNAUTHORIZED when AI provider is not configured", async () => {
      const { getAIProviderInfo } = await import("pilo-core");
      vi.mocked(getAIProviderInfo).mockImplementation(() => {
        throw new Error("No API key found");
      });

      const result = validateTaskRequest({ task: "test" });
      expect(result).not.toBeNull();
      expect(result!.status).toBe(500);
      expect(result!.response.error.message).toBe("AI provider is not configured.");
      expect(result!.response.error.code).toBe("MISSING_API_KEY");
      expect(result!.response.error.reason).toBe("PROVIDER_UNAUTHORIZED");
      expect(result!.response.error.phase).toBe("setup");
    });

    it("should never leak error.message from getAIProviderInfo into validation response", async () => {
      const { getAIProviderInfo } = await import("pilo-core");
      vi.mocked(getAIProviderInfo).mockImplementation(() => {
        throw new Error("SENSITIVE: key sk-abc123 not found in env");
      });

      const result = validateTaskRequest({ task: "test" });
      const json = JSON.stringify(result!.response);
      expect(json).not.toContain("SENSITIVE");
      expect(json).not.toContain("sk-abc123");
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

    it("should pass taskId to WebAgent constructor when provided", async () => {
      await runTask({
        body: { task: "test" },
        sendEvent: vi.fn(),
        abortSignal: new AbortController().signal,
        taskId: "task-abc-123",
      });

      expect(mockConstructorSpy).toHaveBeenCalledWith(
        expect.objectContaining({ taskId: "task-abc-123" }),
      );
    });

    it("should pass trustedHostnames and unsafeMode to WebAgent constructor", async () => {
      await runTask({
        body: {
          task: "submit the form",
          trustedHostnames: ["example.com", "app.example.com"],
          unsafeMode: true,
        },
        sendEvent: vi.fn(),
        abortSignal: new AbortController().signal,
      });

      expect(mockConstructorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          trustedHostnames: ["example.com", "app.example.com"],
          unsafeMode: true,
        }),
      );
    });

    it("passes the configured llm provider timeout to WebAgent", async () => {
      await runTask({
        body: { task: "test" },
        sendEvent: vi.fn(),
        abortSignal: new AbortController().signal,
      });

      expect(mockConstructorSpy).toHaveBeenCalledWith(
        expect.objectContaining({ llmProviderTimeoutMs: 90000 }),
      );
    });

    it("lets the request body override the llm provider timeout", async () => {
      await runTask({
        body: { task: "test", llmProviderTimeoutMs: 45000 },
        sendEvent: vi.fn(),
        abortSignal: new AbortController().signal,
      });

      expect(mockConstructorSpy).toHaveBeenCalledWith(
        expect.objectContaining({ llmProviderTimeoutMs: 45000 }),
      );
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
      expect(consoleError).toHaveBeenCalledWith(
        "[pilo-server] error closing agent",
        expect.objectContaining({ error_class: expect.any(String) }),
      );
      consoleError.mockRestore();
    });
  });
});

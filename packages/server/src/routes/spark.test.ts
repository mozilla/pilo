import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";
import sparkRoutes from "./spark.js";

// Mock the spark library
vi.mock("spark", () => ({
  WebAgent: vi.fn().mockImplementation(() => ({
    execute: vi.fn().mockResolvedValue({
      success: true,
      finalAnswer: "Task completed successfully",
      plan: "Test plan",
      taskExplanation: "Test explanation",
      iterations: 1,
      validationAttempts: 1,
    }),
    close: vi.fn().mockResolvedValue(undefined),
  })),
  PlaywrightBrowser: vi.fn().mockImplementation(() => ({})),
  config: {
    getConfig: vi.fn(() => ({
      provider: "openai",
      openai_api_key: "sk-test123",
    })),
  },
  createAIProvider: vi.fn(() => ({})),
  getAIProviderInfo: vi.fn(() => ({
    provider: "openai",
    model: "gpt-4.1",
    hasApiKey: true,
    keySource: "env",
  })),
  // Config merge utilities
  createNavigationRetryConfig: vi.fn((overrides) => ({
    baseTimeoutMs: overrides?.baseTimeoutMs ?? 30000,
    maxTimeoutMs: overrides?.maxTimeoutMs ?? 120000,
    maxAttempts: overrides?.maxAttempts ?? 3,
    timeoutMultiplier: overrides?.timeoutMultiplier ?? 2,
    ...(overrides?.onRetry && { onRetry: overrides.onRetry }),
  })),
  // Default constants
  DEFAULT_BROWSER: "firefox",
  DEFAULT_HEADLESS: false,
  DEFAULT_BLOCK_ADS: true,
  DEFAULT_DEBUG: false,
  DEFAULT_VISION: false,
  DEFAULT_MAX_ITERATIONS: 50,
  DEFAULT_MAX_VALIDATION_ATTEMPTS: 3,
}));

// Mock the AI SDK
vi.mock("@ai-sdk/openai", () => ({
  openai: vi.fn().mockReturnValue({}),
}));

// Mock the StreamLogger
vi.mock("../StreamLogger.js", () => ({
  StreamLogger: vi.fn().mockImplementation(() => ({})),
}));

describe("Spark Routes", () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    app.route("/spark", sparkRoutes);

    // Don't clear mocks - it breaks our mock setup
    // vi.clearAllMocks();
  });

  describe("POST /spark/run", () => {
    beforeEach(async () => {
      process.env.OPENAI_API_KEY = "test-key";

      // Reset the getAIProviderInfo mock to its default success state
      const { getAIProviderInfo } = await import("spark");
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

    it("should reject requests without task", async () => {
      const res = await app.request("/spark/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.message).toBe("Task is required");
      expect(data.error.code).toBe("MISSING_TASK");
      expect(data.error.timestamp).toBeDefined();
    });

    it("should reject requests without OpenAI API key", async () => {
      // Mock getAIProviderInfo to throw an error for missing API key
      const { getAIProviderInfo } = await import("spark");
      vi.mocked(getAIProviderInfo).mockImplementation(() => {
        throw new Error(
          "No OpenAI API key found. Please set OPENAI_API_KEY environment variable or configure globally.",
        );
      });

      const res = await app.request("/spark/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: "test task" }),
      });

      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.message).toBe(
        "AI provider not configured: No OpenAI API key found. Please set OPENAI_API_KEY environment variable or configure globally.",
      );
      expect(data.error.code).toBe("MISSING_API_KEY");
      expect(data.error.timestamp).toBeDefined();
    });

    it("should return SSE headers for valid request", async () => {
      const res = await app.request("/spark/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: "test task" }),
      });

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("text/event-stream");
      expect(res.headers.get("Cache-Control")).toBe("no-cache");
      expect(res.headers.get("Connection")).toBe("keep-alive");
    });

    it("should accept optional parameters", async () => {
      const res = await app.request("/spark/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: "test task",
          url: "https://example.com",
          data: { key: "value" },
          guardrails: "Do not make purchases",
        }),
      });

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("text/event-stream");
    });

    it("should handle malformed JSON", async () => {
      const res = await app.request("/spark/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "invalid json",
      });

      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.message).toContain("not valid JSON");
      expect(data.error.code).toBe("TASK_SETUP_FAILED");
      expect(data.error.timestamp).toBeDefined();
    });

    it("should return readable stream for SSE", async () => {
      const res = await app.request("/spark/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: "test task" }),
      });

      expect(res.status).toBe(200);
      expect(res.body).toBeInstanceOf(ReadableStream);
      expect(res.headers.get("Content-Type")).toBe("text/event-stream");
      expect(res.headers.get("Cache-Control")).toBe("no-cache");
      expect(res.headers.get("Connection")).toBe("keep-alive");
    });

    it("should stream SSE events with proper format", async () => {
      const res = await app.request("/spark/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: "test task" }),
      });

      expect(res.status).toBe(200);
      expect(res.body).toBeInstanceOf(ReadableStream);

      // Read the stream
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();

      // Read first chunk (should be start event)
      const { value, done } = await reader.read();
      expect(done).toBe(false);

      const chunk = decoder.decode(value);
      expect(chunk).toMatch(/^event: start\ndata: /);
      expect(chunk).toContain('"task":"test task"');

      reader.releaseLock();
    });
  });
});

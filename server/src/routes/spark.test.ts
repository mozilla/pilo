import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";
import sparkRoutes from "./spark.js";

// Mock the spark library
vi.mock("spark", () => ({
  WebAgent: vi.fn().mockImplementation(() => ({
    execute: vi.fn(),
    close: vi.fn(),
  })),
  PlaywrightBrowser: vi.fn().mockImplementation(() => ({})),
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
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("POST /spark/run", () => {
    beforeEach(() => {
      process.env.OPENAI_API_KEY = "test-key";
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
      delete process.env.OPENAI_API_KEY;

      const res = await app.request("/spark/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: "test task" }),
      });

      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.message).toBe(
        "OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.",
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
  });
});

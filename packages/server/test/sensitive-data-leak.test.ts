/**
 * CI gate: user-supplied data and thrown-error content must never reach
 * telemetry surfaces (console logs, server-side structured output).
 *
 * This is an integration-style test that exercises the real server routes
 * (pilo-core is mocked to let us force specific failure modes). It runs the
 * full request path for each failure mode and asserts the sentinel string
 * never appears in anything written to console.*.
 *
 * When this test fails, do not adjust the assertions. Fix the leak.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";

const SENTINEL = "SENSITIVE-CANARY-a8f3d2";

// Module-level hooks so individual tests can control WebAgent behavior.
let mockExecute = vi.fn().mockResolvedValue({
  success: true,
  finalAnswer: "done",
  stats: { iterations: 1, actions: 0, startTime: 0, endTime: 0, durationMs: 0 },
});
let mockClose = vi.fn().mockResolvedValue(undefined);

vi.mock("pilo-core", () => {
  class MockWebAgent {
    constructor(_browser: unknown, _opts: unknown) {}
    execute = (...args: unknown[]) => mockExecute(...args);
    close = (...args: unknown[]) => mockClose(...args);
  }
  class MockPlaywrightBrowser {}

  return {
    RecoverableError: class extends Error {},
    WebAgent: MockWebAgent,
    PlaywrightBrowser: MockPlaywrightBrowser,
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
    createNavigationRetryConfig: vi.fn((overrides: { baseTimeoutMs?: number } | undefined) => ({
      baseTimeoutMs: overrides?.baseTimeoutMs ?? 30000,
      maxTimeoutMs: 120000,
      maxAttempts: 3,
      timeoutMultiplier: 2,
    })),
    SEARCH_PROVIDERS: ["none", "duckduckgo", "google", "bing", "parallel-api"],
    withRemoteContext: vi.fn((_headers: unknown, fn: () => unknown) => fn()),
    // Skill cache wiring is exercised in core tests; the server only forwards
    // the resolved store into WebAgent. Returning null here mirrors the
    // "skills_enabled: false" production default.
    createSkillStoreFromConfig: vi.fn(() => null),
  };
});

vi.mock("@ai-sdk/openai", () => ({
  openai: vi.fn().mockReturnValue({}),
}));

vi.mock("../src/StreamLogger.js", () => ({
  StreamLogger: class MockStreamLogger {},
}));

interface CapturedConsole {
  log: string[];
  error: string[];
  warn: string[];
  info: string[];
  debug: string[];
}

function captureConsole(): {
  captured: CapturedConsole;
  restore: () => void;
  all: () => string;
} {
  const captured: CapturedConsole = { log: [], error: [], warn: [], info: [], debug: [] };
  const methods: (keyof CapturedConsole)[] = ["log", "error", "warn", "info", "debug"];
  const originals: Record<string, (...args: unknown[]) => void> = {};

  for (const method of methods) {
    originals[method] = console[method] as (...args: unknown[]) => void;
    console[method] = vi.fn((...args: unknown[]) => {
      captured[method].push(
        args
          .map((a) => {
            if (a instanceof Error) {
              // What Node's util.inspect would show on console.error(err) —
              // includes message + stack.
              return `${a.name}: ${a.message}\n${a.stack ?? ""}`;
            }
            if (typeof a === "string") return a;
            try {
              return JSON.stringify(a);
            } catch {
              return String(a);
            }
          })
          .join(" "),
      );
    }) as typeof console.log;
  }

  return {
    captured,
    restore() {
      for (const method of methods) {
        console[method] = originals[method] as (...args: unknown[]) => void;
      }
    },
    all() {
      return [
        ...captured.log,
        ...captured.error,
        ...captured.warn,
        ...captured.info,
        ...captured.debug,
      ].join("\n");
    },
  };
}

describe("sensitive data leak canary", () => {
  let app: Hono;
  let cap: ReturnType<typeof captureConsole>;

  beforeEach(async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    // Reset mocks to default happy-path behavior.
    mockExecute = vi.fn().mockResolvedValue({
      success: true,
      finalAnswer: "done",
      stats: { iterations: 1, actions: 0, startTime: 0, endTime: 0, durationMs: 0 },
    });
    mockClose = vi.fn().mockResolvedValue(undefined);

    cap = captureConsole();
    const piloRoutes = (await import("../src/routes/pilo.js")).default;
    app = new Hono();
    app.route("/pilo", piloRoutes);
  });

  afterEach(() => {
    cap.restore();
    delete process.env.OPENAI_API_KEY;
  });

  describe("SSE /pilo/run", () => {
    it("validation error: sentinel in url/data never leaks to console", async () => {
      await app.request("/pilo/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: `https://example.com/secret?token=${SENTINEL}`,
          data: { user: SENTINEL },
        }),
      });

      expect(cap.all()).not.toContain(SENTINEL);
    });

    it("malformed JSON with sentinel inside never leaks to console", async () => {
      await app.request("/pilo/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: `{ "task": "${SENTINEL}", broken`,
      });

      expect(cap.all()).not.toContain(SENTINEL);
    });

    it("sentinel inside a thrown WebAgent error.message never leaks to console", async () => {
      mockExecute = vi.fn().mockRejectedValue(new Error(`agent boom touching ${SENTINEL}`));

      const res = await app.request("/pilo/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: "do a thing" }),
      });
      await res.text();

      // Sanity check: this failure mode must produce a "Pilo task execution failed"
      // console.error entry, otherwise the test isn't exercising the leak path.
      expect(cap.captured.error.join("\n")).toContain("task execution failed");
      expect(cap.all()).not.toContain(SENTINEL);
    });

    it("sentinel inside a thrown agent.close error never leaks to console", async () => {
      mockClose = vi.fn().mockRejectedValue(new Error(`close failed with ${SENTINEL}`));

      const res = await app.request("/pilo/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: "do a thing" }),
      });
      await res.text();

      // Sanity check: must produce an "Error closing agent" entry.
      expect(cap.captured.error.join("\n")).toContain("closing agent");
      expect(cap.all()).not.toContain(SENTINEL);
    });

    it("aggregated: all user-supplied fields + thrown message, zero console leaks", async () => {
      mockExecute = vi.fn().mockRejectedValue(new Error(SENTINEL));

      const res = await app.request("/pilo/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: `${SENTINEL} task content`,
          url: `https://example.com/${SENTINEL}?q=${SENTINEL}`,
          data: { key: SENTINEL },
          guardrails: `do not ${SENTINEL}`,
        }),
      });
      await res.text();

      expect(cap.all()).not.toContain(SENTINEL);
    });
  });
});

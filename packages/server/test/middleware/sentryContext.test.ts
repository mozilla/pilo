import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

const SENTINEL = "SENSITIVE-CANARY-q4r7";

interface MockSentry {
  setTag: ReturnType<typeof vi.fn>;
  addBreadcrumb: ReturnType<typeof vi.fn>;
  capturedTags: Record<string, string>;
}

function makeMockSentry(): MockSentry {
  const capturedTags: Record<string, string> = {};
  return {
    capturedTags,
    setTag: vi.fn((key: string, value: string) => {
      capturedTags[key] = value;
    }),
    addBreadcrumb: vi.fn(),
  };
}

// Mock @hono/sentry's getSentry so we can intercept the request-scoped Toucan
// without standing up a real Sentry transport.
let mockSentry: MockSentry | null = null;
let getSentryThrows = false;

vi.mock("@hono/sentry", () => ({
  getSentry: (_c: unknown) => {
    if (getSentryThrows) throw new Error("sentry middleware not registered");
    return mockSentry;
  },
}));

describe("sentryContext middleware", () => {
  let app: Hono;

  beforeEach(async () => {
    mockSentry = makeMockSentry();
    getSentryThrows = false;
    app = new Hono();
    const { sentryContext } = await import("../../src/middleware/sentryContext.js");
    app.use("*", sentryContext());
  });

  it("sets method, route, and status tags after the request handler runs", async () => {
    app.get("/foo", (c) => c.json({ ok: true }));
    await app.request("/foo");

    expect(mockSentry!.capturedTags.method).toBe("GET");
    expect(mockSentry!.capturedTags.route).toBe("/foo");
    expect(mockSentry!.capturedTags.status).toBe("200");
  });

  it("sets the taskId tag from x-pilo-task-id response header when present", async () => {
    app.get("/foo", (c) => {
      c.header("x-pilo-task-id", "task-abc-123");
      return c.json({ ok: true });
    });
    await app.request("/foo");

    expect(mockSentry!.capturedTags.taskId).toBe("task-abc-123");
  });

  it("omits the taskId tag when no x-pilo-task-id header is set", async () => {
    app.get("/foo", (c) => c.json({ ok: true }));
    await app.request("/foo");

    expect(mockSentry!.capturedTags.taskId).toBeUndefined();
  });

  it("sets tags even when the handler throws", async () => {
    app.get("/foo", () => {
      throw new Error("boom");
    });
    try {
      await app.request("/foo");
    } catch {
      // ignore — the throw is incidental, we want to verify the finally block
    }
    expect(mockSentry!.capturedTags.method).toBe("GET");
    expect(mockSentry!.capturedTags.route).toBe("/foo");
  });

  it("does not throw when @hono/sentry middleware is not registered", async () => {
    getSentryThrows = true;
    app.get("/foo", (c) => c.json({ ok: true }));
    const res = await app.request("/foo");
    expect(res.status).toBe(200);
  });

  it("never sets a tag value derived from request body / URL (canary)", async () => {
    app.post("/foo", async (c) => {
      await c.req.json().catch(() => undefined);
      return c.json({ ok: true });
    });
    await app.request(`/foo?secret=${SENTINEL}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task: SENTINEL }),
    });

    const allTagValues = Object.values(mockSentry!.capturedTags).join(" ");
    expect(allTagValues).not.toContain(SENTINEL);
  });
});

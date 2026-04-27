import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";
import { requestLog } from "../../src/middleware/requestLog.js";

const SENTINEL = "SENSITIVE-CANARY-x9b2";

function captureConsoleLog() {
  const lines: string[] = [];
  const original = console.log;
  console.log = vi.fn((...args: unknown[]) => {
    lines.push(args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "));
  }) as typeof console.log;
  return {
    lines,
    restore: () => {
      console.log = original;
    },
    parsed: () =>
      lines
        .map((l) => {
          try {
            return JSON.parse(l) as Record<string, unknown>;
          } catch {
            return null;
          }
        })
        .filter((x): x is Record<string, unknown> => x !== null),
  };
}

describe("requestLog middleware", () => {
  let app: Hono;
  let cap: ReturnType<typeof captureConsoleLog>;

  beforeEach(() => {
    cap = captureConsoleLog();
    app = new Hono();
    app.use("*", requestLog());
  });

  afterEach(() => {
    cap.restore();
  });

  it("logs method, route, status, duration_ms for a basic request", async () => {
    app.get("/foo", (c) => c.json({ ok: true }));
    await app.request("/foo");

    const log = cap.parsed()[0];
    expect(log).toBeDefined();
    expect(log.method).toBe("GET");
    expect(log.route).toBe("/foo");
    expect(log.status).toBe(200);
    expect(typeof log.duration_ms).toBe("number");
    expect(log.duration_ms as number).toBeGreaterThanOrEqual(0);
  });

  it("logs the matched route pattern, not the actual path", async () => {
    app.get("/users/:id", (c) => c.json({ id: c.req.param("id") }));
    await app.request("/users/abc123");

    const log = cap.parsed()[0];
    expect(log.route).toBe("/users/:id");
  });

  it("never logs the full URL (query strings would leak)", async () => {
    app.get("/foo", (c) => c.json({ ok: true }));
    await app.request(`/foo?secret=${SENTINEL}`);

    const allLogs = cap.lines.join("\n");
    expect(allLogs).not.toContain(SENTINEL);
    expect(allLogs).not.toContain("secret=");
  });

  it("never logs the request body", async () => {
    app.post("/foo", async (c) => {
      await c.req.json().catch(() => undefined);
      return c.json({ ok: true });
    });
    await app.request("/foo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task: SENTINEL }),
    });

    expect(cap.lines.join("\n")).not.toContain(SENTINEL);
  });

  it("never logs request headers (auth tokens would leak)", async () => {
    app.get("/foo", (c) => c.json({ ok: true }));
    await app.request("/foo", {
      headers: {
        Authorization: `Bearer ${SENTINEL}`,
        Cookie: `session=${SENTINEL}`,
      },
    });

    expect(cap.lines.join("\n")).not.toContain(SENTINEL);
  });

  it("includes taskId when x-pilo-task-id response header is set", async () => {
    app.get("/foo", (c) => {
      c.header("x-pilo-task-id", "task-abc-123");
      return c.json({ ok: true });
    });
    await app.request("/foo");

    const log = cap.parsed()[0];
    expect(log.taskId).toBe("task-abc-123");
  });

  it("omits taskId when no x-pilo-task-id header is set", async () => {
    app.get("/foo", (c) => c.json({ ok: true }));
    await app.request("/foo");

    const log = cap.parsed()[0];
    expect(log.taskId).toBeUndefined();
  });

  it("captures 4xx status correctly", async () => {
    app.get("/foo", (c) => c.json({ error: "not found" }, 404));
    await app.request("/foo");

    const log = cap.parsed()[0];
    expect(log.status).toBe(404);
  });

  it("captures 5xx status correctly", async () => {
    app.get("/foo", (c) => c.json({ error: "boom" }, 500));
    await app.request("/foo");

    const log = cap.parsed()[0];
    expect(log.status).toBe(500);
  });

  it("logs once per request even with nested routes", async () => {
    const subApp = new Hono();
    subApp.get("/bar", (c) => c.json({ ok: true }));
    app.route("/api", subApp);
    await app.request("/api/bar");

    expect(cap.parsed()).toHaveLength(1);
  });

  it("emits a single JSON line per request (parseable)", async () => {
    app.get("/foo", (c) => c.json({ ok: true }));
    await app.request("/foo");

    expect(cap.lines).toHaveLength(1);
    expect(() => JSON.parse(cap.lines[0])).not.toThrow();
  });
});

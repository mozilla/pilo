import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";
import { cors } from "hono/cors";

// We'll test the app structure by importing and testing the routes
describe("Server Application", () => {
  it("should create a Hono app instance", () => {
    const app = new Hono();
    expect(app).toBeDefined();
  });

  it("should have health check endpoint", async () => {
    const app = new Hono();

    app.get("/health", (c) => {
      return c.json({ status: "ok", timestamp: new Date().toISOString() });
    });

    const res = await app.request("/health");
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.status).toBe("ok");
    expect(data.timestamp).toBeDefined();
  });

  it("should have basic info endpoint", async () => {
    const app = new Hono();

    app.get("/", (c) => {
      return c.json({
        name: "Pilo Server",
        version: "0.1.0",
        description: "Web server for Pilo AI-powered web automation",
      });
    });

    const res = await app.request("/");
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.name).toBe("Pilo Server");
    expect(data.version).toBe("0.1.0");
    expect(data.description).toBe("Web server for Pilo AI-powered web automation");
  });

  describe("health/readiness probes", () => {
    beforeEach(() => {
      vi.resetModules();
    });

    afterEach(async () => {
      delete process.env.MAX_CONCURRENT_TASKS;
      const { _resetActiveTasksForTesting } = await import("./concurrencyGuard.js");
      _resetActiveTasksForTesting();
    });

    it("readiness returns 200 even when at concurrency capacity", async () => {
      // MAX_CONCURRENT_TASKS=0 makes the pod report 'at capacity' for every
      // task. Readiness must still report ready so the load balancer keeps
      // routing here; over-capacity requests are shed per-request
      // (CONCURRENCY_LIMIT), not by evicting the pod from the Service. (TAB-993)
      process.env.MAX_CONCURRENT_TASKS = "0";
      const { registerHealthRoutes } = await import("./health.js");
      const app = new Hono();
      registerHealthRoutes(app);

      const res = await app.request("/ready");
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe("ok");
    });

    it("liveness /health returns 200", async () => {
      const { registerHealthRoutes } = await import("./health.js");
      const app = new Hono();
      registerHealthRoutes(app);

      const res = await app.request("/health");
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe("ok");
    });
  });

  it("should set CORS headers correctly", async () => {
    const app = new Hono();

    // Add CORS middleware like in the real app
    app.use(
      "*",
      cors({
        origin: [
          "http://localhost:3000",
          "http://localhost:3001",
          "http://127.0.0.1:3000",
          "http://127.0.0.1:3001",
        ],
        allowMethods: ["GET", "POST", "OPTIONS"],
        allowHeaders: ["Content-Type", "Authorization"],
        exposeHeaders: ["Content-Type"],
        credentials: false,
      }),
    );

    app.get("/test", (c) => c.json({ test: true }));

    const res = await app.request("/test", {
      headers: { Origin: "http://localhost:3000" },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:3000");
  });

  it("should handle CORS preflight requests", async () => {
    const app = new Hono();

    app.use(
      "*",
      cors({
        origin: ["http://localhost:3000", "http://localhost:3001"],
        allowMethods: ["GET", "POST", "OPTIONS"],
        allowHeaders: ["Content-Type", "Authorization"],
      }),
    );

    const res = await app.request("/test", {
      method: "OPTIONS",
      headers: {
        Origin: "http://localhost:3000",
        "Access-Control-Request-Method": "POST",
      },
    });

    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:3000");
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("POST");
  });
});

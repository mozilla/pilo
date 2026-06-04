import type { Hono } from "hono";

/**
 * Register the liveness (`/health`) and readiness (`/ready`) probes.
 *
 * Readiness reports whether the process is alive and able to serve requests —
 * NOT whether it currently has a free task slot. Coupling readiness to the
 * concurrency limit caused the load balancer to evict every pod from the
 * Service under burst load (each pod 503s the instant it hits the cap), turning
 * a busy backend into an unreachable one. Over-capacity is instead shed
 * per-request via CONCURRENCY_LIMIT in the task routes, so a busy pod stays in
 * rotation and returns clean retryable errors. (TAB-993)
 */
export function registerHealthRoutes(app: Hono): void {
  // Liveness: is the process alive?
  app.get("/health", (c) => {
    return c.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Readiness: should this pod receive traffic? Yes whenever the process is up.
  app.get("/ready", (c) => {
    return c.json({ status: "ok" });
  });
}

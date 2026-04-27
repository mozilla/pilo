/**
 * Per-request Sentry scope tags.
 *
 * Runs after the @hono/sentry middleware so each request has its own Toucan
 * instance to tag. Adds bounded, non-sensitive tags so Sentry events from a
 * given request can be filtered/grouped on the dashboard:
 *
 * - method (GET/POST/...)
 * - route (matched pattern, e.g. "/pilo/run")
 * - status (HTTP status as a string)
 * - taskId (when the response carries an x-pilo-task-id header)
 *
 * No request body, URL, headers, or other request-derived content is tagged.
 *
 * Defensive: if @hono/sentry middleware isn't registered (no DSN, tests),
 * getSentry() throws and we silently no-op.
 */
import type { Context, Next } from "hono";
import { getSentry } from "@hono/sentry";

export function sentryContext() {
  return async (c: Context, next: Next): Promise<void> => {
    try {
      await next();
    } finally {
      try {
        const sentry = getSentry(c);
        if (!sentry) return;
        sentry.setTag("method", c.req.method);
        sentry.setTag("route", c.req.routePath || "unknown");
        sentry.setTag("status", String(c.res?.status ?? 0));
        const taskId = c.res?.headers.get("x-pilo-task-id");
        if (taskId) sentry.setTag("taskId", taskId);
      } catch {
        // Sentry not available (no DSN, or middleware not registered) — no-op.
      }
    }
  };
}

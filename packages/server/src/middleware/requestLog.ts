/**
 * Request log middleware.
 *
 * Emits one structured JSON line per HTTP request. Captures only metadata
 * (method, matched route, status, duration_ms, taskId) — never the full
 * URL with query string, request body, headers, cookies, or client IP.
 *
 * The `taskId` field is populated from the `x-pilo-task-id` response header
 * (set by route handlers in routes/pilo.ts via the A1 propagation). When the
 * header is absent — for example WebSocket upgrades, /health, /, or any
 * future route that doesn't generate a taskId — the field is omitted.
 *
 * If you find yourself wanting to log additional context, route the value
 * through the data-sensitivity check in the plan first: any value derived
 * from user input or page content must NOT be logged here. The A4 leak
 * canary will fail in CI if a regression is introduced.
 */
import type { Context, Next } from "hono";

interface RequestLogLine {
  level: "info";
  msg: "request";
  method: string;
  route: string;
  status: number;
  duration_ms: number;
  taskId?: string;
}

export function requestLog() {
  return async (c: Context, next: Next): Promise<void> => {
    const start = Date.now();
    try {
      await next();
    } finally {
      const durationMs = Date.now() - start;
      const taskId = c.res?.headers.get("x-pilo-task-id") ?? undefined;
      const line: RequestLogLine = {
        level: "info",
        msg: "request",
        method: c.req.method,
        route: c.req.routePath,
        status: c.res?.status ?? 0,
        duration_ms: durationMs,
        ...(taskId ? { taskId } : {}),
      };
      console.log(JSON.stringify(line));
    }
  };
}

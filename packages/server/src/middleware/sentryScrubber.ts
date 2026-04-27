/**
 * Sentry scrubber hooks.
 *
 * Acts as a defense-in-depth layer at the boundary where Sentry events leave
 * the process. Even when upstream code is careful with `error.message` and
 * span attributes (Stack A's invariants), Sentry's @hono/sentry middleware
 * also auto-captures request data and unhandled exceptions, which can include
 * `error.message` strings and request bodies. These hooks ensure that any
 * such auto-captured content is stripped before transport.
 *
 * If a regression introduces a leak upstream, these scrubbers still catch it.
 * Treat them as safety net, not primary defense.
 */
import type { Breadcrumb, BreadcrumbHint, ErrorEvent, EventHint } from "@sentry/types";

const STRIPPED_HEADER_NAMES = new Set(["authorization", "cookie", "set-cookie"]);

/**
 * Allowlist of breadcrumb data keys that are bounded, non-sensitive, and
 * server-controlled. Any breadcrumb data key not in this set is dropped
 * before the breadcrumb reaches Sentry, regardless of where it came from.
 */
const ALLOWED_BREADCRUMB_DATA_KEYS = new Set([
  "taskId",
  "method",
  "route",
  "status",
  "phase",
  "reason",
  "result",
  "provider",
  "model",
  "iteration",
  "tool",
  "error_class",
  "duration_ms",
]);

/**
 * Sentry `beforeSend` hook. Removes potentially sensitive fields from the
 * event before it leaves the process.
 */
export function scrubBeforeSend(event: ErrorEvent, _hint?: EventHint): ErrorEvent {
  if (event.request) {
    const req = event.request;
    delete req.data;
    delete req.query_string;
    delete req.cookies;
    if (req.headers) {
      const safeHeaders: Record<string, string> = {};
      for (const [k, v] of Object.entries(req.headers)) {
        if (STRIPPED_HEADER_NAMES.has(k.toLowerCase())) continue;
        if (typeof v === "string") safeHeaders[k] = v;
      }
      req.headers = safeHeaders;
    }
  }

  // Reduce exception values to class names only; drop stacktrace.
  if (event.exception?.values) {
    for (const ex of event.exception.values) {
      ex.value = ex.type ?? "Unknown";
      delete ex.stacktrace;
    }
  }

  // Drop response body if Sentry's request integration attached one.
  if (event.contexts?.response) {
    const response = event.contexts.response as Record<string, unknown>;
    delete response.body;
  }

  // Don't forward arbitrary `extra` payloads — they're often where ad-hoc
  // user content gets attached. Tags are bounded; extras are not.
  delete event.extra;

  return event;
}

/**
 * Sentry `beforeBreadcrumb` hook. Drops console breadcrumbs entirely (verbose
 * + may contain user content) and applies an allowlist to breadcrumb `data`.
 */
export function scrubBeforeBreadcrumb(
  breadcrumb: Breadcrumb,
  _hint?: BreadcrumbHint,
): Breadcrumb | null {
  if (breadcrumb.category === "console") return null;

  if (breadcrumb.data) {
    const safe: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(breadcrumb.data)) {
      if (ALLOWED_BREADCRUMB_DATA_KEYS.has(k)) safe[k] = v;
    }
    breadcrumb.data = safe;
  }

  return breadcrumb;
}

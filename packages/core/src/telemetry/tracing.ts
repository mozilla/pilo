/**
 * Thin wrapper that safely resolves @opentelemetry/api at runtime.
 * Falls back to a no-op implementation if the package is not installed.
 */

interface Span {
  setAttribute(key: string, value: string | number | boolean): this;
  setStatus(status: { code: number; message?: string }): this;
  recordException(error: Error | string): void;
  addEvent(name: string, attributes?: Record<string, string | number | boolean>): void;
  end(): void;
}

interface Tracer {
  startSpan(
    name: string,
    options?: { attributes?: Record<string, string | number | boolean> },
  ): Span;
}

/**
 * SpanStatusCode constants compatible with @opentelemetry/api SpanStatusCode enum.
 * These work even when OTel is not installed.
 */
export const SpanStatusCode = {
  /** The default status. */
  UNSET: 0,
  /** The operation completed successfully. */
  OK: 1,
  /** The operation contains an error. */
  ERROR: 2,
} as const;

/**
 * Span name constants for all instrumented operations.
 * Use these with `withSpan` to ensure consistent, typo-free span names.
 */
export const SpanName = {
  TASK_EXECUTE: "pilo.task.execute",
  TASK_PLAN: "pilo.task.plan",
  TASK_VALIDATE: "pilo.task.validate",
  AGENT_STEP: "pilo.agent.step",
  AI_GENERATE: "pilo.ai.generate",
  BROWSER_NAVIGATE: "pilo.browser.navigate",
  BROWSER_SNAPSHOT: "pilo.browser.snapshot",
  BROWSER_SCREENSHOT: "pilo.browser.screenshot",
  BROWSER_PERFORM: "pilo.browser.perform",
  BROWSER_ACTION: "pilo.browser.action",
  BROWSER_RECONNECT: "pilo.browser.reconnect",
  SEARCH_EXECUTE: "pilo.search.execute",
} as const;

// --- Internal cache ---

type OTelApiModule = typeof import("@opentelemetry/api");

let resolvedApi: OTelApiModule | null | undefined = undefined;
const cachedTracers = new Map<string, Tracer>();

// --- No-op implementations ---

function makeNoOpSpan(): Span {
  const span: Span = {
    setAttribute(_key: string, _value: string | number | boolean): Span {
      return span;
    },
    setStatus(_status: { code: number; message?: string }): Span {
      return span;
    },
    recordException(_error: Error | string): void {
      // no-op
    },
    addEvent(_name: string, _attributes?: Record<string, string | number | boolean>): void {
      // no-op
    },
    end(): void {
      // no-op
    },
  };
  return span;
}

function makeNoOpTracer(): Tracer {
  return {
    startSpan(
      _name: string,
      _options?: { attributes?: Record<string, string | number | boolean> },
    ): Span {
      return makeNoOpSpan();
    },
  };
}

// --- Resolution ---

async function resolveOTelApi(): Promise<OTelApiModule | null> {
  if (resolvedApi !== undefined) {
    return resolvedApi;
  }

  try {
    const api = await import("@opentelemetry/api");
    resolvedApi = api;
    return resolvedApi;
  } catch {
    resolvedApi = null;
    return null;
  }
}

// --- Public API ---

/**
 * Returns the full @opentelemetry/api module, or undefined if not installed.
 * Result is cached after the first call.
 */
export async function getOTelApi(): Promise<OTelApiModule | undefined> {
  const api = await resolveOTelApi();
  return api ?? undefined;
}

/**
 * Returns a Tracer for the given name and version.
 * If @opentelemetry/api is not installed, returns a no-op tracer.
 * The same tracer instance is returned on subsequent calls with the same arguments.
 */
export async function getTracer(name = "pilo-core", version?: string): Promise<Tracer> {
  const key = `${name}:${version ?? ""}`;
  const existing = cachedTracers.get(key);
  if (existing) return existing;

  const api = await resolveOTelApi();
  const tracer = api ? api.trace.getTracer(name, version) : makeNoOpTracer();
  cachedTracers.set(key, tracer);
  return tracer;
}

/**
 * Run a function within a trace context extracted from incoming HTTP headers
 * (e.g. a WebSocket upgrade request). Any spans created inside `fn` via
 * `withSpan` will automatically become children of the remote parent.
 *
 * When @opentelemetry/api is not installed or the headers are empty,
 * the function runs directly with zero overhead.
 */
export function withRemoteContext<T>(
  headers: Record<string, string | undefined>,
  fn: () => Promise<T>,
): Promise<T> {
  // Synchronous fast-path: if already resolved to null, skip async entirely
  if (resolvedApi === null) return fn();
  return withRemoteContextAsync(headers, fn);
}

async function withRemoteContextAsync<T>(
  headers: Record<string, string | undefined>,
  fn: () => Promise<T>,
): Promise<T> {
  const api = await resolveOTelApi();
  if (!api) return fn();

  // Build a carrier with only defined values for the propagator.
  const carrier: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    if (v) carrier[k] = v;
  }

  const ctx = api.propagation.extract(api.context.active(), carrier);
  return api.context.with(ctx, fn);
}

/**
 * Execute a function within a traced span. The span is automatically:
 * - Created as a child of the currently active span (if any)
 * - Set as the active span so nested withSpan calls become children
 * - Ended when the function completes (success or error)
 *
 * The callback receives the span for setting attributes or recording errors.
 * withSpan does NOT automatically record errors — the callback manages that.
 */
export function withSpan<T>(
  name: string,
  options: { attributes?: Record<string, string | number | boolean> },
  fn: (span: Span) => Promise<T>,
): Promise<T> {
  // Synchronous fast-path: if already resolved to null, skip async entirely.
  // After the first call, this avoids a microtask tick on every withSpan
  // invocation in the common case where OTel is not installed.
  if (resolvedApi === null) {
    const span = makeNoOpSpan();
    return fn(span).finally(() => span.end());
  }
  return withSpanAsync(name, options, fn);
}

async function withSpanAsync<T>(
  name: string,
  options: { attributes?: Record<string, string | number | boolean> },
  fn: (span: Span) => Promise<T>,
): Promise<T> {
  const api = await resolveOTelApi();

  if (!api) {
    // No OTel — run callback with no-op span, zero overhead
    const span = makeNoOpSpan();
    try {
      return await fn(span);
    } finally {
      span.end();
    }
  }

  const tracer = await getTracer();
  // startSpan automatically uses context.active() to find the parent
  const span = tracer.startSpan(name, options);
  // Set this span as active so children created inside fn() become our children.
  // Cast: tracer.startSpan() returns a full OTel Span at runtime; the local
  // Span interface is an intentionally narrow subset.
  const ctx = api.trace.setSpan(api.context.active(), span as any);

  return api.context.with(ctx, async () => {
    try {
      return await fn(span);
    } finally {
      span.end();
    }
  });
}

/**
 * Record an exception on a span with data-sensitivity protection.
 *
 * Unlike OTel's standard `span.recordException`, this helper emits ONLY the
 * OTel `exception.type` attribute (the error's class name). It deliberately
 * omits `exception.message` and `exception.stacktrace`, both of which
 * commonly embed user input or page content in this codebase (agent errors
 * quote the task, Playwright errors include selectors derived from the DOM,
 * AI SDK errors can echo prompt fragments).
 *
 * Also sets:
 * - `pilo.error.class` attribute (same value as `exception.type`) so dashboards
 *   can filter on it without depending on OTel exception-event semantics.
 * - `pilo.error.code` attribute when `opts.code` is provided.
 */
export function recordSanitizedException(
  span: Span,
  error: unknown,
  opts: { code?: string } = {},
): void {
  const errorClass = error instanceof Error ? error.constructor.name : "Unknown";
  span.addEvent("exception", { "exception.type": errorClass });
  span.setAttribute("pilo.error.class", errorClass);
  if (opts.code) {
    span.setAttribute("pilo.error.code", opts.code);
  }
}

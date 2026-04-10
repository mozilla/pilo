/**
 * Thin wrapper that safely resolves @opentelemetry/api at runtime.
 * Falls back to a no-op implementation if the package is not installed.
 */

interface Span {
  setAttribute(key: string, value: string | number | boolean): this;
  setStatus(status: { code: number; message?: string }): this;
  recordException(error: Error | string): void;
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
 * Execute a function within a traced span. The span is automatically:
 * - Created as a child of the currently active span (if any)
 * - Set as the active span so nested withSpan calls become children
 * - Ended when the function completes (success or error)
 *
 * The callback receives the span for setting attributes or recording errors.
 * withSpan does NOT automatically record errors — the callback manages that.
 */
export async function withSpan<T>(
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

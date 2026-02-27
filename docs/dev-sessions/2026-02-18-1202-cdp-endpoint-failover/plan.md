# Plan: Multiple CDP Endpoint Failover

## Background & Problem

`pwCdpEndpoint` is currently a single `string` threaded through the entire stack:
config schema → CLI options → `PlaywrightBrowser` options → `chromium.connectOverCDP()`.
When the remote browser provider is unreliable, a timeout or connection refusal on that
single endpoint causes the entire task to fail with no recourse.

## Design Goals

1. Accept a list of CDP endpoints (ordered, tried in sequence)
2. Backward-compatible: existing single `pw_cdp_endpoint` string still works unchanged
3. On connection failure, automatically cycle to the next endpoint
4. On mid-task browser restart (existing `navigateToStartWithRetry` logic), use the next
   endpoint rather than retrying the same failed one
5. Minimal surface area — failover logic lives in `PlaywrightBrowser`, not scattered across callers

## Design Decisions

| #   | Decision                                                                                                                              |
| --- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Each endpoint tried once per `start()` call — no per-endpoint retry                                                                   |
| 2   | Only timeouts and connection refused trigger failover; auth failures, malformed URLs, and in-session browser errors are hard failures |
| 3   | Keep `--pw-cdp-endpoint` (singular, unchanged); add new `--pw-cdp-endpoints` (plural, comma-separated)                                |
| 4   | Keep `pw_cdp_endpoint` config key (singular, unchanged); add `pw_cdp_endpoints` (plural)                                              |
| 5   | No wraparound — exhausting the endpoint list is a hard, immediate fatal error                                                         |
| 6   | CDP connection attempt timeout defaults to 5 seconds (5,000 ms) per endpoint                                                          |

## Core Architecture: Endpoint Cycling in `PlaywrightBrowser.start()`

The failover logic lives entirely inside `PlaywrightBrowser.start()`. The `WebAgent`
doesn't need to change — it already calls `browser.shutdown()` + `browser.start()` on
`RecoverableError`, and that's sufficient.

### State in `PlaywrightBrowser`

```
cdpEndpoints: string[]     // normalized list, immutable after construction
nextStartIndex: number = 0 // index of first endpoint to try on next start()
```

### `start()` behavior

```
If cdpEndpoints is empty:
  Skip CDP logic entirely — fall through to pwEndpoint/local launch as before

For each endpoint from nextStartIndex to end of list:
  Try connectOverCDP(endpoint, { ...connectOptions, timeout: CDP_CONNECTION_TIMEOUT_MS })
  If success:
    Set nextStartIndex = successfulIndex + 1
    Continue with context/page setup
    Return
  If connection failure (timeout / connection refused):
    Log warning, try next endpoint
  If other error:
    Throw immediately (hard error — don't cycle)

If all endpoints exhausted:
  Throw hard error immediately (NOT RecoverableError)
```

Throwing a non-`RecoverableError` when endpoints are exhausted means the `WebAgent`'s
`navigateToStartWithRetry` won't attempt further restarts — the task fails fast rather
than burning through remaining retry attempts uselessly.

The `{ ...connectOptions, timeout: CDP_CONNECTION_TIMEOUT_MS }` spread preserves any
other Playwright connection options (e.g. `slowMo`) while overriding only the timeout.

### Endpoint Cycling Example

Given endpoints `[A, B, C]`:

- First `start()`: tries A → succeeds → `nextStartIndex = 1`
- Browser fails mid-task, second `start()`: tries B → succeeds → `nextStartIndex = 2`
- Browser fails mid-task, third `start()`: tries C → fails → hard error, task exits

If A succeeds but then B and C both fail on the second `start()`, that's also an
immediate hard error — all remaining options exhausted.

## Normalizing Singular → Plural

Applied at the construction boundary (before `PlaywrightBrowser` is instantiated, in the
CLI command and server route):

```
if pw_cdp_endpoints is set → use it
else if pw_cdp_endpoint is set → [pw_cdp_endpoint]
else → [] (no CDP; use local launch or pwEndpoint)
```

## Classifying Connection Failures

Reuse/extend the existing `isNetworkError()` private method in `PlaywrightBrowser`.
A connection failure during `connectOverCDP()` cycles to the next endpoint if the error:

- Is a Playwright `TimeoutError`
- Has a message matching: `ECONNREFUSED`, `ECONNRESET`, `ETIMEDOUT`, `net::ERR_`, `NS_ERROR_`

Everything else (e.g., HTTP 401, malformed URL throwing before connection) is rethrown
immediately as a hard error — do not cycle.

## Changes Required

### 1. `src/configDefaults.ts`

Add `"string[]"` to `ConfigFieldType`:

```ts
export type ConfigFieldType = "string" | "string[]" | "number" | "boolean" | "enum";
```

Add to `SparkConfig` and `SparkConfigResolved`:

```ts
pw_cdp_endpoints?: string[]; // new — plural, takes precedence over singular
```

Add to `FIELDS`:

```ts
pw_cdp_endpoints: {
  type: "string[]",
  cli: "--pw-cdp-endpoints",
  placeholder: "url1,url2,...",
  env: ["SPARK_PW_CDP_ENDPOINTS"],
  description: "Comma-separated list of CDP endpoint URLs (chromium only, takes precedence over --pw-cdp-endpoint)",
  category: "playwright",
}
```

### 2. `src/config.ts`

Three updates needed:

**`coerceValue()`** — add `"string[]"` case, splitting on comma:

```ts
case "string[]":
  return value.split(",").map((s) => s.trim()).filter(Boolean);
```

Update the return type of `coerceValue()` to include `string[]`.

**`parseEnvConfig()`** — update return type handling to accommodate `string[]` values
(the `result` accumulator and cast should support arrays).

**`addConfigOptions()`** — add `.argParser()` for `"string[]"` fields so Commander
splits the comma-separated value into an array:

```ts
if (field.type === "string[]") {
  option.argParser((val: string) =>
    val
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}
```

### 3. `src/browser/playwrightBrowser.ts`

**`PlaywrightBrowserOptions`** — add:

```ts
pwCdpEndpoints?: string[]; // new — takes precedence over singular
```

**Internal state** — add:

```ts
private readonly cdpEndpoints: string[]; // normalized in constructor
private nextStartIndex: number = 0;
```

**Public getter for endpoint list** — needed by `webAgent.ts` for event emission and
by loggers for count display:

```ts
get pwCdpEndpoints(): readonly string[] {
  return this.cdpEndpoints;
}
```

**Constructor** — normalize singular → plural:

```ts
this.cdpEndpoints = options.pwCdpEndpoints?.length
  ? options.pwCdpEndpoints
  : options.pwCdpEndpoint
    ? [options.pwCdpEndpoint]
    : [];
```

**Existing `get pwCdpEndpoint()` getter** — update to return the currently active
endpoint (backward-compatible: callers that use this getter continue to get a meaningful
value regardless of whether singular or plural was passed):

```ts
get pwCdpEndpoint(): string | undefined {
  if (this.nextStartIndex === 0) return undefined; // no successful connection yet
  return this.cdpEndpoints[this.nextStartIndex - 1];
}
```

**`start()` method** — replace the single `connectOverCDP` call with a loop over
`cdpEndpoints` from `nextStartIndex`. Pass an explicit `timeout` in `connectOptions`
(default 10 seconds). On connection failure, log and advance. On non-connection error,
rethrow immediately. If loop exhausts all endpoints, throw a hard (non-`RecoverableError`)
error.

**Connection timeout constant** — add near top of file:

```ts
const CDP_CONNECTION_TIMEOUT_MS = 10_000; // 10 seconds per endpoint attempt
```

### 4. `src/cli/commands/run.ts`

Normalize before constructing `PlaywrightBrowser`:

```ts
const cdpEndpoints: string[] | undefined =
  options.pwCdpEndpoints ?? // string[] from --pw-cdp-endpoints (split by argParser)
  cfg.pw_cdp_endpoints ?? // string[] from config file
  (cfg.pw_cdp_endpoint ? [cfg.pw_cdp_endpoint] : undefined); // compat

const browser = new PlaywrightBrowser({
  // ...existing options unchanged...
  pwCdpEndpoint: options.pwCdpEndpoint ?? cfg.pw_cdp_endpoint, // unchanged
  pwCdpEndpoints: cdpEndpoints, // new
});
```

`options.pwCdpEndpoints` is available automatically via `addConfigOptions()` once the
`"string[]"` type is supported there — no manual option wiring needed.

### 5. `server/src/routes/spark.ts`

Add `pwCdpEndpoints?: string[]` to the request body type. Apply same normalization
before constructing `PlaywrightBrowser`:

```ts
const cdpEndpoints: string[] | undefined =
  body.pwCdpEndpoints ??
  serverConfig.pw_cdp_endpoints ??
  (serverConfig.pw_cdp_endpoint ? [serverConfig.pw_cdp_endpoint] : undefined);
```

### 6. Events & Logging

**`src/events.ts`**

- Add `pwCdpEndpoints?: string[]` to `TaskSetupEventData`
- The existing `pwCdpEndpoint` field in the event should use `browser.pwCdpEndpoint`
  (which now returns the active endpoint via the updated getter)
- Add a new event type `CDP_ENDPOINT_CYCLE` with data type `CdpEndpointCycleEventData`:

```ts
interface CdpEndpointCycleEventData {
  attempt: number; // 1-based index of the endpoint attempt that failed
  error: string; // error message (not the URL — no sensitive data)
}
```

The URL and total count are intentionally omitted from the event data for now; they can
be added later once a redaction/exposure strategy is decided.

**`src/browser/playwrightBrowser.ts`**

- Add `onCdpEndpointCycle?: (attempt: number, error: Error) => void` to
  `PlaywrightBrowserOptions` — called within the `start()` loop each time an endpoint
  fails and cycling begins. This follows the same callback pattern as `navigationRetry.onRetry`.
- Within `start()`, also log failover directly (not via event system):
  `CDP endpoint 1 failed (timeout), trying next...`
- Log fatal exhaustion: `All CDP endpoints exhausted, giving up`

**`src/webAgent.ts`**

- The existing `(this.browser as any).pwCdpEndpoint` call in the `TASK_SETUP` emit
  continues to work correctly — the updated getter returns the active endpoint
- Add `pwCdpEndpoints: (this.browser as any).pwCdpEndpoints` to the emit to populate
  the new event field (uses the new public getter)
- Wire up `onCdpEndpointCycle` callback to emit the new `CDP_ENDPOINT_CYCLE` event

**`src/loggers/secretsRedactor.ts`**

- Redact `pwCdpEndpoints` to a single-element array `["(redacted)"]` — this hides both
  the endpoint values and the count (leaking the count could reveal infrastructure details)
- No redaction needed on `CdpEndpointCycleEventData` by default (contains only attempt
  number and error message, no URLs)

**`src/loggers/chalkConsole.ts`**

- Log active endpoint simply as `CDP endpoint: (redacted)` on `TASK_SETUP`
- Log `CDP_ENDPOINT_CYCLE` event, e.g. `⚠️ CDP endpoint attempt N failed, trying next...`

### 7. Implementation Note: Config File Array Loading

Before implementing step 1, verify how the config manager loads config files. If the
file format is JSON/YAML, `pw_cdp_endpoints` would be a native array and should load
without changes. If it's a flat key-value format, comma-splitting may be needed there
too — same logic as the env var path.

### 8. Tests

New tests in `test/browser/playwrightBrowser.test.ts`:

- Single endpoint string (backward compat via `pwCdpEndpoint`)
- First endpoint connection refused → second succeeds
- First endpoint times out → second succeeds
- All endpoints fail → hard (non-`RecoverableError`) error thrown
- Mid-task restart: `start()` succeeds on A → `nextStartIndex` advances → next `start()` tries B
- Auth failure on first endpoint → hard error immediately, no cycling to B
- `onCdpEndpointCycle` callback is called with correct attempt number and error when cycling occurs
- `onCdpEndpointCycle` is NOT called on hard errors (auth failure, all exhausted)

## What's Not Changing

- `--pw-cdp-endpoint` (singular) CLI flag — behavior identical
- `navigateToStartWithRetry` in `WebAgent` — endpoint cycling is transparent at the browser layer
- Navigation-level retry logic in `executeNavigationWithRetry` — separate concern, untouched
- The `pwEndpoint` (non-CDP Playwright endpoint) path — not touched

## Implementation Order

1. `src/configDefaults.ts` — add `"string[]"` type, new field
2. `src/config.ts` — `coerceValue()`, `parseEnvConfig()`, `addConfigOptions()` updates
3. `src/browser/playwrightBrowser.ts` — core cycling logic, updated getter, timeout constant
4. `src/cli/commands/run.ts` + `server/src/routes/spark.ts` — wire through new options
5. `src/events.ts` + loggers — endpoint tracking and redaction
6. Tests

# Human-in-the-Loop Server WebSocket Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a WebSocket endpoint to pilo-server that enables bidirectional communication, allowing input requests to flow from the agent to the caller and input responses to flow back.

**Architecture:** A new `WS /pilo/run` endpoint sits alongside the existing SSE `POST /pilo/run`. The WebSocket handler receives a `task:start` message, creates a WebAgent with an `onInput` callback that sends/receives messages over the WebSocket, and streams all events back as JSON messages. The existing SSE endpoint remains untouched.

**Tech Stack:** Hono, `@hono/node-ws` (new dependency), `ws` (transitive via `@hono/node-ws`), pilo-core

**Spec:** `docs/superpowers/specs/2026-03-16-human-in-the-loop-server-integration-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `packages/server/package.json` | Modify | Add `@hono/node-ws` and `nanoid` dependencies |
| `packages/server/src/index.ts` | Modify | Wire up `createNodeWebSocket` and `injectWebSocket` |
| `packages/server/src/shared.ts` | Create | Shared types (`PiloTaskRequest`) and utilities (`errorToString`) used by both SSE and WS routes |
| `packages/server/src/routes/pilo.ts` | Modify | Import `PiloTaskRequest` and `errorToString` from shared module |
| `packages/server/src/routes/piloWs.ts` | Create | WebSocket route handler, task execution, `onInput` callback |
| `packages/server/src/StreamLogger.ts` | No change | Reused as-is (sendEvent callback works for both SSE and WS) |
| `packages/server/src/routes/piloWs.test.ts` | Create | Tests for WebSocket message handling, `onInput` flow |

---

## Chunk 1: Dependencies and Shared Extraction

### Task 1: Add dependencies

**Files:**
- Modify: `packages/server/package.json`

- [ ] **Step 1: Install the dependencies**

Run:
```bash
cd /Users/tbeauvais/workspace/spark && pnpm --filter pilo-server add @hono/node-ws nanoid
```

- [ ] **Step 2: Verify installation**

Run:
```bash
cd /Users/tbeauvais/workspace/spark && pnpm --filter pilo-server list @hono/node-ws nanoid
```
Expected: Shows both packages with version numbers.

- [ ] **Step 3: Commit**

```bash
git add packages/server/package.json pnpm-lock.yaml
git commit -m "Add @hono/node-ws and nanoid dependencies"
```

---

### Task 2: Extract shared types and utilities

**Files:**
- Create: `packages/server/src/shared.ts`
- Modify: `packages/server/src/routes/pilo.ts`

The `PiloTaskRequest` interface and `errorToString` utility are currently defined in `pilo.ts`. Both will be needed by the new WebSocket route. Extract them to a shared module.

- [ ] **Step 1: Create shared.ts with extracted types**

Create `packages/server/src/shared.ts`:

```typescript
// Shared types and utilities used by both SSE and WebSocket route handlers

export interface PiloTaskRequest {
  // Core task parameters
  task: string;
  url?: string;
  data?: Record<string, any>;
  guardrails?: string;

  // AI configuration overrides
  provider?:
    | "openai"
    | "openrouter"
    | "vertex"
    | "ollama"
    | "openai-compatible"
    | "lmstudio"
    | "google";
  model?: string;
  openaiApiKey?: string;
  openrouterApiKey?: string;
  googleApiKey?: string;
  ollamaBaseUrl?: string;
  openaiCompatibleBaseUrl?: string;
  openaiCompatibleName?: string;

  // Browser configuration overrides
  browser?: "firefox" | "chrome" | "chromium" | "safari" | "webkit" | "edge";
  channel?: string;
  executablePath?: string;
  headless?: boolean;
  vision?: boolean;
  debug?: boolean;
  blockAds?: boolean;
  blockResources?: string[];
  pwEndpoint?: string;
  pwCdpEndpoint?: string;
  pwCdpEndpoints?: string[];
  bypassCSP?: boolean;

  // WebAgent behavior overrides
  maxIterations?: number;
  maxValidationAttempts?: number;

  // Proxy configuration overrides
  proxy?: string;
  proxyUsername?: string;
  proxyPassword?: string;

  // Navigation retry configuration overrides
  navigationTimeoutMs?: number;
  navigationMaxTimeoutMs?: number;
  navigationMaxAttempts?: number;
  navigationTimeoutMultiplier?: number;

  // Action timeout configuration
  actionTimeoutMs?: number;

  // Logging configuration
  logger?: "console" | "json";

  // Search configuration overrides
  searchProvider?: "none" | "duckduckgo" | "google" | "bing" | "parallel-api";

  // Enable full screenshot events (default: false)
  includeScreenshotImages?: boolean;
}

interface ErrorResponse {
  success: false;
  error: {
    message: string;
    code: string;
    timestamp: string;
  };
}

// Use error.name rather than error.message to avoid leaking sensitive data
// (e.g. credentials embedded in proxy URLs that Playwright includes in error messages)
export const errorToString = (error: unknown): string =>
  error instanceof Error ? error.name : "Unknown error";

export const createErrorResponse = (message: string, code: string): ErrorResponse => ({
  success: false,
  error: {
    message,
    code,
    timestamp: new Date().toISOString(),
  },
});
```

- [ ] **Step 2: Update pilo.ts to import from shared**

In `packages/server/src/routes/pilo.ts`, replace the local type/utility definitions with imports from shared:

Remove the following from `pilo.ts`:
- The `ErrorResponse` interface (lines 15-22)
- The `errorToString` function (lines 26-27)
- The `createErrorResponse` function (lines 29-36)
- The `PiloTaskRequest` interface (lines 40-104)

Add this import at the top:
```typescript
import { PiloTaskRequest, errorToString, createErrorResponse } from "../shared.js";
```

- [ ] **Step 3: Run existing tests to verify no regressions**

Run: `cd /Users/tbeauvais/workspace/spark && pnpm --filter pilo-server run test`
Expected: All existing tests pass.

- [ ] **Step 4: Run typecheck**

Run: `cd /Users/tbeauvais/workspace/spark && pnpm --filter pilo-server run typecheck`
Expected: No type errors.

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/shared.ts packages/server/src/routes/pilo.ts
git commit -m "Extract shared types and utilities from SSE route"
```

---

## Chunk 2: Server Wiring

### Task 3: Wire WebSocket support into the server entry point

**Files:**
- Modify: `packages/server/src/index.ts`

- [ ] **Step 1: Update `index.ts` to wire WebSocket support**

Update `packages/server/src/index.ts`:

```typescript
import "dotenv/config";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";
import { cors } from "hono/cors";
import { sentry } from "@hono/sentry";
import piloRoutes from "./routes/pilo.js";
import { createPiloWsRoute } from "./routes/piloWs.js";

const app = new Hono();

// Create WebSocket adapter
const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

// Add Sentry middleware
app.use(
  "*",
  sentry({
    dsn: process.env.SENTRY_DSN,
  }),
);

// Add CORS middleware
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

// Health check endpoint
app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Basic info endpoint
app.get("/", (c) => {
  return c.json({
    name: "Pilo Server",
    version: "0.1.0",
    description: "Web server for Pilo AI-powered web automation",
  });
});

// Mount Pilo routes (SSE - existing)
app.route("/pilo", piloRoutes);

// Mount Pilo WebSocket route
const piloWsRoute = createPiloWsRoute(upgradeWebSocket);
app.route("/pilo", piloWsRoute);

const port = Number(process.env.PORT) || 3000;

console.log(`🚀 Pilo Server starting on port ${port}`);

const server = serve({
  fetch: app.fetch,
  port,
});

// Inject WebSocket handling into the Node.js HTTP server
injectWebSocket(server);
```

Key changes:
- Import `createNodeWebSocket` from `@hono/node-ws`
- Create the WebSocket adapter before defining routes
- Pass `upgradeWebSocket` to the new route factory
- Capture `serve()` return value, pass it to `injectWebSocket()`

- [ ] **Step 2: Defer typecheck until piloWs.ts is created**

The import of `./routes/piloWs.js` will cause a compile error until that file exists in Task 4.

- [ ] **Step 3: Commit**

```bash
git add packages/server/src/index.ts
git commit -m "Wire WebSocket support into server entry"
```

---

## Chunk 3: WebSocket Route Handler

### Task 4: Create the WebSocket route handler

**Files:**
- Create: `packages/server/src/routes/piloWs.ts`
- Create: `packages/server/src/routes/piloWs.test.ts`

This is the core of the implementation. It handles:
1. WebSocket connection lifecycle
2. Parsing the `task:start` message
3. Creating and running the WebAgent
4. Streaming events back as JSON messages
5. The `onInput` callback (send `input:form`, wait for `input:form_response`)
6. Keepalive pings

- [ ] **Step 1: Write the failing test for message parsing**

Create `packages/server/src/routes/piloWs.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { parseClientMessage } from "./piloWs.js";

describe("parseClientMessage", () => {
  it("should parse a valid task:start message", () => {
    const raw = JSON.stringify({
      event: "task:start",
      data: { task: "Click the login button", url: "https://example.com" },
    });
    const result = parseClientMessage(raw);
    expect(result).toEqual({
      event: "task:start",
      data: { task: "Click the login button", url: "https://example.com" },
    });
  });

  it("should parse a valid input:form_response message", () => {
    const raw = JSON.stringify({
      event: "input:form_response",
      data: {
        questionId: "abc123",
        response: { type: "form", fields: { email: "test@real.com" } },
      },
    });
    const result = parseClientMessage(raw);
    expect(result).toEqual({
      event: "input:form_response",
      data: {
        questionId: "abc123",
        response: { type: "form", fields: { email: "test@real.com" } },
      },
    });
  });

  it("should parse a declined input:form_response", () => {
    const raw = JSON.stringify({
      event: "input:form_response",
      data: {
        questionId: "abc123",
        response: { type: "declined", reason: "User refused" },
      },
    });
    const result = parseClientMessage(raw);
    expect(result).toEqual({
      event: "input:form_response",
      data: {
        questionId: "abc123",
        response: { type: "declined", reason: "User refused" },
      },
    });
  });

  it("should return null for invalid JSON", () => {
    const result = parseClientMessage("not json");
    expect(result).toBeNull();
  });

  it("should return null for missing event field", () => {
    const raw = JSON.stringify({ data: { task: "do something" } });
    const result = parseClientMessage(raw);
    expect(result).toBeNull();
  });

  it("should return null for unknown event type", () => {
    const raw = JSON.stringify({ event: "unknown:event", data: {} });
    const result = parseClientMessage(raw);
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/tbeauvais/workspace/spark && pnpm --filter pilo-server run test`
Expected: FAIL with "Cannot find module './piloWs.js'"

- [ ] **Step 3: Implement parseClientMessage and the route handler**

Create `packages/server/src/routes/piloWs.ts`. Note on types: import `UpgradeWebSocket`, `WSContext`, and `WSMessageReceive` from `hono/ws`. If `WSMessageReceive` does not exist in the installed version, use `string | Blob | ArrayBufferLike` inline. If `UpgradeWebSocket` causes a type mismatch with the `@hono/node-ws` return type, use `typeof upgradeWebSocket` from the caller instead.

```typescript
import { Hono } from "hono";
import type { UpgradeWebSocket, WSContext, WSMessageReceive } from "hono/ws";
import {
  WebAgent,
  PlaywrightBrowser,
  createAIProvider,
  getAIProviderInfo,
  createNavigationRetryConfig,
  SEARCH_PROVIDERS,
  DEFAULT_INPUT_TIMEOUT_MS,
} from "pilo-core";
import type {
  OnInputCallback,
  InputRequest,
  InputResponse,
  TaskExecutionResult,
} from "pilo-core";
import { StreamLogger } from "../StreamLogger.js";
import { config } from "../config.js";
import { errorToString } from "../shared.js";
import type { PiloTaskRequest } from "../shared.js";
import { nanoid } from "nanoid";

// === Message Types ===

interface TaskStartMessage {
  event: "task:start";
  taskId?: string;
  data: PiloTaskRequest;
}

interface InputFormResponseMessage {
  event: "input:form_response";
  data: {
    questionId: string;
    response:
      | { type: "form"; fields: Record<string, string> }
      | { type: "declined"; reason?: string };
  };
}

type ClientMessage = TaskStartMessage | InputFormResponseMessage;

// === Message Parsing ===

const VALID_EVENTS = new Set(["task:start", "input:form_response"]);

/**
 * Parse and validate a raw WebSocket message from the client.
 * Returns null if the message is invalid.
 */
export function parseClientMessage(raw: string): ClientMessage | null {
  try {
    const parsed = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof parsed.event !== "string" ||
      !VALID_EVENTS.has(parsed.event)
    ) {
      return null;
    }
    return parsed as ClientMessage;
  } catch {
    return null;
  }
}

// === Outbound Message Helpers ===

export interface OutboundMessage {
  event: string;
  taskId: string;
  data: Record<string, any>;
}

export function serializeMessage(msg: OutboundMessage): string {
  return JSON.stringify(msg);
}

// === Input Response Registry ===

/**
 * Tracks pending input requests for a single WebSocket connection.
 * Since one connection = one task and input requests are sequential,
 * at most one pending request exists at a time.
 */
export class InputResponseRegistry {
  private pending: Map<
    string,
    { resolve: (response: InputResponse) => void }
  > = new Map();

  /**
   * Register a pending input request. Returns a Promise that resolves
   * when the matching response arrives.
   */
  waitForResponse(questionId: string): Promise<InputResponse> {
    return new Promise((resolve) => {
      this.pending.set(questionId, { resolve });
    });
  }

  /**
   * Deliver a response for a pending input request.
   * Returns true if a matching request was found.
   */
  deliver(questionId: string, response: InputResponse): boolean {
    const entry = this.pending.get(questionId);
    if (!entry) return false;
    this.pending.delete(questionId);
    entry.resolve(response);
    return true;
  }

  /**
   * Reject all pending requests (e.g., on connection close).
   */
  rejectAll(reason: string): void {
    for (const [questionId, entry] of this.pending) {
      entry.resolve({ type: "declined", reason });
      this.pending.delete(questionId);
    }
  }
}

// === Keepalive ===

const PING_INTERVAL_MS = 30_000;

// === Route Factory ===

/**
 * Creates the WebSocket route for pilo task execution.
 * Accepts the `upgradeWebSocket` function from @hono/node-ws.
 */
export function createPiloWsRoute(upgradeWebSocket: UpgradeWebSocket) {
  const pilo = new Hono();

  pilo.get(
    "/run",
    upgradeWebSocket(() => {
      const registry = new InputResponseRegistry();
      const abortController = new AbortController();
      let taskId = "";
      let taskStarted = false;
      let pingInterval: ReturnType<typeof setInterval> | undefined;

      // Helper to send a JSON message on the WebSocket
      const sendMessage = (ws: WSContext, event: string, data: Record<string, any>) => {
        if (ws.readyState === 1) {
          ws.send(serializeMessage({ event, taskId, data }));
        }
      };

      return {
        onOpen(_evt: Event, ws: WSContext) {
          // Start keepalive pings
          pingInterval = setInterval(() => {
            if (ws.readyState === 1) {
              try {
                const raw = ws.raw as any;
                if (raw && typeof raw.ping === "function") {
                  raw.ping();
                }
              } catch {
                // Ignore ping errors
              }
            }
          }, PING_INTERVAL_MS);
        },

        async onMessage(evt: MessageEvent<WSMessageReceive>, ws: WSContext) {
          const raw = typeof evt.data === "string" ? evt.data : String(evt.data);
          const message = parseClientMessage(raw);

          if (!message) {
            sendMessage(ws, "error", { message: "Invalid message format" });
            return;
          }

          if (message.event === "input:form_response") {
            const { questionId, response } = message.data;
            const delivered = registry.deliver(questionId, response as InputResponse);
            if (!delivered) {
              sendMessage(ws, "error", {
                message: `No pending input request for questionId: ${questionId}`,
              });
            }
            return;
          }

          // task:start
          if (taskStarted) {
            sendMessage(ws, "error", {
              message: "Task already started on this connection",
            });
            return;
          }
          taskStarted = true;

          const body = message.data;
          taskId = message.taskId ?? nanoid(12);

          // Validate required fields
          if (!body.task) {
            sendMessage(ws, "error", { message: "task field is required" });
            ws.close(1008, "task field is required");
            return;
          }

          // Validate search provider
          if (
            body.searchProvider &&
            !SEARCH_PROVIDERS.includes(body.searchProvider as (typeof SEARCH_PROVIDERS)[number])
          ) {
            sendMessage(ws, "error", {
              message: `Invalid search provider: ${body.searchProvider}. Must be one of: ${SEARCH_PROVIDERS.join(", ")}`,
            });
            ws.close(1008, "Invalid search provider");
            return;
          }

          const serverConfig = config.getConfig();

          const effectiveSearchProvider = body.searchProvider ?? serverConfig.search_provider;
          if (effectiveSearchProvider === "parallel-api" && !serverConfig.parallel_api_key) {
            sendMessage(ws, "error", {
              message:
                "parallel-api search provider requires PARALLEL_API_KEY to be configured on the server",
            });
            ws.close(1008, "Missing search API key");
            return;
          }

          // Validate AI provider
          try {
            getAIProviderInfo();
          } catch (error) {
            sendMessage(ws, "error", {
              message: `AI provider not configured: ${errorToString(error)}`,
            });
            ws.close(1011, "AI provider not configured");
            return;
          }

          // Run the task
          let agent: WebAgent | null = null;

          try {
            sendMessage(ws, "start", { task: body.task, url: body.url });

            // Build configs (same logic as SSE endpoint)
            const browserConfig = {
              browser: body.browser ?? serverConfig.browser,
              channel: body.channel ?? serverConfig.channel,
              executablePath: body.executablePath ?? serverConfig.executable_path,
              headless: body.headless ?? serverConfig.headless,
              blockAds: body.blockAds ?? serverConfig.block_ads,
              blockResources: (body.blockResources ??
                (serverConfig.block_resources
                  ? serverConfig.block_resources.split(",")
                  : undefined)) as
                | Array<"image" | "stylesheet" | "font" | "media" | "manifest">
                | undefined,
              pwEndpoint: body.pwEndpoint ?? serverConfig.pw_endpoint,
              pwCdpEndpoint: body.pwCdpEndpoint ?? serverConfig.pw_cdp_endpoint,
              pwCdpEndpoints:
                body.pwCdpEndpoints ??
                serverConfig.pw_cdp_endpoints ??
                (serverConfig.pw_cdp_endpoint ? [serverConfig.pw_cdp_endpoint] : undefined),
              bypassCSP: body.bypassCSP ?? serverConfig.bypass_csp,
              proxyServer: body.proxy ?? serverConfig.proxy,
              proxyUsername: body.proxyUsername ?? serverConfig.proxy_username,
              proxyPassword: body.proxyPassword ?? serverConfig.proxy_password,
              actionTimeoutMs: body.actionTimeoutMs ?? serverConfig.action_timeout_ms,
              navigationRetry: createNavigationRetryConfig({
                baseTimeoutMs: body.navigationTimeoutMs ?? serverConfig.navigation_timeout_ms,
                maxTimeoutMs:
                  body.navigationMaxTimeoutMs ?? serverConfig.navigation_max_timeout_ms,
                maxAttempts:
                  body.navigationMaxAttempts ?? serverConfig.navigation_max_attempts,
                timeoutMultiplier:
                  body.navigationTimeoutMultiplier ??
                  serverConfig.navigation_timeout_multiplier,
              }),
            };

            const inputTimeoutMs = DEFAULT_INPUT_TIMEOUT_MS;

            // onInput callback: send input:form over WS, wait for input:form_response
            const onInput: OnInputCallback = async (request: InputRequest) => {
              const eventData: Record<string, any> = {
                questionId: request.questionId,
                question: request.question,
                fields: request.fields,
                timeoutMs: inputTimeoutMs,
              };
              if (request.pageUrl) eventData.pageUrl = request.pageUrl;
              if (request.pageTitle) eventData.pageTitle = request.pageTitle;

              sendMessage(ws, "input:form", eventData);

              // Block until the response arrives (or the core timeout/abort handles it)
              return registry.waitForResponse(request.questionId);
            };

            // Create StreamLogger that writes to WebSocket instead of SSE
            const logger = new StreamLogger({
              sendEvent: async (event: string, data: any) => {
                sendMessage(ws, event, data);
              },
              includeScreenshotImages: body.includeScreenshotImages ?? false,
            });

            const providerConfig = createAIProvider({
              provider: body.provider,
              model: body.model,
              openai_api_key: body.openaiApiKey,
              openrouter_api_key: body.openrouterApiKey,
              google_generative_ai_api_key: body.googleApiKey,
              ollama_base_url: body.ollamaBaseUrl,
              openai_compatible_base_url: body.openaiCompatibleBaseUrl,
              openai_compatible_name: body.openaiCompatibleName,
            });

            const browser = new PlaywrightBrowser(browserConfig);

            agent = new WebAgent(browser, {
              debug: body.debug ?? serverConfig.debug,
              vision: body.vision ?? serverConfig.vision,
              maxIterations: body.maxIterations ?? serverConfig.max_iterations,
              maxValidationAttempts:
                body.maxValidationAttempts ?? serverConfig.max_validation_attempts,
              guardrails: body.guardrails,
              searchProvider: body.searchProvider ?? serverConfig.search_provider,
              searchApiKey: serverConfig.parallel_api_key,
              providerConfig,
              logger,
              onInput,
              inputTimeoutMs,
            });

            const result: TaskExecutionResult = await agent.execute(body.task, {
              startingUrl: body.url,
              data: body.data,
              abortSignal: abortController.signal,
            });

            sendMessage(ws, "complete", result as unknown as Record<string, any>);
            sendMessage(ws, "done", {});

            // Small delay to ensure messages are flushed before close
            await new Promise((resolve) => setTimeout(resolve, 50));
            ws.close(1000, "Task complete");
          } catch (error) {
            if (abortController.signal.aborted) {
              console.log("Task execution aborted due to client disconnection");
            } else {
              console.error("Pilo task execution failed:", error);
              sendMessage(ws, "error", {
                message: errorToString(error),
                code: "TASK_EXECUTION_FAILED",
              });
              ws.close(1011, "Task execution failed");
            }
          } finally {
            if (agent) {
              try {
                await agent.close();
              } catch (closeError) {
                console.error("Error closing agent:", closeError);
              }
            }
          }
        },

        onClose() {
          // Client disconnected: abort the task and reject pending input requests
          abortController.abort();
          registry.rejectAll("WebSocket connection closed");
          if (pingInterval) {
            clearInterval(pingInterval);
            pingInterval = undefined;
          }
        },

        onError(evt: Event) {
          console.error("WebSocket error:", evt);
          abortController.abort();
          registry.rejectAll("WebSocket error");
          if (pingInterval) {
            clearInterval(pingInterval);
            pingInterval = undefined;
          }
        },
      };
    }),
  );

  return pilo;
}
```

- [ ] **Step 4: Run tests to verify parseClientMessage passes**

Run: `cd /Users/tbeauvais/workspace/spark && pnpm --filter pilo-server run test`
Expected: All `parseClientMessage` tests pass.

- [ ] **Step 5: Run typecheck**

Run: `cd /Users/tbeauvais/workspace/spark && pnpm --filter pilo-server run typecheck`
Expected: No type errors. If `WSMessageReceive` or `UpgradeWebSocket` type imports fail, adjust the imports (see note in Step 3 above).

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/routes/piloWs.ts packages/server/src/routes/piloWs.test.ts
git commit -m "Add WebSocket route handler for pilo task execution"
```

---

## Chunk 4: Tests

### Task 5: Test the InputResponseRegistry

**Files:**
- Modify: `packages/server/src/routes/piloWs.test.ts`

The `InputResponseRegistry` is the core state management for the input flow. It needs thorough testing.

- [ ] **Step 1: Write tests for InputResponseRegistry**

Add to `packages/server/src/routes/piloWs.test.ts`:

```typescript
import { parseClientMessage, InputResponseRegistry, serializeMessage } from "./piloWs.js";

describe("InputResponseRegistry", () => {
  it("should resolve a pending request when response is delivered", async () => {
    const registry = new InputResponseRegistry();

    const responsePromise = registry.waitForResponse("q1");
    const delivered = registry.deliver("q1", {
      type: "form",
      fields: { email: "test@test.com" },
    });

    expect(delivered).toBe(true);
    const response = await responsePromise;
    expect(response).toEqual({
      type: "form",
      fields: { email: "test@test.com" },
    });
  });

  it("should return false when delivering to unknown questionId", () => {
    const registry = new InputResponseRegistry();
    const delivered = registry.deliver("unknown", {
      type: "form",
      fields: {},
    });
    expect(delivered).toBe(false);
  });

  it("should handle declined responses", async () => {
    const registry = new InputResponseRegistry();

    const responsePromise = registry.waitForResponse("q1");
    registry.deliver("q1", {
      type: "declined",
      reason: "User refused",
    });

    const response = await responsePromise;
    expect(response).toEqual({
      type: "declined",
      reason: "User refused",
    });
  });

  it("should reject all pending requests on rejectAll", async () => {
    const registry = new InputResponseRegistry();

    const p1 = registry.waitForResponse("q1");
    const p2 = registry.waitForResponse("q2");

    registry.rejectAll("Connection closed");

    const r1 = await p1;
    const r2 = await p2;

    expect(r1).toEqual({ type: "declined", reason: "Connection closed" });
    expect(r2).toEqual({ type: "declined", reason: "Connection closed" });
  });

  it("should not deliver to the same questionId twice", async () => {
    const registry = new InputResponseRegistry();

    const responsePromise = registry.waitForResponse("q1");
    registry.deliver("q1", { type: "form", fields: { a: "1" } });

    // Second delivery should fail (already consumed)
    const secondDelivery = registry.deliver("q1", {
      type: "form",
      fields: { a: "2" },
    });

    expect(secondDelivery).toBe(false);
    const response = await responsePromise;
    expect(response.type).toBe("form");
  });
});
```

- [ ] **Step 2: Run tests**

Run: `cd /Users/tbeauvais/workspace/spark && pnpm --filter pilo-server run test`
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add packages/server/src/routes/piloWs.test.ts
git commit -m "Add InputResponseRegistry tests"
```

---

### Task 6: Test the outbound message format

**Files:**
- Modify: `packages/server/src/routes/piloWs.test.ts`

- [ ] **Step 1: Write tests for message serialization**

Add to `packages/server/src/routes/piloWs.test.ts`:

```typescript
describe("serializeMessage", () => {
  it("should include event, taskId, and data", () => {
    const result = JSON.parse(
      serializeMessage({
        event: "agent:action",
        taskId: "task_xyz",
        data: { action: "click" },
      }),
    );
    expect(result).toEqual({
      event: "agent:action",
      taskId: "task_xyz",
      data: { action: "click" },
    });
  });

  it("should serialize input:form with timeoutMs", () => {
    const result = JSON.parse(
      serializeMessage({
        event: "input:form",
        taskId: "task_abc",
        data: {
          questionId: "q1",
          question: "Enter credentials",
          fields: [{ name: "email", label: "Email" }],
          timeoutMs: 120000,
        },
      }),
    );
    expect(result.event).toBe("input:form");
    expect(result.taskId).toBe("task_abc");
    expect(result.data.timeoutMs).toBe(120000);
  });
});
```

- [ ] **Step 2: Run tests**

Run: `cd /Users/tbeauvais/workspace/spark && pnpm --filter pilo-server run test`
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add packages/server/src/routes/piloWs.test.ts
git commit -m "Add outbound message serialization tests"
```

---

## Chunk 5: Final Validation

### Task 7: Full validation pass

**Files:** None (validation only)

- [ ] **Step 1: Run format**

Run: `cd /Users/tbeauvais/workspace/spark && pnpm run format`

- [ ] **Step 2: Run typecheck across all packages**

Run: `cd /Users/tbeauvais/workspace/spark && pnpm run typecheck`
Expected: No errors.

- [ ] **Step 3: Run all tests**

Run: `cd /Users/tbeauvais/workspace/spark && pnpm -r run test`
Expected: All tests pass across all packages.

- [ ] **Step 4: Fix any issues found and commit**

If formatting or type errors were found, fix and commit:
```bash
git add -A
git commit -m "Fix formatting and type errors"
```

- [ ] **Step 5: Final validation**

Run: `cd /Users/tbeauvais/workspace/spark && pnpm run check`
Expected: All checks pass.

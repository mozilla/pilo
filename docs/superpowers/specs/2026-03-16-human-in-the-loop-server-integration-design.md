# Human-in-the-Loop Server Integration Design

## Overview

Integrate the human-in-the-loop input system (already implemented in pilo-core and pilo-cli) into the pilo-server and tabs-api layers. The core challenge: when the AI agent needs user input mid-task, the response must travel from the user, through tabs-api, back to the pilo-server handler that is blocked waiting for it.

## Architecture

### Current State

- User connects to tabs-api via REST. Automation responses stream back as SSE.
- tabs-api connects to pilo-server via HTTP POST, receives SSE.
- Communication is unidirectional: events flow from pilo-server to user only.
- pilo-core's `onInput` callback and `inputTools.ts` are already implemented.

### Target State

- User to tabs-api: unchanged (REST + SSE), plus a new `POST /v1/automate/input` endpoint.
- tabs-api to pilo-server: upgraded from HTTP+SSE to WebSocket (per-task connection).
- Redis pub/sub enables input response routing across multiple tabs-api instances.
- pilo-server has no knowledge of Redis or the pub/sub architecture.

## Data Flow

```
User                        tabs-api (Instance A)       tabs-api (Instance B)       pilo-server
 |                             |                             |                          |
 |  POST /v1/automate          |                             |                          |
 |----------------------------->                             |                          |
 |                             |  WS /pilo/run (connect)     |                          |
 |                             |-------------------------------------------------------->
 |                             |  { task, url, ... }         |                          |
 |                             |-------------------------------------------------------->
 |                             |                             |                          |
 |  SSE: events                |  WS: events                 |                          |
 |<-----------------------------|<--------------------------------------------------------|
 |                             |                             |                          |
 |  SSE: input:form            |  WS: input:form             |                          |
 |  { questionId, fields }     |  { questionId, fields }     |                          |
 |<-----------------------------|<--------------------------------------------------------|
 |                             |                             |                          |
 |                             |  (subscribes to Redis       |                          |
 |                             |   for questionId)           |                          |
 |                             |                             |                          |
 |  POST /v1/automate/input    |                             |                          |
 |  { questionId, fields }     |                             |                          |
 |-------------------------------------------------------------->                       |
 |            (lands on Instance B)                          |                          |
 |                             |                             |                          |
 |                             |       Redis PUBLISH         |                          |
 |                             |<----------------------------|                          |
 |                             |  (Instance A receives,      |                          |
 |                             |   owns the questionId)      |                          |
 |                             |                             |                          |
 |                             |  WS: input:form_response    |                          |
 |                             |-------------------------------------------------------->
 |                             |                             |                          |
 |                             |                             |          (resumes)       |
 |  SSE: events continue       |  WS: events continue        |                          |
 |<-----------------------------|<--------------------------------------------------------|
```

The key detail: any tabs-api instance can receive the user's input POST. That instance publishes to Redis. All tabs-api instances subscribe in fan-out mode. The instance that owns the questionId (the one holding the WebSocket to pilo-server) receives it and forwards over the WebSocket. All other instances ignore it. pilo-server has no knowledge of Redis.

## WebSocket Implementation

### Dependency

pilo-server uses Hono with `@hono/node-server`, which does not support WebSocket upgrades natively. The `@hono/node-ws` package must be added as a dependency. It patches the Node.js HTTP server to handle WebSocket upgrades via the `ws` library, integrating with Hono's `upgradeWebSocket()` helper.

### Connection Lifecycle

1. Client connects to `WS /pilo/run`
2. Client sends a `task:start` message with the task payload
3. Server validates the payload. On validation failure, sends an `error` message and closes.
4. Server creates WebAgent, starts execution, streams events back as messages
5. On `requestFormData()`, server sends `input:form` message (includes `timeoutMs`), blocks on Promise
6. Client sends `input:form_response`, Promise resolves, agent continues
7. Server sends `complete`, then `done`, then closes the connection
8. Server must ensure `done` is flushed before sending the WebSocket close frame

### Keepalive

Long-running tasks may last several minutes. The implementation should use WebSocket ping/pong frames to prevent intermediary proxies from dropping idle connections. A 30-second ping interval is a reasonable default.

## WebSocket Message Protocol

All messages are JSON with `event` and `data` fields, mirroring SSE structure.

### Server to Client (pilo-server to tabs-api)

Every existing SSE event maps 1:1:

```json
{ "event": "agent:action", "data": { "action": "click", "element": "Submit button" } }
{ "event": "input:form", "data": { "questionId": "abc123", "question": "...", "fields": [...], "pageUrl": "...", "pageTitle": "...", "timeoutMs": 120000 } }
{ "event": "complete", "data": { "success": true, "result": "...", "stats": {} } }
{ "event": "done", "data": {} }
```

Error message (for invalid `task:start` or server errors):

```json
{ "event": "error", "data": { "message": "task field is required" } }
```

Note: the `input:form` message includes `timeoutMs` so tabs-api can set the Redis active key TTL to match the server's timeout without hardcoding values. The `timeoutMs` value is not part of pilo-core's `InputFormEventData`; the WebSocket handler augments the event data with the configured timeout when constructing the outbound message. This keeps the timeout a server-level concern without requiring pilo-core changes.

### Client to Server (tabs-api to pilo-server)

Two message types only:

```json
{ "event": "task:start", "data": { "task": "...", "url": "...", "guardrails": "...", ... } }
```

```json
{
  "event": "input:form_response",
  "data": {
    "questionId": "abc123",
    "response": { "type": "form", "fields": { "email": "...", "password": "..." } }
  }
}
```

Declined response:

```json
{
  "event": "input:form_response",
  "data": { "questionId": "abc123", "response": { "type": "declined", "reason": "..." } }
}
```

The `task:start` message may optionally include a `taskId` field for correlation/observability. If provided, pilo-server includes it in event messages. If omitted, pilo-server generates one. The `taskId` is a top-level field on every WebSocket message:

```json
{ "event": "agent:action", "taskId": "task_xyz", "data": { ... } }
```

### Connection Close Semantics

- Normal completion: server sends `done`, flushes, then closes the connection.
- Task cancellation: client closes the connection. pilo-server treats this as an abort (fires the AbortSignal). There is no explicit `task:cancel` message; since the connection is per-task, closing it is equivalent.
- Error: either side can close on error; the other treats unexpected close as an abort.

## User-Facing Input Endpoint

### `POST /v1/automate/input`

**Auth:** Same Bearer token as `/v1/automate`.

**Request body (form response):**

```json
{
  "questionId": "abc123",
  "type": "form",
  "fields": { "email": "user@real.com", "password": "hunter2" }
}
```

**Request body (decline):**

```json
{
  "questionId": "abc123",
  "type": "declined",
  "reason": "User chose not to provide credentials"
}
```

**Response codes:**

- `202 Accepted`: response published to Redis.
- `410 Gone`: questionId expired or already answered.

### Active Question Registry

- When tabs-api receives an `input:form` event over the WebSocket, it writes `input:active:{questionId}` to Redis with a TTL derived from the `timeoutMs` value in the event.
- When the input resolves (response received, timeout, or task ends), tabs-api deletes the key.
- The input POST endpoint checks this key before publishing. If absent, returns `410 Gone`.

### Redis Pub/Sub Channel

Channel name pattern: `pilo:input:{questionId}`

Each tabs-api instance that is waiting for an input response subscribes to the specific channel for its questionId. When any instance receives the user's input POST, it publishes the response payload to `pilo:input:{questionId}`. The subscribing instance receives it and forwards over its WebSocket. Non-subscribing instances ignore it (they are not subscribed to that channel).

tabs-api must subscribe to the Redis channel before forwarding the `input:form` event to the user as SSE, to avoid a race where the user responds before the subscription is active.

## User-Facing SSE Events

tabs-api forwards the `input:form` event to the user's SSE stream. Only the user-relevant fields should be included: `questionId`, `question`, `fields`, `pageUrl`, `pageTitle`, `timeoutMs`. Internal agent metadata (e.g., `timestamp`, `iterationId`) should be stripped.

tabs-api should NOT forward `input:form_response` as an SSE event to the user. The user already knows what they submitted; echoing it back is redundant and leaks timing metadata (`responseTimeMs`).

## Error Handling

### User never responds (timeout)

The core's `raceWithCancellation` handles this. After `timeoutMs` (default 2 min), the `onInput` Promise rejects with `TimeoutError`. The agent decides to proceed or abort. tabs-api cleans up: unsubscribes from Redis, deletes the active key.

### User responds after timeout

The POST returns `410 Gone` because the active key has expired (TTL) or been deleted. The user knows their input was too late.

### Invalid or unknown questionId

No active key in Redis. Returns `410 Gone`.

### Invalid `task:start` payload

pilo-server sends an `error` message over the WebSocket and closes the connection. tabs-api translates this to an SSE error event for the user.

### WebSocket disconnects mid-task

pilo-server: the `onInput` Promise rejects (connection close triggers abort). tabs-api: SSE stream ends with an error event.

### User disconnects (SSE stream aborts)

tabs-api detects via SSE abort handler (already exists). tabs-api closes the WebSocket. pilo-server's abort signal fires, task stops, resources clean up.

### Multiple input requests in a single task

Each gets its own `questionId` and Redis subscription. They are sequential (agent blocks until each resolves), so only one is active at a time.

## Scope by Component

### pilo-server (this repo, `packages/server/`)

- Add `@hono/node-ws` dependency for WebSocket support
- New WebSocket route handler at `WS /pilo/run`
- WebSocket message listener: parses incoming messages, dispatches `task:start` and `input:form_response`
- Validation and error response for invalid `task:start` payloads
- `onInput` callback: sends `input:form` (with `timeoutMs`) on WebSocket, returns Promise resolved by incoming `input:form_response`
- Adapts `StreamLogger` pattern to write to WebSocket instead of SSE callback
- WebSocket ping/pong keepalive (30s interval)
- Existing SSE endpoint (`POST /pilo/run`) remains untouched for backward compatibility

### pilo-core (`packages/core/`)

- No changes. The `onInput` callback interface and event types are already in place.

### tabs-api (separate repo, separate effort)

- New `CallSparkWebSocket()` in spark provider
- Automate handler uses WebSocket client, translates WS messages to SSE events
- Strips internal metadata from `input:form` before forwarding as SSE
- Does not forward `input:form_response` to user SSE stream
- Redis subscribe on `pilo:input:{questionId}` before forwarding `input:form` to user
- Redis publish on `pilo:input:{questionId}` when input POST received
- Active question registry: `input:active:{questionId}` Redis keys with TTL from `timeoutMs`
- New endpoint: `POST /v1/automate/input`
- Cleanup on task completion, timeout, or disconnect

### User-facing API changes

- New SSE event type: `input:form`
- New endpoint: `POST /v1/automate/input`
- SDKs and docs updated after ship

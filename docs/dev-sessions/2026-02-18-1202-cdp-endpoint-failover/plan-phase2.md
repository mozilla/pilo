# Plan: Phase 2 — Mid-Task Browser Disconnect Handling

## Background & Problem

Phase 1 added CDP endpoint failover at connection time: when `chromium.connectOverCDP()`
fails, the next endpoint is tried. But the browser can also drop mid-task — after a
successful connection — producing Playwright's `TargetClosedError`:

```
Error: Target page, context or browser has been closed
```

This error surfaces from `getTreeWithRefs`, `getScreenshot`, or `performAction` when the
CDP session closes unexpectedly. Currently it propagates to `runMainLoop`'s per-iteration
catch block, which counts it as a regular agent error and calls `addErrorFeedback`. The
dead browser is not restarted, so every subsequent iteration fails the same way until
`maxConsecutiveErrors` is exhausted and the task fails.

Phase 2 makes mid-task disconnects trigger a browser restart (advancing to the next CDP
endpoint via Phase 1's `nextStartIndex`) and then re-executes the task plan from the
beginning on the new browser.

## Why Not Just Continue from the Current Page?

A reconnected browser is a fresh browser with no state: no cookies, no DOM, no session.
The agent's message history at the point of disconnect describes actions against a browser
that no longer exists. Navigating to `currentPage.url` would produce a page in an unknown
state — mid-flow forms gone, auth sessions potentially lost — while the agent's conversation
history expects the opposite.

The clean approach: keep the already-computed plan (skip re-planning), but restart
execution from the beginning on the new browser. The agent re-executes its plan with
a coherent browser state.

## Design Goals

1. Detect `TargetClosedError` in `PlaywrightBrowser` methods and surface it as a
   distinct `BrowserDisconnectedError` so `WebAgent` can handle it specially
2. On disconnect: restart browser (uses Phase 1's `nextStartIndex` for next endpoint),
   navigate to the original starting URL, and reset the execution message history
3. Do NOT re-run the planning phase — keep `plan`, `successCriteria`, `url`, `actionItems`
4. Do NOT count a disconnect against the agent's error thresholds — it's an
   infrastructure failure, not an agent logic error
5. If reconnect fails (all endpoints exhausted), propagate a hard error immediately
6. Emit a new `BROWSER_RECONNECTED` event when reconnect succeeds

## Design Decisions

| #   | Decision                                                                                                                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `BrowserDisconnectedError extends RecoverableError` — fits the error hierarchy but gets special handling in `runMainLoop`                   |
| 2   | Detection lives in `PlaywrightBrowser` methods (not in `WebAgent`) — keeps Playwright internals encapsulated                                |
| 3   | Reconnect logic lives in a new `WebAgent.handleBrowserDisconnect()` private method                                                          |
| 4   | Disconnects do NOT increment `consecutiveErrors` or `totalErrors`                                                                           |
| 5   | `consecutiveErrors` is reset to 0 on successful reconnect                                                                                   |
| 6   | After reconnect, navigate to `this.url` (original starting URL, not last page URL) and reset messages via `initializeSystemPromptAndTask()` |
| 7   | Planning phase state (`this.plan`, `this.successCriteria`, `this.url`, `this.actionItems`) is preserved — only message history is reset     |
| 8   | Iteration counter is NOT reset — the agent continues against the same `maxIterations` budget                                                |
| 9   | If `browser.start()` throws (endpoints exhausted), it propagates as a hard error → task fails                                               |
| 10  | `navigateToStartWithRetry` already handles `RecoverableError` → no changes needed there                                                     |

## Disconnect Detection in `PlaywrightBrowser`

Playwright's `TargetClosedError` fires when the CDP session is lost mid-use.
Detect it with:

```ts
private isBrowserDisconnectedError(error: Error): boolean {
  if (error instanceof playwrightErrors.TargetClosedError) return true;
  return error.message.includes("Target page, context or browser has been closed");
}
```

The string fallback handles Playwright versions where `TargetClosedError` may not be
separately instantiated.

### Methods that need disconnect detection

**`performAction`** — the main action path. Currently wraps unknown errors in
`BrowserActionException`. Add a check before that wrap:

```ts
} catch (error) {
  if (error instanceof InvalidRefException || error instanceof BrowserActionException) {
    throw error;
  }
  // NEW: surface disconnects distinctly before generic wrapping
  if (error instanceof Error && this.isBrowserDisconnectedError(error)) {
    throw new BrowserDisconnectedError(error.message);
  }
  throw new BrowserActionException(...);
}
```

**`getTreeWithRefs`** — currently no try/catch. Wrap the body and rethrow disconnects:

```ts
async getTreeWithRefs(): Promise<string> {
  try {
    // ... existing implementation ...
  } catch (error) {
    if (error instanceof Error && this.isBrowserDisconnectedError(error)) {
      throw new BrowserDisconnectedError(error.message);
    }
    throw error;
  }
}
```

**`getScreenshot`** — currently has try/finally but no catch. Add disconnect detection:

```ts
try {
  return await this.page.screenshot(...);
} catch (error) {
  if (error instanceof Error && this.isBrowserDisconnectedError(error)) {
    throw new BrowserDisconnectedError(error.message);
  }
  throw error;
} finally {
  // ... existing mark cleanup ...
}
```

`getUrl()` and `getTitle()` are simpler calls; disconnect there is unlikely in practice
and will surface as uncaught errors counted normally — not worth adding detection.

## Reconnect Logic in `WebAgent`

### Modified catch block in `runMainLoop`

```ts
} catch (error) {
  // Browser disconnects are handled specially: trigger reconnect + execution reset
  if (error instanceof BrowserDisconnectedError) {
    // May throw if all endpoints exhausted — propagates as hard error
    await this.handleBrowserDisconnect(task, error);
    consecutiveErrors = 0;
    needsPageSnapshot = true;
    executionState.currentIteration++;
    continue;
  }

  trackError();
  // ... rest of existing error handling unchanged ...
}
```

### New `handleBrowserDisconnect()` private method

```ts
private async handleBrowserDisconnect(task: string, error: BrowserDisconnectedError): Promise<void> {
  console.warn(`[WebAgent] Browser disconnected mid-task: ${error.message}`);
  console.warn(`[WebAgent] Restarting on next CDP endpoint...`);

  // Shut down the dead browser
  await this.browser.shutdown();

  // Restart — uses nextStartIndex to try the next CDP endpoint (Phase 1)
  // Throws a hard error (non-RecoverableError) if all endpoints are exhausted
  await this.browser.start();

  // Navigate to the original starting URL (not currentPage.url — the new browser
  // has no prior state and we need a coherent starting point for re-execution)
  if (this.url && this.url !== "about:blank") {
    await this.browser.goto(this.url);
    await this.updatePageState();
  }

  // Reset message history so the agent re-executes the plan cleanly on the new browser.
  // Planning state (this.plan, this.successCriteria, this.url) is preserved.
  this.initializeSystemPromptAndTask(task);

  this.emit(WebAgentEventType.BROWSER_RECONNECTED, {
    startingUrl: this.url,
  });
}
```

If `browser.start()` throws (all CDP endpoints exhausted), that hard error propagates
out of `handleBrowserDisconnect`. JavaScript semantics: a throw inside a catch block
propagates to the enclosing scope — not back to the same catch — so it exits `runMainLoop`
and is converted to a task failure in `execute()`.

## Error Counting Behavior

| Scenario                                                  | `consecutiveErrors`    | `totalErrors` |
| --------------------------------------------------------- | ---------------------- | ------------- |
| Normal agent error (bad action, timeout, etc.)            | +1                     | +1            |
| Browser disconnect, reconnect succeeds                    | reset to 0             | unchanged     |
| Browser disconnect, reconnect fails (endpoints exhausted) | task fails immediately | N/A           |
| Error after reconnect                                     | +1 from 0              | +1            |

Disconnects are not agent errors — they're infrastructure failures. The agent gets a
clean error slate on the new browser.

## Changes Required

### 1. `src/errors.ts`

Add new error class:

```ts
/**
 * Thrown when the browser connection is lost mid-task (CDP session closed).
 * WebAgent catches this to trigger a browser restart and execution reset rather
 * than treating it as an ordinary agent error.
 */
export class BrowserDisconnectedError extends RecoverableError {
  constructor(message: string) {
    super(`Browser connection lost: ${message}`);
    this.name = "BrowserDisconnectedError";
  }
}
```

### 2. `src/browser/playwrightBrowser.ts`

- Import `BrowserDisconnectedError` from `errors.js`
- Add `isBrowserDisconnectedError(error: Error): boolean` private method
- Add disconnect detection in `performAction` catch block
- Add try/catch with disconnect detection to `getTreeWithRefs`
- Add catch with disconnect detection to `getScreenshot`

### 3. `src/events.ts`

Add new event type and data interface:

```ts
BROWSER_RECONNECTED = "browser:reconnected";

export interface BrowserReconnectedEventData extends WebAgentEventData {
  startingUrl: string; // The original starting URL the agent is restarting from
}
```

Add `{ type: WebAgentEventType.BROWSER_RECONNECTED; data: BrowserReconnectedEventData }`
to the `WebAgentEvent` discriminated union.

### 4. `src/webAgent.ts`

- Import `BrowserDisconnectedError` from `errors.js`
- Import `BrowserReconnectedEventData` from `events.js`
- Add `handleBrowserDisconnect(task: string, error: BrowserDisconnectedError): Promise<void>`
  private method
- Modify `runMainLoop` catch block to check for `BrowserDisconnectedError` first

### 5. `src/loggers/chalkConsole.ts`

Handle the new event:

```ts
private handleBrowserReconnected = (data: BrowserReconnectedEventData): void => {
  console.log(
    chalk.yellow(`⚠ Browser disconnected — reconnected and restarting task execution`),
    data.startingUrl ? chalk.gray(`(from ${data.startingUrl})`) : "",
  );
};
```

### 6. `src/loggers/secretsRedactor.ts`

No changes needed. `BrowserReconnectedEventData` contains only `startingUrl` (a page
URL, not a credential) — nothing to redact.

### 7. Tests

**`test/playwrightBrowser.test.ts`** — new describe block for disconnect detection:

- `TargetClosedError` in `performAction` → throws `BrowserDisconnectedError`
- Generic "Target page, context or browser has been closed" message → `BrowserDisconnectedError`
- Non-disconnect error in `performAction` → still wraps as `BrowserActionException`
- `TargetClosedError` in `getTreeWithRefs` → `BrowserDisconnectedError`
- `TargetClosedError` in `getScreenshot` → `BrowserDisconnectedError`

**`test/webAgent.test.ts`** — new tests:

- Browser disconnects mid-loop → `handleBrowserDisconnect` called, loop continues
- After reconnect, `consecutiveErrors` is reset to 0
- Disconnects do NOT increment `totalErrors`
- Reconnect navigates to `this.url` (starting URL), NOT `currentPage.url`
- Messages are reset to initial execution state after reconnect
- `BROWSER_RECONNECTED` event emitted with correct `startingUrl`
- If reconnect `browser.start()` throws (all endpoints exhausted), task fails with hard error
- Iteration counter continues from where it was (not reset)

## What's Not Changing

- Phase 1 `connectOverCDPWithFailover` logic — Phase 2 builds on it transparently
- Planning phase state (`plan`, `successCriteria`, `url`) — preserved across reconnect
- `navigateToStartWithRetry` — no changes; it already handles `RecoverableError` correctly
- Error counting for non-disconnect errors — unchanged
- The `CDP_ENDPOINT_CYCLE` event — fires as usual during `browser.start()` when
  cycling endpoints, which now also happens during mid-task reconnect

## Implementation Order

1. `src/errors.ts` — add `BrowserDisconnectedError`
2. `src/browser/playwrightBrowser.ts` — detection method + 3 method wrappers
3. `src/events.ts` — `BROWSER_RECONNECTED` event type and data interface
4. `src/webAgent.ts` — `handleBrowserDisconnect()` + modified `runMainLoop` catch
5. `src/loggers/chalkConsole.ts` — new event handler
6. Tests

# Pilo LLM Provider Timeouts Design

## Context

TAB-346 asks to review "Spark" timeouts to the LLM provider. Spark is the previous name for Pilo, so this work targets the current Pilo extension and core runtime.

Pilo already has browser navigation and action timeouts, and several AI SDK calls pass `abortSignal` for user cancellation. The current gaps are:

- Planning calls `generateTextWithRetry()` without forwarding the task abort signal.
- AI SDK calls do not consistently receive an explicit provider timeout.
- The extension sidepanel has a 10 minute `Promise.race()` timeout for waiting on the background response, but that timeout only rejects the UI wait. It does not cancel the background task or abort the active provider request.

## Goals

- Add a configurable default timeout for LLM provider calls.
- Apply the timeout consistently to planning, action generation, validation, and extract calls.
- Preserve explicit per-call timeout overrides.
- Ensure extension-side response timeouts cancel the background task instead of leaving it running.
- Keep all names and config under Pilo terminology.

## Non-Goals

- Do not add provider-specific custom fetch wrappers.
- Do not change provider selection, model defaults, retry counts, or navigation/action timeout behavior.
- Do not add legacy `spark` naming to code or config.

## Design

Add a new AI config field, `llm_provider_timeout_ms`, in `packages/core/src/config/defaults.ts`. The field is browser-safe, has a default of `120000`, and is exposed through the existing config system with:

- CLI flag: `--llm-provider-timeout-ms`
- Env var: `PILO_LLM_PROVIDER_TIMEOUT_MS`
- Category: `ai`

`generateTextWithRetry()` will apply this timeout when the caller does not provide `params.timeout`. This covers planning, validation, and extract generation through one shared path. If a caller passes an explicit AI SDK timeout, that value wins.

Action generation uses `streamText()` directly, so `WebAgent` will pass the configured timeout there as well. Planning will also pass `this.abortSignal` into `generateTextWithRetry()` so cancellation behavior is consistent across all agent phases.

`WebAgent` will read the timeout from config by default and allow constructor options to override it for tests or embedded callers. The extension uses `pilo-core/core`, so the timeout default must remain available from browser-safe core exports without importing Node-only config modules.

In the extension sidepanel, the response wait timeout will abort the background task for the active tab by sending `cancelTask` before surfacing a timeout message. The background already tracks running tasks by tab ID with `AbortController`, so this reuses the existing cancellation mechanism.

## Error Handling

Provider timeouts should surface as normal task failures with a clear timeout message. User cancellation should continue to be treated as a successful cancellation response in the extension, matching current UI behavior.

Retries remain controlled by `generateTextWithRetry()`. A timeout error may retry if the current retry classifier treats it as retryable. The timeout applies to each AI SDK call attempt unless the AI SDK call itself receives a structured timeout with different semantics.

## Testing

Core tests should cover:

- `generateTextWithRetry()` injects the default timeout when none is provided.
- `generateTextWithRetry()` preserves explicit timeout values.
- Existing abort signals are preserved.
- Planning forwards the task abort signal.
- Action generation passes the configured timeout to `streamText()`.

Extension tests should cover:

- Sidepanel timeout sends `cancelTask` for the current tab.
- The user-visible timeout error is still shown.

## Open Questions

None. The chosen default is `120000` ms unless implementation reveals an existing product expectation that requires a different value.

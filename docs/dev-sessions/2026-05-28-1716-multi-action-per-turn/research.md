# Research — multi-action per turn (#438)

All refs are `packages/core/src/...` unless noted. Verified against worktree branched off origin/main @ a26880e.

## 1. Per-turn action loop: `generateAndProcessAction()`

- Method spans `webAgent.ts:931-1190`. Return type declared at `webAgent.ts:935-940` (`{ isTerminal, success, finalAnswer, pageChanged, actionExecuted }`).
- `streamText` call at `webAgent.ts:958-966`: `toolChoice: "required"`, `tools: webActionTools`, `maxOutputTokens: DEFAULT_GENERATION_MAX_TOKENS`, `abortSignal`.
- Reasoning streamed via `fullStream` loop `webAgent.ts:972-1000`; `AGENT_REASONED` emitted once at reasoning-end / first tool-call (`webAgent.ts:992-995`), payload `{ reasoning, iterationId }`.
- Await tuple of promises (`toolResults`, `response`, `finishReason`, `usage`, `warnings`, `providerMetadata`) at `webAgent.ts:1003-1011`.
- **`AI_GENERATION` event emitted `webAgent.ts:1050-1059`** (always, success or error). Payload: `{ messages, temperature:0, object:null, finishReason, usage:{inputTokens,outputTokens}, warnings, providerMetadata, error? }`. No batch fields today.
- **Multi-tool DROP path `webAgent.ts:1081-1094`**: when `toolResults.length > 1`, keeps `[0]`, warns, emits `SYSTEM_DEBUG_TOOL_DROP { iterationId, droppedCount, droppedTools, keptTool }`. _This is the path the batching feature converts from "drop" to "execute"._
- Single result consumed at `webAgent.ts:1096`: `const toolResult = aiResponse.toolResults[0]`.
- Zero-tool handling: if no tools executed, `ToolExecutionError("You must use exactly one tool")` thrown `webAgent.ts:1067-1075`; caught as recoverable, fed back as a message.
- Recoverable tool error: `actionOutput.success === false && error` + `isRecoverable` → `throw new ToolExecutionError(...)` `webAgent.ts:1108-1118`.

## 2. ActionResult shape + action classification

- Base type `tools/webActionTools.ts:40-52`: `{ success, action, ref?, value?, error?, isRecoverable?, targetIdentity? }`. **No `isTerminal` in the base type.**
- `done`/`abort` tools return an _extended_ shape with `isTerminal: true`:
  - `done` → `{ success:true, action:"done", result, isTerminal:true }` (`tools/webActionTools.ts:438`)
  - `abort` → `{ success:true, action:"abort", reason, isTerminal:true }` (`tools/webActionTools.ts:453`)
- Loop reads `actionOutput.isTerminal` at `webAgent.ts:1127`.
- **`pageChanged` already exists `webAgent.ts:1124`:** `action !== "extract" && action !== "webSearch"`. ⇒ _Every_ action is considered page-changing today EXCEPT `extract` and `webSearch`. This drives whether a fresh snapshot is taken next iteration.
  - ⚠️ **This is the inverse of the issue's `isPageChangingAction`.** The issue wants to know which actions are SAFE TO BATCH (fill/focus/check don't invalidate refs). The existing `pageChanged` flag treats fill/focus/check as page-changing. We need a NEW, separate classifier for "batch terminator" — do not overload `pageChanged`.
- Web action tools defined in `tools/webActionTools.ts:159-457`. Names: `click, fill, select, hover, check, uncheck, focus, enter, wait, scroll, goto, back, forward, extract, done, abort`.
- **`webSearch` is a separate, CONDITIONAL tool** in `tools/searchTools.ts:22`, added only when `searchProvider !== "none"` (gated at `webAgent.ts:1473`). Not in the base webActionTools list.

## 3. Repetition detector: `checkAndHandleRepeatedAction()`

- Defined `webAgent.ts:1196-1286`. Called once per turn at `webAgent.ts:1177` (after successful tool exec, before returning non-terminal).
- State in `executionState` (`webAgent.ts:151-161`): `actionRepeatCount`, `lastAction` (single signature string).
- Signature via `createActionSignature()` `webAgent.ts:1577-1590`: `action:role:name:normalizedValue` or `action:normalizedValue`. **Ref deliberately excluded** (handles snapshot ref churn).
- Exempt: `scroll`, `wait` reset count + clear `lastAction` (`webAgent.ts:1211-1212`, exempt set `webAgent.ts:237-240`).
- Thresholds: warning at `maxRepeatedActions+1`, abort at `maxRepeatedActions+2` (`webAgent.ts:1217-1276`). Warning returns intervention result with `pageChanged:true` to force snapshot; abort emits `TASK_ABORTED`.
- ⚠️ Tracks ONE action per turn. With batching, multiple actions execute per turn — detector must consider each (issue's noted dependency).

## 4. WebAgentOptions + events

- `WebAgentOptions` interface `webAgent.ts:66-103`. Has `maxIterations, maxConsecutiveErrors, maxTotalErrors, maxValidationAttempts, maxRepeatedActions, initialNavigationRetries, guardrails, searchProvider, ...`. **No `maxActionsPerStep` yet** — this is the new field.
- `AGENT_ACTION` emitted per-tool in `tools/webActionTools.ts:79-83` (start of `performActionWithValidation`), payload `{ action, ref?, value? }`. Already per-action, so a batch naturally emits multiple — matches issue section B.
- Events defined in `events.ts` (WebAgentEventType enum + payload types).

## 5. Validator-on-done

- Triggered only when `isTerminal && action === "done"` (`webAgent.ts:1127-1130`).
- `validateTaskCompletion()` `webAgent.ts:1291-1426`: builds validation prompt, calls `generateTextWithRetry` with `createValidationTools()`, reads `completionQuality` ∈ {failed, partial, complete, excellent}; accepts on complete/excellent (`webAgent.ts:1364`), force-accepts at max attempts (`webAgent.ts:1387`).
- On accept → terminal success return `webAgent.ts:1137-1144`. On reject → non-terminal, feedback already in messages, `pageChanged:false` to avoid snapshot `webAgent.ts:1148-1154`.
- ⚠️ For batching: if `done` appears mid-batch, only actions before it should run, then validate `done`; nothing after `done`.

## 6. Test conventions — `packages/core/test/webAgent.test.ts`

- `vi.mock("ai", ...)` stubs `streamText` + `tool` (`webAgent.test.ts:14-26`); `generateTextWithRetry` mocked separately.
- `createMockStreamResponse(response)` factory `webAgent.test.ts:41-116` builds a `fullStream` async-iterator that yields `reasoning-*` then **iterates over `response.toolResults` yielding `tool-call`/`tool-result` per entry** — so multi-tool batches are already expressible in the mock. Returns promise-wrapped `toolResults`, `response`, `finishReason`, etc.
- Usage pattern `webAgent.test.ts:327-406`: planning via `mockGenerateTextWithRetry.mockResolvedValueOnce`, action via `mockStreamText.mockReturnValueOnce(createMockStreamResponse({ toolResults:[...], response:{messages:[...]} }))`, validation via `mockValidationResponse("complete")`. Tool result entries include `toolCallId, toolName, input, output` (output = ActionResult).
- Browser mock implements `AriaBrowser` (`webAgent.test.ts:147-226`); logger mock captures all events into `events[]` (`webAgent.test.ts:229-248`); fake timers in `beforeEach`/`afterEach`.

## Deltas from the issue's assumptions

1. **Line numbers** all shifted (issue cited ~905/1011/1019; real: streamText 958, drop 1081, `[0]` 1096, zero-tool 1067). Issue said to verify — done.
2. **`pageChanged` already exists and is the inverse concept.** Don't reuse it as the batch terminator; introduce a distinct `isBatchTerminating(action)` (or "safe-to-batch" allowlist). Safe-to-batch candidates: `fill, select, check, uncheck, focus, hover`. Terminating: `click, enter, goto, back, forward, webSearch, extract?, done, abort, scroll, wait?`.
3. **`isTerminal` is not on the base ActionResult type** — it's added by `done`/`abort` returns. The batch loop's `output.isTerminal` check works because of that.
4. **`webSearch` is conditional** (only when search provider configured); the batch terminator classifier must handle its possible absence gracefully.
5. **The multi-tool drop path already exists** (1081-1094) and is the natural hook to convert into batch execution.
6. **Test harness already supports multi-tool mocks** — `createMockStreamResponse` iterates `toolResults`.

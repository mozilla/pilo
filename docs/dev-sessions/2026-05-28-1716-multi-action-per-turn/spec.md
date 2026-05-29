# Multi-action per turn — core batching Spec

**Goal:** Let the web agent execute several safe, non-navigating actions (e.g. filling multiple form fields) in a single LLM turn, cutting round-trips — the dominant latency — without changing default behavior.

**Source:** https://github.com/mozilla/pilo/issues/438 (this spec is PR 1 of a phased delivery)

## Current state

The per-turn loop `generateAndProcessAction()` (`webAgent.ts:931-1190`) enforces one action per turn:

- `streamText` uses `toolChoice: "required"` (`webAgent.ts:958-966`).
- When a provider returns >1 tool call, the extras are **dropped**: keep `toolResults[0]`, warn, emit `SYSTEM_DEBUG_TOOL_DROP` (`webAgent.ts:1081-1094`). Single result consumed at `webAgent.ts:1096`.
- Zero tool calls → `ToolExecutionError("You must use exactly one tool")` (`webAgent.ts:1067-1075`), caught as recoverable.
- The system prompt repeats "EXACTLY ONE tool" in `prompts.ts` (tool-call instruction + per-step + error-feedback templates).

A `pageChanged` flag already exists (`webAgent.ts:1124`): `action !== "extract" && action !== "webSearch"` — it decides whether to snapshot next turn, and treats nearly every action (including `fill`) as page-changing. It is **not** the same concept as "safe to batch" and must not be overloaded. See `research.md` §2.

Action tools: `click, fill, select, hover, check, uncheck, focus, enter, wait, scroll, goto, back, forward, extract, done, abort` (`tools/webActionTools.ts:159-457`), plus conditional `webSearch` (`tools/searchTools.ts:22`, only when `searchProvider !== "none"`). `done`/`abort` return an extended result carrying `isTerminal:true` (`webActionTools.ts:438,453`); base `ActionResult` (`webActionTools.ts:40-52`) has no `isTerminal`.

**Eager execution (load-bearing).** Every tool has an `execute` fn that performs the browser action immediately (`webActionTools.ts:166-241`). With AI SDK v6 `streamText` (single step, no `stopWhen`/`maxSteps`), when the model returns N tool calls in one assistant message, the SDK runs **all N** `execute` fns before `streamResult.toolResults` resolves. So by the time the loop inspects results, every returned action has already hit the browser — the current drop path (`webAgent.ts:1081-1094`) drops them from _processing_, not from _execution_. The caller (`webAgent.ts:527-545`) consumes one aggregated turn-result: `actionCount++` once, `needsPageSnapshot = result.pageChanged`, terminal breaks the loop. Recoverable errors are surfaced by `throw`ing `ToolExecutionError`, caught at `webAgent.ts:546` (trackError + retry).

## Desired end state

- New option `WebAgentOptions.maxActionsPerStep?: number`, default **1** (exact current behavior preserved). Recommended production value 3.
- When `maxActionsPerStep > 1`: `toolChoice: "auto"` (so the model may emit several tool calls) and the prompt invites batching up to N. When `=== 1`: `toolChoice: "required"` and the "exactly one tool" prompt, unchanged.
- **Unified processing loop.** Because execution is eager (all returned tools already ran), the loop's job is to _process_ the executed results in order and produce one aggregated turn-result. Take `toProcess = toolResults.slice(0, maxActionsPerStep)`; for any results beyond the cap, keep the existing `SYSTEM_DEBUG_TOOL_DROP` emit. When `maxActionsPerStep === 1` this reduces to today's exact behavior (process `[0]`, drop+emit the rest). Process `toProcess` in order, **stopping at the first terminal action or the first error**:
  - Regular (non-terminal, success) action → count it; track `pageChanged ||= (action !== "extract" && action !== "webSearch")`.
  - Terminal (`done`/`abort`) → run existing terminal handling (validation / abort) and return; ignore any later results (they executed but are irrelevant).
  - Error result (`!success && error`) → `throw` exactly as the single-action path does today (`ToolExecutionError` if `isRecoverable`, else `Error`). Earlier successful actions are already in `this.messages` (appended from `response.messages` at `webAgent.ts:1043-1047`), so the model sees them next turn.
- **Safety comes from the prompt, not the loop.** The classifier `isBatchTerminating()` is only used in the _prompt guidance_ framing (which actions to put last) and is not a code gate on execution. Safe-to-batch (model is told these may precede others): `fill, select, check, uncheck, focus`. Page-changing / must-be-last: everything else. If the model mis-orders and a later action runs against a changed page, it typically returns a recoverable error (stale ref) → fed back → model retries.
- Refs are stable across actions the model batches _only if_ no page-changer precedes them — which the prompt enforces by ordering, not the code.
- Repetition check unchanged in shape: called once on the **last processed non-terminal action** (current call site `webAgent.ts:1177`). Per-action tracking deferred to PR 2.
- Zero-tool case: keep throwing, but soften the message wording when `maxActionsPerStep > 1` (e.g. "You must use at least one tool"). With `toolChoice:"auto"` some providers may return zero tools more often; the existing recoverable feedback path handles it.
- System prompt updated to describe batching (see Patterns), parameterized on `maxActionsPerStep`.
- Telemetry via a **new** `SYSTEM_DEBUG_BATCH` event (mirroring `SYSTEM_DEBUG_TOOL_DROP`) emitted after the processing loop: `{ iterationId, actionsRequested: number (= toolResults.length), actionsProcessed: number, batchStoppedBy: "terminal" | "error" | "completed" }`. (The issue proposed putting these on `AI_GENERATION`, but that event fires _before_ tool processing — `webAgent.ts:1050` — so `actionsProcessed`/`batchStoppedBy` aren't known there. A dedicated post-processing event is the correct home.)
- Expose via the existing config schema (`config/defaults.ts`): add `max_actions_per_step` (default 1) which auto-generates the `--max-actions-per-step` CLI flag + `PILO_MAX_ACTIONS_PER_STEP` env var, matching the `max_iterations`/`max_repeated_actions` pattern. Wire `cfg.max_actions_per_step` into the CLI's `new WebAgent(...)` call (`cli/src/commands/run.ts:310-318`). This makes the latency eval runnable. (Server wiring deferred — see NOT doing.)

## Design decisions

- **Decision:** Safety is prompt-driven, not code-gated (Les's choice — see #438 brainstorm). The AI SDK executes all returned tool calls eagerly, so the code cannot prevent a mis-ordered action from running. We instead (a) cap how many tools the model is invited to call via `maxActionsPerStep`, and (b) instruct it to batch only safe actions and put any page-changer last. The recoverable-error path is the safety net for mis-ordering.
  - **Why:** True execution control would require stripping `execute` from the tools and running them manually (synthesizing tool-result messages by hand) — a much larger change, rejected as out of scope for PR 1.
  - **Rejected:** Manual execution control (Option B in brainstorm); slicing-to-prevent-execution (impossible — execution already happened by await time).
- **Decision:** `isBatchTerminating(action: string): boolean` exists to drive the _prompt guidance wording_ (safe set = `fill, select, check, uncheck, focus`; everything else, incl. unknown names, is "page-changing / last"). It is **not** a runtime gate on the processing loop.
  - **Why:** A single source of truth for the safe/unsafe split keeps the prompt and any future logic consistent; unknown actions default to "terminating/unsafe" (fail safe).
  - **Rejected:** Reusing the existing `pageChanged` flag (`webAgent.ts:1124`) — it is the inverse concept (snapshot-driver that treats fills as page-changing).
- **Decision:** `select` is in the safe set.
  - **Why:** Les's call; a dropdown `onchange` that navigates is rare, and if it happens the trailing batched actions return recoverable stale-ref errors that self-heal next turn. Revisit if evals show breakage.
  - **Rejected:** Treating `select` as page-changing (smaller wins for the common multi-select form).
- **Decision:** Unify the processing loop around `toolResults.slice(0, maxActionsPerStep)` rather than branching on `maxActionsPerStep > 1`. Keep the `SYSTEM_DEBUG_TOOL_DROP` emit for results beyond the cap.
  - **Why:** When `maxActionsPerStep === 1`, `slice(0,1)` + drop-emit reproduces today's exact behavior — no separate default code path to keep in sync.
  - **Rejected:** A parallel `if (maxActionsPerStep>1)` block duplicating terminal/error/repetition handling.
- **Decision:** Default `maxActionsPerStep = 1`; new behavior gated entirely on `> 1` (only changes `toolChoice` and prompt wording).
  - **Why:** Backwards-compat and easy rollback, per the issue's feature-flag guidance.
- **Decision:** Repetition detector left as-is; called once on the **last processed non-terminal action** (current call site `webAgent.ts:1177` preserved).
  - **Why:** Per-action repetition tracking is a separable refactor (deferred to PR 2). Default path unchanged; batched path degrades gracefully (slightly weaker coverage, not incorrect).
  - **Rejected:** Full per-action rework here (scope creep; it's its own issue).

## Patterns to follow

- **Processing loop** replaces `webAgent.ts:1081-1096`: `toProcess = toolResults.slice(0, maxActionsPerStep)`; keep `SYSTEM_DEBUG_TOOL_DROP` for results beyond `toProcess`. Iterate `toProcess` in order; stop at first terminal action or first error. Accumulate `pageChanged` and processed-count for the aggregated turn-result.
- **Terminal handling** reuse the existing `isTerminal` + `action==="done"/"abort"` blocks (`webAgent.ts:1127-1170`) — feed the terminal action through them unchanged.
- **Error handling** reuse the existing throw at `webAgent.ts:1108-1120` (`ToolExecutionError` if recoverable, else `Error`) for the first error result encountered.
- **Prompt updates** mirror existing template structure in `prompts.ts`: the tool-call instruction (~`prompts.ts:213-217` per issue) plus the per-step snapshot and error-feedback templates. Add the issue's "Action batching" guidance block, parameterized on `maxActionsPerStep`; when it's 1, keep the "exactly one tool" wording.
- **Event payload** extend the object built at `webAgent.ts:1050-1059`; update the corresponding payload type in `events.ts`.
- **Tests** follow `webAgent.test.ts` conventions: `createMockStreamResponse({ toolResults:[...] })` (`webAgent.test.ts:41-116`) already yields multiple `tool-call`/`tool-result` pairs; assert on the `events[]` logger capture (`webAgent.test.ts:229-248`).

## What we're NOT doing

- **Per-action repetition-detector rework** (`checkAndHandleRepeatedAction`, `createActionSignature`) — deferred to PR 2 / a follow-up issue. This PR keeps the single-signature tracking.
- **Server-side wiring** of `maxActionsPerStep` (HTTP API / config). CLI flag only, just enough to run the eval. Server can adopt the core option later.
- **Adjusting the `pageChanged`/snapshot logic** beyond what batching requires.
- **Provider-specific tuning** or per-provider default `maxActionsPerStep` values.
- **Changing default behavior** — default stays 1; no existing test should change its expectations.
- **The manual latency eval itself** — that's a real-provider run for Les to execute (the CLI flag enables it); not something this session validates in CI.

## Open questions

- **Should `hover` ever be safe-to-batch?** Default answer: **no** (page-changing), per Les's "form-fill only" choice. Revisit only if a concrete combobox/menu case needs `focus`+`hover` batched.
- **`batchStoppedBy` mapping.** Default answer: `"terminal"` when processing stopped at a `done`/`abort`; `"error"` when stopped at an error result; `"completed"` when all of `toProcess` was processed without hitting either. (Eager execution means there is no "page-change truncation" — the SDK already ran everything; this field reports why _processing_ stopped.)

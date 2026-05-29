# Multi-action per turn — core batching Implementation Plan

**Goal:** Let the web agent batch several safe, non-navigating actions in one LLM turn (gated on `maxActionsPerStep`, default 1 = no change), cutting round-trips.

**Approach:** Add a `maxActionsPerStep` option (config-driven). When `>1`, flip `toolChoice` to `"auto"` and prompt the model to batch safe actions with any page-changer last. Because the AI SDK executes all returned tool calls eagerly, the loop's job is to _process_ the executed results in order (stop at first terminal/error) and produce one aggregated turn-result + telemetry. Safety is prompt-driven, not code-gated.

**Tech stack:** TypeScript, pnpm monorepo (`@tabstack/pilo`), AI SDK v6, Vitest, nunjucks-style prompt templates.

**Verification commands** (no Makefile; run from repo root):

- lint/format: `pnpm format:check`
- types: `pnpm typecheck`
- tests: `pnpm --filter pilo-core test` (full suite: `pnpm test`)
- combined: `pnpm check`

---

## Phase 1: Option plumbing + config + safe-set classifier

Foundation slice: the option exists end-to-end (config → CLI flag/env → `WebAgent` field) and a tested classifier defines the safe-to-batch set. **No loop behavior changes** (default 1; loop still processes `[0]`).

**Files:**

- Modify: `packages/core/src/config/defaults.ts` — add `max_actions_per_step` to the optional interface (~line 104), the resolved interface (~line 176), and the schema map (after `max_repeated_actions`, ~line 491).
- Modify: `packages/core/src/core.ts` — export `DEFAULT_MAX_ACTIONS_PER_STEP` (mirror `DEFAULT_MAX_REPEATED_ACTIONS`, line 95).
- Modify: `packages/core/src/webAgent.ts` — add `maxActionsPerStep?: number` to `WebAgentOptions` (~line 88, near `maxRepeatedActions`); add `private readonly maxActionsPerStep: number` field (~line 219) and init in constructor (~line 255).
- Modify: `packages/core/src/tools/webActionTools.ts` — add `SAFE_TO_BATCH_ACTIONS` constant + `isBatchTerminating()`, exported.
- Modify: `packages/cli/src/commands/run.ts` — pass `maxActionsPerStep: options.maxActionsPerStep ?? cfg.max_actions_per_step` into `new WebAgent(...)` (~line 314).
- Test: `packages/core/test/webActionTools.test.ts` (or new `test/batching.test.ts`) — classifier unit test.

**Key changes:**

In `config/defaults.ts` schema map (mirror `max_repeated_actions` at 483-491):

```ts
max_actions_per_step: {
  default: 1,
  type: "number",
  cli: "--max-actions-per-step",
  placeholder: "n",
  env: ["PILO_MAX_ACTIONS_PER_STEP"],
  description: "Maximum tool calls the agent may batch in one turn (1 = one action per turn)",
  category: "agent",
},
```

Add `max_actions_per_step?: number;` to the optional interface (~104) and `max_actions_per_step: number;` to the resolved interface (~176).

In `core.ts` (after line 95):

```ts
export const DEFAULT_MAX_ACTIONS_PER_STEP = _defaults.max_actions_per_step;
```

In `webAgent.ts` `WebAgentOptions` (after `maxRepeatedActions`):

```ts
/** Maximum tool calls the agent may batch in one turn (default 1 = one action per turn). */
maxActionsPerStep?: number;
```

Field + constructor init (mirror line 255):

```ts
private readonly maxActionsPerStep: number;
// ...in constructor:
this.maxActionsPerStep = options.maxActionsPerStep ?? defaults.max_actions_per_step;
```

In `tools/webActionTools.ts` (near the top-level exports):

```ts
/**
 * Actions that mutate form state without navigating or invalidating other refs.
 * The model may batch these before a single trailing page-changing action.
 * Single source of truth shared by prompt guidance and any batch logic.
 */
export const SAFE_TO_BATCH_ACTIONS: ReadonlySet<string> = new Set([
  "fill",
  "select",
  "check",
  "uncheck",
  "focus",
]);

/** True when an action ends a batch (page-changing, terminal, or unknown — fail safe). */
export function isBatchTerminating(action: string): boolean {
  return !SAFE_TO_BATCH_ACTIONS.has(action);
}
```

In `cli/src/commands/run.ts` `new WebAgent(browser, { ... })` (~314):

```ts
maxActionsPerStep: options.maxActionsPerStep ?? cfg.max_actions_per_step,
```

**Test (write first, watch fail):**

```ts
import { SAFE_TO_BATCH_ACTIONS, isBatchTerminating } from "../src/tools/webActionTools.js";

describe("batch action classification", () => {
  it("treats form-fill actions as safe to batch", () => {
    for (const a of ["fill", "select", "check", "uncheck", "focus"]) {
      expect(isBatchTerminating(a)).toBe(false);
      expect(SAFE_TO_BATCH_ACTIONS.has(a)).toBe(true);
    }
  });
  it("treats navigating/terminal/unknown actions as batch-terminating", () => {
    for (const a of [
      "click",
      "enter",
      "goto",
      "back",
      "forward",
      "scroll",
      "wait",
      "webSearch",
      "extract",
      "done",
      "abort",
      "hover",
      "totally-unknown",
    ]) {
      expect(isBatchTerminating(a)).toBe(true);
    }
  });
});
```

**Verification — automated:**

- [x] `pnpm --filter pilo-core test` passes (743 pass; new classifier test green, config schema-sync test updated)
- [x] `pnpm typecheck` passes (core + cli)
- [x] `pnpm format:check` passes
- [x] `pnpm check:schemas` passes (config doesn't touch the events schema — no diff)

**Verification — manual:**

- [x] `pnpm pilo run --help` shows `--max-actions-per-step <n>` under agent options (verified)
- [x] Existing default behavior unchanged: `maxActionsPerStep` resolves to 1 when unset (config default + schema-sync test)

> **Adaptation:** the repo has `noUnusedLocals`, so declaring the field without using it failed typecheck. Pulled the one-line `toolChoice` flip (planned for Phase 2) into Phase 1 as the field's first real use — behaviorally safe (stays `"required"` at the default of 1). Also updated `test/config.test.ts`'s hardcoded key list (the schema-sync structural guard) to include `max_actions_per_step`.

---

## Phase 2: Prompt batching guidance + toolChoice flip

Slice: when `maxActionsPerStep > 1`, the action-loop prompts invite batching and `streamText` uses `toolChoice:"auto"`; when `=== 1`, everything renders/behaves exactly as today. The processing loop is still single-action (Phase 3 changes that), so this phase is safe at any value — at most the model batches and extras get dropped as they are today.

**Files:**

- Modify: `packages/core/src/prompts.ts` — replace the `${toolCallInstruction}` interpolation in the three _action-loop_ templates (action system prompt ~424, page snapshot ~518, step error feedback ~560) with a templated `{{ toolCallInstruction }}` var computed per `maxActionsPerStep`; make the static "exactly ONE" lines (rule #2 ~331 and the CRITICAL block ~339-343) conditional. Leave planning (~287) and validation (~611) templates untouched — those legitimately want one tool call.
- Modify: `packages/core/src/webAgent.ts` — thread `this.maxActionsPerStep` into `buildActionLoopSystemPrompt(...)` (~1757), `buildPageSnapshotPrompt(...)` (call site), and `buildStepErrorFeedbackPrompt(...)` (call site); set `toolChoice` conditionally in the `streamText` call (~963).
- Test: `packages/core/test/prompts.test.ts` (or existing prompt test file) — assert guidance text presence by `maxActionsPerStep`.

**Key changes:**

In `prompts.ts`, add a builder for the instruction (keeps the `toolCallInstruction` constant for planning/validation):

```ts
const BATCHING_INSTRUCTION = (n: number) =>
  `
You may call up to ${n} tools in one turn, but ONLY for related actions that do
not change the page (filling several fields of the same form, focusing inputs,
checking boxes). Any page-changing action — click, enter, goto, back, forward,
scroll, webSearch, extract, done, abort — MUST be the LAST call in the turn, or
the only call. Actions placed after a page-changing call run against a stale page
and will fail.

Safe to batch together (before any page-changing action): fill, select, check, uncheck, focus.
Must be last or alone: everything else.

Use valid JSON for all arguments. Do not call the same tool with identical arguments more than once.
`.trim();

/** Instruction text for the action loop, parameterized on the per-turn action cap. */
const toolCallInstructionFor = (maxActionsPerStep: number): string =>
  maxActionsPerStep > 1 ? BATCHING_INSTRUCTION(maxActionsPerStep) : toolCallInstruction;
```

Thread a `maxActionsPerStep` arg (default 1, added as the LAST param to avoid breaking other callers) through the three builders and pass `toolCallInstruction: toolCallInstructionFor(maxActionsPerStep)` plus `maxActionsPerStep` into each template context. Change `${toolCallInstruction}` → `{{ toolCallInstruction }}` in those three templates.

For the static lines in the action system prompt template, make them conditional:

```nunjucks
{# rule #2 #}
{% if maxActionsPerStep > 1 %}2. You may batch up to {{ maxActionsPerStep }} safe actions per turn; any page-changing action must be last{% else %}2. Execute EXACTLY ONE tool per turn{% endif %}
{# CRITICAL block #}
{% if maxActionsPerStep > 1 %}**CRITICAL:** Use 1–{{ maxActionsPerStep }} tools per turn (page-changing action last). Choose:{% else %}**CRITICAL:** You MUST use exactly ONE tool with valid arguments EVERY turn. Choose:{% endif %}
```

In `webAgent.ts` `streamText` call (~963):

```ts
toolChoice: this.maxActionsPerStep > 1 ? "auto" : "required",
```

And pass `this.maxActionsPerStep` to the three prompt builders at their call sites.

**Test (write first, watch fail):**

```ts
it("renders batching guidance when maxActionsPerStep > 1", () => {
  const p = buildActionLoopSystemPrompt(false, false, false, false, false, 3);
  expect(p).toMatch(/up to 3 tools/i);
  expect(p).toMatch(/Safe to batch together/i);
  expect(p).not.toMatch(/EXACTLY ONE tool per turn/);
});
it("renders single-tool instruction when maxActionsPerStep === 1", () => {
  const p = buildActionLoopSystemPrompt(false, false, false, false, false, 1);
  expect(p).toMatch(/EXACTLY ONE tool per turn/);
  expect(p).not.toMatch(/Safe to batch together/i);
});
```

(Match the final `buildActionLoopSystemPrompt` signature — `maxActionsPerStep` is the appended last param with default 1.)

**Verification — automated:**

- [x] `pnpm --filter pilo-core test` passes (749 pass; 6 new prompt tests green, existing prompt tests unchanged)
- [x] `pnpm typecheck` passes
- [x] `pnpm format:check` passes

**Verification — manual:**

- [x] Eyeball a rendered action-loop prompt at `maxActionsPerStep:3` — Core Rule #2, CRITICAL line, and batching block all render coherently with the page-changer-last rule (verified via render)
- [x] Rendered prompt at default (1) still says "exactly ONE" and contains no batching text (existing `actionLoopSystemPrompt` describe block asserts this)

> **Note:** the `toolChoice` flip listed in this phase's Files already landed in Phase 1 (see Phase 1 adaptation). Phase 2 is the prompt-guidance work only.

---

## Phase 3: Unified processing loop + batch telemetry

Slice: replace the single-result processing (`webAgent.ts:1077-1189`) with a capped, ordered processing loop that produces one aggregated turn-result and emits a `SYSTEM_DEBUG_BATCH` telemetry event. At `maxActionsPerStep === 1` this reproduces today's exact behavior (process `[0]`, drop+emit the rest).

**Files:**

- Modify: `packages/core/src/events.ts` — add `SYSTEM_DEBUG_BATCH` to `WebAgentEventType` (mirror `SYSTEM_DEBUG_TOOL_DROP`), a payload interface, and the discriminated-union entry (~line 378).
- Modify: `packages/core/src/webAgent.ts` — soften the zero-tool error message (1067-1075) when `maxActionsPerStep > 1`; refactor the terminal `done`/`abort` block (1127-1173) into `handleTerminalAction(actionOutput, task, executionState)`; replace lines 1077-1189 with the processing loop; add `actionsProcessed` to the return shape; update the caller's `actionCount` increment (~541-543).
- Test: `packages/core/test/webAgent.test.ts` — batch scenarios.

**Zero-tool message (webAgent.ts:1067-1075):**

```ts
if (!aiResponse?.toolResults?.length) {
  console.error("[WebAgent] No tools called in action generation");
  const msg =
    this.maxActionsPerStep > 1
      ? "You must use at least one tool. Please use one of the available tools."
      : "You must use exactly one tool. Please use one of the available tools.";
  throw new ToolExecutionError(msg, { action: "none" });
}
```

**Key changes:**

In `events.ts` (mirror the tool-drop event):

```ts
SYSTEM_DEBUG_BATCH = "system:debug:batch",
// ...
export interface SystemDebugBatchEventData extends WebAgentEventData {
  actionsRequested: number;
  actionsProcessed: number;
  batchStoppedBy: "terminal" | "error" | "completed";
}
// ...union:
| { type: WebAgentEventType.SYSTEM_DEBUG_BATCH; data: SystemDebugBatchEventData }
```

In `webAgent.ts`, extend the return type of `generateAndProcessAction` (935-942) with `actionsProcessed: number;`.

Replace lines 1077-1189 with (keeping the existing terminal/error code by extracting `handleTerminalAction`):

```ts
// Cap processing at maxActionsPerStep. Results beyond the cap already executed
// (the AI SDK runs every returned tool's execute fn) — note them as dropped,
// matching the historical single-action behavior when the cap is 1.
const toProcess = aiResponse.toolResults.slice(0, this.maxActionsPerStep);
if (aiResponse.toolResults.length > toProcess.length) {
  const droppedTools = aiResponse.toolResults.slice(toProcess.length).map((r: any) => r.toolName);
  console.warn(
    `[WebAgent] Provider returned ${aiResponse.toolResults.length} tool calls; ` +
      `processing ${toProcess.length}, dropping: ${droppedTools.join(", ")}`,
  );
  this.emit(WebAgentEventType.SYSTEM_DEBUG_TOOL_DROP, {
    iterationId: this.currentIterationId,
    droppedCount: droppedTools.length,
    droppedTools,
    keptTool: toProcess[0].toolName,
  });
}

let actionsProcessed = 0;
let anyPageChanged = false;
let lastNonTerminalOutput: any = null;
let batchStoppedBy: "terminal" | "error" | "completed" = "completed";

try {
  for (const tr of toProcess) {
    const actionOutput = tr.output as any;
    if (!actionOutput) throw new Error("Tool execution failed: missing output property.");

    // Error result → throw (matches the single-action path). Earlier successful
    // actions are already in this.messages (appended from response.messages above),
    // so the model sees them next turn.
    if (!actionOutput.success && actionOutput.error) {
      batchStoppedBy = "error";
      if (actionOutput.isRecoverable) {
        throw new ToolExecutionError(actionOutput.error, {
          action: actionOutput.action,
          ref: actionOutput.ref,
          output: actionOutput,
        });
      }
      throw new Error(actionOutput.error);
    }

    // Terminal action (done/abort) — handle and return; ignore any later results.
    if (actionOutput.isTerminal) {
      batchStoppedBy = "terminal";
      actionsProcessed++;
      const terminal = await this.handleTerminalAction(actionOutput, task, executionState);
      return { ...terminal, actionsProcessed };
    }

    // Regular action: count it, track page change.
    actionsProcessed++;
    lastNonTerminalOutput = actionOutput;
    if (actionOutput.action !== "extract" && actionOutput.action !== "webSearch") {
      anyPageChanged = true;
    }
  }
} finally {
  this.emit(WebAgentEventType.SYSTEM_DEBUG_BATCH, {
    iterationId: this.currentIterationId,
    actionsRequested: aiResponse.toolResults.length,
    actionsProcessed,
    batchStoppedBy,
  });
}

// Repetition check on the last non-terminal action (unchanged shape; per-action
// tracking deferred to PR 2).
if (lastNonTerminalOutput) {
  const repetitionResult = this.checkAndHandleRepeatedAction(lastNonTerminalOutput, executionState);
  if (repetitionResult) return { ...repetitionResult, actionsProcessed };
}

return {
  isTerminal: false,
  success: false,
  finalAnswer: null,
  pageChanged: anyPageChanged,
  actionExecuted: actionsProcessed > 0,
  actionsProcessed,
};
```

`handleTerminalAction` is the existing `done`/`abort` body (1128-1172) lifted verbatim into a private method returning the same `{isTerminal, success, finalAnswer, pageChanged, actionExecuted, error?}` shape. The two `checkAndHandleRepeatedAction` early-return paths must also carry `actionsProcessed` — spread it as shown.

Caller change (`webAgent.ts:541-543`):

```ts
if (result.actionExecuted) {
  executionState.actionCount += result.actionsProcessed ?? 1;
}
```

**Tests (write first, watch fail):** add to `webAgent.test.ts` using `createMockStreamResponse({ toolResults: [...] })`. Construct the agent with `maxActionsPerStep: 3` where noted.

1. **3-fill batch (completed):** toolResults = 3 successful `fill` outputs. Assert: turn returns `actionExecuted:true`, `pageChanged:true`, `actionsProcessed:3`; a `SYSTEM_DEBUG_BATCH` event with `{actionsRequested:3, actionsProcessed:3, batchStoppedBy:"completed"}`; `actionCount` incremented by 3.
2. **fill + enter (page-changer last, completed):** toolResults = [fill ok, enter ok]. Assert both processed, `batchStoppedBy:"completed"`, `pageChanged:true`, `actionsProcessed:2`.
3. **fill + done (terminal):** toolResults = [fill ok, done(isTerminal)]; mock validation `complete`. Assert terminal success returned, `batchStoppedBy:"terminal"`, validation ran once.
4. **fill + recoverable error (stops at error):** toolResults = [fill ok, fill {success:false,error:"Invalid element reference",isRecoverable:true}]. Assert `ToolExecutionError` thrown; `SYSTEM_DEBUG_BATCH` with `batchStoppedBy:"error"`, `actionsProcessed:1`; the successful fill's message is present in `this.messages`.
5. **done not last in batch:** toolResults = [done(isTerminal), fill]. Assert terminal handling runs on `done`, the trailing fill is ignored (`actionsProcessed:1`, `batchStoppedBy:"terminal"`).
6. **default (maxActionsPerStep:1) regression:** toolResults = [click ok, fill ok] with default agent. Assert only `[0]` processed (`actionsProcessed:1`), `SYSTEM_DEBUG_TOOL_DROP` emitted for the extra; behavior identical to pre-change (existing tests should also cover this — confirm none changed).

**Verification — automated:**

- [ ] `pnpm --filter pilo-core test` passes (6 new scenarios green; all 741 existing green, none modified)
- [ ] `pnpm typecheck` passes
- [ ] `pnpm format:check` passes
- [ ] `pnpm check` passes (full)

**Verification — manual:**

- [ ] Re-read the diff of `generateAndProcessAction`: at `maxActionsPerStep:1`, `slice(0,1)` + drop-emit + single-result processing is behaviorally identical to the original

---

## Out of scope (deferred / NOT this plan)

- Per-action repetition-detector rework → PR 2 / follow-up issue.
- Server-side wiring of `maxActionsPerStep`.
- The manual latency eval (real-provider run) — Les runs it via `--max-actions-per-step 3` after merge; acceptance is a 2–3× wall-clock reduction on a form-heavy task vs. `1`. Not a CI gate.

# Notes — multi-action per turn (#438)

## Session state (execution complete)

- Worktree: `.claude/worktrees/438-multi-action-per-turn/`, branch `worktree-438-multi-action-per-turn`, off origin/main @ a26880e.
- Baseline: 1324 tests green (core 741). After: **1338 green** (core 755, cli 221, server 96, extension 266), typecheck + format + check:schemas clean.
- Phase: spec ✓, research ✓, plan ✓, **execute ✓ (3 phases committed)**. Next: `pr`. PR 1 of 2 (per-action repetition rework is PR 2).

### Commits

- `e419814` Phase 1: maxActionsPerStep option, config, safe-batch classifier (+14 classifier/config tests context)
- `6353005` Phase 2: prompt batching guidance parameterized on maxActionsPerStep (+6 prompt tests)
- `f156df2` Phase 3: unified processing loop + SYSTEM_DEBUG_BATCH telemetry (+6 batch scenarios)

### Execution adaptations (vs plan)

- **`noUnusedLocals`** forced the `toolChoice` flip into Phase 1 (planned for Phase 2) so the field had a real use.
- Updated three **structural-guard tests** that enumerate config keys / event types: `config.test.ts` (+`max_actions_per_step`), `events.test.ts` (+`system:debug_batch`). Legit sync updates, not weakening.
- **Schema**: `packages/core/schemas/` is `.prettierignore`d (prettier diverges from ts-json-schema-generator). Regenerate with `pnpm --filter pilo-core generate:schemas` ONLY — never prettier it. Committed the regenerated `webagent-event.json`.

## Load-bearing discoveries (read before resuming)

1. **Eager execution.** AI SDK v6 `streamText` runs every returned tool's `execute` fn before `toolResults` resolves (`webActionTools.ts:166-241`). So we CANNOT prevent a mis-ordered batch action from hitting the browser — the loop only controls _processing/reporting_. Safety is prompt-driven (Les's explicit choice over manual execution control). The recoverable-error path is the net for mis-ordering.
2. **`pageChanged` is the inverse concept.** `webAgent.ts:1124` treats everything as page-changing except `extract`/`webSearch`. The batch safe-set (`fill, select, check, uncheck, focus`) is a _new_ classifier (`isBatchTerminating`), NOT a reuse of `pageChanged`.
3. **Telemetry can't go on `AI_GENERATION`** — that event fires before tool processing (`webAgent.ts:1050`). Using a new `SYSTEM_DEBUG_BATCH` event emitted after processing.
4. **Config, not a one-off CLI flag.** `max_actions_per_step` goes in `config/defaults.ts` schema → auto-generates `--max-actions-per-step` + `PILO_MAX_ACTIONS_PER_STEP`.
5. The multi-tool **drop** path already exists (`1081-1094`); we unify around `slice(0, maxActionsPerStep)` so cap=1 reproduces today's behavior exactly.

## Key decisions (Les)

- Safe-to-batch set: form-fill only (`fill, select, check, uncheck, focus`); `select` kept safe.
- Phased delivery: core batching now (this PR); per-action repetition detector later.
- Safety mechanism: prompt-ordered + eager execution (not manual execution control).

# Pilo LLM Provider Timeouts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Pilo-controlled timeout for LLM provider calls using the AI SDK `timeout` option, and make extension UI response timeouts abort the background task.

**Architecture:** Add a browser-safe `llm_provider_timeout_ms` config field, then thread that value into AI SDK call parameters instead of creating custom timeout wrappers. `generateTextWithRetry()` applies the default timeout for non-streaming calls, while `WebAgent` passes the same value to direct `streamText()` action generation and forwards abort signals to planning. The extension keeps using `cancelTask` and the background `AbortController` map for timeout cancellation.

**Tech Stack:** TypeScript, Vercel AI SDK `generateText`/`streamText`, Vitest, React Testing Library, webextension-polyfill, pnpm.

---

## File Map

- Modify `packages/core/src/config/defaults.ts`: add `llm_provider_timeout_ms` to config types, field metadata, defaults, and required field validation.
- Modify `packages/core/src/core.ts`: export a browser-safe default constant for extension/core consumers if needed.
- Modify `packages/core/src/utils/retry.ts`: apply the configured timeout to `generateText()` calls when `params.timeout` is absent.
- Modify `packages/core/src/webAgent.ts`: add `llmProviderTimeoutMs` option/state, pass it to `streamText()`, pass `abortSignal` to planning, and pass timeout into web action tool context if extract needs direct configurability.
- Modify `packages/core/src/tools/webActionTools.ts`: accept optional timeout in tool context and pass it to extract calls only if not already covered by `generateTextWithRetry()` default.
- Modify `packages/core/test/config.test.ts`: assert config/schema/default synchronization for the new field.
- Modify `packages/core/test/utils/retry.test.ts`: TDD coverage for default timeout injection and override preservation.
- Modify `packages/core/test/webAgent.test.ts`: TDD coverage for planning abort propagation and action-generation timeout.
- Modify `packages/core/test/tools/webActionTools.test.ts`: TDD coverage for extract preserving abort signal and receiving timeout through the retry wrapper if tool context is extended.
- Modify `packages/extension/src/ui/components/sidepanel/ChatView.tsx`: make the response wait timeout send `cancelTask` for the current tab before throwing a user-visible timeout error.
- Modify `packages/extension/test/components/sidepanel/ChatView.test.tsx`: TDD coverage for timeout-driven cancellation.
- Read `.github/pull_request_template.md` before creating the PR body.

---

### Task 1: Add Browser-Safe LLM Timeout Config

**Files:**
- Modify: `packages/core/src/config/defaults.ts`
- Modify: `packages/core/src/core.ts`
- Test: `packages/core/test/config.test.ts`

- [ ] **Step 1: Write failing config tests**

Add `llm_provider_timeout_ms` to the schema synchronization list in `packages/core/test/config.test.ts`:

```ts
const piloConfigKeys: (keyof PiloConfig)[] = [
  "provider",
  "model",
  "openai_api_key",
  "openrouter_api_key",
  "google_generative_ai_api_key",
  "vertex_project",
  "vertex_location",
  "ollama_base_url",
  "openai_compatible_base_url",
  "openai_compatible_name",
  "llm_provider_timeout_ms",
  "browser",
  // keep the rest of the existing keys unchanged
];
```

Add assertions near the default assertions:

```ts
expect(DEFAULTS.llm_provider_timeout_ms).toBe(120000);
expect(typeof DEFAULTS.llm_provider_timeout_ms).toBe("number");
```

If there is an existing field metadata test, add:

```ts
expect(FIELDS.llm_provider_timeout_ms).toMatchObject({
  default: 120000,
  type: "number",
  cli: "--llm-provider-timeout-ms",
  env: ["PILO_LLM_PROVIDER_TIMEOUT_MS"],
  category: "ai",
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter pilo-core run test -- test/config.test.ts
```

Expected: FAIL because `llm_provider_timeout_ms` is missing from `PiloConfig`, `PiloConfigResolved`, `FIELDS`, or `DEFAULTS`.

- [ ] **Step 3: Implement config field**

In `packages/core/src/config/defaults.ts`, add to `PiloConfig` AI configuration:

```ts
llm_provider_timeout_ms?: number;
```

Add to `PiloConfigResolved` AI configuration:

```ts
llm_provider_timeout_ms: number;
```

Add to `FIELDS` after `reasoning_effort` or adjacent AI fields:

```ts
llm_provider_timeout_ms: {
  default: 120000,
  type: "number",
  cli: "--llm-provider-timeout-ms",
  placeholder: "ms",
  env: ["PILO_LLM_PROVIDER_TIMEOUT_MS"],
  description: "Timeout for LLM provider calls in milliseconds",
  category: "ai",
},
```

Add to `requiredFields`:

```ts
"llm_provider_timeout_ms",
```

In `packages/core/src/core.ts`, export a browser-safe constant near the other timeout constants:

```ts
export const DEFAULT_LLM_PROVIDER_TIMEOUT_MS = _defaults.llm_provider_timeout_ms;
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter pilo-core run test -- test/config.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/config/defaults.ts packages/core/src/core.ts packages/core/test/config.test.ts
git commit -m "feat(core): add llm provider timeout config"
```

---

### Task 2: Apply Timeout in `generateTextWithRetry`

**Files:**
- Modify: `packages/core/src/utils/retry.ts`
- Test: `packages/core/test/utils/retry.test.ts`

- [ ] **Step 1: Write failing retry tests**

In `packages/core/test/utils/retry.test.ts`, add:

```ts
it("passes the default LLM provider timeout to generateText", async () => {
  const expectedResult = { text: "Success", toolResults: [] };
  mockGenerateText.mockResolvedValueOnce(expectedResult);

  await generateTextWithRetry({
    prompt: "test",
    model: "test-model",
  });

  expect(mockGenerateText).toHaveBeenCalledWith(
    expect.objectContaining({
      timeout: 120000,
    }),
  );
});

it("preserves an explicit generateText timeout", async () => {
  const expectedResult = { text: "Success", toolResults: [] };
  mockGenerateText.mockResolvedValueOnce(expectedResult);

  await generateTextWithRetry({
    prompt: "test",
    model: "test-model",
    timeout: { totalMs: 45000 },
  } as any);

  expect(mockGenerateText).toHaveBeenCalledWith(
    expect.objectContaining({
      timeout: { totalMs: 45000 },
    }),
  );
});

it("preserves an existing abort signal when applying the default timeout", async () => {
  const expectedResult = { text: "Success", toolResults: [] };
  const controller = new AbortController();
  mockGenerateText.mockResolvedValueOnce(expectedResult);

  await generateTextWithRetry({
    prompt: "test",
    model: "test-model",
    abortSignal: controller.signal,
  });

  expect(mockGenerateText).toHaveBeenCalledWith(
    expect.objectContaining({
      abortSignal: controller.signal,
      timeout: 120000,
    }),
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter pilo-core run test -- test/utils/retry.test.ts
```

Expected: FAIL because `generateText()` is currently called with the original params and no injected timeout.

- [ ] **Step 3: Implement timeout injection using AI SDK option**

In `packages/core/src/utils/retry.ts`, import defaults:

```ts
import { getConfigDefaults } from "../config/defaults.js";
```

Before the retry loop or inside the function after options are resolved, add:

```ts
const defaults = getConfigDefaults();
const paramsWithTimeout = {
  ...params,
  timeout: params.timeout ?? defaults.llm_provider_timeout_ms,
};
```

Change:

```ts
const result = await generateText(params);
```

to:

```ts
const result = await generateText(paramsWithTimeout);
```

Do not create `setTimeout`, `AbortController`, custom fetch wrappers, or `Promise.race()` here.

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter pilo-core run test -- test/utils/retry.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/utils/retry.ts packages/core/test/utils/retry.test.ts
git commit -m "fix(core): apply llm timeout to generateText calls"
```

---

### Task 3: Apply Timeout and Abort Signal in `WebAgent`

**Files:**
- Modify: `packages/core/src/webAgent.ts`
- Test: `packages/core/test/webAgent.test.ts`

- [ ] **Step 1: Write failing WebAgent tests**

In `packages/core/test/webAgent.test.ts`, add a test near the abort-signal coverage:

```ts
it("passes the execute abort signal to planning", async () => {
  const controller = new AbortController();
  mockGenerateTextWithRetry.mockResolvedValueOnce({
    text: "Plan",
    toolResults: [
      {
        output: {
          plan: "Test plan",
          successCriteria: "Done",
          url: "about:blank",
        },
      },
    ],
  } as any);

  mockStreamText.mockReturnValueOnce(
    createMockStreamResponse({
      toolResults: [
        {
          toolName: "done",
          output: { success: true, action: "done", isTerminal: true, result: "Done" },
        },
      ],
    }),
  );
  mockGenerateTextWithRetry.mockResolvedValueOnce(mockValidationResponse("complete"));

  await webAgent.execute("test task", { abortSignal: controller.signal });

  expect(mockGenerateTextWithRetry).toHaveBeenCalledWith(
    expect.objectContaining({
      abortSignal: controller.signal,
    }),
    expect.any(Object),
  );
});
```

Add a timeout test for action generation:

```ts
it("passes the default LLM provider timeout to action generation", async () => {
  await webAgent.execute("test task");

  expect(mockStreamText).toHaveBeenCalledWith(
    expect.objectContaining({
      timeout: 120000,
    }),
  );
});
```

Add an override test:

```ts
it("allows callers to override the LLM provider timeout", async () => {
  const agent = new WebAgent(mockBrowser, {
    ...options,
    llmProviderTimeoutMs: 45000,
  });

  await agent.execute("test task");

  expect(mockStreamText).toHaveBeenCalledWith(
    expect.objectContaining({
      timeout: 45000,
    }),
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter pilo-core run test -- test/webAgent.test.ts
```

Expected: FAIL because `WebAgentOptions` has no `llmProviderTimeoutMs`, planning does not pass `abortSignal`, and `streamText()` does not receive timeout.

- [ ] **Step 3: Implement WebAgent timeout plumbing**

In `WebAgentOptions`, add:

```ts
/** Timeout for LLM provider calls in milliseconds */
llmProviderTimeoutMs?: number;
```

In the class configuration fields, add:

```ts
private readonly llmProviderTimeoutMs: number;
```

In the constructor after defaults are loaded:

```ts
this.llmProviderTimeoutMs = options.llmProviderTimeoutMs ?? defaults.llm_provider_timeout_ms;
```

In the `streamText()` call inside `generateAndProcessAction()`, add:

```ts
timeout: this.llmProviderTimeoutMs,
```

In the planning `generateTextWithRetry()` params inside `planTask()`, add:

```ts
abortSignal: this.abortSignal,
timeout: this.llmProviderTimeoutMs,
```

When creating web action tools, include the timeout in context if the context object is local to `WebAgent`:

```ts
llmProviderTimeoutMs: this.llmProviderTimeoutMs,
```

Do not implement timeout with custom timers.

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter pilo-core run test -- test/webAgent.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/webAgent.ts packages/core/test/webAgent.test.ts
git commit -m "fix(core): apply llm timeout in web agent"
```

---

### Task 4: Confirm Extract Tool Timeout Coverage

**Files:**
- Modify only if needed: `packages/core/src/tools/webActionTools.ts`
- Test: `packages/core/test/tools/webActionTools.test.ts`

- [ ] **Step 1: Write failing or confirming extract test**

In `packages/core/test/tools/webActionTools.test.ts`, add:

```ts
it("passes abort signal and configured timeout to extract generation", async () => {
  const controller = new AbortController();
  context.abortSignal = controller.signal;
  context.llmProviderTimeoutMs = 45000;
  tools = createWebActionTools(context);

  mockGenerateTextWithRetry.mockResolvedValueOnce({
    text: "extracted",
    toolResults: [],
  } as any);

  await tools.extract.execute({ description: "Extract page data" });

  expect(mockGenerateTextWithRetry).toHaveBeenCalledWith(
    expect.objectContaining({
      abortSignal: controller.signal,
      timeout: 45000,
    }),
    expect.any(Object),
  );
});
```

- [ ] **Step 2: Run test to verify it fails or already passes**

Run:

```bash
pnpm --filter pilo-core run test -- test/tools/webActionTools.test.ts
```

Expected: FAIL if extract does not pass `timeout`; PASS only if Task 2 default coverage is enough and no context-specific timeout is required. If it passes without implementation, keep the test and skip Step 3.

- [ ] **Step 3: Implement extract timeout pass-through if needed**

If Step 2 fails, update the web action tool context type in `packages/core/src/tools/webActionTools.ts` to accept:

```ts
llmProviderTimeoutMs?: number;
```

In the extract `generateTextWithRetry()` params, add:

```ts
timeout: context.llmProviderTimeoutMs,
```

This still uses the AI SDK timeout option through `generateTextWithRetry()`.

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter pilo-core run test -- test/tools/webActionTools.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

If implementation was needed:

```bash
git add packages/core/src/tools/webActionTools.ts packages/core/test/tools/webActionTools.test.ts
git commit -m "fix(core): apply llm timeout to extract tool"
```

If only the test was needed:

```bash
git add packages/core/test/tools/webActionTools.test.ts
git commit -m "test(core): cover extract llm timeout"
```

---

### Task 5: Abort Extension Background Task on UI Response Timeout

**Files:**
- Modify: `packages/extension/src/ui/components/sidepanel/ChatView.tsx`
- Test: `packages/extension/test/components/sidepanel/ChatView.test.tsx`

- [ ] **Step 1: Write failing ChatView timeout test**

In `packages/extension/test/components/sidepanel/ChatView.test.tsx`, add or extend tests using fake timers:

```ts
it("cancels the background task when waiting for executeTask times out", async () => {
  vi.useFakeTimers();
  vi.mocked(browser.runtime.sendMessage)
    .mockImplementationOnce(() => new Promise(() => {}))
    .mockResolvedValueOnce({ success: true, message: "Cancelled 1 running task(s)" });

  render(<ChatView {...defaultProps} />);

  const input = screen.getByRole("textbox");
  await userEvent.type(input, "Run a slow task");
  await userEvent.keyboard("{Enter}");

  await vi.advanceTimersByTimeAsync(600000);

  expect(browser.runtime.sendMessage).toHaveBeenCalledWith({
    type: "cancelTask",
    tabId: 1,
  });
  expect(mockAddMessage).toHaveBeenCalledWith(
    expect.objectContaining({
      type: "result",
      content: expect.stringContaining("Background script timeout"),
    }),
  );

  vi.useRealTimers();
});
```

If this test file uses a helper component for message input instead of `userEvent`, follow the existing send-message test pattern and keep the assertions above.

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter pilo-extension run test -- test/components/sidepanel/ChatView.test.tsx
```

Expected: FAIL because the timeout currently throws without sending `cancelTask`.

- [ ] **Step 3: Implement cancellation on timeout**

In `packages/extension/src/ui/components/sidepanel/ChatView.tsx`, replace the timeout promise with an async timeout that sends cancellation:

```ts
const timeoutPromise = new Promise<never>((_, reject) => {
  setTimeout(async () => {
    try {
      await browser.runtime.sendMessage({
        type: "cancelTask",
        tabId: currentTab.id,
      } satisfies CancelTaskMessage);
    } catch (cancelError) {
      console.error("Failed to cancel timed out task:", cancelError);
    }
    reject(new Error("Background script timeout"));
  }, 600000);
});
```

Keep the existing user-visible error path. Do not add custom provider timeout code in the extension; the provider timeout belongs in AI SDK call params.

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter pilo-extension run test -- test/components/sidepanel/ChatView.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/extension/src/ui/components/sidepanel/ChatView.tsx packages/extension/test/components/sidepanel/ChatView.test.tsx
git commit -m "fix(extension): cancel task on response timeout"
```

---

### Task 6: Validation, Secret Scan, and PR Preparation

**Files:**
- Read: `.github/pull_request_template.md`
- No code changes unless validation reveals a defect.

- [ ] **Step 1: Run formatting**

Run:

```bash
pnpm run format
```

Expected: Prettier completes successfully.

- [ ] **Step 2: Run full typecheck**

Run:

```bash
pnpm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Run full tests**

Run:

```bash
pnpm -r run test
```

Expected: PASS.

- [ ] **Step 4: Run full project check**

Run:

```bash
pnpm run check
```

Expected: PASS.

- [ ] **Step 5: Scan for secrets before final commit or push**

Run:

```bash
gitleaks protect -v
```

Expected: no leaks found. If gitleaks is unavailable, install it or report that the scan could not be run.

- [ ] **Step 6: Inspect PR template**

Run:

```bash
sed -n '1,220p' .github/pull_request_template.md
```

Use these sections in the PR body:

```md
## Description

## PR Type

## Related issues

## Checklist

## AI Usage
```

- [ ] **Step 7: Prepare PR body using the template**

Draft:

```md
## Description

Adds a configurable Pilo LLM provider timeout and applies it through the AI SDK `timeout` option for provider calls. Also makes the extension sidepanel cancel the active background task when its response wait times out, so provider work is aborted instead of continuing in the background.

## PR Type

- Bug Fix

## Related issues

Related to TAB-346

## Checklist

- [x] I understand the code I am submitting
- [x] I have tested this code locally
- [x] New and existing tests pass locally (`pnpm test`)
- [x] I have added tests that prove my fix/feature works (if applicable)
- [x] Documentation was updated where necessary
- [ ] I have read and followed the [contribution guidelines](CONTRIBUTING.md)

## AI Usage

- [x] AI was used for drafting/refactoring

Tooling: Codex in the local development environment.
```

- [ ] **Step 8: Final status**

Run:

```bash
git status --short
git log --oneline -8
```

Expected: no uncommitted changes except any intentionally uncommitted PR body file if created. Report commits, validation commands, and any residual risk.


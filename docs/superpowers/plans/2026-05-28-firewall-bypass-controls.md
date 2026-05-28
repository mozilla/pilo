# Firewall Bypass Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two caller-supplied controls on top of the existing prompt-injection action firewall — a `trusted_hostnames` list that bypasses both fill and submit gates when the page and form-action hostnames all match, and an `unsafe_mode` global firewall disable. Also surface remediation guidance to the user when a block fires in non-interactive mode.

**Architecture:** Extend the pure firewall policy with a `FirewallConfig` input and short-circuit branches in front of the existing structural rules. Surface the new controls through `WebAgentOptions`, `PiloConfig`, CLI flags, and (dev-mode) env vars. On block in non-interactive mode, emit a structured `FIREWALL_BLOCKED_NON_INTERACTIVE` event for user-facing channels only; the model-visible tool-result error stays minimal.

**Tech Stack:** TypeScript, Vitest, Playwright, AI SDK tools, Commander, eventemitter3, existing `AriaBrowser` / `webActionTools` / `ConfigManager` modules.

**Builds on:** `docs/superpowers/specs/2026-05-28-firewall-bypass-controls-design.md`.

---

## File Structure

| Action | Path | Responsibility |
|---|---|---|
| Modify | `packages/core/src/security/actionFirewall.ts` | `FirewallConfig` type, `normalizeHostname`, `extractHostname`, `InvalidHostnameError`, bypass branches in `assessFill`/`assessFormSubmission` |
| Modify | `packages/core/src/browser/ariaBrowser.ts` | Add `submitterActionUrl` to `FormSubmissionContext` |
| Modify | `packages/core/src/browser/playwrightBrowser.ts` | Resolve and return `submitterActionUrl` |
| Modify | `packages/core/src/events.ts` | Add `FIREWALL_BLOCKED_NON_INTERACTIVE` event type + data type |
| Modify | `packages/core/src/tools/webActionTools.ts` | Extend `WebActionContext` with `firewall` and `interactive`; query page hostname; pass to firewall; emit non-interactive event on block |
| Modify | `packages/core/src/webAgent.ts` | Add `trustedHostnames` / `unsafeMode` options; build frozen `FirewallConfig`; thread `interactive` into tool context |
| Modify | `packages/core/src/config/defaults.ts` | New `trusted_hostnames` (string[]) and `unsafe_mode` (boolean) fields with warning descriptions |
| Modify | `packages/core/src/config/commander.ts` | (No code change expected — `addConfigOptions` already handles `string[]` and `boolean` types automatically) |
| Modify | `packages/core/src/config/env.ts` | (No code change expected — generic env coercion handles both new fields) |
| Modify | `packages/cli/src/commands/run.ts` | Pass `trustedHostnames` / `unsafeMode` from merged config into `WebAgent`; subscribe to `FIREWALL_BLOCKED_NON_INTERACTIVE` and print remediation footer |
| Modify | `packages/core/src/index.ts` and `packages/core/src/core.ts` | Re-export `InvalidHostnameError` if it needs to be caught by callers |
| Create | `packages/core/test/security/actionFirewall.test.ts` | Add pure tests for normalization + bypass logic (file already exists per prior plan; new test cases appended) |
| Modify | `packages/core/test/tools/webActionTools.test.ts` | Tool-level tests for bypass and remediation event |
| Modify | `packages/core/test/playwrightBrowser.test.ts` | Test that `submitterActionUrl` is resolved and returned |
| Modify | `packages/core/test/webAgent.test.ts` | Integration tests for option plumbing and end-to-end bypass behavior |
| Modify | `README.md` (root) | Add "Security model" subsection |

---

## Task 1: Hostname normalization and extraction helpers

**Files:**
- Modify: `packages/core/src/security/actionFirewall.ts`
- Test: `packages/core/test/security/actionFirewall.test.ts`

- [ ] **Step 1: Write failing tests for `normalizeHostname` and `extractHostname`**

Append to `packages/core/test/security/actionFirewall.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  normalizeHostname,
  extractHostname,
  InvalidHostnameError,
} from "../../src/security/actionFirewall.js";

describe("normalizeHostname", () => {
  it("lowercases input", () => {
    expect(normalizeHostname("Example.COM")).toBe("example.com");
  });

  it("strips a single trailing dot", () => {
    expect(normalizeHostname("example.com.")).toBe("example.com");
  });

  it("accepts bare hostnames", () => {
    expect(normalizeHostname("app.example.com")).toBe("app.example.com");
  });

  it("accepts IDN punycode", () => {
    expect(normalizeHostname("xn--mnich-kva.de")).toBe("xn--mnich-kva.de");
  });

  it("accepts bare IPv4 literals", () => {
    expect(normalizeHostname("127.0.0.1")).toBe("127.0.0.1");
  });

  it("rejects empty string", () => {
    expect(() => normalizeHostname("")).toThrow(InvalidHostnameError);
  });

  it("rejects whitespace-only", () => {
    expect(() => normalizeHostname("   ")).toThrow(InvalidHostnameError);
  });

  it("rejects strings with whitespace", () => {
    expect(() => normalizeHostname("ex ample.com")).toThrow(InvalidHostnameError);
  });

  it("rejects strings with slashes", () => {
    expect(() => normalizeHostname("example.com/path")).toThrow(InvalidHostnameError);
  });

  it("rejects strings with colons", () => {
    expect(() => normalizeHostname("example.com:8080")).toThrow(InvalidHostnameError);
  });

  it("rejects strings with wildcards", () => {
    expect(() => normalizeHostname("*.example.com")).toThrow(InvalidHostnameError);
  });

  it("rejects URL inputs with scheme", () => {
    expect(() => normalizeHostname("https://example.com")).toThrow(InvalidHostnameError);
  });

  it("rejects bracketed IPv6 in v1", () => {
    expect(() => normalizeHostname("[::1]")).toThrow(InvalidHostnameError);
  });

  it("error message names the bad entry", () => {
    try {
      normalizeHostname("bad value");
    } catch (e) {
      expect(e).toBeInstanceOf(InvalidHostnameError);
      expect((e as Error).message).toContain("bad value");
    }
  });
});

describe("extractHostname", () => {
  it("returns lowercase hostname for https URLs", () => {
    expect(extractHostname("https://Example.COM/path?q=1")).toBe("example.com");
  });

  it("returns lowercase hostname for http URLs", () => {
    expect(extractHostname("http://app.example.com")).toBe("app.example.com");
  });

  it("strips trailing dot", () => {
    expect(extractHostname("https://example.com./")).toBe("example.com");
  });

  it("returns null for null input", () => {
    expect(extractHostname(null)).toBeNull();
  });

  it("returns null for about:blank", () => {
    expect(extractHostname("about:blank")).toBeNull();
  });

  it("returns null for data: URLs", () => {
    expect(extractHostname("data:text/html,<p>x</p>")).toBeNull();
  });

  it("returns null for file: URLs", () => {
    expect(extractHostname("file:///tmp/foo.html")).toBeNull();
  });

  it("returns null for javascript: URLs", () => {
    expect(extractHostname("javascript:alert(1)")).toBeNull();
  });

  it("returns null for malformed URLs", () => {
    expect(extractHostname("not a url")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(extractHostname("")).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `pnpm --dir packages/core exec vitest run test/security/actionFirewall.test.ts -t "normalizeHostname"`
Expected: FAIL — `normalizeHostname`, `extractHostname`, `InvalidHostnameError` not exported.

- [ ] **Step 3: Implement the helpers in `actionFirewall.ts`**

Append to `packages/core/src/security/actionFirewall.ts`:

```ts
export class InvalidHostnameError extends Error {
  constructor(input: string, reason: string) {
    super(`Invalid hostname "${input}": ${reason}`);
    this.name = "InvalidHostnameError";
  }
}

const HOSTNAME_DISALLOWED_CHARS = /[\s/:*]/;

export function normalizeHostname(input: string): string {
  if (typeof input !== "string") {
    throw new InvalidHostnameError(String(input), "not a string");
  }
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    throw new InvalidHostnameError(input, "empty");
  }
  if (HOSTNAME_DISALLOWED_CHARS.test(trimmed)) {
    throw new InvalidHostnameError(input, "contains whitespace, '/', ':', or '*'");
  }
  if (trimmed.startsWith("[") || trimmed.endsWith("]")) {
    throw new InvalidHostnameError(input, "bracketed IPv6 is not supported");
  }
  let withoutTrailingDot = trimmed;
  if (withoutTrailingDot.endsWith(".")) {
    withoutTrailingDot = withoutTrailingDot.slice(0, -1);
  }
  if (withoutTrailingDot.length === 0) {
    throw new InvalidHostnameError(input, "empty after trimming trailing dot");
  }
  return withoutTrailingDot.toLowerCase();
}

export function extractHostname(url: string | null): string | null {
  if (url === null || url === undefined) return null;
  if (typeof url !== "string" || url.length === 0) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  let host = parsed.hostname.toLowerCase();
  if (host.endsWith(".")) host = host.slice(0, -1);
  if (host.length === 0) return null;
  return host;
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `pnpm --dir packages/core exec vitest run test/security/actionFirewall.test.ts -t "normalizeHostname"`
Run: `pnpm --dir packages/core exec vitest run test/security/actionFirewall.test.ts -t "extractHostname"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/security/actionFirewall.ts packages/core/test/security/actionFirewall.test.ts
git commit -m "feat(core): add hostname normalization and extraction helpers"
```

---

## Task 2: FirewallConfig type and bypass branches

**Files:**
- Modify: `packages/core/src/security/actionFirewall.ts`
- Modify: `packages/core/test/security/actionFirewall.test.ts`
- Modify (consumer): `packages/core/src/tools/webActionTools.ts` (compile-fix only)

- [ ] **Step 1: Write failing tests for bypass behavior**

Append to `packages/core/test/security/actionFirewall.test.ts`:

```ts
import {
  assessFill,
  assessFormSubmission,
  type FirewallConfig,
} from "../../src/security/actionFirewall.js";
import type {
  FieldMetadata,
  FormSubmissionContext,
} from "../../src/browser/ariaBrowser.js";

const freeformField: FieldMetadata = {
  ref: "ref-1",
  tagName: "textarea",
  inputType: null,
  role: null,
  name: "comment",
  label: "Comment",
  placeholder: null,
  autocomplete: null,
  isContentEditable: false,
  formId: null,
  formAction: null,
  formMethod: null,
};

const emptyFirewall: FirewallConfig = {
  trustedHostnames: new Set<string>(),
  unsafeMode: false,
};

function withTrusted(hosts: string[]): FirewallConfig {
  return { trustedHostnames: new Set(hosts), unsafeMode: false };
}

const unsafeFirewall: FirewallConfig = {
  trustedHostnames: new Set<string>(),
  unsafeMode: true,
};

describe("assessFill bypass branches", () => {
  it("unsafeMode allows any field regardless of source", () => {
    const result = assessFill({
      field: freeformField,
      source: "agent",
      pageHostname: null,
      firewall: unsafeFirewall,
    });
    expect(result.allowed).toBe(true);
  });

  it("trusted page hostname allows freeform fill", () => {
    const result = assessFill({
      field: freeformField,
      source: "agent",
      pageHostname: "example.com",
      firewall: withTrusted(["example.com"]),
    });
    expect(result.allowed).toBe(true);
  });

  it("untrusted page hostname falls through to existing rules and blocks freeform", () => {
    const result = assessFill({
      field: freeformField,
      source: "agent",
      pageHostname: "attacker.com",
      firewall: withTrusted(["example.com"]),
    });
    expect(result.allowed).toBe(false);
  });

  it("pageHostname=null never bypasses", () => {
    const result = assessFill({
      field: freeformField,
      source: "agent",
      pageHostname: null,
      firewall: withTrusted(["example.com"]),
    });
    expect(result.allowed).toBe(false);
  });
});

const baseForm: FormSubmissionContext = {
  submitterRef: "submit-1",
  formId: null,
  actionUrl: "https://example.com/submit",
  submitterActionUrl: null,
  method: "post",
  fields: [
    {
      ref: "ref-1",
      name: "comment",
      tagName: "textarea",
      inputType: null,
      autocomplete: null,
    },
  ],
};

describe("assessFormSubmission bypass branches", () => {
  it("unsafeMode allows any form", () => {
    const result = assessFormSubmission({
      form: baseForm,
      approvedRefs: new Set(),
      agentFilledRefs: new Set(["ref-1"]),
      operationalRefs: new Set(),
      pageHostname: "attacker.com",
      firewall: unsafeFirewall,
    });
    expect(result.allowed).toBe(true);
  });

  it("trusted page + trusted form action allows submission", () => {
    const result = assessFormSubmission({
      form: baseForm,
      approvedRefs: new Set(),
      agentFilledRefs: new Set(["ref-1"]),
      operationalRefs: new Set(),
      pageHostname: "example.com",
      firewall: withTrusted(["example.com"]),
    });
    expect(result.allowed).toBe(true);
  });

  it("trusted page + untrusted form action falls through and blocks", () => {
    const result = assessFormSubmission({
      form: { ...baseForm, actionUrl: "https://attacker.com/exfil" },
      approvedRefs: new Set(),
      agentFilledRefs: new Set(["ref-1"]),
      operationalRefs: new Set(),
      pageHostname: "example.com",
      firewall: withTrusted(["example.com"]),
    });
    expect(result.allowed).toBe(false);
  });

  it("trusted page + null form action hostname falls through", () => {
    const result = assessFormSubmission({
      form: { ...baseForm, actionUrl: "about:blank" },
      approvedRefs: new Set(),
      agentFilledRefs: new Set(["ref-1"]),
      operationalRefs: new Set(),
      pageHostname: "example.com",
      firewall: withTrusted(["example.com"]),
    });
    expect(result.allowed).toBe(false);
  });

  it("untrusted page + trusted form action falls through", () => {
    const result = assessFormSubmission({
      form: baseForm,
      approvedRefs: new Set(),
      agentFilledRefs: new Set(["ref-1"]),
      operationalRefs: new Set(),
      pageHostname: "attacker.com",
      firewall: withTrusted(["example.com"]),
    });
    expect(result.allowed).toBe(false);
  });

  it("checks submitter action URL when present", () => {
    const result = assessFormSubmission({
      form: {
        ...baseForm,
        actionUrl: "https://example.com/normal",
        submitterActionUrl: "https://attacker.com/override",
      },
      approvedRefs: new Set(),
      agentFilledRefs: new Set(["ref-1"]),
      operationalRefs: new Set(),
      pageHostname: "example.com",
      firewall: withTrusted(["example.com"]),
    });
    expect(result.allowed).toBe(false);
  });

  it("falls through (no bypass) when nothing is agent-filled but submitter is untrusted", () => {
    const result = assessFormSubmission({
      form: { ...baseForm, actionUrl: "https://attacker.com/exfil" },
      approvedRefs: new Set(),
      agentFilledRefs: new Set(),
      operationalRefs: new Set(),
      pageHostname: "example.com",
      firewall: withTrusted(["example.com"]),
    });
    expect(result.allowed).toBe(true); // existing rule: no agent-filled => allowed
  });
});
```

Note: this references `submitterActionUrl` on `FormSubmissionContext`. That field is added in Task 3. Compilation will fail until Task 3 lands. That's expected; complete tasks in order.

- [ ] **Step 2: Run tests, verify they fail**

Run: `pnpm --dir packages/core exec vitest run test/security/actionFirewall.test.ts -t "bypass"`
Expected: FAIL — `FirewallConfig` and the new signature arguments do not exist.

- [ ] **Step 3: Extend the firewall in `actionFirewall.ts`**

Replace existing exported types and signatures with the bypass-aware versions. Full file content:

```ts
import type { FieldMetadata, FormSubmissionContext } from "../browser/ariaBrowser.js";

export const SECURITY_BLOCKED_UNAUTHORIZED_FILL =
  "Security policy blocked filling a submittable form field without user approval";

export const SECURITY_BLOCKED_UNAUTHORIZED_SUBMIT =
  "Security policy blocked submitting a form containing unauthorized agent-filled data";

export type FillSource = "agent" | "user-approved";

export type ActionFirewallResult =
  | { allowed: true; operational?: boolean }
  | { allowed: false; reason: string; isRecoverable: true };

export interface FirewallConfig {
  trustedHostnames: ReadonlySet<string>;
  unsafeMode: boolean;
}

export class InvalidHostnameError extends Error {
  constructor(input: string, reason: string) {
    super(`Invalid hostname "${input}": ${reason}`);
    this.name = "InvalidHostnameError";
  }
}

const HOSTNAME_DISALLOWED_CHARS = /[\s/:*]/;

export function normalizeHostname(input: string): string {
  if (typeof input !== "string") {
    throw new InvalidHostnameError(String(input), "not a string");
  }
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    throw new InvalidHostnameError(input, "empty");
  }
  if (HOSTNAME_DISALLOWED_CHARS.test(trimmed)) {
    throw new InvalidHostnameError(input, "contains whitespace, '/', ':', or '*'");
  }
  if (trimmed.startsWith("[") || trimmed.endsWith("]")) {
    throw new InvalidHostnameError(input, "bracketed IPv6 is not supported");
  }
  let withoutTrailingDot = trimmed;
  if (withoutTrailingDot.endsWith(".")) {
    withoutTrailingDot = withoutTrailingDot.slice(0, -1);
  }
  if (withoutTrailingDot.length === 0) {
    throw new InvalidHostnameError(input, "empty after trimming trailing dot");
  }
  return withoutTrailingDot.toLowerCase();
}

export function extractHostname(url: string | null): string | null {
  if (url === null || url === undefined) return null;
  if (typeof url !== "string" || url.length === 0) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  let host = parsed.hostname.toLowerCase();
  if (host.endsWith(".")) host = host.slice(0, -1);
  if (host.length === 0) return null;
  return host;
}

const OPERATIONAL_INPUT_TYPES = new Set([
  "search",
  "number",
  "date",
  "datetime-local",
  "month",
  "time",
  "week",
  "color",
  "range",
]);

const OPERATIONAL_ROLES = new Set(["searchbox", "combobox", "spinbutton", "slider"]);

const SENSITIVE_AUTOCOMPLETE_TOKENS = new Set([
  "name",
  "honorific-prefix",
  "given-name",
  "additional-name",
  "family-name",
  "honorific-suffix",
  "nickname",
  "email",
  "username",
  "new-password",
  "current-password",
  "one-time-code",
  "organization",
  "street-address",
  "address-line1",
  "address-line2",
  "address-line3",
  "address-level1",
  "address-level2",
  "address-level3",
  "address-level4",
  "country",
  "country-name",
  "postal-code",
  "cc-name",
  "cc-given-name",
  "cc-additional-name",
  "cc-family-name",
  "cc-number",
  "cc-exp",
  "cc-exp-month",
  "cc-exp-year",
  "cc-csc",
  "cc-type",
  "transaction-currency",
  "transaction-amount",
  "language",
  "bday",
  "bday-day",
  "bday-month",
  "bday-year",
  "sex",
  "tel",
  "tel-country-code",
  "tel-national",
  "tel-area-code",
  "tel-local",
  "tel-local-prefix",
  "tel-local-suffix",
  "tel-extension",
  "impp",
  "url",
  "photo",
]);

export function assessFill(input: {
  field: FieldMetadata;
  source: FillSource;
  pageHostname: string | null;
  firewall: FirewallConfig;
}): ActionFirewallResult {
  if (input.firewall.unsafeMode) {
    return { allowed: true };
  }
  if (
    input.pageHostname !== null &&
    input.firewall.trustedHostnames.has(input.pageHostname)
  ) {
    return { allowed: true };
  }

  if (input.source === "user-approved") {
    return { allowed: true };
  }

  if (isOperationalField(input.field)) {
    return { allowed: true, operational: true };
  }

  return {
    allowed: false,
    reason: SECURITY_BLOCKED_UNAUTHORIZED_FILL,
    isRecoverable: true,
  };
}

export function assessFormSubmission(input: {
  form: FormSubmissionContext;
  approvedRefs: ReadonlySet<string>;
  agentFilledRefs: ReadonlySet<string>;
  operationalRefs: ReadonlySet<string>;
  pageHostname: string | null;
  firewall: FirewallConfig;
}): ActionFirewallResult {
  if (input.firewall.unsafeMode) {
    return { allowed: true };
  }

  if (input.pageHostname !== null && input.firewall.trustedHostnames.has(input.pageHostname)) {
    const actionUrls = [input.form.actionUrl, input.form.submitterActionUrl];
    const allFormActionsTrusted = actionUrls.every((url) => {
      const host = extractHostname(url);
      return host !== null && input.firewall.trustedHostnames.has(host);
    });
    if (allFormActionsTrusted) {
      return { allowed: true };
    }
  }

  for (const field of input.form.fields) {
    if (!field.ref || !input.agentFilledRefs.has(field.ref)) continue;
    if (input.approvedRefs.has(field.ref) || input.operationalRefs.has(field.ref)) continue;

    return {
      allowed: false,
      reason: SECURITY_BLOCKED_UNAUTHORIZED_SUBMIT,
      isRecoverable: true,
    };
  }

  return { allowed: true };
}

function isOperationalField(field: FieldMetadata): boolean {
  const inputType = field.inputType?.toLowerCase() ?? null;
  const role = field.role?.toLowerCase() ?? null;

  if (hasSensitiveAutocomplete(field.autocomplete)) return false;
  if (field.tagName.toLowerCase() === "textarea" || field.isContentEditable) return false;
  if (inputType && OPERATIONAL_INPUT_TYPES.has(inputType)) return true;
  if (role && OPERATIONAL_ROLES.has(role)) return true;
  return false;
}

function hasSensitiveAutocomplete(autocomplete: string | null): boolean {
  if (!autocomplete) return false;
  const tokens = autocomplete.toLowerCase().split(/\s+/);
  return tokens.some((token) => SENSITIVE_AUTOCOMPLETE_TOKENS.has(token));
}
```

Note on the form-action check: when `submitterActionUrl` is `null`, `extractHostname(null)` returns `null` and the check fails — meaning the bypass does not apply. This is intentionally strict; if you want to allow the bypass when no submitter override is present, change the iteration to skip `null` entries. **Correct behavior:** if the only action URL is the form's `actionUrl`, bypass should still work. Update the iteration:

Replace this snippet inside `assessFormSubmission` with the correct semantics:

```ts
if (input.pageHostname !== null && input.firewall.trustedHostnames.has(input.pageHostname)) {
  const formActionHost = extractHostname(input.form.actionUrl);
  const submitterActionHost = extractHostname(input.form.submitterActionUrl);

  const formActionTrusted =
    formActionHost !== null && input.firewall.trustedHostnames.has(formActionHost);

  // submitterActionUrl is optional. If null, treat as "no override" (trusted).
  // If present, it must resolve to a trusted hostname.
  const submitterTrusted =
    input.form.submitterActionUrl === null
      ? true
      : submitterActionHost !== null && input.firewall.trustedHostnames.has(submitterActionHost);

  if (formActionTrusted && submitterTrusted) {
    return { allowed: true };
  }
}
```

Use that second snippet, not the first.

- [ ] **Step 4: Update the existing `assessFill` and `assessFormSubmission` call sites to pass the new fields**

The existing `webActionTools.ts` and any existing tests call these without `pageHostname` and `firewall`. Compile-fix only here — actual plumbing happens in Tasks 5 and 6. Locate every caller via:

Run: `grep -rn "assessFill\|assessFormSubmission" packages/core/src packages/core/test`

For each caller in `packages/core/src/tools/webActionTools.ts`, add temporary fields so the build compiles:

In `webActionTools.ts:232-235`, replace:

```ts
const assessment = assessFill({
  field: metadata,
  source: userApproved ? "user-approved" : "agent",
});
```

with:

```ts
const assessment = assessFill({
  field: metadata,
  source: userApproved ? "user-approved" : "agent",
  pageHostname: null,
  firewall: { trustedHostnames: new Set(), unsafeMode: false },
});
```

In `webActionTools.ts:90-95` (inside `assessFormSubmissionForAction`), replace:

```ts
const assessment = assessFormSubmission({
  form,
  approvedRefs: context.approvedRefs ?? EMPTY_APPROVED_REFS,
  agentFilledRefs: context.agentFilledRefs,
  operationalRefs: context.operationalRefs,
});
```

with:

```ts
const assessment = assessFormSubmission({
  form,
  approvedRefs: context.approvedRefs ?? EMPTY_APPROVED_REFS,
  agentFilledRefs: context.agentFilledRefs,
  operationalRefs: context.operationalRefs,
  pageHostname: null,
  firewall: { trustedHostnames: new Set(), unsafeMode: false },
});
```

These temporary literals preserve existing behavior (no bypass) until Task 5 replaces them with the real plumbed-through values.

Update any existing test callers in `packages/core/test/security/actionFirewall.test.ts` from the original spec (Task 3 in the prior plan added them) to pass the same literals. Use `grep -n "assessFill\|assessFormSubmission" packages/core/test/security/actionFirewall.test.ts` to find them.

- [ ] **Step 5: Run all firewall-related tests to verify pass**

Run: `pnpm --dir packages/core exec vitest run test/security/actionFirewall.test.ts`
Expected: PASS.

Run: `pnpm --filter pilo-core run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/security/actionFirewall.ts packages/core/src/tools/webActionTools.ts packages/core/test/security/actionFirewall.test.ts
git commit -m "feat(core): add FirewallConfig and bypass branches to action firewall"
```

---

## Task 3: Add `submitterActionUrl` to FormSubmissionContext

**Files:**
- Modify: `packages/core/src/browser/ariaBrowser.ts`
- Modify: `packages/core/src/browser/playwrightBrowser.ts`
- Modify: `packages/core/test/playwrightBrowser.test.ts`

- [ ] **Step 1: Write a failing browser test for `submitterActionUrl`**

Append to `packages/core/test/playwrightBrowser.test.ts` (locate the existing `describe` block that tests `getFormSubmissionContext` and add a sibling test inside it):

```ts
it("returns submitterActionUrl when the submit button has a formaction attribute", async () => {
  await page.setContent(`
    <form action="https://example.com/normal" method="post">
      <input type="text" name="x" data-pilo-ref="x1" />
      <button type="submit" formaction="https://override.example.com/special" data-pilo-ref="btn">Go</button>
    </form>
  `);

  const ctx = await browser.getFormSubmissionContext("btn", "click");
  expect(ctx).not.toBeNull();
  expect(ctx!.actionUrl).toBe("https://example.com/normal");
  expect(ctx!.submitterActionUrl).toBe("https://override.example.com/special");
});

it("returns null submitterActionUrl when the submit button has no formaction", async () => {
  await page.setContent(`
    <form action="https://example.com/normal" method="post">
      <input type="text" name="x" data-pilo-ref="x1" />
      <button type="submit" data-pilo-ref="btn">Go</button>
    </form>
  `);

  const ctx = await browser.getFormSubmissionContext("btn", "click");
  expect(ctx).not.toBeNull();
  expect(ctx!.submitterActionUrl).toBeNull();
});
```

Adapt setup to match the existing test file's pattern (page/browser fixtures). If the existing tests use a different page setup helper, use that helper instead of `setContent` directly.

- [ ] **Step 2: Run test, verify it fails**

Run: `pnpm --dir packages/core exec vitest run test/playwrightBrowser.test.ts -t "submitterActionUrl"`
Expected: FAIL — `submitterActionUrl` not on `FormSubmissionContext`.

- [ ] **Step 3: Extend `FormSubmissionContext` interface**

In `packages/core/src/browser/ariaBrowser.ts`, locate the `FormSubmissionContext` interface (around line 83) and add the field:

```ts
export interface FormSubmissionContext {
  submitterRef: string;
  formId: string | null;
  actionUrl: string | null;
  submitterActionUrl: string | null;
  method: string | null;
  fields: FormFieldState[];
}
```

- [ ] **Step 4: Compute `submitterActionUrl` in `playwrightBrowser.ts`**

In `packages/core/src/browser/playwrightBrowser.ts`, locate `getFormSubmissionContext` (around line 901). Inside the `locator.evaluate` callback, compute the submitter's `formAction` if it's a button-like element with the attribute set:

After the `getSubmissionForm` and `canSubmitForm` helper definitions (still inside the evaluate callback) and before the `return` statement, modify the existing return to include `submitterActionUrl`:

```ts
const submitterActionUrl = (() => {
  if (!(el instanceof HTMLButtonElement) && !(el instanceof HTMLInputElement)) return null;
  // formaction attribute only meaningful on submit/image inputs and submit buttons
  if (el instanceof HTMLInputElement && el.type !== "submit" && el.type !== "image") return null;
  if (el instanceof HTMLButtonElement && el.type !== "submit") return null;
  if (!el.hasAttribute("formaction")) return null;
  // formAction property resolves to an absolute URL when attribute is set
  return el.formAction || null;
})();

return {
  submitterRef,
  formId: form.id || null,
  actionUrl: form.action || null,
  submitterActionUrl,
  method: form.method?.toLowerCase() || null,
  fields,
};
```

- [ ] **Step 5: Run test, verify it passes**

Run: `pnpm --dir packages/core exec vitest run test/playwrightBrowser.test.ts -t "submitterActionUrl"`
Expected: PASS.

Run: `pnpm --filter pilo-core run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/browser/ariaBrowser.ts packages/core/src/browser/playwrightBrowser.ts packages/core/test/playwrightBrowser.test.ts
git commit -m "feat(core): expose submitter formaction override on FormSubmissionContext"
```

---

## Task 4: Add `FIREWALL_BLOCKED_NON_INTERACTIVE` event type

**Files:**
- Modify: `packages/core/src/events.ts`

- [ ] **Step 1: Add the event type enum value**

In `packages/core/src/events.ts`, locate `enum WebAgentEventType` (around line 9) and add the new value at the end of the enum, before the closing brace:

```ts
  // Firewall events
  FIREWALL_BLOCKED_NON_INTERACTIVE = "firewall:blocked_non_interactive",
```

- [ ] **Step 2: Add the data type for the event**

Still in `packages/core/src/events.ts`, after the existing event-data interfaces (search for the file pattern; add the new interface in the same style as e.g. `BrowserActionResultEventData`):

```ts
export type FirewallRemediation =
  | { kind: "add-trusted-hostnames"; hostnames: string[]; description: string }
  | { kind: "enable-interactive-mode"; description: string }
  | { kind: "enable-unsafe-mode"; description: string };

export interface FirewallBlockedNonInteractiveEventData extends WebAgentEventData {
  reason: string;
  kind: "freeform-fill" | "form-submission";
  pageHostname: string | null;
  formActionHostnames: string[];
  remediations: FirewallRemediation[];
}
```

- [ ] **Step 3: Add the event to the discriminated union**

In `packages/core/src/events.ts`, locate the `WebAgentEvent` discriminated union (the long `|`-chain starting around line 370). Add a new arm at the end of the union:

```ts
  | {
      type: WebAgentEventType.FIREWALL_BLOCKED_NON_INTERACTIVE;
      data: FirewallBlockedNonInteractiveEventData;
    };
```

If the union ends with a `;` after the last arm, place the new arm before that terminator. Match the file's existing punctuation exactly.

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter pilo-core run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/events.ts
git commit -m "feat(core): add FIREWALL_BLOCKED_NON_INTERACTIVE event type"
```

---

## Task 5: Plumb `firewall` and `interactive` into webActionTools and emit the event

**Files:**
- Modify: `packages/core/src/tools/webActionTools.ts`
- Modify: `packages/core/test/tools/webActionTools.test.ts`

- [ ] **Step 1: Write failing tool-level tests**

Append to `packages/core/test/tools/webActionTools.test.ts`. Use the same setup pattern as the existing tests in that file (look for `createWebActionTools` usage). Add tests:

```ts
import { WebAgentEventType, WebAgentEventEmitter } from "../../src/events.js";
import type { FirewallConfig } from "../../src/security/actionFirewall.js";

describe("webActionTools firewall bypass and remediation", () => {
  it("trustedHostnames allows freeform fill on a trusted page", async () => {
    const browser = createMockBrowser({
      getUrl: async () => "https://example.com/page",
      getFieldMetadata: async () => ({
        ref: "ref-1",
        tagName: "textarea",
        inputType: null,
        role: null,
        name: "comment",
        label: "Comment",
        placeholder: null,
        autocomplete: null,
        isContentEditable: false,
        formId: null,
        formAction: null,
        formMethod: null,
      }),
      performAction: vi.fn().mockResolvedValue(undefined),
    });
    const eventEmitter = new WebAgentEventEmitter();
    const firewall: FirewallConfig = {
      trustedHostnames: new Set(["example.com"]),
      unsafeMode: false,
    };

    const tools = createWebActionTools({
      browser,
      eventEmitter,
      providerConfig: stubProviderConfig,
      firewall,
      interactive: false,
      agentFilledRefs: new Set(),
      operationalRefs: new Set(),
    });

    const result = await tools.fill.execute({ ref: "ref-1", value: "hi" }, stubExecOptions);
    expect(result.success).toBe(true);
    expect(browser.performAction).toHaveBeenCalled();
  });

  it("unsafeMode allows fill of any field", async () => {
    const browser = createMockBrowser({
      getUrl: async () => "https://attacker.com/",
      getFieldMetadata: async () => ({
        ref: "ref-1",
        tagName: "textarea",
        inputType: null,
        role: null,
        name: "comment",
        label: "Comment",
        placeholder: null,
        autocomplete: null,
        isContentEditable: false,
        formId: null,
        formAction: null,
        formMethod: null,
      }),
      performAction: vi.fn().mockResolvedValue(undefined),
    });
    const eventEmitter = new WebAgentEventEmitter();
    const firewall: FirewallConfig = {
      trustedHostnames: new Set(),
      unsafeMode: true,
    };

    const tools = createWebActionTools({
      browser,
      eventEmitter,
      providerConfig: stubProviderConfig,
      firewall,
      interactive: false,
      agentFilledRefs: new Set(),
      operationalRefs: new Set(),
    });

    const result = await tools.fill.execute({ ref: "ref-1", value: "hi" }, stubExecOptions);
    expect(result.success).toBe(true);
  });

  it("emits FIREWALL_BLOCKED_NON_INTERACTIVE on fill block when interactive=false", async () => {
    const browser = createMockBrowser({
      getUrl: async () => "https://untrusted.com/",
      getFieldMetadata: async () => ({
        ref: "ref-1",
        tagName: "textarea",
        inputType: null,
        role: null,
        name: "comment",
        label: "Comment",
        placeholder: null,
        autocomplete: null,
        isContentEditable: false,
        formId: null,
        formAction: null,
        formMethod: null,
      }),
      performAction: vi.fn(),
    });
    const eventEmitter = new WebAgentEventEmitter();
    const events: unknown[] = [];
    eventEmitter.on(WebAgentEventType.FIREWALL_BLOCKED_NON_INTERACTIVE, (data) => events.push(data));

    const tools = createWebActionTools({
      browser,
      eventEmitter,
      providerConfig: stubProviderConfig,
      firewall: { trustedHostnames: new Set(), unsafeMode: false },
      interactive: false,
      agentFilledRefs: new Set(),
      operationalRefs: new Set(),
    });

    const result = await tools.fill.execute({ ref: "ref-1", value: "hi" }, stubExecOptions);
    expect(result.success).toBe(false);
    expect(browser.performAction).not.toHaveBeenCalled();
    expect(events).toHaveLength(1);
    const data = events[0] as {
      kind: string;
      pageHostname: string | null;
      remediations: Array<{ kind: string }>;
    };
    expect(data.kind).toBe("freeform-fill");
    expect(data.pageHostname).toBe("untrusted.com");
    expect(data.remediations.map((r) => r.kind).sort()).toEqual(
      ["add-trusted-hostnames", "enable-interactive-mode", "enable-unsafe-mode"].sort(),
    );
  });

  it("does NOT emit FIREWALL_BLOCKED_NON_INTERACTIVE when interactive=true", async () => {
    const browser = createMockBrowser({
      getUrl: async () => "https://untrusted.com/",
      getFieldMetadata: async () => ({
        ref: "ref-1",
        tagName: "textarea",
        inputType: null,
        role: null,
        name: "comment",
        label: "Comment",
        placeholder: null,
        autocomplete: null,
        isContentEditable: false,
        formId: null,
        formAction: null,
        formMethod: null,
      }),
      performAction: vi.fn(),
    });
    const eventEmitter = new WebAgentEventEmitter();
    const events: unknown[] = [];
    eventEmitter.on(WebAgentEventType.FIREWALL_BLOCKED_NON_INTERACTIVE, (data) => events.push(data));

    const tools = createWebActionTools({
      browser,
      eventEmitter,
      providerConfig: stubProviderConfig,
      firewall: { trustedHostnames: new Set(), unsafeMode: false },
      interactive: true,
      agentFilledRefs: new Set(),
      operationalRefs: new Set(),
    });

    const result = await tools.fill.execute({ ref: "ref-1", value: "hi" }, stubExecOptions);
    expect(result.success).toBe(false);
    expect(events).toHaveLength(0);
  });

  it("model-visible error string does not include unsafe_mode or trusted_hostnames", async () => {
    const browser = createMockBrowser({
      getUrl: async () => "https://untrusted.com/",
      getFieldMetadata: async () => ({
        ref: "ref-1",
        tagName: "textarea",
        inputType: null,
        role: null,
        name: "comment",
        label: "Comment",
        placeholder: null,
        autocomplete: null,
        isContentEditable: false,
        formId: null,
        formAction: null,
        formMethod: null,
      }),
      performAction: vi.fn(),
    });
    const tools = createWebActionTools({
      browser,
      eventEmitter: new WebAgentEventEmitter(),
      providerConfig: stubProviderConfig,
      firewall: { trustedHostnames: new Set(), unsafeMode: false },
      interactive: false,
      agentFilledRefs: new Set(),
      operationalRefs: new Set(),
    });

    const result = await tools.fill.execute({ ref: "ref-1", value: "hi" }, stubExecOptions);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).not.toMatch(/unsafe_mode|trusted_hostnames|untrusted\.com/);
  });
});
```

If `createMockBrowser`, `stubProviderConfig`, and `stubExecOptions` aren't already defined in the test file, follow the patterns used in existing tests in that same file. If `getUrl` is not already part of the mock-browser pattern, extend the mock factory to accept and return it.

- [ ] **Step 2: Run tests, verify they fail**

Run: `pnpm --dir packages/core exec vitest run test/tools/webActionTools.test.ts -t "firewall bypass"`
Expected: FAIL — `WebActionContext` does not accept `firewall` or `interactive`, event is not emitted.

- [ ] **Step 3: Extend `WebActionContext` and wire firewall + interactive into handlers**

In `packages/core/src/tools/webActionTools.ts`:

3a. Add imports (top of file):

```ts
import {
  assessFill,
  assessFormSubmission,
  extractHostname,
  type FirewallConfig,
} from "../security/actionFirewall.js";
import type {
  FirewallBlockedNonInteractiveEventData,
  FirewallRemediation,
} from "../events.js";
```

Replace the existing import line that brought in `assessFill, assessFormSubmission` with this combined import.

3b. Extend `WebActionContext` (around line 24):

```ts
interface WebActionContext {
  browser: AriaBrowser;
  eventEmitter: WebAgentEventEmitter;
  providerConfig: ProviderConfig;
  abortSignal?: AbortSignal;
  approvedRefs?: ReadonlySet<string>;
  agentFilledRefs: Set<string>;
  operationalRefs: Set<string>;
  firewall: FirewallConfig;
  interactive: boolean;
}
```

3c. Add a remediation builder helper (top of file, after `EMPTY_APPROVED_REFS`):

```ts
function buildRemediations(blockedHostnames: string[]): FirewallRemediation[] {
  const uniqueHosts = Array.from(new Set(blockedHostnames.filter((h): h is string => Boolean(h))));
  return [
    {
      kind: "add-trusted-hostnames",
      hostnames: uniqueHosts,
      description:
        uniqueHosts.length > 0
          ? `Add ${uniqueHosts.join(", ")} to trusted_hostnames to allow this action on this site.`
          : "Add the page hostname to trusted_hostnames to allow this action on this site.",
    },
    {
      kind: "enable-interactive-mode",
      description:
        "Run in interactive mode by providing a UserDataCallback so the agent can ask the user to approve sensitive fields per-action via request_user_data.",
    },
    {
      kind: "enable-unsafe-mode",
      description:
        "Set unsafe_mode=true to disable the action firewall entirely. WARNING: prompt injection from page content can then drive the agent to submit any field, including personal and credential data, to attacker-controlled forms.",
    },
  ];
}

function emitNonInteractiveBlock(
  context: WebActionContext,
  kind: "freeform-fill" | "form-submission",
  reason: string,
  pageHostname: string | null,
  formActionHostnames: string[],
): void {
  if (context.interactive) return;
  const data: FirewallBlockedNonInteractiveEventData = {
    timestamp: Date.now(),
    iterationId: "", // populated by the eventEmitter middleware that adds iterationId; if no middleware, leave empty
    reason,
    kind,
    pageHostname,
    formActionHostnames,
    remediations: buildRemediations(
      pageHostname === null ? formActionHostnames : [pageHostname, ...formActionHostnames],
    ),
  };
  context.eventEmitter.emit(WebAgentEventType.FIREWALL_BLOCKED_NON_INTERACTIVE, data);
}
```

If the existing event emit pattern in the file sets `iterationId` via a wrapper (search for `iterationId:` in this file), match that pattern.

3d. Update the `fill.execute` handler (around line 228) to compute page hostname and call the assessment with bypass inputs, and emit on block:

Replace the existing `fill.execute` body with:

```ts
execute: async ({ ref, value }) => {
  try {
    const [metadata, pageUrl] = await Promise.all([
      context.browser.getFieldMetadata(ref),
      context.browser.getUrl(),
    ]);
    const pageHostname = extractHostname(pageUrl);
    const userApproved = Boolean(context.approvedRefs?.has(ref));
    const assessment = assessFill({
      field: metadata,
      source: userApproved ? "user-approved" : "agent",
      pageHostname,
      firewall: context.firewall,
    });

    if (!assessment.allowed) {
      emitNonInteractiveBlock(context, "freeform-fill", assessment.reason, pageHostname, []);
      return failedActionResult(PageAction.Fill, assessment.reason, context, ref);
    }

    const result = await performActionWithValidation(PageAction.Fill, context, ref, value);
    if (result.success && !userApproved) {
      context.agentFilledRefs.add(ref);
      if (assessment.operational) {
        context.operationalRefs.add(ref);
      }
    }
    return result;
  } catch (error) {
    if (error instanceof BrowserException) {
      return failedActionResult(PageAction.Fill, error.message, context, ref);
    }
    throw error;
  }
},
```

3e. Update `assessFormSubmissionForAction` (around line 78) similarly:

```ts
async function assessFormSubmissionForAction(
  action: PageAction.Click | PageAction.Enter,
  context: WebActionContext,
  ref: string,
): Promise<ActionResult | null> {
  try {
    const [form, pageUrl] = await Promise.all([
      context.browser.getFormSubmissionContext(
        ref,
        action === PageAction.Click ? "click" : "enter",
      ),
      context.browser.getUrl(),
    ]);
    if (!form) return null;
    const pageHostname = extractHostname(pageUrl);
    const formActionHostnames = [
      extractHostname(form.actionUrl),
      extractHostname(form.submitterActionUrl),
    ].filter((h): h is string => h !== null);

    const assessment = assessFormSubmission({
      form,
      approvedRefs: context.approvedRefs ?? EMPTY_APPROVED_REFS,
      agentFilledRefs: context.agentFilledRefs,
      operationalRefs: context.operationalRefs,
      pageHostname,
      firewall: context.firewall,
    });

    if (!assessment.allowed) {
      emitNonInteractiveBlock(
        context,
        "form-submission",
        assessment.reason,
        pageHostname,
        formActionHostnames,
      );
      return failedActionResult(action, assessment.reason, context, ref);
    }
  } catch (error) {
    if (error instanceof BrowserException) {
      return failedActionResult(action, error.message, context, ref);
    }
    throw error;
  }

  return null;
}
```

3f. Confirm the `createWebActionTools` guard around line 203 still validates required fields. Update it to include `firewall`:

```ts
export function createWebActionTools(context: WebActionContext) {
  if (!context.agentFilledRefs || !context.operationalRefs) {
    throw new Error("Web action provenance tracking sets are required");
  }
  if (!context.firewall) {
    throw new Error("FirewallConfig is required on WebActionContext");
  }
  if (typeof context.interactive !== "boolean") {
    throw new Error("interactive flag is required on WebActionContext");
  }
  ...
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `pnpm --dir packages/core exec vitest run test/tools/webActionTools.test.ts -t "firewall bypass"`
Expected: PASS.

Run: `pnpm --filter pilo-core run typecheck`
Expected: FAIL — `webAgent.ts` does not yet pass `firewall` or `interactive` to `createWebActionTools`. This is fixed in Task 6.

- [ ] **Step 5: Commit (typecheck failure intentional until Task 6)**

```bash
git add packages/core/src/tools/webActionTools.ts packages/core/test/tools/webActionTools.test.ts
git commit -m "feat(core): plumb FirewallConfig and interactive flag into web action tools"
```

---

## Task 6: WebAgent option additions and FirewallConfig construction

**Files:**
- Modify: `packages/core/src/webAgent.ts`
- Modify: `packages/core/test/webAgent.test.ts`

- [ ] **Step 1: Write failing integration tests**

Append to `packages/core/test/webAgent.test.ts`. Locate the existing test setup pattern (`createWebAgent` / `WebAgent.execute` style) and add:

```ts
describe("WebAgent firewall options", () => {
  it("trustedHostnames flows into firewall config", async () => {
    // Setup an agent with trustedHostnames=["example.com"].
    // Mock the model to issue a fill action on a textarea on a page at https://example.com/.
    // Assert: the fill is allowed and the action result is success.
  });

  it("unsafeMode flows into firewall config", async () => {
    // Setup an agent with unsafeMode=true.
    // Mock the model to issue a fill on a textarea on https://untrusted.com/.
    // Assert: the fill is allowed.
  });

  it("invalid hostname in trustedHostnames throws at agent construction", () => {
    expect(() => createWebAgent({ trustedHostnames: ["bad value"] })).toThrow(/Invalid hostname/);
  });

  it("interactive flag is set from onUserDataRequired presence", async () => {
    // Setup an agent without onUserDataRequired. Trigger a firewall-blocked fill.
    // Assert: FIREWALL_BLOCKED_NON_INTERACTIVE is emitted.

    // Setup another agent with a stub onUserDataRequired. Trigger a firewall-blocked fill.
    // Assert: FIREWALL_BLOCKED_NON_INTERACTIVE is NOT emitted.
  });

  it("existing prompt-injection regression still blocks on non-trusted page with both bypasses off", async () => {
    // Existing regression scenario from the prior plan: ensure it still blocks.
  });
});
```

Replace the commented assertions with actual code following the conventions used elsewhere in `webAgent.test.ts`. Look at the existing `prompt injection` regression test to see how the model and browser are mocked.

- [ ] **Step 2: Run tests, verify they fail**

Run: `pnpm --dir packages/core exec vitest run test/webAgent.test.ts -t "WebAgent firewall options"`
Expected: FAIL — options don't exist.

- [ ] **Step 3: Add the new options to `WebAgentOptions` and build `FirewallConfig`**

In `packages/core/src/webAgent.ts`:

3a. Add imports (top of file):

```ts
import {
  normalizeHostname,
  type FirewallConfig,
} from "./security/actionFirewall.js";
```

3b. Extend `WebAgentOptions` (around line 66). Add two new fields with TSDoc warnings:

```ts
/**
 * Hostnames where the action firewall is bypassed for fills and submissions.
 *
 * @warning On listed hosts, prompt injection from page content can drive the
 * agent to fill and submit any field, including personal and credential data.
 * Use only for sites you fully trust to receive your data. The bypass applies
 * only when the current page hostname AND every form-action hostname (the
 * form's `action` plus any submitter `formaction` override) are all in this
 * list.
 */
trustedHostnames?: readonly string[];

/**
 * Disables the action firewall entirely.
 *
 * @warning When true, prompt injection from page content can cause the agent
 * to submit your data, including credentials, personal information, and
 * conversation context, to attacker-controlled forms. Only enable for
 * trusted, controlled environments.
 */
unsafeMode?: boolean;
```

3c. Build a frozen `FirewallConfig` at task setup. Locate the section of `WebAgent` constructor or task-start path where other config-like values are normalized (search for `options.guardrails` or similar pattern). Add a helper near the top of the class or as a module function:

```ts
function buildFirewallConfig(options: WebAgentOptions): FirewallConfig {
  const rawHostnames = options.trustedHostnames ?? [];
  const normalized = rawHostnames.map((entry) => normalizeHostname(entry));
  return Object.freeze({
    trustedHostnames: new Set(normalized),
    unsafeMode: Boolean(options.unsafeMode),
  });
}
```

3d. Wire `FirewallConfig` and `interactive` into the `createWebActionTools` call. Locate the existing call (around line 407 — search for `createWebActionTools(`) and update:

```ts
const firewall = buildFirewallConfig(options);
const interactive = Boolean(options.onUserDataRequired);

...

const webActionTools = createWebActionTools({
  browser,
  eventEmitter,
  providerConfig: options.providerConfig,
  abortSignal,
  approvedRefs: approvedRefs ?? undefined,
  agentFilledRefs,
  operationalRefs,
  firewall,
  interactive,
});
```

If the existing structure builds `WebActionContext` differently (e.g., a constructor pattern), match that pattern. `firewall` and `interactive` must be set before `createWebActionTools` is called.

Ensure `buildFirewallConfig` runs synchronously before the agent loop starts so a bad hostname surfaces immediately to the caller.

- [ ] **Step 4: Run tests, verify they pass**

Run: `pnpm --dir packages/core exec vitest run test/webAgent.test.ts -t "WebAgent firewall options"`
Expected: PASS.

Run: `pnpm --filter pilo-core run typecheck`
Expected: PASS.

Run: `pnpm --filter pilo-core run test`
Expected: PASS (existing tests should still pass; regression test should still block).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/webAgent.ts packages/core/test/webAgent.test.ts
git commit -m "feat(core): add trustedHostnames and unsafeMode to WebAgentOptions"
```

---

## Task 7: Config defaults — `trusted_hostnames` and `unsafe_mode`

**Files:**
- Modify: `packages/core/src/config/defaults.ts`
- Modify: `packages/core/test/config/*.test.ts` (add tests next to existing config tests)

- [ ] **Step 1: Write failing config tests**

Look in `packages/core/test/config/` for an existing test file (e.g., `defaults.test.ts` or similar). If none exists for parsing, create `packages/core/test/config/defaults.test.ts`. Add:

```ts
import { describe, it, expect } from "vitest";
import { FIELDS, DEFAULTS } from "../../src/config/defaults.js";

describe("config defaults: firewall fields", () => {
  it("declares trusted_hostnames as string[] with empty default", () => {
    expect(FIELDS.trusted_hostnames).toBeDefined();
    expect(FIELDS.trusted_hostnames.type).toBe("string[]");
    expect(FIELDS.trusted_hostnames.category).toBe("action");
    expect(DEFAULTS.trusted_hostnames).toEqual([]);
  });

  it("declares unsafe_mode as boolean with false default", () => {
    expect(FIELDS.unsafe_mode).toBeDefined();
    expect(FIELDS.unsafe_mode.type).toBe("boolean");
    expect(FIELDS.unsafe_mode.category).toBe("action");
    expect(DEFAULTS.unsafe_mode).toBe(false);
  });

  it("trusted_hostnames description warns about data risk", () => {
    expect(FIELDS.trusted_hostnames.description).toMatch(/WARNING/);
    expect(FIELDS.trusted_hostnames.description.toLowerCase()).toContain("trust");
  });

  it("unsafe_mode description warns about data risk", () => {
    expect(FIELDS.unsafe_mode.description).toMatch(/WARNING/);
    expect(FIELDS.unsafe_mode.description.toLowerCase()).toContain("firewall");
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `pnpm --dir packages/core exec vitest run test/config/defaults.test.ts -t "firewall fields"`
Expected: FAIL — fields not declared.

- [ ] **Step 3: Add the fields to `PiloConfig`, `PiloConfigWithDefaults`, `FIELDS`, and `DEFAULTS`**

In `packages/core/src/config/defaults.ts`:

3a. Add to the `PiloConfig` input interface (find the existing `action` block; add after `action_timeout_ms`):

```ts
trusted_hostnames?: string[];
unsafe_mode?: boolean;
```

3b. Add to the `PiloConfigWithDefaults` resolved interface (mirror the same position):

```ts
trusted_hostnames: string[];
unsafe_mode: boolean;
```

3c. Add to the `FIELDS` registry (after the `action_timeout_ms` entry, in the same `action` category block):

```ts
trusted_hostnames: {
  default: [],
  type: "string[]",
  cli: "--trusted-hostnames",
  placeholder: "host1,host2,...",
  env: ["PILO_TRUSTED_HOSTNAMES"],
  description:
    "Comma-separated hostnames where the action firewall is bypassed for fills and submissions. WARNING: on listed hosts, prompt injection from page content can drive the agent to fill and submit any field, including personal and credential data. Use only for sites you fully trust to receive your data.",
  category: "action",
},
unsafe_mode: {
  default: false,
  type: "boolean",
  cli: "--unsafe",
  env: ["PILO_UNSAFE_MODE"],
  description:
    "Disables the action firewall entirely. WARNING: prompt injection from page content can then cause the agent to submit your data, including credentials, personal info, and conversation context, to attacker-controlled forms. Only enable for trusted, controlled environments.",
  category: "action",
},
```

3d. Add to the `DEFAULTS` constant (mirror position):

```ts
trusted_hostnames: [],
unsafe_mode: false,
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `pnpm --dir packages/core exec vitest run test/config/defaults.test.ts -t "firewall fields"`
Expected: PASS.

Run: `pnpm --filter pilo-core run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/config/defaults.ts packages/core/test/config/defaults.test.ts
git commit -m "feat(core): add trusted_hostnames and unsafe_mode config fields"
```

---

## Task 8: CLI + env wiring (verify no code changes needed)

**Files:**
- Verify: `packages/core/src/config/commander.ts`
- Verify: `packages/core/src/config/env.ts`
- Modify: `packages/core/test/config/` (add CLI + env tests if not present)

The generic `addConfigOptions` in `commander.ts` and `parseEnvConfig` in `env.ts` already handle `string[]` and `boolean` field types. No source changes are expected — verify by test.

- [ ] **Step 1: Write CLI tests**

Add to (or create) `packages/core/test/config/commander.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { Command } from "commander";
import { addConfigOptions } from "../../src/config/commander.js";

describe("CLI: firewall flags", () => {
  it("parses --trusted-hostnames as comma-separated list", () => {
    const cmd = new Command().exitOverride();
    addConfigOptions(cmd);
    cmd.action(() => {});
    cmd.parse(["node", "test", "--trusted-hostnames", "a.com,b.com"]);
    const opts = cmd.opts();
    expect(opts.trustedHostnames).toEqual(["a.com", "b.com"]);
  });

  it("parses --unsafe as boolean true", () => {
    const cmd = new Command().exitOverride();
    addConfigOptions(cmd);
    cmd.action(() => {});
    cmd.parse(["node", "test", "--unsafe"]);
    const opts = cmd.opts();
    expect(opts.unsafe).toBe(true);
  });
});
```

(Commander converts kebab-case flags to camelCase option keys: `--trusted-hostnames` → `trustedHostnames`, `--unsafe` → `unsafe`.)

- [ ] **Step 2: Write env tests**

Add to (or create) `packages/core/test/config/env.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { parseEnvConfig } from "../../src/config/env.js";

describe("env: firewall fields", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.PILO_TRUSTED_HOSTNAMES;
    delete process.env.PILO_UNSAFE_MODE;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("parses PILO_TRUSTED_HOSTNAMES as comma-separated list", () => {
    process.env.PILO_TRUSTED_HOSTNAMES = "a.com,b.com";
    const result = parseEnvConfig();
    expect(result.trusted_hostnames).toEqual(["a.com", "b.com"]);
  });

  it("parses PILO_UNSAFE_MODE=true as boolean true", () => {
    process.env.PILO_UNSAFE_MODE = "true";
    const result = parseEnvConfig();
    expect(result.unsafe_mode).toBe(true);
  });

  it("ignores PILO_UNSAFE_MODE when unset", () => {
    const result = parseEnvConfig();
    expect(result.unsafe_mode).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run tests, verify they pass without any source change**

Run: `pnpm --dir packages/core exec vitest run test/config/commander.test.ts`
Run: `pnpm --dir packages/core exec vitest run test/config/env.test.ts`
Expected: PASS for both.

If they fail with an unexpected reason (not "expected" vs "received"), investigate whether `addConfigOptions` or `parseEnvConfig` needs adjustment. They should not.

- [ ] **Step 4: Commit**

```bash
git add packages/core/test/config/commander.test.ts packages/core/test/config/env.test.ts
git commit -m "test(core): verify CLI flags and env vars for firewall config"
```

---

## Task 9: CLI consumer — pass config to WebAgent and print remediation footer

**Files:**
- Modify: `packages/cli/src/commands/run.ts`
- Test: `packages/cli/test/commands/run.test.ts` (if test pattern exists; otherwise add a minimal unit test for the footer printer)

- [ ] **Step 1: Locate the WebAgent construction in `pilo run`**

Run: `grep -n "new WebAgent\|WebAgent(" packages/cli/src/commands/run.ts`

Find the call where options are passed to `WebAgent` from the merged config. Add `trustedHostnames` and `unsafeMode`:

```ts
const agent = new WebAgent({
  ...existingOptions,
  trustedHostnames: config.trusted_hostnames,
  unsafeMode: config.unsafe_mode,
});
```

(Use the actual variable names from the file.)

- [ ] **Step 2: Subscribe to the firewall event and print remediation**

Locate the existing event subscription pattern in `run.ts` (search for `eventEmitter.on(` or `eventEmitter.onEvent(`). Add a new subscriber:

```ts
import { WebAgentEventType, type FirewallBlockedNonInteractiveEventData } from "pilo-core";

// near the other eventEmitter.onEvent(...) calls:
eventEmitter.onEvent(
  WebAgentEventType.FIREWALL_BLOCKED_NON_INTERACTIVE,
  (data: FirewallBlockedNonInteractiveEventData) => {
    printFirewallRemediation(data);
  },
);
```

Add the helper near the bottom of the file (or in a small adjacent module if `run.ts` is large):

```ts
function printFirewallRemediation(data: FirewallBlockedNonInteractiveEventData): void {
  const lines: string[] = [];
  lines.push("");
  lines.push("Pilo: an action was blocked by the prompt-injection firewall.");
  lines.push(`Reason: ${data.reason}`);
  if (data.pageHostname || data.formActionHostnames.length > 0) {
    const hosts = [data.pageHostname, ...data.formActionHostnames]
      .filter((h): h is string => Boolean(h))
      .filter((h, i, a) => a.indexOf(h) === i);
    if (hosts.length > 0) {
      lines.push(`Hostnames involved: ${hosts.join(", ")}`);
    }
  }
  lines.push("To allow this action, you can:");
  for (const r of data.remediations) {
    if (r.kind === "add-trusted-hostnames") {
      const cmd =
        r.hostnames.length > 0
          ? `pilo config set trusted_hostnames ${r.hostnames.join(",")}`
          : "pilo config set trusted_hostnames <host>";
      lines.push(`  - ${r.description} Run: ${cmd}`);
    } else if (r.kind === "enable-interactive-mode") {
      lines.push(`  - ${r.description}`);
    } else if (r.kind === "enable-unsafe-mode") {
      lines.push(`  - ${r.description} Run: pilo config set unsafe_mode true`);
    }
  }
  // Use the project's existing logging convention. If the file uses console.warn for similar warnings,
  // use console.warn. Otherwise use the project logger.
  for (const line of lines) {
    console.warn(line);
  }
}
```

If the file uses a different logging primitive (e.g., a chalk-styled error stream), use that instead. The footer must be distinguishable from the model's tool-result line.

- [ ] **Step 3: Add a unit test for the footer printer**

If a test pattern exists for run.ts, add a test in the matching location. Otherwise, create `packages/cli/test/commands/run.test.ts` with a minimal test:

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { printFirewallRemediation } from "../../src/commands/run.js";
import type { FirewallBlockedNonInteractiveEventData } from "pilo-core";

describe("printFirewallRemediation", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("prints all three remediation options with the blocked hostname", () => {
    const data: FirewallBlockedNonInteractiveEventData = {
      timestamp: Date.now(),
      iterationId: "",
      reason: "Security policy blocked submitting a form containing unauthorized agent-filled data",
      kind: "form-submission",
      pageHostname: "untrusted.com",
      formActionHostnames: ["untrusted.com"],
      remediations: [
        {
          kind: "add-trusted-hostnames",
          hostnames: ["untrusted.com"],
          description: "Add untrusted.com to trusted_hostnames to allow this action on this site.",
        },
        {
          kind: "enable-interactive-mode",
          description: "Run in interactive mode by providing a UserDataCallback...",
        },
        {
          kind: "enable-unsafe-mode",
          description: "Set unsafe_mode=true to disable the action firewall entirely...",
        },
      ],
    };

    printFirewallRemediation(data);
    const output = warnSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(output).toContain("trusted_hostnames untrusted.com");
    expect(output).toContain("interactive mode");
    expect(output).toContain("unsafe_mode true");
    expect(output).toContain("untrusted.com");
  });
});
```

For this test to work, `printFirewallRemediation` must be exported from `run.ts` (add `export` to the function declaration).

- [ ] **Step 4: Run tests, verify they pass**

Run: `pnpm --filter pilo-cli run test`
Expected: PASS.

Run: `pnpm --filter pilo-cli run typecheck` (or `pnpm run typecheck` from the root if there is no per-package typecheck script)
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/commands/run.ts packages/cli/test/commands/run.test.ts
git commit -m "feat(cli): wire firewall config and print non-interactive remediation footer"
```

---

## Task 10: Documentation — TSDoc and README

**Files:**
- Modify: `README.md` (root)
- Verify TSDoc already added in Task 6 (`packages/core/src/webAgent.ts`)

- [ ] **Step 1: Add a "Security model" subsection to the root README**

Locate the existing top-level sections in `README.md`. Add a new subsection — placement is the project owner's call, but a reasonable spot is after the high-level "How it works" / "Features" section.

Append this subsection (adapt heading level to match the surrounding doc):

```markdown
## Security model

Pilo treats every web page as untrusted input. By default, the **action firewall** prevents the agent from filling freeform form fields (textareas, contact-info inputs, password fields, etc.) and from submitting any form containing agent-filled values that the user did not explicitly approve. This is the structural defense against prompt-injection attacks where a page tries to coax the agent into exfiltrating data via a form.

Two caller-supplied controls relax this protection. Both are off by default. **Enabling either weakens the firewall's data-protection guarantees.**

### `trusted_hostnames`

A list of hostnames on which the firewall is bypassed for fills and submissions. The bypass applies only when the current page hostname **and every form-action hostname** (the form's `action` plus any submitter `formaction` override) are all in the list.

```bash
pilo config set trusted_hostnames example.com,app.example.com
```

WARNING: on listed hosts, prompt injection from page content can drive the agent to fill and submit any field, including personal and credential data. Use only for sites you fully trust to receive your data.

### `unsafe_mode`

A global firewall disable. When enabled, neither the fill gate nor the submit gate applies, regardless of page or form-action hostname.

```bash
pilo config set unsafe_mode true
```

WARNING: prompt injection from page content can then cause the agent to submit your data, including credentials, personal information, and conversation context, to attacker-controlled forms. Only enable for trusted, controlled environments.

### Remediation when a block fires

When the firewall blocks a fill or submission and the agent is not running in interactive mode (no `UserDataCallback`), the CLI prints a footer listing the three ways the user can enable the workflow:

- Add the involved hostnames to `trusted_hostnames`.
- Run in interactive mode so the agent can request per-field approval through `request_user_data`.
- Enable `unsafe_mode` (with the data-protection warning above).

The footer is shown only to the user; the model that drives the agent never sees these remediation suggestions, so prompt-injected page content cannot ask the user to enable the bypasses.
```

- [ ] **Step 2: Verify TSDoc was added in Task 6**

Run: `grep -A 5 "trustedHostnames?:" packages/core/src/webAgent.ts`
Run: `grep -A 5 "unsafeMode?:" packages/core/src/webAgent.ts`
Expected: each shows a TSDoc block with `@warning` referencing the data-protection caveat.

If the TSDoc is missing or incomplete, add it now (copy from Task 6 Step 3b).

- [ ] **Step 3: Commit**

```bash
git add README.md packages/core/src/webAgent.ts
git commit -m "docs: document action firewall and bypass controls"
```

---

## Task 11: Final validation

**Files:** none (validation only)

- [ ] **Step 1: Format**

Run: `pnpm run format`
Expected: clean exit.

- [ ] **Step 2: Typecheck**

Run: `pnpm run typecheck`
Expected: PASS.

- [ ] **Step 3: Full test suite**

Run: `pnpm -r run test`
Expected: PASS.

- [ ] **Step 4: Format check**

Run: `pnpm run format:check`
Expected: PASS.

- [ ] **Step 5: Gitleaks scan**

Run: `gitleaks protect -v`
Expected: no leaks. If `gitleaks` is not installed locally, run `brew install gitleaks` first.

Run: `gitleaks detect -v`
Expected: no leaks. (Existing `.gitleaksignore` entries handle historical false positives.)

- [ ] **Step 6: Manual smoke test (one CLI run per bypass surface)**

Run: `pnpm pilo config set trusted_hostnames example.com`
Expected: persists; `pilo config get trusted_hostnames` prints `example.com`.

Run: `pnpm pilo config set trusted_hostnames "bad value"`
Expected: error message naming the bad entry; exit non-zero.

Run: `pnpm pilo config unset trusted_hostnames`
Expected: clean.

Run: `pnpm pilo --help | grep -E "trusted-hostnames|unsafe"`
Expected: both flags appear with their warning-laden descriptions.

- [ ] **Step 7: Commit any format-only changes**

```bash
git status
# if format made changes:
git add -A
git commit -m "chore: prettier pass after firewall bypass work"
```

---

## Out of scope

- Wildcard / subdomain matching for trusted hostnames.
- Per-field trust overrides beyond `request_user_data`.
- Runtime banner UI for bypassed actions (documentation is the compensating control).
- Reputation- or heuristic-based trust.

## Self-Review

- **Spec coverage:**
  - Trusted-hostname bypass conditions (page hostname + all form-action hostnames must match): covered in Task 2 (firewall logic) and Task 5 (tool plumbing).
  - `unsafeMode` global disable: Task 2, Task 5.
  - `submitterActionUrl` resolution: Task 3.
  - User-facing remediation on block in non-interactive mode: Task 5 (event emission) and Task 9 (CLI footer).
  - Model isolation (no remediation in tool result): Task 5 (test asserts `result.error` does not include `unsafe_mode`/`trusted_hostnames`/blocked hostnames).
  - Hostname normalization with validation at agent construction: Task 1 (helpers) and Task 6 (called from `buildFirewallConfig`).
  - Config field defaults: Task 7.
  - CLI/env wiring: Task 8 (verified via tests).
  - CLI consumer prints remediation: Task 9.
  - TSDoc + README: Tasks 6 and 10.
- **Placeholder scan:** none ("TBD", "TODO", "implement later" not present).
- **Type consistency:** `FirewallConfig`, `assessFill`, `assessFormSubmission` signatures match across tasks. `FirewallRemediation` shape matches between Task 4 (event-data type) and Task 5 (`buildRemediations`) and Task 9 (CLI printer). `FormSubmissionContext.submitterActionUrl` introduced in Task 3 and consumed in Tasks 2 and 5.
- **Compile-fix gap:** Task 5 ends in a deliberate `webAgent.ts` typecheck failure that Task 6 fixes. Implementers must execute Tasks 5 and 6 together (or accept the intermediate red typecheck between commits) rather than stopping at Task 5.

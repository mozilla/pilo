# Firewall Bypass Controls — Design

**Status:** Draft for review
**Date:** 2026-05-28
**Branch:** `stafford/tab-976-harden-pilo-against-web-content-prompt-injection`
**Builds on:** `docs/superpowers/plans/2026-05-26-prompt-injection-action-firewall.md`

## Problem

The prompt-injection action firewall is correct but uniform: it blocks every agent-driven freeform fill and every form submission containing agent-filled freeform values unless the field was approved through `request_user_data`. Callers have no way to relax this on sites they trust, and no way to disable it for controlled environments where the protections are not needed.

We need two caller-supplied controls:

1. **Trusted hostnames** — a list of hostnames on which the firewall is bypassed for both fill and submission.
2. **Unsafe mode** — a global switch that disables the firewall entirely.

Both controls must be opt-in, default off, and surfaced in documentation as data-protection opt-outs.

## Non-goals

- Heuristic trust (rating sites by domain reputation, autocomplete hints, etc.).
- Per-field trust granularity beyond what `request_user_data` already provides.
- Wildcard/subdomain matching, scheme matching, or port matching in the trusted-hostname list.
- Runtime warnings, banners, or per-action telemetry for bypassed actions.

## Security model

The bypass logic sits in front of the existing structural firewall. Order of evaluation:

1. If `unsafeMode` is true → `{ allowed: true }`.
2. Else if the bypass conditions for trusted hostnames are met → `{ allowed: true }`.
3. Else fall through to the existing structural rules (operational classification, approved refs, etc.).

### Trusted-hostname bypass conditions

- **Fill:** the current page hostname must be in the trusted set.
- **Submission:** the current page hostname AND every resolved form-action hostname (the form's `action` plus any submitter `formaction` override) must be in the trusted set.

A page on a non-http(s) URL (`about:blank`, `data:`, `file:`) has a `null` hostname and can never satisfy the bypass.

### Documented limitations

When either bypass is active, prompt injection in page content can drive the agent to fill and submit any field, including credentials, personal information, and conversation context, into forms hosted by the trusted site. The bypass is a deliberate opt-out of the firewall's data-protection guarantees. This is documented on every surface where the controls appear.

## Architecture

The action firewall is a pure policy module. The bypass adds one input — a `FirewallConfig` carrying caller state — and one set of short-circuit branches at the top of `assessFill` and `assessFormSubmission`. No new modules are required.

```
WebAgentOptions ──▶ WebAgent (normalize once at task start)
                            │
                            ▼
                     FirewallConfig (frozen)
                            │
                            ▼
                   WebActionContext.firewall
                            │
                            ▼
   webActionTools fill/click/enter handlers
                            │
                            ▼
         assessFill / assessFormSubmission
                            │
                            ▼
            short-circuit if bypass applies,
            otherwise existing structural rules
```

`browser.getUrl()` is queried once per action invocation to obtain the current page hostname. Form-action hostnames come from the existing `FormSubmissionContext` extended to carry the submitter's `formaction` override.

## Components

### `packages/core/src/security/actionFirewall.ts` — extended

New exported types:

```ts
export interface FirewallConfig {
  trustedHostnames: ReadonlySet<string>;
  unsafeMode: boolean;
}
```

New exported helpers:

```ts
export function normalizeHostname(input: string): string;
export function extractHostname(url: string | null): string | null;
export class InvalidHostnameError extends Error {}
```

`normalizeHostname`:

- Lowercases input.
- Strips a single trailing `.`.
- Rejects empty/whitespace strings, strings containing `/`, `:`, `*`, or whitespace.
- Rejects anything that parses with `new URL(input)` as having a scheme.
- Accepts bare hostnames including IDN punycode (`xn--mnich-kva.de`) and bare IPv4 literals (`127.0.0.1`).
- Rejects bracketed IPv6 (`[::1]`) and bare IPv6 in v1.
- Throws `InvalidHostnameError` with a message naming the bad entry on rejection.

`extractHostname`:

- Returns the lowercased hostname (trailing dot stripped) for absolute http/https URLs.
- Returns `null` for `null` input, malformed URLs, or non-http(s) schemes (`about:`, `data:`, `file:`, `javascript:`, etc.).

`assessFill` and `assessFormSubmission` gain two new fields on their input:

```ts
pageHostname: string | null;
firewall: FirewallConfig;
```

Bypass logic in both functions (in order):

1. If `firewall.unsafeMode` → `{ allowed: true }`.
2. Else compute trust: `pageHostname !== null && firewall.trustedHostnames.has(pageHostname)`.
   For `assessFormSubmission`, additionally require every form-action hostname (form action + submitter override) to be non-null and in `firewall.trustedHostnames`.
3. If trusted → `{ allowed: true }`.
4. Else fall through to the existing structural classification.

The existing structural classification logic is unchanged.

### `packages/core/src/browser/ariaBrowser.ts` — extended

`FormSubmissionContext` gains:

```ts
submitterActionUrl: string | null;
```

resolved to an absolute URL by the Playwright introspection layer. `actionUrl` remains the form's `action`, also resolved to absolute.

### `packages/core/src/browser/playwrightBrowser.ts` — updated

`getFormSubmissionContext` resolves both `actionUrl` and `submitterActionUrl` against the page's base URL. A missing `action` attribute defaults to the current page URL (matches browser semantics).

### `packages/core/src/tools/webActionTools.ts` — updated

`WebActionContext` gains:

```ts
firewall: FirewallConfig;
interactive: boolean;
```

`interactive` is set by `WebAgent` to `Boolean(options.onUserDataRequired)` and drives the remediation event described in the "User-facing remediation on block" section.

Tool handlers for `fill`, `click`, and `enter`:

1. Call `browser.getUrl()` once per invocation.
2. Pass the resulting page hostname (via `extractHostname`) and `firewall` into the firewall assessment alongside existing inputs.
3. When the assessment returns `allowed: false` and `interactive === false`, emit `FIREWALL_BLOCKED_NON_INTERACTIVE` with structured remediation context.
4. No other behavior changes to the model-visible result.

### `packages/core/src/webAgent.ts` — updated

`WebAgentOptions` gains:

```ts
trustedHostnames?: readonly string[];
unsafeMode?: boolean;
```

At task start, WebAgent constructs a frozen `FirewallConfig`:

- Each entry in `trustedHostnames` is passed through `normalizeHostname`. Validation errors propagate to the caller before the agent runs.
- `unsafeMode` defaults to `false`.

`FirewallConfig` is built once per task, threaded into `createWebActionTools`. It is not recomputed per iteration.

### `packages/core/src/config/defaults.ts` — extended

Two new fields in the `action` category:

| Key                 | Type       | Default | Description (short form)                                                                                                                                                                                                                                             |
| ------------------- | ---------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `trusted_hostnames` | `string[]` | `[]`    | Hostnames where the action firewall is bypassed for fills and submissions. WARNING: on listed hosts, page content can drive the agent to fill and submit any field, including personal and credential data. Use only for sites you fully trust to receive your data. |
| `unsafe_mode`       | `boolean`  | `false` | Disables the action firewall entirely. WARNING: web page content can then cause the agent to submit your data, including credentials, personal info, and conversation context, to attacker-controlled forms. Only enable for trusted, controlled environments.       |

The field parser for `trusted_hostnames` applies `normalizeHostname` to each entry. A bad entry surfaces at config load (during `pilo config set`, `pilo config show`, or `pilo run` startup), naming the invalid value.

### `packages/core/src/config/commander.ts` — extended

- `--trusted-hostname <host>` — repeatable, collected into an array.
- `--unsafe` — boolean flag.

Both options include the warning wording from the config descriptions.

### `packages/core/src/config/env.ts` — extended (dev mode only)

- `PILO_TRUSTED_HOSTNAMES` — comma-separated list.
- `PILO_UNSAFE_MODE` — `true`/`false`.

Production mode ignores env vars (existing invariant).

### `packages/cli/src/commands/run.ts` — updated

Reads the merged config, builds the `WebAgentOptions` with `trustedHostnames` and `unsafeMode` from config, and passes them into `WebAgent`. No special CLI UI for bypass state.

## User-facing remediation on block (non-interactive mode only)

When the firewall blocks an action and the agent is **not** in interactive mode (no `onUserDataRequired` callback), the user needs to know how to enable the blocked workflow. Pilo emits a structured remediation message to user-facing channels listing every available path forward, parameterized by the blocked action's context.

### Why interactive mode is the trigger

In interactive mode the agent already has a path forward: `request_user_data` escalates the missing approval to the user per field. The block is recoverable in-loop. No extra user-facing messaging is needed because the standard interactive flow handles it.

In non-interactive mode the block is terminal for that action. The user has no in-loop recourse, so we surface the configuration paths they can take to allow the action on a future run.

### What is shown

A `FIREWALL_BLOCKED_NON_INTERACTIVE` event is emitted on the `WebAgentEventEmitter` with structured context:

```ts
interface FirewallBlockedNonInteractiveEventData {
  reason: string; // policy reason (no field values)
  kind: "freeform-fill" | "form-submission";
  pageHostname: string | null;
  formActionHostnames: string[]; // empty for fills
  remediations: FirewallRemediation[];
}

type FirewallRemediation =
  | { kind: "enable-interactive-mode"; description: string }
  | { kind: "add-trusted-hostnames"; hostnames: string[]; description: string }
  | { kind: "enable-unsafe-mode"; description: string };
```

The CLI subscribes to this event and prints a human-readable footer after the model's tool-result line. SDK callers and pilo-server can subscribe to surface the structured remediation to their end users.

The three remediations are always included, in this order:

1. **`add-trusted-hostnames`** — lists the page hostname and (for submissions) every form-action hostname the user would need to add. Includes the literal command `pilo config set trusted_hostnames <host> [...]` and the SDK-equivalent option name.
2. **`enable-interactive-mode`** — instructs the caller to provide a `UserDataCallback` (`onUserDataRequired`) so the agent can request explicit user approval per field via `request_user_data`.
3. **`enable-unsafe-mode`** — disables the firewall entirely, with the documented data-protection warning.

The remediations omit any reference to the attempted field value, consistent with the existing "no field values in errors" invariant.

### Model isolation

The structured remediation context is emitted to user-facing channels only. It is **not** included in the `ActionResult.error` string that goes back to the model as a tool result. The model-visible string remains the existing policy reason (`SECURITY_BLOCKED_UNAUTHORIZED_FILL` / `SECURITY_BLOCKED_UNAUTHORIZED_SUBMIT`). This prevents prompt-injected page content from coaxing the model to suggest that the user enable `unsafe_mode` or add the attacker's hostname to `trusted_hostnames`.

### Implementation surfaces

- **`packages/core/src/events.ts`** — adds `FIREWALL_BLOCKED_NON_INTERACTIVE` to `WebAgentEventType` and the corresponding event data type.
- **`packages/core/src/tools/webActionTools.ts`** — when a firewall assessment returns `allowed: false`:
  - Resolves the page hostname (already computed for the assessment).
  - For submissions, collects every form-action hostname.
  - Reads `context.interactive: boolean` (new field on `WebActionContext`, set by `WebAgent` based on the presence of `onUserDataRequired`).
  - If `interactive === false`, emits `FIREWALL_BLOCKED_NON_INTERACTIVE` with the structured remediation list.
  - The tool's `ActionResult.error` continues to carry only the model-visible policy reason.
- **`packages/core/src/webAgent.ts`** — populates `WebActionContext.interactive` from `Boolean(options.onUserDataRequired)`.
- **`packages/cli/src/commands/run.ts`** — listens for `FIREWALL_BLOCKED_NON_INTERACTIVE` and prints a remediation footer formatted for the terminal. The footer is distinct from the model's tool-output line and marked clearly as a Pilo-side hint.

### Tests

- Non-interactive mode + firewall block → `FIREWALL_BLOCKED_NON_INTERACTIVE` event emitted with both blocked hostnames and all three remediations populated.
- Interactive mode + firewall block → no `FIREWALL_BLOCKED_NON_INTERACTIVE` event.
- Model-visible `ActionResult.error` does **not** contain `unsafe_mode`, `trusted_hostnames`, or the blocked hostnames in either mode.
- CLI integration test: a non-interactive run that triggers a block prints a remediation footer naming the host that would need to be added.

## Documentation surfaces

The following surfaces include the explicit warning that bypassing the firewall removes data-protection guarantees. Wording is consistent across surfaces.

- Config descriptions for `trusted_hostnames` and `unsafe_mode` (printed by `pilo config list` / `pilo config show`).
- CLI help text for `--trusted-hostname` and `--unsafe`.
- TSDoc on the new `WebAgentOptions` fields, including `@warning` blocks so warnings surface in IDE tooltips.
- A new "Security model" subsection in the root README documenting the firewall and naming both bypasses as deliberate data-protection opt-outs. This section also describes the non-interactive-mode remediation footer so users running the CLI know what to expect when a block surfaces.

Documentation is the compensating control for the silent-observability decision on **bypassed** actions: there is no runtime banner or per-action telemetry when a bypass is in effect, so it must be unambiguous in docs that turning these on weakens protections. Blocked actions in non-interactive mode are the inverse case — they are deliberately verbose at the user-facing layer so the user can choose a path forward.

## Error handling

- **Invalid hostname at config load** — `normalizeHostname` throws `InvalidHostnameError` with a message naming the bad entry. CLI surfaces the message and exits non-zero before the agent runs.
- **`browser.getUrl()` failure** — treated as `pageHostname = null`. Bypass cannot apply; existing structural rules run as today.
- **Form action URL resolution failure** — treated as `null` hostname for that action. Bypass cannot apply for that submission; falls through to structural rules.
- **Both `unsafeMode` and `trustedHostnames` set** — `unsafeMode` short-circuits first; `trustedHostnames` is moot.

## Backwards compatibility

- Both new fields default to safe values (`false`, `[]`).
- Existing config files and existing callers require no changes.
- The bypass branches are additive; the structural classification is untouched when neither bypass applies.

## Testing

### Pure firewall tests — `packages/core/test/security/actionFirewall.test.ts`

- `normalizeHostname`: accepts bare hostnames; lowercases; strips trailing dot; rejects schemes, paths, wildcards, whitespace, empty.
- `extractHostname`: returns hostname for http(s); returns `null` for `about:blank`, `data:`, `file:`, malformed input, `null` input.
- `assessFill` with `unsafeMode=true` → allowed for any field regardless of source.
- `assessFill` with trusted page hostname → allowed for freeform field that would otherwise block.
- `assessFill` with untrusted page hostname → falls through to existing rules.
- `assessFill` with `pageHostname=null` → never bypasses (even if `""` were in trusted set).
- `assessFormSubmission` with `unsafeMode=true` → allowed for any form.
- `assessFormSubmission` with trusted page + all form-action hostnames trusted → allowed.
- `assessFormSubmission` with trusted page + one form-action hostname untrusted → falls through and blocks.
- `assessFormSubmission` with trusted page + `null` form-action hostname → falls through.
- `assessFormSubmission` with untrusted page + trusted form-action → falls through.
- `assessFormSubmission` checks both `actionUrl` and `submitterActionUrl`.

### Tool-level tests — `packages/core/test/tools/webActionTools.test.ts`

- Fill of textarea on trusted page → allowed without `request_user_data`.
- Fill of textarea on untrusted page → blocked as today.
- Click submit on trusted page with form action on same trusted host → allowed.
- Click submit on trusted page with form action on untrusted host → blocked.
- `unsafeMode=true` → fill/submit allowed on any page including freeform fields and untrusted form actions.
- Blocked results never include the attempted field value (existing invariant preserved).

### Config tests — under `packages/core/test/config/`

- `pilo config set trusted_hostnames a.com b.com` persists normalized list.
- Invalid entry throws at parse time, naming the bad entry.
- CLI `--trusted-hostname example.com --trusted-hostname app.example.com` builds an array.
- CLI `--unsafe` flips the boolean.
- Env (dev mode): `PILO_TRUSTED_HOSTNAMES="a.com,b.com"` parses to array; `PILO_UNSAFE_MODE=true` flips boolean.
- Production mode ignores env (existing invariant).

### WebAgent integration tests — `packages/core/test/webAgent.test.ts`

- Options-supplied `trustedHostnames` plumbs through to tool context and gates as expected on a fake page.
- Options-supplied `unsafeMode=true` bypasses both gates end-to-end.
- Regression: existing prompt-injection test still blocks on a non-trusted page with both bypasses off.

## Out of scope

- Wildcard / subdomain matching.
- Per-field trust override beyond `request_user_data`.
- Runtime warning UI when a bypass is active (documentation is the compensating control).
- Reputation-based or heuristic trust.

## Open questions

None at design time. Implementation may surface platform-specific edge cases in URL resolution under Playwright; those will be addressed during the build-out.

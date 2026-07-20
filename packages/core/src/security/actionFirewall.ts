import type { FieldMetadata, FormSubmissionContext } from "../browser/ariaBrowser.js";

export const SECURITY_BLOCKED_UNAUTHORIZED_FILL =
  "Security policy blocked filling a submittable form field without user approval";

export const SECURITY_BLOCKED_UNAUTHORIZED_SUBMIT =
  "Security policy blocked submitting a form containing unauthorized agent-filled data";

export const SECURITY_BLOCKED_CROSS_SITE_OPERATIONAL_SUBMIT =
  "Security policy blocked submitting operational field data to a site other than the current page";

export const SECURITY_BLOCKED_UNTRUSTED_NAVIGATION =
  "Security policy blocked navigation to a host the caller did not name";

export const SECURITY_BLOCKED_UNTRUSTED_DATA_FILL =
  "Security policy blocked placing caller-provided data on a host the caller did not name";

export type FillSource = "agent" | "user-approved";

export type ActionFirewallResult =
  | { allowed: true; operational?: boolean }
  | { allowed: false; reason: string; isRecoverable: true };

export interface FirewallConfig {
  trustedHostnames: ReadonlySet<string>;
  unsafeMode: boolean;
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

  if (input.pageHostname !== null && input.firewall.trustedHostnames.has(input.pageHostname)) {
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
    const formActionHost = extractHostname(input.form.actionUrl);
    const submitterActionHost = extractHostname(input.form.submitterActionUrl);

    const formActionTrusted =
      formActionHost !== null && input.firewall.trustedHostnames.has(formActionHost);

    const submitterTrusted =
      input.form.submitterActionUrl === null
        ? true
        : submitterActionHost !== null && input.firewall.trustedHostnames.has(submitterActionHost);

    if (formActionTrusted && submitterTrusted) {
      return { allowed: true };
    }
  }

  let hasOperationalAgentFill = false;
  for (const field of input.form.fields) {
    if (!field.ref || !input.agentFilledRefs.has(field.ref)) continue;
    if (input.approvedRefs.has(field.ref)) continue;
    if (input.operationalRefs.has(field.ref)) {
      hasOperationalAgentFill = true;
      continue;
    }

    return {
      allowed: false,
      reason: SECURITY_BLOCKED_UNAUTHORIZED_SUBMIT,
      isRecoverable: true,
    };
  }

  // Operational fields (search/filter boxes, comboboxes, etc.) are classified
  // from page-controlled attributes (inputType/role) and may carry agent-typed
  // text. They are exempt from the unauthorized-submit gate so the agent can
  // search and filter — but that exemption must not become an exfiltration
  // channel. An attacker page can label its collector field as a search box and
  // point the form action at its own host. So operational agent-filled data may
  // only be submitted to the current page's own host. A null page host
  // (non-http(s) page, or a getUrl failure) cannot be matched, so we fail closed.
  // Approved fields are excluded from this restriction: they hold the user's own
  // data, entered through request_user_data, and legitimately post cross-host
  // (e.g. a payment processor on a separate domain).
  if (hasOperationalAgentFill) {
    const sameHost = (url: string | null): boolean =>
      input.pageHostname !== null && extractHostname(url) === input.pageHostname;
    const submitterSameHost =
      input.form.submitterActionUrl === null ? true : sameHost(input.form.submitterActionUrl);
    if (!sameHost(input.form.actionUrl) || !submitterSameHost) {
      return {
        allowed: false,
        reason: SECURITY_BLOCKED_CROSS_SITE_OPERATIONAL_SUBMIT,
        isRecoverable: true,
      };
    }
  }

  return { allowed: true };
}

/**
 * Gate agent-initiated navigation (goto) to the caller's trusted hosts.
 *
 * Navigation is an unconditional data-egress sink: the agent can place any value
 * from its context (task text, caller data) into an outbound URL, and the request
 * carries it to the destination host with no form and no approval. Detecting the
 * secret inside the URL is unsound — it can be encoded or reshaped — so we gate
 * the destination instead. A goto is allowed only to a host the caller named
 * (the start host, folded in by withTrustedStartHost, or trusted_hostnames), or
 * when the firewall is disabled via unsafe_mode.
 *
 * A null host (non-http(s) target: about:, file:, data:, javascript:, …) is
 * never trusted, so it is blocked — failing closed.
 */
export function assessNavigation(input: {
  targetUrl: string;
  firewall: FirewallConfig;
}): ActionFirewallResult {
  if (input.firewall.unsafeMode) {
    return { allowed: true };
  }

  const targetHost = extractHostname(input.targetUrl);
  if (targetHost !== null && input.firewall.trustedHostnames.has(targetHost)) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: SECURITY_BLOCKED_UNTRUSTED_NAVIGATION,
    isRecoverable: true,
  };
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

/**
 * Gate placing a caller-provided data value (via fill_user_data) into a field.
 *
 * Stricter than assessFill: caller data may be placed ONLY on a host the caller
 * named (start host + trusted_hostnames; unsafe_mode overrides). Unlike assessFill
 * there is NO operational-field exemption — an operational field (search box,
 * combobox) on an untrusted host is still an attacker-readable sink for a secret,
 * so caller data must not inherit that carve-out. A null host is never trusted, so
 * it fails closed.
 */
export function assessDataFill(input: {
  pageHostname: string | null;
  firewall: FirewallConfig;
}): ActionFirewallResult {
  if (input.firewall.unsafeMode) return { allowed: true };
  if (input.pageHostname !== null && input.firewall.trustedHostnames.has(input.pageHostname)) {
    return { allowed: true };
  }
  return { allowed: false, reason: SECURITY_BLOCKED_UNTRUSTED_DATA_FILL, isRecoverable: true };
}

/**
 * Minimum length for a caller-data value to be treated as a secret worth redacting
 * from page content re-entering the model context. Short values (country codes,
 * single digits, "true") appear incidentally in legitimate page text and would cause
 * false-positive redaction. This is a tuning knob; sub-threshold values are a known,
 * documented gap.
 */
const MIN_SENSITIVE_VALUE_LENGTH = 6;

/**
 * Walk an arbitrary caller-supplied `data` object and collect the leaf values worth
 * redacting from page content: string and numeric leaves at or above the length
 * threshold. Booleans and null are ignored. `data` is typed `any` and may be built
 * programmatically, so a WeakSet guards against cyclic references — redaction must
 * fail safe, never stack-overflow the agent loop.
 */
export function collectSensitiveValues(data: unknown): Set<string> {
  const values = new Set<string>();
  const seen = new WeakSet<object>();
  const visit = (node: unknown): void => {
    if (node === null || node === undefined) return;
    if (typeof node === "string") {
      const trimmed = node.trim();
      if (trimmed.length >= MIN_SENSITIVE_VALUE_LENGTH) values.add(trimmed);
    } else if (typeof node === "number" || typeof node === "bigint") {
      const asString = String(node);
      if (asString.length >= MIN_SENSITIVE_VALUE_LENGTH) values.add(asString);
    } else if (typeof node === "object") {
      if (seen.has(node)) return;
      seen.add(node);
      if (Array.isArray(node)) {
        for (const item of node) visit(item);
      } else {
        for (const value of Object.values(node as Record<string, unknown>)) visit(value);
      }
    }
  };
  visit(data);
  return values;
}

/**
 * Replace every (case-insensitive) occurrence of each value with "[hidden]".
 * Regex-special characters in a value are matched literally; empty values are ignored.
 * Used to strip caller-data secrets from page content (snapshot, extracted markdown)
 * before it re-enters the model context.
 */
export function redactSensitiveValues(text: string, values: Iterable<string>): string {
  let out = text;
  for (const value of values) {
    if (!value) continue;
    const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(escaped, "gi"), "[hidden]");
  }
  return out;
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

/**
 * Return a FirewallConfig with the start URL's host added to the trusted set.
 *
 * Used to trust the hostname of a caller-provided start URL: navigating somewhere
 * the caller explicitly named is treated as consent to interact with that host's
 * forms. Only call this with a caller-supplied URL — never a planner-chosen or
 * agent-navigated URL, which are model/page-influenced and must not grant trust.
 *
 * Non-http(s) or unparseable URLs (null host) leave the firewall unchanged, as
 * does a host that is already trusted. The input is never mutated.
 */
export function withTrustedStartHost(
  firewall: FirewallConfig,
  startUrl: string | null,
): FirewallConfig {
  const host = extractHostname(startUrl);
  if (host === null || firewall.trustedHostnames.has(host)) return firewall;
  return Object.freeze({
    trustedHostnames: new Set([...firewall.trustedHostnames, host]),
    unsafeMode: firewall.unsafeMode,
  });
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

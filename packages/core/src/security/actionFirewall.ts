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

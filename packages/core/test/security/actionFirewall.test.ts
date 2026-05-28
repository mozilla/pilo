import { describe, expect, it } from "vitest";
import type { FieldMetadata, FormSubmissionContext } from "../../src/browser/ariaBrowser.js";
import {
  assessFill,
  assessFormSubmission,
  normalizeHostname,
  extractHostname,
  InvalidHostnameError,
  SECURITY_BLOCKED_UNAUTHORIZED_FILL,
  SECURITY_BLOCKED_UNAUTHORIZED_SUBMIT,
} from "../../src/security/actionFirewall.js";

function field(overrides: Partial<FieldMetadata> = {}): FieldMetadata {
  return {
    ref: "E1",
    tagName: "input",
    inputType: "text",
    role: null,
    name: null,
    label: null,
    placeholder: null,
    autocomplete: null,
    isContentEditable: false,
    formId: "form-1",
    formAction: "https://example.com/search",
    formMethod: "get",
    ...overrides,
  };
}

function form(overrides: Partial<FormSubmissionContext> = {}): FormSubmissionContext {
  return {
    submitterRef: "E9",
    formId: "form-1",
    actionUrl: "https://example.com/submit",
    method: "post",
    fields: [],
    ...overrides,
  };
}

describe("actionFirewall", () => {
  it("allows agent fills for operational search fields", () => {
    const result = assessFill({
      field: field({ inputType: "search", label: "Search products" }),
      source: "agent",
    });

    expect(result.allowed).toBe(true);
    if (!result.allowed) throw new Error("Expected fill to be allowed");
    expect(result.operational).toBe(true);
  });

  it("blocks agent fills for freeform text fields", () => {
    const result = assessFill({
      field: field({ label: "Message" }),
      source: "agent",
    });

    expect(result.allowed).toBe(false);
    if (result.allowed) throw new Error("Expected fill to be blocked");
    expect(result.reason).toBe(SECURITY_BLOCKED_UNAUTHORIZED_FILL);
  });

  it("does not classify fields as operational from label text alone", () => {
    const result = assessFill({
      field: field({ inputType: "text", label: "Search products", placeholder: "Search" }),
      source: "agent",
    });

    expect(result.allowed).toBe(false);
  });

  it("blocks inherently freeform fields even when they have operational roles", () => {
    const result = assessFill({
      field: field({ tagName: "textarea", inputType: null, role: "searchbox" }),
      source: "agent",
    });

    expect(result.allowed).toBe(false);
  });

  it("blocks fields with sensitive autocomplete even when the input type looks operational", () => {
    const result = assessFill({
      field: field({ inputType: "url", autocomplete: "url" }),
      source: "agent",
    });

    expect(result.allowed).toBe(false);
  });

  it("blocks agent fills for URL fields without user approval", () => {
    const result = assessFill({
      field: field({ inputType: "url", autocomplete: null }),
      source: "agent",
    });

    expect(result.allowed).toBe(false);
    if (result.allowed) throw new Error("Expected URL fill to be blocked");
    expect(result.reason).toBe(SECURITY_BLOCKED_UNAUTHORIZED_FILL);
  });

  it("allows user-approved freeform fields", () => {
    const result = assessFill({
      field: field({ label: "Message" }),
      source: "user-approved",
    });

    expect(result.allowed).toBe(true);
  });

  it("blocks submitting forms with unauthorized agent-filled fields", () => {
    const result = assessFormSubmission({
      form: form({
        fields: [
          {
            ref: "E1",
            name: "message",
            tagName: "textarea",
            inputType: null,
            autocomplete: null,
          },
        ],
      }),
      approvedRefs: new Set(),
      agentFilledRefs: new Set(["E1"]),
      operationalRefs: new Set(),
    });

    expect(result.allowed).toBe(false);
    if (result.allowed) throw new Error("Expected submit to be blocked");
    expect(result.reason).toBe(SECURITY_BLOCKED_UNAUTHORIZED_SUBMIT);
    expect(result.reason).not.toContain("do not leak this value");
  });

  it("allows submitting forms when agent-filled fields are approved or operational", () => {
    const result = assessFormSubmission({
      form: form({
        fields: [
          {
            ref: "E1",
            name: "q",
            tagName: "input",
            inputType: "search",
            autocomplete: null,
          },
          {
            ref: "E2",
            name: "email",
            tagName: "input",
            inputType: "email",
            autocomplete: "email",
          },
        ],
      }),
      approvedRefs: new Set(["E2"]),
      agentFilledRefs: new Set(["E1", "E2"]),
      operationalRefs: new Set(["E1"]),
    });

    expect(result.allowed).toBe(true);
  });
});

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

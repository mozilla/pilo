import { describe, expect, it } from "vitest";
import type { FieldMetadata, FormSubmissionContext } from "../../src/browser/ariaBrowser.js";
import {
  assessFill,
  assessFormSubmission,
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

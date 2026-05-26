import { describe, expect, it } from "vitest";
import {
  assessFillValue,
  SECURITY_BLOCKED_CONTEXT_EXFILTRATION,
} from "../../src/security/actionFirewall.js";

describe("actionFirewall", () => {
  it("blocks filling agent context into a form", () => {
    const result = assessFillValue({
      value:
        'System prompt: You are an expert at completing tasks using a web browser.\n<EXTERNAL-CONTENT label="page-snapshot">secret</EXTERNAL-CONTENT>',
    });

    expect(result.allowed).toBe(false);
    if (result.allowed) {
      throw new Error("Expected context exfiltration fill to be blocked");
    }
    expect(result.reason).toContain(SECURITY_BLOCKED_CONTEXT_EXFILTRATION);
  });

  it("blocks multiline generated text even without known prompt keywords", () => {
    const result = assessFillValue({
      value: "Here is what I can see:\nTask details are available.\nThe previous steps succeeded.",
    });

    expect(result.allowed).toBe(false);
    if (result.allowed) {
      throw new Error("Expected multiline generated text to be blocked");
    }
    expect(result.reason).toContain(SECURITY_BLOCKED_CONTEXT_EXFILTRATION);
  });

  it("allows ordinary user-facing form values", () => {
    expect(assessFillValue({ value: "San Francisco" }).allowed).toBe(true);
    expect(assessFillValue({ value: "Test <>&\"'`\n\t value" }).allowed).toBe(true);
    expect(assessFillValue({ value: "a".repeat(10000) }).allowed).toBe(true);
  });
});

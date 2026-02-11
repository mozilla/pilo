import { describe, it, expect } from "vitest";

describe("yamlUtils", () => {
  describe("yamlEscapeKeyIfNeeded", async () => {
    const { yamlEscapeKeyIfNeeded } = await import("../../../src/browser/ariaTree/yamlUtils.js");

    it("should not escape simple strings", () => {
      expect(yamlEscapeKeyIfNeeded("button")).toBe("button");
      expect(yamlEscapeKeyIfNeeded("click-me")).toBe("click-me");
      expect(yamlEscapeKeyIfNeeded("test_value")).toBe("test_value");
    });

    it("should not escape strings with single quotes in middle", () => {
      // Single quotes in middle don't trigger escaping
      expect(yamlEscapeKeyIfNeeded("it's")).toBe("it's");
    });

    it("should escape strings starting with special chars", () => {
      expect(yamlEscapeKeyIfNeeded("- dash")).toBe("'- dash'");
      expect(yamlEscapeKeyIfNeeded("& amp")).toBe("'& amp'");
      expect(yamlEscapeKeyIfNeeded("* star")).toBe("'* star'");
      expect(yamlEscapeKeyIfNeeded("[bracket")).toBe("'[bracket'");
      expect(yamlEscapeKeyIfNeeded("{brace")).toBe("'{brace'");
      expect(yamlEscapeKeyIfNeeded("# hash")).toBe("'# hash'");
    });

    it("should escape strings starting with quote", () => {
      // Single quote gets doubled when wrapping in single quotes
      expect(yamlEscapeKeyIfNeeded("'quoted")).toBe("'''quoted'");
      expect(yamlEscapeKeyIfNeeded('"quoted')).toBe("'\"quoted'");
    });

    it("should escape strings with leading/trailing whitespace", () => {
      expect(yamlEscapeKeyIfNeeded(" leading")).toBe("' leading'");
      expect(yamlEscapeKeyIfNeeded("trailing ")).toBe("'trailing '");
      expect(yamlEscapeKeyIfNeeded(" both ")).toBe("' both '");
    });

    it("should escape YAML reserved words", () => {
      expect(yamlEscapeKeyIfNeeded("true")).toBe("'true'");
      expect(yamlEscapeKeyIfNeeded("false")).toBe("'false'");
      expect(yamlEscapeKeyIfNeeded("yes")).toBe("'yes'");
      expect(yamlEscapeKeyIfNeeded("no")).toBe("'no'");
      expect(yamlEscapeKeyIfNeeded("null")).toBe("'null'");
      expect(yamlEscapeKeyIfNeeded("on")).toBe("'on'");
      expect(yamlEscapeKeyIfNeeded("off")).toBe("'off'");
    });

    it("should escape strings that look like numbers", () => {
      expect(yamlEscapeKeyIfNeeded("123")).toBe("'123'");
      expect(yamlEscapeKeyIfNeeded("3.14")).toBe("'3.14'");
    });

    it("should escape strings with newlines", () => {
      expect(yamlEscapeKeyIfNeeded("line1\nline2")).toBe("'line1\nline2'");
    });

    it("should escape strings with colons followed by space", () => {
      expect(yamlEscapeKeyIfNeeded("key: value")).toBe("'key: value'");
    });

    it("should escape empty strings", () => {
      expect(yamlEscapeKeyIfNeeded("")).toBe("''");
    });

    it("should escape backticks", () => {
      expect(yamlEscapeKeyIfNeeded("code`here")).toBe("'code`here'");
    });
  });

  describe("yamlEscapeValueIfNeeded", async () => {
    const { yamlEscapeValueIfNeeded } = await import("../../../src/browser/ariaTree/yamlUtils.js");

    it("should not escape simple strings", () => {
      expect(yamlEscapeValueIfNeeded("hello")).toBe("hello");
      expect(yamlEscapeValueIfNeeded("click me")).toBe("click me");
    });

    it("should escape control characters when they trigger quoting", () => {
      // Tab triggers quoting when combined with newline triggers
      expect(yamlEscapeValueIfNeeded("a\nb")).toBe('"a\\nb"');
      expect(yamlEscapeValueIfNeeded("a\rb")).toBe('"a\\rb"');
    });

    it("should escape other control characters with hex", () => {
      // 0x01 is in the \x00-\x08 range which triggers quoting
      const result = yamlEscapeValueIfNeeded("a\x01b");
      expect(result).toContain("\\x01");
    });

    it("should escape strings starting with dash", () => {
      expect(yamlEscapeValueIfNeeded("- list item")).toBe('"- list item"');
    });

    it("should escape YAML reserved words", () => {
      expect(yamlEscapeValueIfNeeded("true")).toBe('"true"');
      expect(yamlEscapeValueIfNeeded("false")).toBe('"false"');
      expect(yamlEscapeValueIfNeeded("null")).toBe('"null"');
    });

    it("should escape strings with leading/trailing whitespace", () => {
      expect(yamlEscapeValueIfNeeded(" leading")).toBe('" leading"');
      expect(yamlEscapeValueIfNeeded("trailing ")).toBe('"trailing "');
    });

    it("should escape empty strings", () => {
      expect(yamlEscapeValueIfNeeded("")).toBe('""');
    });

    it("should escape strings starting with special chars", () => {
      expect(yamlEscapeValueIfNeeded("&foo")).toBe('"&foo"');
      expect(yamlEscapeValueIfNeeded("*item")).toBe('"*item"');
      expect(yamlEscapeValueIfNeeded("{obj")).toBe('"{obj"');
    });

    it("should escape strings with backticks", () => {
      expect(yamlEscapeValueIfNeeded("code`here")).toBe('"code`here"');
    });
  });
});

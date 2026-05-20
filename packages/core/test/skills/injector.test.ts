import { describe, it, expect } from "vitest";
import { formatSkillSection } from "../../src/skills/injector.js";

describe("skills/injector", () => {
  describe("formatSkillSection", () => {
    it("returns an empty string when input is null", () => {
      expect(formatSkillSection(null)).toBe("");
    });

    it("returns an empty string when input is an empty string", () => {
      expect(formatSkillSection("")).toBe("");
    });

    it("returns an empty string when input is whitespace-only", () => {
      expect(formatSkillSection("  \n\t  ")).toBe("");
    });

    it("includes the input content when input has real content", () => {
      const input = "## 2026-01-01 — search task\n\nUse the search box at the top.";
      const result = formatSkillSection(input);
      expect(result).toContain(input);
    });

    it("wraps the content with the opening and closing framing comments", () => {
      const input = "## 2026-01-01 — example\n\nA hint.";
      const result = formatSkillSection(input);
      expect(result.startsWith("<!-- NOTES FROM PRIOR RUNS ON THIS SITE -->")).toBe(true);
      expect(result.endsWith("<!-- END NOTES -->")).toBe(true);
    });

    it("includes guidance to verify against the live snapshot", () => {
      const input = "## 2026-01-01 — example\n\nA hint.";
      const result = formatSkillSection(input);
      expect(result).toContain("verify");
      expect(result).toContain("live snapshot");
    });

    it("trims leading and trailing whitespace from the input", () => {
      const input = "\n\n   ## 2026-01-01 — example\n\nA hint.   \n\n";
      const result = formatSkillSection(input);
      // Trimmed input should appear without the leading/trailing whitespace.
      expect(result).toContain("## 2026-01-01 — example\n\nA hint.");
      // And the raw padded version should NOT appear.
      expect(result).not.toContain("\n\n   ## 2026-01-01");
      expect(result).not.toContain("A hint.   \n\n");
    });
  });
});

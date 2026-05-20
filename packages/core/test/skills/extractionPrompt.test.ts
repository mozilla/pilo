import { describe, it, expect } from "vitest";
import { buildSkillExtractionPrompt } from "../../src/skills/extractionPrompt.js";

describe("skills/extractionPrompt", () => {
  it("renders host, task, and trajectorySummary into the template", () => {
    const prompt = buildSkillExtractionPrompt({
      host: "example.com",
      task: "Buy a widget from the store",
      trajectorySummary: "USER: open page\nTOOL: click(button)",
    });

    expect(prompt).toContain("example.com");
    expect(prompt).toContain("Buy a widget from the store");
    expect(prompt).toContain("USER: open page");
    expect(prompt).toContain("TOOL: click(button)");
  });

  it("produces a string for typical inputs", () => {
    const prompt = buildSkillExtractionPrompt({
      host: "shop.example.com",
      task: "Find a thing",
      trajectorySummary: "USER: hello",
    });
    expect(typeof prompt).toBe("string");
    expect(prompt.length).toBeGreaterThan(0);
  });

  it("includes the SKIP instruction", () => {
    const prompt = buildSkillExtractionPrompt({
      host: "example.com",
      task: "Task",
      trajectorySummary: "summary",
    });
    expect(prompt).toContain("SKIP");
  });

  it("includes the section-header guard", () => {
    const prompt = buildSkillExtractionPrompt({
      host: "example.com",
      task: "Task",
      trajectorySummary: "summary",
    });
    expect(prompt).toContain('Lines that start with "## "');
  });

  it("includes the second-person guidance", () => {
    const prompt = buildSkillExtractionPrompt({
      host: "example.com",
      task: "Task",
      trajectorySummary: "summary",
    });
    expect(prompt).toContain("second person");
  });

  it("produces a renderable prompt for empty task and trajectory", () => {
    const prompt = buildSkillExtractionPrompt({
      host: "example.com",
      task: "",
      trajectorySummary: "",
    });
    expect(typeof prompt).toBe("string");
    expect(prompt).toContain("example.com");
    // Should still include the structural instructions
    expect(prompt).toContain("SKIP");
  });

  it("renders the host string in multiple positions", () => {
    const prompt = buildSkillExtractionPrompt({
      host: "unique-host.test",
      task: "Task",
      trajectorySummary: "summary",
    });
    // The host appears at least twice in the template (Site header + future-agent reference)
    const occurrences = prompt.split("unique-host.test").length - 1;
    expect(occurrences).toBeGreaterThanOrEqual(2);
  });
});

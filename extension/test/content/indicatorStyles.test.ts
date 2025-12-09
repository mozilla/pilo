import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("indicator CSS content script", () => {
  const cssPath = path.join(__dirname, "../../entrypoints/indicator.content/styles.css");

  it("should exist at entrypoints/indicator.content/styles.css", () => {
    expect(fs.existsSync(cssPath)).toBe(true);
  });

  it("should hide indicator by default (no class)", () => {
    const css = fs.readFileSync(cssPath, "utf-8");
    // Default state should have opacity: 0 (regex allows multiline match)
    expect(css).toMatch(/html::after\s*\{[\s\S]*?opacity:\s*0/);
  });

  it("should show indicator when html has spark-indicator-active class", () => {
    const css = fs.readFileSync(cssPath, "utf-8");
    expect(css).toContain("html.spark-indicator-active::after");
  });

  it("should include the pulse animation keyframes", () => {
    const css = fs.readFileSync(cssPath, "utf-8");
    expect(css).toContain("@keyframes spark-pulse");
  });
});

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { INDICATOR_CSS } from "../../src/background/indicatorControl";

describe("indicator CSS file for dynamic registration", () => {
  const cssPath = path.join(__dirname, "../../public/indicator.css");

  it("should exist at public/indicator.css", () => {
    expect(fs.existsSync(cssPath)).toBe(true);
  });

  it("should target html.spark-indicator-active::after", () => {
    const css = fs.readFileSync(cssPath, "utf-8");
    expect(css).toContain("html.spark-indicator-active::after");
  });

  it("should include the pulse animation keyframes", () => {
    const css = fs.readFileSync(cssPath, "utf-8");
    expect(css).toContain("@keyframes spark-pulse");
  });

  it("should use highest z-index", () => {
    const css = fs.readFileSync(cssPath, "utf-8");
    expect(css).toContain("z-index: 2147483647");
  });
});

describe("CSS consistency", () => {
  const cssPath = path.join(__dirname, "../../public/indicator.css");

  it("should have matching CSS rules in file and INDICATOR_CSS constant", () => {
    const fileCss = fs.readFileSync(cssPath, "utf-8");

    // Normalize whitespace for comparison
    const normalizeCSS = (css: string) => css.replace(/\s+/g, " ").trim();

    expect(normalizeCSS(fileCss)).toEqual(normalizeCSS(INDICATOR_CSS));
  });
});

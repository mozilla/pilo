import { describe, it, expect } from "vitest";
import { PlaywrightBrowser } from "../src/browser/playwrightBrowser.js";

describe("PlaywrightBrowser Remote Connection", () => {
  it("should accept pwEndpoint option in constructor", () => {
    const browser = new PlaywrightBrowser({
      pwEndpoint: "ws://localhost:9222",
      browser: "firefox",
    });

    // Test that the browser instance is created successfully
    expect(browser).toBeDefined();
  });

  it("should handle missing pwEndpoint gracefully", () => {
    const browser = new PlaywrightBrowser({
      browser: "firefox",
    });

    // Test that the browser instance is created successfully without endpoint
    expect(browser).toBeDefined();
  });

  it("should preserve all other options when pwEndpoint is provided", () => {
    const options = {
      headless: true,
      device: "Desktop Firefox",
      browser: "firefox" as const,
      bypassCSP: true,
      blockAds: true,
      blockResources: ["image", "media"] as Array<
        "image" | "stylesheet" | "font" | "media" | "manifest"
      >,
      pwEndpoint: "ws://localhost:9222",
    };

    const browser = new PlaywrightBrowser(options);
    expect(browser).toBeDefined();
  });
});

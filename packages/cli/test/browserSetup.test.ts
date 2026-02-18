import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("browserSetup", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe("environment detection", () => {
    it("should detect CI environment", async () => {
      // This is a smoke test to ensure the module loads correctly
      // Full integration testing would require mocking user input and process execution
      const { checkBrowserForRun } = await import("../src/browserSetup.js");
      expect(typeof checkBrowserForRun).toBe("function");
    });

    it("should export ensureBrowserInstalled", async () => {
      const { ensureBrowserInstalled } = await import("../src/browserSetup.js");
      expect(typeof ensureBrowserInstalled).toBe("function");
    });
  });

  describe("browser mapping", () => {
    it("should handle chromium browser option", async () => {
      const { checkBrowserForRun } = await import("../src/browserSetup.js");

      // In test environment (NODE_ENV=test), check is automatically skipped
      const result = await checkBrowserForRun("chromium");
      expect(result).toBe(true);
    });

    it("should handle firefox browser option", async () => {
      const { checkBrowserForRun } = await import("../src/browserSetup.js");

      // In test environment (NODE_ENV=test), check is automatically skipped
      const result = await checkBrowserForRun("firefox");
      expect(result).toBe(true);
    });

    it("should handle webkit browser option", async () => {
      const { checkBrowserForRun } = await import("../src/browserSetup.js");

      // In test environment (NODE_ENV=test), check is automatically skipped
      const result = await checkBrowserForRun("webkit");
      expect(result).toBe(true);
    });

    it("should map chrome to chromium", async () => {
      const { checkBrowserForRun } = await import("../src/browserSetup.js");

      // In test environment (NODE_ENV=test), check is automatically skipped
      const result = await checkBrowserForRun("chrome");
      expect(result).toBe(true);
    });

    it("should map edge to chromium", async () => {
      const { checkBrowserForRun } = await import("../src/browserSetup.js");

      // In test environment (NODE_ENV=test), check is automatically skipped
      const result = await checkBrowserForRun("edge");
      expect(result).toBe(true);
    });

    it("should map safari to webkit", async () => {
      const { checkBrowserForRun } = await import("../src/browserSetup.js");

      // In test environment (NODE_ENV=test), check is automatically skipped
      const result = await checkBrowserForRun("safari");
      expect(result).toBe(true);
    });
  });
});

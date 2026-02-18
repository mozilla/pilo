import { describe, it, expect } from "vitest";
import {
  isBrowserInstalled,
  checkAllBrowsers,
  type BrowserType,
} from "../../src/browser/playwrightSetup.js";

describe("playwrightSetup", () => {
  describe("isBrowserInstalled", () => {
    it("should check if chromium is installed", async () => {
      const result = await isBrowserInstalled("chromium");

      expect(result).toBeDefined();
      expect(result).toHaveProperty("installed");

      // If installed, should have executablePath
      if (result.installed) {
        expect(result.executablePath).toBeDefined();
        expect(typeof result.executablePath).toBe("string");
        expect(result.executablePath!.length).toBeGreaterThan(0);
      }
    });

    it("should check if firefox is installed", async () => {
      const result = await isBrowserInstalled("firefox");

      expect(result).toBeDefined();
      expect(result).toHaveProperty("installed");

      // If installed, should have executablePath
      if (result.installed) {
        expect(result.executablePath).toBeDefined();
        expect(typeof result.executablePath).toBe("string");
      }
    });

    it("should check if webkit is installed", async () => {
      const result = await isBrowserInstalled("webkit");

      expect(result).toBeDefined();
      expect(result).toHaveProperty("installed");

      // If installed, should have executablePath
      if (result.installed) {
        expect(result.executablePath).toBeDefined();
        expect(typeof result.executablePath).toBe("string");
      }
    });

    it("should return error for unsupported browser type", async () => {
      const result = await isBrowserInstalled("invalid" as BrowserType);

      expect(result).toBeDefined();
      expect(result.installed).toBe(false);
      expect(result.error).toContain("Unsupported browser type");
    });

    it("should default to chromium if no browser type specified", async () => {
      const result = await isBrowserInstalled();

      expect(result).toBeDefined();
      expect(result).toHaveProperty("installed");
    });
  });

  describe("checkAllBrowsers", () => {
    it("should check all supported browsers", async () => {
      const results = await checkAllBrowsers();

      expect(results).toBeDefined();
      expect(results).toHaveProperty("chromium");
      expect(results).toHaveProperty("firefox");
      expect(results).toHaveProperty("webkit");

      // Each result should have the correct structure
      expect(results.chromium).toHaveProperty("installed");
      expect(results.firefox).toHaveProperty("installed");
      expect(results.webkit).toHaveProperty("installed");
    });

    it("should return valid status for each browser", async () => {
      const results = await checkAllBrowsers();

      for (const status of Object.values(results)) {
        expect(typeof status.installed).toBe("boolean");

        if (status.installed) {
          expect(status.executablePath).toBeDefined();
          expect(typeof status.executablePath).toBe("string");
        }
      }
    });
  });
});

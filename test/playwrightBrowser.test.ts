import { describe, it, expect } from "vitest";
import { PlaywrightBrowser } from "../src/browser/playwrightBrowser.js";
import { PageAction, LoadState } from "../src/browser/ariaBrowser.js";

describe("PlaywrightBrowser", () => {
  describe("constructor and options", () => {
    it("should handle default options", () => {
      const browser = new PlaywrightBrowser();
      expect(browser).toBeDefined();
      expect(browser).toBeInstanceOf(PlaywrightBrowser);
    });

    it("should handle empty options object", () => {
      const browser = new PlaywrightBrowser({});
      expect(browser).toBeDefined();
      expect(browser).toBeInstanceOf(PlaywrightBrowser);
    });

    it("should handle basic options", () => {
      const browser = new PlaywrightBrowser({
        browser: "chrome",
        headless: true,
        bypassCSP: false,
      });
      expect(browser).toBeDefined();
      expect(browser).toBeInstanceOf(PlaywrightBrowser);
    });

    it("should handle extended options", () => {
      const browser = new PlaywrightBrowser({
        browser: "firefox",
        headless: true,
        blockAds: true,
        blockResources: ["image", "media"],
        pwEndpoint: "ws://localhost:9222",
        launchOptions: { slowMo: 100 },
        contextOptions: { viewport: { width: 1280, height: 720 } },
        connectOptions: { timeout: 30000 },
      });
      expect(browser).toBeDefined();
      expect(browser).toBeInstanceOf(PlaywrightBrowser);
    });

    it("should handle all browser types", () => {
      const browsers = ["firefox", "chrome", "chromium", "safari", "webkit", "edge"] as const;

      browsers.forEach((browserType) => {
        const browser = new PlaywrightBrowser({ browser: browserType });
        expect(browser).toBeDefined();
        expect(browser).toBeInstanceOf(PlaywrightBrowser);
      });
    });

    it("should handle all block resource types", () => {
      const browser = new PlaywrightBrowser({
        blockResources: ["image", "stylesheet", "font", "media", "manifest"],
      });
      expect(browser).toBeDefined();
      expect(browser).toBeInstanceOf(PlaywrightBrowser);
    });

    it("should handle remote connection options", () => {
      const browser = new PlaywrightBrowser({
        pwEndpoint: "ws://localhost:9222",
        browser: "firefox",
      });
      expect(browser).toBeDefined();
      expect(browser).toBeInstanceOf(PlaywrightBrowser);
    });

    it("should handle complex remote connection with all options", () => {
      const options = {
        browser: "firefox" as const,
        blockAds: true,
        blockResources: ["image", "media"] as Array<
          "image" | "stylesheet" | "font" | "media" | "manifest"
        >,
        pwEndpoint: "ws://localhost:9222",
        headless: true, // Top-level option
        bypassCSP: true, // Top-level option
        launchOptions: {
          slowMo: 100, // Advanced Playwright option
        },
        contextOptions: {
          viewport: { width: 1280, height: 720 }, // Device emulation via contextOptions
        },
      };

      const browser = new PlaywrightBrowser(options);
      expect(browser).toBeDefined();
      expect(browser).toBeInstanceOf(PlaywrightBrowser);
    });
  });

  describe("error handling without browser started", () => {
    let browser: PlaywrightBrowser;

    beforeEach(() => {
      browser = new PlaywrightBrowser();
    });

    it("should throw error for navigation methods when not started", async () => {
      await expect(browser.goto("https://example.com")).rejects.toThrow("Browser not started");
      await expect(browser.goBack()).rejects.toThrow("Browser not started");
      await expect(browser.goForward()).rejects.toThrow("Browser not started");
    });

    it("should throw error for page info methods when not started", async () => {
      await expect(browser.getUrl()).rejects.toThrow("Browser not started");
      await expect(browser.getTitle()).rejects.toThrow("Browser not started");
      await expect(browser.getTreeWithRefs()).rejects.toThrow("Browser not started");
      await expect(browser.getScreenshot()).rejects.toThrow("Browser not started");
    });

    it("should throw error for performAction when not started", async () => {
      await expect(browser.performAction("ref1", PageAction.Click)).rejects.toThrow(
        "Browser not started",
      );
    });

    it("should throw error for waitForLoadState when not started", async () => {
      await expect(browser.waitForLoadState(LoadState.Load)).rejects.toThrow("Browser not started");
    });
  });

  describe("edge cases and robustness", () => {
    let browser: PlaywrightBrowser;

    beforeEach(() => {
      browser = new PlaywrightBrowser();
    });

    it("should handle multiple shutdown calls gracefully", async () => {
      await browser.shutdown();
      await browser.shutdown(); // Should not throw
      await browser.shutdown(); // Should not throw
    });

    it("should handle concurrent shutdown calls", async () => {
      const shutdownPromises = [browser.shutdown(), browser.shutdown(), browser.shutdown()];

      await expect(Promise.all(shutdownPromises)).resolves.not.toThrow();
    });
  });

  describe("shutdown", () => {
    it("should handle shutdown when not started", async () => {
      const browser = new PlaywrightBrowser();

      // Should not throw
      await expect(browser.shutdown()).resolves.not.toThrow();
    });
  });

  describe("type safety", () => {
    it("should accept PlaywrightBrowserOptions", () => {
      const options = {
        browser: "firefox" as const,
        headless: true,
        bypassCSP: false,
        blockAds: true,
        blockResources: ["image"] as const,
        pwEndpoint: "ws://localhost:9222",
      };

      const browser = new PlaywrightBrowser(options);
      expect(browser).toBeDefined();
    });

    it("should accept ExtendedPlaywrightBrowserOptions", () => {
      const options = {
        browser: "chrome" as const,
        headless: false,
        launchOptions: {
          args: ["--disable-web-security"],
          slowMo: 100,
        },
        contextOptions: {
          viewport: { width: 1920, height: 1080 },
          userAgent: "Test Bot",
        },
        connectOptions: {
          timeout: 30000,
        },
      };

      const browser = new PlaywrightBrowser(options);
      expect(browser).toBeDefined();
    });
  });

  describe("launch options args handling", () => {
    it("should filter out empty args from launch options", () => {
      const browser = new PlaywrightBrowser({
        launchOptions: {
          args: [
            "--disable-web-security",
            "",
            "--no-sandbox",
            null,
            "--disable-features=VizDisplayCompositor",
            undefined,
          ],
        },
      });
      expect(browser).toBeDefined();
      expect(browser).toBeInstanceOf(PlaywrightBrowser);

      // Test that the internal mapping filters out empty args
      const mappedOptions = (browser as any).mapOptionsToPlaywright();
      expect(mappedOptions.launchOptions.args).toEqual([
        "--disable-web-security",
        "--no-sandbox",
        "--disable-features=VizDisplayCompositor",
      ]);
    });

    it("should handle launch options with only empty args", () => {
      const browser = new PlaywrightBrowser({
        launchOptions: {
          args: ["", null, undefined],
        },
      });
      expect(browser).toBeDefined();
      expect(browser).toBeInstanceOf(PlaywrightBrowser);

      // Test that all empty args are filtered out
      const mappedOptions = (browser as any).mapOptionsToPlaywright();
      expect(mappedOptions.launchOptions.args).toEqual([]);
    });

    it("should handle launch options with no args", () => {
      const browser = new PlaywrightBrowser({
        launchOptions: {
          slowMo: 100,
        },
      });
      expect(browser).toBeDefined();
      expect(browser).toBeInstanceOf(PlaywrightBrowser);

      // Test that args property doesn't exist when not provided
      const mappedOptions = (browser as any).mapOptionsToPlaywright();
      expect(mappedOptions.launchOptions.args).toBeUndefined();
    });

    it("should preserve valid args while filtering empty ones", () => {
      const browser = new PlaywrightBrowser({
        launchOptions: {
          args: [
            "--valid-arg",
            "",
            "--another-valid",
            null,
            "--third-valid",
            undefined,
            "--fourth-valid",
          ],
        },
      });
      expect(browser).toBeDefined();
      expect(browser).toBeInstanceOf(PlaywrightBrowser);

      // Test that only valid args are preserved
      const mappedOptions = (browser as any).mapOptionsToPlaywright();
      expect(mappedOptions.launchOptions.args).toEqual([
        "--valid-arg",
        "--another-valid",
        "--third-valid",
        "--fourth-valid",
      ]);
    });
  });

  describe("proxy configuration", () => {
    it("should handle proxy options", () => {
      const browser = new PlaywrightBrowser({
        proxyServer: "http://proxy.example.com:8080",
        proxyUsername: "testuser",
        proxyPassword: "testpass",
      });
      expect(browser).toBeDefined();
      expect(browser).toBeInstanceOf(PlaywrightBrowser);
    });

    it("should handle proxy without authentication", () => {
      const browser = new PlaywrightBrowser({
        proxyServer: "http://proxy.example.com:8080",
      });
      expect(browser).toBeDefined();
      expect(browser).toBeInstanceOf(PlaywrightBrowser);
    });

    it("should handle different proxy protocols", () => {
      const proxyTypes = [
        "http://proxy.example.com:8080",
        "https://proxy.example.com:8080",
        "socks5://proxy.example.com:1080",
      ];

      proxyTypes.forEach((proxyServer) => {
        const browser = new PlaywrightBrowser({
          proxyServer,
          proxyUsername: "user",
          proxyPassword: "pass",
        });
        expect(browser).toBeDefined();
        expect(browser).toBeInstanceOf(PlaywrightBrowser);
      });
    });

    it("should handle proxy with extended options", () => {
      const browser = new PlaywrightBrowser({
        browser: "firefox",
        headless: true,
        proxyServer: "http://proxy.example.com:8080",
        proxyUsername: "testuser",
        proxyPassword: "testpass",
        launchOptions: {
          slowMo: 100,
        },
        contextOptions: {
          viewport: { width: 1280, height: 720 },
        },
      });
      expect(browser).toBeDefined();
      expect(browser).toBeInstanceOf(PlaywrightBrowser);
    });

    it("should handle proxy options alongside existing proxy in launchOptions", () => {
      // Test that top-level proxy options override launchOptions.proxy
      const browser = new PlaywrightBrowser({
        proxyServer: "http://new-proxy.example.com:8080",
        proxyUsername: "newuser",
        proxyPassword: "newpass",
        launchOptions: {
          proxy: {
            server: "http://old-proxy.example.com:8080",
            username: "olduser",
            password: "oldpass",
          },
        },
      });
      expect(browser).toBeDefined();
      expect(browser).toBeInstanceOf(PlaywrightBrowser);
    });
  });
});

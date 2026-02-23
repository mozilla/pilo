import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { PlaywrightBrowser } from "../src/browser/playwrightBrowser.js";
import { PageAction, LoadState } from "../src/browser/ariaBrowser.js";
import {
  InvalidRefException,
  BrowserActionException,
  BrowserDisconnectedError,
} from "../src/errors.js";

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

    it("should preserve default timeouts when undefined values are passed", () => {
      // Simulates what CLI/server does when options aren't set
      const browser = new PlaywrightBrowser({
        actionTimeoutMs: undefined,
        navigationRetry: {
          baseTimeoutMs: undefined,
          maxAttempts: undefined,
          timeoutMultiplier: undefined,
        },
      });

      expect((browser as any).actionTimeoutMs).toBe(30000);

      const config = (browser as any).navigationConfig;
      expect(config.baseTimeoutMs).toBe(30000);
      expect(config.maxAttempts).toBe(3);
      expect(config.timeoutMultiplier).toBe(2);
    });

    it("should allow partial overrides of navigation config", () => {
      const browser = new PlaywrightBrowser({
        navigationRetry: {
          baseTimeoutMs: 15000,
          maxAttempts: undefined, // Keep default
          timeoutMultiplier: 3,
        },
      });
      const config = (browser as any).navigationConfig;
      expect(config.baseTimeoutMs).toBe(15000);
      expect(config.maxAttempts).toBe(3); // Default preserved
      expect(config.timeoutMultiplier).toBe(3);
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
        blockResources: ["image"] as ("image" | "stylesheet" | "font" | "media" | "manifest")[],
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
            "--disable-features=VizDisplayCompositor",
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
          args: [""],
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
          args: ["--valid-arg", "", "--another-valid", "--third-valid", "--fourth-valid"],
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

  describe("channel configuration", () => {
    it("should handle explicit channel option", () => {
      const browser = new PlaywrightBrowser({
        browser: "firefox",
        channel: "moz-firefox",
      });
      expect(browser).toBeDefined();
      expect(browser).toBeInstanceOf(PlaywrightBrowser);
      expect(browser.channel).toBe("moz-firefox");
    });

    it("should use default channel for edge when not specified", () => {
      const browser = new PlaywrightBrowser({
        browser: "edge",
      });
      expect(browser).toBeDefined();
      expect(browser.channel).toBe("msedge");
    });

    it("should use default channel for chrome when not specified", () => {
      const browser = new PlaywrightBrowser({
        browser: "chrome",
      });
      expect(browser).toBeDefined();
      expect(browser.channel).toBe("chrome");
    });

    it("should use default channel for firefox when not specified", () => {
      const browser = new PlaywrightBrowser({
        browser: "firefox",
      });
      expect(browser).toBeDefined();
      expect(browser.channel).toBe("firefox");
    });

    it("should have undefined channel for chromium when not specified", () => {
      const browser = new PlaywrightBrowser({
        browser: "chromium",
      });
      expect(browser).toBeDefined();
      expect(browser.channel).toBeUndefined();
    });

    it("should have undefined channel for safari when not specified", () => {
      const browser = new PlaywrightBrowser({
        browser: "safari",
      });
      expect(browser).toBeDefined();
      expect(browser.channel).toBeUndefined();
    });

    it("should have undefined channel for webkit when not specified", () => {
      const browser = new PlaywrightBrowser({
        browser: "webkit",
      });
      expect(browser).toBeDefined();
      expect(browser.channel).toBeUndefined();
    });

    it("should override default channel when explicitly provided", () => {
      const browser = new PlaywrightBrowser({
        browser: "edge",
        channel: "chrome",
      });
      expect(browser).toBeDefined();
      expect(browser.channel).toBe("chrome");
    });

    it("should pass channel to launch options", () => {
      const browser = new PlaywrightBrowser({
        browser: "chrome",
        channel: "chrome-beta",
      });
      expect(browser).toBeDefined();

      const mappedOptions = (browser as any).mapOptionsToPlaywright();
      expect(mappedOptions.launchOptions.channel).toBe("chrome-beta");
    });

    it("should use default channel in launch options when not specified", () => {
      const browser = new PlaywrightBrowser({
        browser: "firefox",
      });
      expect(browser).toBeDefined();

      const mappedOptions = (browser as any).mapOptionsToPlaywright();
      expect(mappedOptions.launchOptions.channel).toBe("firefox");
    });

    it("should handle channel with other options", () => {
      const browser = new PlaywrightBrowser({
        browser: "chrome",
        channel: "chrome-beta",
        headless: true,
        blockAds: true,
        blockResources: ["image"],
      });
      expect(browser).toBeDefined();
      expect(browser).toBeInstanceOf(PlaywrightBrowser);
      expect(browser.channel).toBe("chrome-beta");
    });

    it("should prioritize top-level channel over launchOptions channel", () => {
      const browser = new PlaywrightBrowser({
        browser: "chrome",
        channel: "chrome-beta",
        launchOptions: {
          channel: "chrome",
        },
      });
      expect(browser).toBeDefined();

      const mappedOptions = (browser as any).mapOptionsToPlaywright();
      expect(mappedOptions.launchOptions.channel).toBe("chrome-beta");
    });
  });

  describe("executablePath configuration", () => {
    it("should handle explicit executablePath option", () => {
      const browser = new PlaywrightBrowser({
        browser: "firefox",
        executablePath: "/usr/bin/firefox",
      });
      expect(browser).toBeDefined();
      expect(browser).toBeInstanceOf(PlaywrightBrowser);
    });

    it("should handle executablePath on different platforms", () => {
      const paths = [
        "/usr/bin/firefox",
        "/Applications/Firefox.app/Contents/MacOS/firefox",
        "C:\\Program Files\\Mozilla Firefox\\firefox.exe",
      ];

      paths.forEach((executablePath) => {
        const browser = new PlaywrightBrowser({
          browser: "firefox",
          executablePath,
        });
        expect(browser).toBeDefined();
        expect(browser).toBeInstanceOf(PlaywrightBrowser);
      });
    });

    it("should pass executablePath to launch options", () => {
      const browser = new PlaywrightBrowser({
        browser: "chrome",
        executablePath: "/usr/bin/google-chrome",
      });
      expect(browser).toBeDefined();

      const mappedOptions = (browser as any).mapOptionsToPlaywright();
      expect(mappedOptions.launchOptions.executablePath).toBe("/usr/bin/google-chrome");
    });

    it("should handle executablePath with other options", () => {
      const browser = new PlaywrightBrowser({
        browser: "chrome",
        executablePath: "/usr/bin/chromium",
        headless: true,
        blockAds: true,
        blockResources: ["image"],
      });
      expect(browser).toBeDefined();
      expect(browser).toBeInstanceOf(PlaywrightBrowser);

      const mappedOptions = (browser as any).mapOptionsToPlaywright();
      expect(mappedOptions.launchOptions.executablePath).toBe("/usr/bin/chromium");
    });

    it("should prioritize top-level executablePath over launchOptions executablePath", () => {
      const browser = new PlaywrightBrowser({
        browser: "chrome",
        executablePath: "/usr/bin/google-chrome-beta",
        launchOptions: {
          executablePath: "/usr/bin/google-chrome",
        },
      });
      expect(browser).toBeDefined();

      const mappedOptions = (browser as any).mapOptionsToPlaywright();
      expect(mappedOptions.launchOptions.executablePath).toBe("/usr/bin/google-chrome-beta");
    });

    it("should handle undefined executablePath gracefully", () => {
      const browser = new PlaywrightBrowser({
        browser: "firefox",
      });
      expect(browser).toBeDefined();

      const mappedOptions = (browser as any).mapOptionsToPlaywright();
      expect(mappedOptions.launchOptions.executablePath).toBeUndefined();
    });

    it("should work with channel and executablePath together", () => {
      const browser = new PlaywrightBrowser({
        browser: "chrome",
        channel: "chrome-beta",
        executablePath: "/usr/bin/google-chrome-beta",
      });
      expect(browser).toBeDefined();

      const mappedOptions = (browser as any).mapOptionsToPlaywright();
      expect(mappedOptions.launchOptions.channel).toBe("chrome-beta");
      expect(mappedOptions.launchOptions.executablePath).toBe("/usr/bin/google-chrome-beta");
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

  describe("element ref validation and error handling", () => {
    let browser: PlaywrightBrowser;

    beforeEach(() => {
      browser = new PlaywrightBrowser();
    });

    describe("validateElementRef", () => {
      it("should throw InvalidRefException when element doesn't exist", async () => {
        // Mock the page and locator
        const mockLocator = {
          count: vi.fn().mockResolvedValue(0),
        };
        const mockPage = {
          locator: vi.fn().mockReturnValue(mockLocator),
        };
        (browser as any).page = mockPage;

        await expect((browser as any).validateElementRef("nonexistent")).rejects.toThrow(
          InvalidRefException,
        );
        await expect((browser as any).validateElementRef("nonexistent")).rejects.toThrow(
          "Invalid element reference 'nonexistent'",
        );
      });

      it("should throw InvalidRefException when multiple elements match", async () => {
        const mockLocator = {
          count: vi.fn().mockResolvedValue(2),
        };
        const mockPage = {
          locator: vi.fn().mockReturnValue(mockLocator),
        };
        (browser as any).page = mockPage;

        await expect((browser as any).validateElementRef("duplicate")).rejects.toThrow(
          InvalidRefException,
        );
        await expect((browser as any).validateElementRef("duplicate")).rejects.toThrow(
          "Multiple elements found with reference 'duplicate'",
        );
      });

      it("should return locator when element exists", async () => {
        const mockLocator = {
          count: vi.fn().mockResolvedValue(1),
        };
        const mockPage = {
          locator: vi.fn().mockReturnValue(mockLocator),
        };
        (browser as any).page = mockPage;

        const result = await (browser as any).validateElementRef("valid");
        expect(result).toBe(mockLocator);
        expect(mockPage.locator).toHaveBeenCalledWith('[data-pilo-ref="valid"]');
      });
    });

    describe("actionRequiresElement", () => {
      it("should return true for element actions", () => {
        const elementActions = [
          PageAction.Click,
          PageAction.Hover,
          PageAction.Fill,
          PageAction.Focus,
          PageAction.Check,
          PageAction.Uncheck,
          PageAction.Select,
          PageAction.Enter,
        ];

        elementActions.forEach((action) => {
          expect((browser as any).actionRequiresElement(action)).toBe(true);
        });
      });

      it("should return false for non-element actions", () => {
        const nonElementActions = [
          PageAction.Wait,
          PageAction.Goto,
          PageAction.Back,
          PageAction.Forward,
          PageAction.Done,
        ];

        nonElementActions.forEach((action) => {
          expect((browser as any).actionRequiresElement(action)).toBe(false);
        });
      });
    });

    describe("performAction error handling", () => {
      it("should throw BrowserActionException for missing value in Fill action", async () => {
        const mockLocator = {
          count: vi.fn().mockResolvedValue(1),
          scrollIntoViewIfNeeded: vi.fn(),
          fill: vi.fn(),
        };
        const mockPage = {
          locator: vi.fn().mockReturnValue(mockLocator),
        };
        (browser as any).page = mockPage;

        await expect(browser.performAction("ref1", PageAction.Fill)).rejects.toThrow(
          BrowserActionException,
        );
        await expect(browser.performAction("ref1", PageAction.Fill)).rejects.toThrow(
          "Value required for fill action",
        );
      });

      it("should throw BrowserActionException for missing value in Select action", async () => {
        const mockLocator = {
          count: vi.fn().mockResolvedValue(1),
          scrollIntoViewIfNeeded: vi.fn(),
          selectOption: vi.fn(),
        };
        const mockPage = {
          locator: vi.fn().mockReturnValue(mockLocator),
        };
        (browser as any).page = mockPage;

        await expect(browser.performAction("ref1", PageAction.Select)).rejects.toThrow(
          BrowserActionException,
        );
        await expect(browser.performAction("ref1", PageAction.Select)).rejects.toThrow(
          "Value required for select action",
        );
      });

      it("should throw BrowserActionException for missing value in FillAndEnter action", async () => {
        const mockLocator = {
          count: vi.fn().mockResolvedValue(1),
          scrollIntoViewIfNeeded: vi.fn(),
          fill: vi.fn(),
          press: vi.fn(),
        };
        const mockPage = {
          locator: vi.fn().mockReturnValue(mockLocator),
          waitForTimeout: vi.fn(),
          waitForLoadState: vi.fn(),
        };
        (browser as any).page = mockPage;
      });

      it("should throw BrowserActionException for invalid wait time", async () => {
        const mockPage = {
          waitForTimeout: vi.fn(),
        };
        (browser as any).page = mockPage;

        await expect(browser.performAction("", PageAction.Wait, "invalid")).rejects.toThrow(
          BrowserActionException,
        );
        await expect(browser.performAction("", PageAction.Wait, "-5")).rejects.toThrow(
          "Invalid wait time",
        );
      });

      it("should throw BrowserActionException for missing URL in Goto action", async () => {
        const mockPage = {
          goto: vi.fn(),
        };
        (browser as any).page = mockPage;

        // Test missing URL (undefined)
        await expect(browser.performAction("", PageAction.Goto)).rejects.toThrow(
          BrowserActionException,
        );
        await expect(browser.performAction("", PageAction.Goto)).rejects.toThrow(
          "URL required for goto action",
        );

        // Test empty URL - also caught by first check since !value is true for empty string
        await expect(browser.performAction("", PageAction.Goto, "")).rejects.toThrow(
          BrowserActionException,
        );
        await expect(browser.performAction("", PageAction.Goto, "")).rejects.toThrow(
          "URL required for goto action",
        );
      });

      it("should wrap unexpected errors in BrowserActionException", async () => {
        const mockLocator = {
          count: vi.fn().mockResolvedValue(1),
          scrollIntoViewIfNeeded: vi.fn(),
          click: vi.fn().mockRejectedValue(new Error("Network error")),
        };
        const mockPage = {
          locator: vi.fn().mockReturnValue(mockLocator),
          waitForTimeout: vi.fn(),
          waitForLoadState: vi.fn(),
        };
        (browser as any).page = mockPage;

        await expect(browser.performAction("ref1", PageAction.Click)).rejects.toThrow(
          BrowserActionException,
        );
        await expect(browser.performAction("ref1", PageAction.Click)).rejects.toThrow(
          "Failed to perform action: Network error",
        );
      });

      it("should re-throw InvalidRefException as-is", async () => {
        const mockLocator = {
          count: vi.fn().mockResolvedValue(0),
        };
        const mockPage = {
          locator: vi.fn().mockReturnValue(mockLocator),
        };
        (browser as any).page = mockPage;

        const error = await browser.performAction("missing", PageAction.Click).catch((e) => e);
        expect(error).toBeInstanceOf(InvalidRefException);
        expect(error.ref).toBe("missing");
      });
    });
  });

  describe("CDP endpoint failover", () => {
    // Mock the playwright chromium module for connection tests
    vi.mock("playwright", async (importOriginal) => {
      const actual = await importOriginal<typeof import("playwright")>();
      return {
        ...actual,
        chromium: {
          ...actual.chromium,
          connectOverCDP: vi.fn(),
        },
      };
    });

    let mockChromium: { connectOverCDP: ReturnType<typeof vi.fn> };

    beforeEach(async () => {
      const playwright = await import("playwright");
      mockChromium = playwright.chromium as any;
      vi.clearAllMocks();
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    function makeMockBrowser() {
      const mockPage = { setDefaultTimeout: vi.fn(), close: vi.fn() };
      const mockContext = { newPage: vi.fn().mockResolvedValue(mockPage), close: vi.fn() };
      const mockBrowser = { newContext: vi.fn().mockResolvedValue(mockContext), close: vi.fn() };
      return { mockBrowser, mockContext, mockPage };
    }

    it("normalizes singular pwCdpEndpoint to internal array", () => {
      const browser = new PlaywrightBrowser({ pwCdpEndpoint: "ws://host-a:9222" });
      expect((browser as any).cdpEndpoints).toEqual(["ws://host-a:9222"]);
      expect(browser.pwCdpEndpoints).toEqual(["ws://host-a:9222"]);
    });

    it("uses pwCdpEndpoints (plural) when provided, ignoring singular", () => {
      const browser = new PlaywrightBrowser({
        pwCdpEndpoint: "ws://host-a:9222",
        pwCdpEndpoints: ["ws://host-b:9222", "ws://host-c:9222"],
      });
      expect((browser as any).cdpEndpoints).toEqual(["ws://host-b:9222", "ws://host-c:9222"]);
    });

    it("pwCdpEndpoint getter returns undefined before any connection", () => {
      const browser = new PlaywrightBrowser({ pwCdpEndpoint: "ws://host-a:9222" });
      expect(browser.pwCdpEndpoint).toBeUndefined();
    });

    it("pwCdpEndpoint getter returns active endpoint after successful start()", async () => {
      const { mockBrowser } = makeMockBrowser();
      mockChromium.connectOverCDP.mockResolvedValue(mockBrowser);

      const browser = new PlaywrightBrowser({
        browser: "chromium",
        pwCdpEndpoints: ["ws://host-a:9222", "ws://host-b:9222"],
      });
      await browser.start();

      expect(browser.pwCdpEndpoint).toBe("ws://host-a:9222");
    });

    it("tries second endpoint when first fails with connection refused", async () => {
      const { mockBrowser } = makeMockBrowser();
      mockChromium.connectOverCDP
        .mockRejectedValueOnce(new Error("ECONNREFUSED"))
        .mockResolvedValueOnce(mockBrowser);

      const browser = new PlaywrightBrowser({
        browser: "chromium",
        pwCdpEndpoints: ["ws://host-a:9222", "ws://host-b:9222"],
      });
      await browser.start();

      expect(mockChromium.connectOverCDP).toHaveBeenCalledTimes(2);
      expect(browser.pwCdpEndpoint).toBe("ws://host-b:9222");
    });

    it("tries second endpoint when first times out", async () => {
      const { errors } = await import("playwright");
      const { mockBrowser } = makeMockBrowser();
      mockChromium.connectOverCDP
        .mockRejectedValueOnce(new errors.TimeoutError("Connection timed out"))
        .mockResolvedValueOnce(mockBrowser);

      const browser = new PlaywrightBrowser({
        browser: "chromium",
        pwCdpEndpoints: ["ws://host-a:9222", "ws://host-b:9222"],
      });
      await browser.start();

      expect(mockChromium.connectOverCDP).toHaveBeenCalledTimes(2);
      expect(browser.pwCdpEndpoint).toBe("ws://host-b:9222");
    });

    it("throws hard error when all endpoints are exhausted", async () => {
      mockChromium.connectOverCDP.mockRejectedValue(new Error("ECONNREFUSED"));

      const browser = new PlaywrightBrowser({
        browser: "chromium",
        pwCdpEndpoints: ["ws://host-a:9222", "ws://host-b:9222", "ws://host-c:9222"],
      });

      await expect(browser.start()).rejects.toThrow("All 3 CDP endpoint(s) failed");
      expect(mockChromium.connectOverCDP).toHaveBeenCalledTimes(3);
    });

    it("does not cycle on auth/hard errors", async () => {
      mockChromium.connectOverCDP.mockRejectedValue(new Error("HTTP 401 Unauthorized"));

      const browser = new PlaywrightBrowser({
        browser: "chromium",
        pwCdpEndpoints: ["ws://host-a:9222", "ws://host-b:9222"],
      });

      await expect(browser.start()).rejects.toThrow("HTTP 401 Unauthorized");
      // Only tried the first endpoint — didn't cycle
      expect(mockChromium.connectOverCDP).toHaveBeenCalledTimes(1);
    });

    it("advances nextStartIndex after successful connection for mid-task restart", async () => {
      const { mockBrowser } = makeMockBrowser();
      mockChromium.connectOverCDP.mockResolvedValue(mockBrowser);

      const browser = new PlaywrightBrowser({
        browser: "chromium",
        pwCdpEndpoints: ["ws://host-a:9222", "ws://host-b:9222", "ws://host-c:9222"],
      });

      await browser.start();
      expect(mockChromium.connectOverCDP).toHaveBeenLastCalledWith(
        "ws://host-a:9222",
        expect.any(Object),
      );
      expect((browser as any).nextStartIndex).toBe(1);

      await browser.shutdown();
      await browser.start();
      expect(mockChromium.connectOverCDP).toHaveBeenLastCalledWith(
        "ws://host-b:9222",
        expect.any(Object),
      );
      expect((browser as any).nextStartIndex).toBe(2);
    });

    it("calls onCdpEndpointCycle callback when cycling", async () => {
      const { mockBrowser } = makeMockBrowser();
      const cycleCallback = vi.fn();
      mockChromium.connectOverCDP
        .mockRejectedValueOnce(new Error("ECONNREFUSED"))
        .mockResolvedValueOnce(mockBrowser);

      const browser = new PlaywrightBrowser({
        browser: "chromium",
        pwCdpEndpoints: ["ws://host-a:9222", "ws://host-b:9222"],
        onCdpEndpointCycle: cycleCallback,
      });
      await browser.start();

      expect(cycleCallback).toHaveBeenCalledOnce();
      expect(cycleCallback).toHaveBeenCalledWith(1, expect.any(Error));
    });

    it("does not call onCdpEndpointCycle on hard errors", async () => {
      const cycleCallback = vi.fn();
      mockChromium.connectOverCDP.mockRejectedValue(new Error("HTTP 401 Unauthorized"));

      const browser = new PlaywrightBrowser({
        browser: "chromium",
        pwCdpEndpoints: ["ws://host-a:9222", "ws://host-b:9222"],
        onCdpEndpointCycle: cycleCallback,
      });

      await expect(browser.start()).rejects.toThrow();
      expect(cycleCallback).not.toHaveBeenCalled();
    });

    it("falls through to local launch when cdpEndpoints is empty", () => {
      // No CDP configured — should not touch connectOverCDP at all
      // (We just verify the internal state; actual launch isn't tested here)
      const browser = new PlaywrightBrowser({ browser: "chromium" });
      expect((browser as any).cdpEndpoints).toEqual([]);
    });
  });

  describe("browser disconnect detection", () => {
    let browser: PlaywrightBrowser;

    beforeEach(() => {
      browser = new PlaywrightBrowser({ browser: "chromium" });
      // Inject a mock page so the browser appears started
      (browser as any).page = {
        locator: vi.fn(),
        screenshot: vi.fn(),
        evaluate: vi.fn(),
        frames: vi.fn().mockReturnValue([]),
        mainFrame: vi.fn(),
        waitForTimeout: vi.fn(),
        url: vi.fn().mockReturnValue("https://example.com"),
      };
    });

    it("throws BrowserDisconnectedError from performAction on target-closed message", async () => {
      const targetClosedError = new Error("Target page, context or browser has been closed");
      const mockLocator = {
        count: vi.fn().mockResolvedValue(1),
        scrollIntoViewIfNeeded: vi.fn().mockResolvedValue(undefined),
        click: vi.fn().mockRejectedValue(targetClosedError),
      };
      (browser as any).page.locator.mockReturnValue(mockLocator);

      await expect(browser.performAction("s1e1", PageAction.Click)).rejects.toThrow(
        BrowserDisconnectedError,
      );
    });

    it("throws BrowserDisconnectedError from performAction on TargetClosedError constructor name", async () => {
      const err = new Error("some internal playwright message");
      err.constructor = { name: "TargetClosedError" } as any;
      Object.defineProperty(err, "constructor", { value: { name: "TargetClosedError" } });
      const mockLocator = {
        count: vi.fn().mockResolvedValue(1),
        scrollIntoViewIfNeeded: vi.fn().mockResolvedValue(undefined),
        click: vi.fn().mockRejectedValue(err),
      };
      (browser as any).page.locator.mockReturnValue(mockLocator);

      await expect(browser.performAction("s1e1", PageAction.Click)).rejects.toThrow(
        BrowserDisconnectedError,
      );
    });

    it("wraps non-disconnect errors from performAction as BrowserActionException", async () => {
      const genericError = new Error("Element not interactable");
      const mockLocator = {
        count: vi.fn().mockResolvedValue(1),
        scrollIntoViewIfNeeded: vi.fn().mockResolvedValue(undefined),
        click: vi.fn().mockRejectedValue(genericError),
      };
      (browser as any).page.locator.mockReturnValue(mockLocator);

      await expect(browser.performAction("s1e1", PageAction.Click)).rejects.toThrow(
        BrowserActionException,
      );
    });

    it("throws BrowserDisconnectedError from getTreeWithRefs on target-closed message", async () => {
      (browser as any).page.evaluate = vi
        .fn()
        .mockRejectedValue(new Error("Target page, context or browser has been closed"));

      await expect(browser.getTreeWithRefs()).rejects.toThrow(BrowserDisconnectedError);
    });

    it("rethrows non-disconnect errors from getTreeWithRefs unchanged", async () => {
      const evalError = new Error("Script evaluation failed");
      (browser as any).page.evaluate = vi.fn().mockRejectedValue(evalError);

      await expect(browser.getTreeWithRefs()).rejects.toThrow("Script evaluation failed");
      await expect(browser.getTreeWithRefs()).rejects.not.toThrow(BrowserDisconnectedError);
    });

    it("throws BrowserDisconnectedError from getScreenshot on target-closed message", async () => {
      (browser as any).page.screenshot = vi
        .fn()
        .mockRejectedValue(new Error("Target page, context or browser has been closed"));

      await expect(browser.getScreenshot()).rejects.toThrow(BrowserDisconnectedError);
    });

    it("rethrows non-disconnect errors from getScreenshot unchanged", async () => {
      const screenshotError = new Error("Screenshot capture failed");
      (browser as any).page.screenshot = vi.fn().mockRejectedValue(screenshotError);

      await expect(browser.getScreenshot()).rejects.toThrow("Screenshot capture failed");
      await expect(browser.getScreenshot()).rejects.not.toThrow(BrowserDisconnectedError);
    });
  });
});

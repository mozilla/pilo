import {
  firefox,
  chromium,
  webkit,
  devices,
  Browser as PlaywrightOriginalBrowser,
  BrowserContext,
  Page,
} from "playwright";
import { AriaBrowser, PageAction, LoadState } from "./ariaBrowser.js";
import { PlaywrightBlocker } from "@ghostery/adblocker-playwright";
import fetch from "cross-fetch";

/**
 * PlaywrightBrowser - Browser implementation using Playwright's accessibility features
 */
export class PlaywrightBrowser implements AriaBrowser {
  private browser: PlaywrightOriginalBrowser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;

  // Default timeouts
  private readonly ACTION_TIMEOUT_MS = 5000; // 5 seconds timeout for interactive actions

  constructor(
    private options: {
      headless?: boolean;
      device?: string;
      browser?: "firefox" | "chrome" | "chromium" | "safari" | "webkit" | "edge";
      bypassCSP?: boolean;
      blockAds?: boolean;
      blockResources?: Array<"image" | "stylesheet" | "font" | "media" | "manifest">;
    } = {},
  ) {}

  async start(): Promise<void> {
    // Merge constructor options with launch options
    const mergedOptions = {
      headless: this.options.headless ?? false,
    };

    // Determine which browser to launch
    const browserType = this.options.browser ?? "firefox";

    switch (browserType) {
      case "firefox":
        this.browser = await firefox.launch(mergedOptions);
        break;
      case "chrome":
      case "chromium":
        this.browser = await chromium.launch(mergedOptions);
        break;
      case "safari":
      case "webkit":
        this.browser = await webkit.launch(mergedOptions);
        break;
      case "edge":
        // Edge uses the same engine as Chrome/Chromium
        this.browser = await chromium.launch({
          ...mergedOptions,
          channel: "msedge",
        });
        break;
      default:
        throw new Error(`Unsupported browser: ${browserType}`);
    }

    // Setup context with device configuration
    let deviceConfig = {};
    if (this.options.device) {
      deviceConfig = devices[this.options.device] || {};
    } else {
      // Set default device based on browser
      switch (browserType) {
        case "firefox":
          deviceConfig = devices["Desktop Firefox"] || {};
          break;
        case "chrome":
        case "chromium":
          deviceConfig = devices["Desktop Chrome"] || {};
          break;
        case "safari":
        case "webkit":
          deviceConfig = devices["Desktop Safari"] || {};
          break;
        case "edge":
          deviceConfig = devices["Desktop Edge"] || {};
          break;
        default:
          deviceConfig = {};
      }
    }

    this.context = await this.browser.newContext({
      ...deviceConfig,
      bypassCSP: this.options.bypassCSP ?? true,
    });

    this.page = await this.context.newPage();

    // Set consistent default timeout for all operations
    this.page.setDefaultTimeout(this.ACTION_TIMEOUT_MS);

    // Enable ad blocking if requested
    if (this.options.blockAds) {
      const blocker = await PlaywrightBlocker.fromPrebuiltAdsAndTracking(fetch);
      blocker.enableBlockingInPage(this.page);
    }

    // Set up resource blocking based on options
    if (this.options.blockResources && this.options.blockResources.length > 0) {
      await this.page.route("**/*", async (route) => {
        const request = route.request();
        const resourceType = request.resourceType();

        // Block if the resource type is in the block list
        if (this.options.blockResources!.includes(resourceType as any)) {
          await route.abort();
        } else {
          await route.continue();
        }
      });
    }
  }

  async shutdown(): Promise<void> {
    if (this.browser) await this.browser.close();
    this.browser = null;
    this.context = null;
    this.page = null;
  }

  async goto(url: string): Promise<void> {
    if (!this.page) throw new Error("Browser not started");
    try {
      console.debug(`🔄 Navigating to: ${url}`);
      // Use "commit" for fastest initial navigation (just waits for document to start loading)
      await this.page.goto(url, {
        waitUntil: "commit",
        timeout: this.ACTION_TIMEOUT_MS,
      });
      console.debug(`✅ Navigation committed to: ${url}`);
      await this.ensureOptimizedPageLoad();
    } catch (error) {
      console.error(
        `❌ Navigation failed to: ${url} - ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw error; // Re-throw to allow caller to handle
    }
  }

  async goBack(): Promise<void> {
    if (!this.page) throw new Error("Browser not started");
    try {
      console.debug(`🔄 Navigating back`);
      await this.page.goBack({
        waitUntil: "commit",
        timeout: this.ACTION_TIMEOUT_MS,
      });
      console.debug(`✅ Back navigation committed`);
      await this.ensureOptimizedPageLoad();
    } catch (error) {
      console.error(
        `❌ Back navigation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error; // Re-throw to allow caller to handle
    }
  }

  async goForward(): Promise<void> {
    if (!this.page) throw new Error("Browser not started");
    try {
      console.debug(`🔄 Navigating forward`);
      await this.page.goForward({
        waitUntil: "commit",
        timeout: this.ACTION_TIMEOUT_MS,
      });
      console.debug(`✅ Forward navigation committed`);
      await this.ensureOptimizedPageLoad();
    } catch (error) {
      console.error(
        `❌ Forward navigation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error; // Re-throw to allow caller to handle
    }
  }

  // Private helper method to ensure page is usable with appropriate timeouts
  private async ensureOptimizedPageLoad(): Promise<void> {
    if (!this.page) throw new Error("Browser not started");

    try {
      // 1. Wait for DOM to be ready - this is critical for interactivity
      await this.page.waitForLoadState("domcontentloaded");
      console.debug("✅ DOM content loaded successfully");
    } catch (error) {
      console.error(
        `❌ DOM content load failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Still continue since we might be able to interact with what's loaded
    }

    // 2. Try to wait for full load, but cap at 5 seconds
    // We catch and ignore timeout errors since the page is usable after domcontentloaded
    try {
      await this.page.waitForLoadState("load", {
        timeout: this.ACTION_TIMEOUT_MS,
      });
      console.debug("✅ Page fully loaded");
    } catch (error) {
      console.debug(
        `⚠️ Page load timed out after ${this.ACTION_TIMEOUT_MS}ms: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async getUrl(): Promise<string> {
    if (!this.page) throw new Error("Browser not started");
    return this.page.url();
  }

  async getTitle(): Promise<string> {
    if (!this.page) throw new Error("Browser not started");
    return this.page.title();
  }

  async getText(): Promise<string> {
    if (!this.page) throw new Error("Browser not started");
    return await this.page.locator("html").ariaSnapshot({ ref: true });
  }

  async getScreenshot(): Promise<Buffer> {
    if (!this.page) throw new Error("Browser not started");
    return await this.page.screenshot();
  }

  async waitForLoadState(state: LoadState, options?: { timeout?: number }): Promise<void> {
    if (!this.page) throw new Error("Browser not started");
    try {
      console.debug(
        `🔄 Waiting for load state: ${state}${
          options?.timeout ? ` with timeout ${options.timeout}ms` : ""
        }`,
      );
      await this.page.waitForLoadState(state, options);
      console.debug(`✅ Load state "${state}" reached successfully`);
    } catch (error) {
      console.error(
        `❌ Failed to reach load state "${state}": ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw error; // Re-throw to allow caller to handle
    }
  }

  async performAction(ref: string, action: PageAction, value?: string): Promise<void> {
    if (!this.page) throw new Error("Browser not started");

    try {
      // Log the action being attempted
      console.debug(
        `🔄 Performing ${action} action on element with ref=${ref}${
          value ? ` with value="${value}"` : ""
        }`,
      );

      // Create a locator for the element
      const locator = this.page.locator(`aria-ref=${ref}`);

      switch (action) {
        // Element interactions
        case PageAction.Click:
          await locator.click({ timeout: this.ACTION_TIMEOUT_MS });
          console.debug(`✅ Click successful on ref=${ref}`);
          // Ensure page is usable after click that may cause navigation
          await this.ensureOptimizedPageLoad();
          break;

        case PageAction.Hover:
          await locator.hover({ timeout: this.ACTION_TIMEOUT_MS });
          console.debug(`✅ Hover successful on ref=${ref}`);
          break;

        case PageAction.Fill:
          if (!value) throw new Error("Value required for fill action");
          await locator.fill(value, { timeout: this.ACTION_TIMEOUT_MS });
          console.debug(`✅ Fill successful on ref=${ref} with value="${value}"`);
          break;

        case PageAction.Focus:
          await locator.focus({ timeout: this.ACTION_TIMEOUT_MS });
          console.debug(`✅ Focus successful on ref=${ref}`);
          break;

        case PageAction.Check:
          await locator.check({ timeout: this.ACTION_TIMEOUT_MS });
          console.debug(`✅ Check successful on ref=${ref}`);
          break;

        case PageAction.Uncheck:
          await locator.uncheck({ timeout: this.ACTION_TIMEOUT_MS });
          console.debug(`✅ Uncheck successful on ref=${ref}`);
          break;

        case PageAction.Select:
          if (!value) throw new Error("Value required for select action");
          await locator.selectOption(value, {
            timeout: this.ACTION_TIMEOUT_MS,
          });
          console.debug(`✅ Select successful on ref=${ref} with value="${value}"`);
          // Forms might trigger page reloads on select
          await this.ensureOptimizedPageLoad();
          break;

        // Navigation and workflow
        case PageAction.Wait:
          if (!value) throw new Error("Value required for wait action");
          const seconds = parseInt(value, 10);
          console.debug(`🕒 Waiting for ${seconds} seconds`);
          await this.page.waitForTimeout(seconds * 1000);
          console.debug(`✅ Wait completed for ${seconds} seconds`);
          break;

        case PageAction.Goto:
          if (!value) throw new Error("URL required for goto action");
          await this.goto(value);
          // Note: goto already calls ensureOptimizedPageLoad internally
          break;

        case PageAction.Back:
          await this.goBack();
          // Note: goBack already calls ensureOptimizedPageLoad internally
          break;

        case PageAction.Forward:
          await this.goForward();
          // Note: goForward already calls ensureOptimizedPageLoad internally
          break;

        case PageAction.Done:
          // This is a no-op in the browser implementation
          // It's handled at a higher level in the automation flow
          console.debug(`✅ Done action received`);
          break;

        default:
          throw new Error(`Unsupported action: ${action}`);
      }
    } catch (error) {
      console.error(
        `❌ Failed to perform ${action} action on ref=${ref}${
          value ? ` with value="${value}"` : ""
        }: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new Error(
        `Failed to perform action: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

import {
  firefox,
  chromium,
  webkit,
  Browser as PlaywrightOriginalBrowser,
  BrowserContext,
  Page,
  LaunchOptions,
  BrowserContextOptions,
  ConnectOptions,
} from "playwright";
import { AriaBrowser, PageAction, LoadState } from "./ariaBrowser.js";
import { PlaywrightBlocker } from "@ghostery/adblocker-playwright";
import fetch from "cross-fetch";

// Type extension for Playwright's private AI snapshot function
type PageEx = Page & {
  _snapshotForAI: () => Promise<string>;
};

export interface PlaywrightBrowserOptions {
  /** Browser type to use (defaults to 'firefox') */
  browser?: "firefox" | "chrome" | "chromium" | "safari" | "webkit" | "edge";
  /** Enable ad blocking using Ghostery's adblocker */
  blockAds?: boolean;
  /** Block specific resource types to improve performance */
  blockResources?: Array<"image" | "stylesheet" | "font" | "media" | "manifest">;
  /** Playwright endpoint URL to connect to remote browser */
  pwEndpoint?: string;
  /** Run browser in headless mode (maps to launchOptions.headless) */
  headless?: boolean;
  /** Bypass Content Security Policy (maps to contextOptions.bypassCSP) */
  bypassCSP?: boolean;
}

export interface ExtendedPlaywrightBrowserOptions extends PlaywrightBrowserOptions {
  /** Playwright browser launch options (passed directly to browser.launch()) */
  launchOptions?: LaunchOptions;
  /** Playwright browser context options (passed directly to browser.newContext()) */
  contextOptions?: BrowserContextOptions;
  /** Playwright connect options (passed directly to browser.connect()) */
  connectOptions?: ConnectOptions;
}

/**
 * PlaywrightBrowser - Browser implementation using Playwright's accessibility features
 */
export class PlaywrightBrowser implements AriaBrowser {
  private browser: PlaywrightOriginalBrowser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;

  // Default timeouts
  private readonly ACTION_TIMEOUT_MS = 5000; // 5 seconds timeout for interactive actions

  constructor(private options: ExtendedPlaywrightBrowserOptions = {}) {}

  /**
   * Maps Spark's top-level options into the appropriate Playwright options
   * Top-level options take precedence over Playwright options
   */
  private mapOptionsToPlaywright(): {
    launchOptions: LaunchOptions;
    contextOptions: BrowserContextOptions;
    connectOptions: ConnectOptions;
  } {
    const launchOptions: LaunchOptions = {
      headless: false, // Spark default
      ...this.options.launchOptions, // User-provided Playwright options
    };

    const contextOptions: BrowserContextOptions = {
      bypassCSP: true, // Spark default
      ...this.options.contextOptions, // User-provided Playwright options
    };

    const connectOptions: ConnectOptions = {
      ...this.options.connectOptions, // User-provided Playwright options
    };

    // Top-level options override Playwright options (clear precedence)
    if (this.options.headless !== undefined) {
      launchOptions.headless = this.options.headless;
    }
    if (this.options.bypassCSP !== undefined) {
      contextOptions.bypassCSP = this.options.bypassCSP;
    }

    return { launchOptions, contextOptions, connectOptions };
  }

  async start(): Promise<void> {
    if (this.browser) {
      throw new Error("Browser already started. Call shutdown() first.");
    }

    // Map all options upfront for clear precedence
    const { launchOptions, contextOptions, connectOptions } = this.mapOptionsToPlaywright();

    // Determine which browser to use
    const browserType = this.options.browser ?? "firefox";

    // Single switch to handle both launch and connect cases
    switch (browserType) {
      case "firefox":
        this.browser = this.options.pwEndpoint
          ? await firefox.connect(this.options.pwEndpoint, connectOptions)
          : await firefox.launch(launchOptions);
        break;

      case "chrome":
      case "chromium":
        this.browser = this.options.pwEndpoint
          ? await chromium.connect(this.options.pwEndpoint, connectOptions)
          : await chromium.launch(launchOptions);
        break;

      case "safari":
      case "webkit":
        this.browser = this.options.pwEndpoint
          ? await webkit.connect(this.options.pwEndpoint, connectOptions)
          : await webkit.launch(launchOptions);
        break;

      case "edge":
        // Edge uses chromium with channel setting
        this.browser = this.options.pwEndpoint
          ? await chromium.connect(this.options.pwEndpoint, connectOptions)
          : await chromium.launch({ ...launchOptions, channel: "msedge" });
        break;

      default:
        throw new Error(`Unsupported browser: ${browserType}`);
    }

    // Setup context
    this.context = await this.browser.newContext(contextOptions);

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
        try {
          const request = route.request();
          const resourceType = request.resourceType();

          // Block if the resource type is in the block list
          if (this.options.blockResources!.includes(resourceType as any)) {
            await route.abort();
          } else {
            await route.continue();
          }
        } catch (error) {
          // If route handling fails, continue to avoid blocking navigation
          try {
            await route.continue();
          } catch (continueError) {
            // Route may already be handled, ignore
          }
        }
      });
    }
  }

  async shutdown(): Promise<void> {
    try {
      if (this.browser) {
        await this.browser.close();
      }
    } catch (error) {
      // Continue with cleanup even if close() fails
    } finally {
      this.browser = null;
      this.context = null;
      this.page = null;
    }
  }

  async goto(url: string): Promise<void> {
    if (!this.page) throw new Error("Browser not started");
    try {
      // Use "commit" for fastest initial navigation (just waits for document to start loading)
      await this.page.goto(url, {
        waitUntil: "commit",
        timeout: this.ACTION_TIMEOUT_MS,
      });
      await this.ensureOptimizedPageLoad();
    } catch (error) {
      throw error; // Re-throw to allow caller to handle
    }
  }

  async goBack(): Promise<void> {
    if (!this.page) throw new Error("Browser not started");
    try {
      await this.page.goBack({
        waitUntil: "commit",
        timeout: this.ACTION_TIMEOUT_MS,
      });
      await this.ensureOptimizedPageLoad();
    } catch (error) {
      throw error; // Re-throw to allow caller to handle
    }
  }

  async goForward(): Promise<void> {
    if (!this.page) throw new Error("Browser not started");
    try {
      await this.page.goForward({
        waitUntil: "commit",
        timeout: this.ACTION_TIMEOUT_MS,
      });
      await this.ensureOptimizedPageLoad();
    } catch (error) {
      throw error; // Re-throw to allow caller to handle
    }
  }

  // Private helper method to ensure page is usable with appropriate timeouts
  private async ensureOptimizedPageLoad(): Promise<void> {
    if (!this.page) throw new Error("Browser not started");

    try {
      // 1. Wait for DOM to be ready - this is critical for interactivity
      await this.page.waitForLoadState("domcontentloaded");
    } catch (error) {
      // Still continue since we might be able to interact with what's loaded
    }

    // 2. Try to wait for full load, but cap at 10 seconds
    // We catch and ignore timeout errors since the page is usable after domcontentloaded
    try {
      await this.page.waitForLoadState("load", {
        timeout: this.ACTION_TIMEOUT_MS,
      });
    } catch (error) {
      // Page load timed out - continue anyway
    }

    // 3. Wait 1 second for page to settle (animations, dynamic content, etc.)
    await this.page.waitForTimeout(1000);
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
    return await (this.page as PageEx)._snapshotForAI();
  }

  async getScreenshot(): Promise<Buffer> {
    if (!this.page) throw new Error("Browser not started");
    return await this.page.screenshot({
      fullPage: true,
      type: "jpeg",
      quality: 80,
      scale: "css",
    });
  }

  async waitForLoadState(state: LoadState, options?: { timeout?: number }): Promise<void> {
    if (!this.page) throw new Error("Browser not started");
    try {
      await this.page.waitForLoadState(state, options);
    } catch (error) {
      throw error; // Re-throw to allow caller to handle
    }
  }

  async performAction(ref: string, action: PageAction, value?: string): Promise<void> {
    if (!this.page) throw new Error("Browser not started");

    try {
      // Create a locator for the element
      const locator = this.page.locator(`aria-ref=${ref}`);

      switch (action) {
        // Element interactions
        case PageAction.Click:
          await locator.click({ timeout: this.ACTION_TIMEOUT_MS });
          // Ensure page is usable after click that may cause navigation
          await this.ensureOptimizedPageLoad();
          break;

        case PageAction.Hover:
          await locator.hover({ timeout: this.ACTION_TIMEOUT_MS });
          break;

        case PageAction.Fill:
          if (!value) throw new Error("Value required for fill action");
          await locator.fill(value, { timeout: this.ACTION_TIMEOUT_MS });
          break;

        case PageAction.Focus:
          await locator.focus({ timeout: this.ACTION_TIMEOUT_MS });
          break;

        case PageAction.Check:
          await locator.check({ timeout: this.ACTION_TIMEOUT_MS });
          break;

        case PageAction.Uncheck:
          await locator.uncheck({ timeout: this.ACTION_TIMEOUT_MS });
          break;

        case PageAction.Select:
          if (!value) throw new Error("Value required for select action");
          await locator.selectOption(value, {
            timeout: this.ACTION_TIMEOUT_MS,
          });
          // Forms might trigger page reloads on select
          await this.ensureOptimizedPageLoad();
          break;

        // Navigation and workflow
        case PageAction.Wait:
          if (!value) throw new Error("Value required for wait action");
          const seconds = parseInt(value, 10);
          if (isNaN(seconds) || seconds < 0) {
            throw new Error(`Invalid wait time: ${value}. Must be a positive number.`);
          }
          await this.page.waitForTimeout(seconds * 1000);
          break;

        case PageAction.Goto:
          if (!value) throw new Error("URL required for goto action");
          if (!value.trim()) throw new Error("URL cannot be empty");
          await this.goto(value.trim());
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
          break;

        default:
          throw new Error(`Unsupported action: ${action}`);
      }
    } catch (error) {
      throw new Error(
        `Failed to perform action: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

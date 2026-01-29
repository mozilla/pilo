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
  Locator,
  errors as playwrightErrors,
} from "playwright";
import { AriaBrowser, PageAction, LoadState } from "./ariaBrowser.js";
import { PlaywrightBlocker } from "@ghostery/adblocker-playwright";
import fetch from "cross-fetch";
import TurndownService from "turndown";
import {
  InvalidRefException,
  BrowserActionException,
  NavigationTimeoutException,
  NavigationNetworkException,
} from "../errors.js";
import { NavigationRetryConfig, calculateTimeout } from "./navigationRetry.js";
import { getConfigDefaults } from "../configDefaults.js";
import { createNavigationRetryConfig } from "../utils/configMerge.js";

// Type extension for Playwright's private AI snapshot function
// See: https://github.com/microsoft/playwright/blob/main/packages/playwright-core/src/client/page.ts#L858-L860
type PageEx = Page & {
  _snapshotForAI: () => Promise<{ full: string; incremental?: string }>;
};

export interface PlaywrightBrowserOptions {
  /** Browser type to use (defaults to 'firefox') */
  browser?: "firefox" | "chrome" | "chromium" | "safari" | "webkit" | "edge";
  /** Enable ad blocking using Ghostery's adblocker */
  blockAds?: boolean;
  /** Block specific resource types to improve performance */
  blockResources?: Array<"image" | "stylesheet" | "font" | "media" | "manifest">;
  /** Bypass Content Security Policy (maps to contextOptions.bypassCSP) */
  bypassCSP?: boolean;
  /** Browser channel to use (e.g. 'chrome', 'msedge', 'chrome-beta', 'firefox') */
  channel?: string;
  /** Path to a browser executable to use instead of the bundled browser (maps to launchOptions.executablePath) */
  executablePath?: string;
  /** Run browser in headless mode (maps to launchOptions.headless) */
  headless?: boolean;
  /** Proxy server URL (http://host:port, https://host:port, socks5://host:port) */
  proxyServer?: string;
  /** Proxy authentication username */
  proxyUsername?: string;
  /** Proxy authentication password */
  proxyPassword?: string;
  /** Chrome DevTools Protocol endpoint URL (chromium browsers only) */
  pwCdpEndpoint?: string;
  /** Playwright endpoint URL to connect to remote browser */
  pwEndpoint?: string;
  /** Navigation retry configuration */
  navigationRetry?: Partial<NavigationRetryConfig>;
  /** Timeout for page load and element actions in milliseconds (default: 30000) */
  actionTimeoutMs?: number;
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
  public browserName: string;
  public channel: string | undefined;
  private browser: PlaywrightOriginalBrowser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;

  // Timeout for page load and element actions (configurable)
  private readonly actionTimeoutMs: number;

  // Navigation retry configuration
  private readonly navigationConfig: NavigationRetryConfig;

  // Track refs from last snapshot to distinguish hallucinations from page changes
  private lastSnapshotRefs?: Set<string>;

  constructor(private options: ExtendedPlaywrightBrowserOptions = {}) {
    this.browserName = `playwright:${this.options.browser ?? "firefox"}`;
    this.channel = this.options.channel ?? this.getDefaultChannel();

    // Initialize action timeout from options or use default
    this.actionTimeoutMs = options.actionTimeoutMs ?? getConfigDefaults().action_timeout_ms;

    // Initialize navigation retry config with defaults and overrides
    // Uses createNavigationRetryConfig which safely handles undefined values
    this.navigationConfig = createNavigationRetryConfig(options.navigationRetry);
  }

  get pwEndpoint(): string | undefined {
    return this.options.pwEndpoint;
  }

  get pwCdpEndpoint(): string | undefined {
    return this.options.pwCdpEndpoint;
  }

  get proxyServer(): string | undefined {
    return this.options.proxyServer;
  }

  /**
   * Get the default channel based on browser type
   */
  private getDefaultChannel(): string | undefined {
    const browserType = this.options.browser ?? "firefox";

    switch (browserType) {
      case "edge":
        // Edge uses the "msedge" channel in Playwright
        return "msedge";
      case "chrome":
        return "chrome";
      case "firefox":
        return "firefox";
      case "chromium":
      case "safari":
      case "webkit":
      default:
        // These browsers don't use channels or use bundled versions
        return undefined;
    }
  }

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
      channel: this.options.channel ?? this.getDefaultChannel(),
      ...this.options.launchOptions, // User-provided Playwright options
    };

    // Filter out empty args to avoid Playwright issues
    if (launchOptions.args) {
      launchOptions.args = launchOptions.args.filter((arg) => !!arg);
    }

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
    if (this.options.channel !== undefined) {
      launchOptions.channel = this.options.channel;
    }
    if (this.options.executablePath !== undefined) {
      launchOptions.executablePath = this.options.executablePath;
    }
    if (this.options.proxyServer) {
      launchOptions.proxy = {
        server: this.options.proxyServer,
        ...(this.options.proxyUsername && { username: this.options.proxyUsername }),
        ...(this.options.proxyPassword && { password: this.options.proxyPassword }),
      };
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
        if (this.options.pwCdpEndpoint) {
          this.browser = await chromium.connectOverCDP(this.options.pwCdpEndpoint, connectOptions);
        } else if (this.options.pwEndpoint) {
          this.browser = await chromium.connect(this.options.pwEndpoint, connectOptions);
        } else {
          this.browser = await chromium.launch(launchOptions);
        }
        break;

      case "safari":
      case "webkit":
        this.browser = this.options.pwEndpoint
          ? await webkit.connect(this.options.pwEndpoint, connectOptions)
          : await webkit.launch(launchOptions);
        break;

      case "edge":
        // Edge uses chromium with channel setting (defaults to "msedge")
        if (this.options.pwCdpEndpoint) {
          this.browser = await chromium.connectOverCDP(this.options.pwCdpEndpoint, connectOptions);
        } else if (this.options.pwEndpoint) {
          this.browser = await chromium.connect(this.options.pwEndpoint, connectOptions);
        } else {
          this.browser = await chromium.launch(launchOptions);
        }
        break;

      default:
        throw new Error(`Unsupported browser: ${browserType}`);
    }

    // Setup context
    this.context = await this.browser.newContext(contextOptions);

    this.page = await this.context.newPage();

    // Set consistent default timeout for all operations
    this.page.setDefaultTimeout(this.actionTimeoutMs);

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

  /**
   * Navigate to URL with retry on timeout/network errors
   */
  async goto(url: string): Promise<void> {
    if (!this.page) throw new Error("Browser not started");
    await this.executeNavigationWithRetry((timeoutMs) => this.performGoto(url, timeoutMs), url);
  }

  /**
   * Go back with retry on timeout/network errors
   */
  async goBack(): Promise<void> {
    if (!this.page) throw new Error("Browser not started");
    await this.executeNavigationWithRetry(
      (timeoutMs) => this.performGoBack(timeoutMs),
      "history.back()",
    );
  }

  /**
   * Go forward with retry on timeout/network errors
   */
  async goForward(): Promise<void> {
    if (!this.page) throw new Error("Browser not started");
    await this.executeNavigationWithRetry(
      (timeoutMs) => this.performGoForward(timeoutMs),
      "history.forward()",
    );
  }

  /**
   * Execute navigation with tiered retry logic.
   * Retries on timeout errors and network errors (net::ERR_*).
   */
  private async executeNavigationWithRetry(
    operation: (timeoutMs: number) => Promise<void>,
    url: string,
  ): Promise<void> {
    const maxAttempts = this.navigationConfig.maxAttempts;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const timeoutMs = calculateTimeout(attempt, this.navigationConfig);

      try {
        await operation(timeoutMs);
        return; // Success
      } catch (error) {
        const isTimeout = error instanceof playwrightErrors.TimeoutError;
        const isNetworkError = error instanceof Error && this.isNetworkError(error);
        const isRetryable = isTimeout || isNetworkError;

        if (!isRetryable) {
          throw error;
        }

        // Last attempt - throw appropriate exception
        if (attempt >= maxAttempts) {
          if (isTimeout) {
            throw new NavigationTimeoutException(url, timeoutMs, { attempt, maxAttempts });
          } else {
            throw new NavigationNetworkException(url, (error as Error).message, {
              attempt,
              maxAttempts,
            });
          }
        }

        // More attempts remaining - call retry callback and continue
        if (this.navigationConfig.onRetry) {
          const nextTimeout = calculateTimeout(attempt + 1, this.navigationConfig);
          this.navigationConfig.onRetry(attempt, error as Error, nextTimeout);
        }
      }
    }
  }

  /**
   * Check if an error is a retryable network error.
   * Covers Chromium (net::ERR_*) and Firefox (NS_ERROR_*, NS_BINDING_*) patterns.
   */
  private isNetworkError(error: Error): boolean {
    const message = error.message;
    return (
      message.includes("net::") || // Chromium: net::ERR_CONNECTION_REFUSED, etc.
      message.includes("NS_ERROR_") || // Firefox: NS_ERROR_NET_RESET, etc.
      message.includes("NS_BINDING_") // Firefox: NS_BINDING_ABORTED, etc.
    );
  }

  /**
   * Internal goto implementation
   */
  private async performGoto(url: string, timeoutMs: number): Promise<void> {
    await this.page!.goto(url, {
      waitUntil: "commit",
      timeout: timeoutMs,
    });
    await this.ensureOptimizedPageLoad();
  }

  /**
   * Internal goBack implementation
   */
  private async performGoBack(timeoutMs: number): Promise<void> {
    await this.page!.goBack({
      waitUntil: "commit",
      timeout: timeoutMs,
    });
    await this.ensureOptimizedPageLoad();
  }

  /**
   * Internal goForward implementation
   */
  private async performGoForward(timeoutMs: number): Promise<void> {
    await this.page!.goForward({
      waitUntil: "commit",
      timeout: timeoutMs,
    });
    await this.ensureOptimizedPageLoad();
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

    // 2. Try to wait for full load, but don't block forever
    // We catch and ignore timeout errors since the page is usable after domcontentloaded
    try {
      await this.page.waitForLoadState("load", {
        timeout: this.actionTimeoutMs,
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

  async getTreeWithRefs(): Promise<string> {
    if (!this.page) throw new Error("Browser not started");
    const snapshot = await (this.page as PageEx)._snapshotForAI();

    // Extract and store refs from snapshot for future comparison
    const refMatches = snapshot.full.match(/\[s1e\d+\]/g);
    this.lastSnapshotRefs = new Set(refMatches || []);

    return snapshot.full;
  }

  /**
   * Gets simplified HTML with noise elements removed in browser context
   * Reduces payload size by removing elements we don't need
   */
  async getSimpleHtml(): Promise<string> {
    if (!this.page) throw new Error("Browser not started");

    return await this.page.evaluate(() => {
      const body = document.body || document.documentElement;
      if (!body) return "";

      const clone = body.cloneNode(true) as Element;

      // Remove noise elements in browser context to reduce wire transfer
      clone.querySelectorAll("head, script, style, noscript").forEach((el) => el.remove());

      return clone.innerHTML;
    });
  }

  async getMarkdown(): Promise<string> {
    if (!this.page) throw new Error("Browser not started");

    try {
      // Get simplified HTML (noise removed in browser context)
      const html = await this.getSimpleHtml();

      // Convert HTML to markdown using turndown
      const turndown = new TurndownService({
        headingStyle: "atx",
        codeBlockStyle: "fenced",
        emDelimiter: "*",
        strongDelimiter: "**",
      });

      return turndown.turndown(html);
    } catch (error) {
      throw new Error(
        `Failed to get markdown: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
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

  /**
   * Validates that an element reference exists on the current page
   * @param ref The element reference to validate
   * @returns The locator for the valid element
   * @throws InvalidRefException if the element doesn't exist
   */
  private async validateElementRef(ref: string): Promise<Locator> {
    if (!this.page) throw new Error("Browser not started");

    const locator = this.page.locator(`aria-ref=${ref}`);
    const count = await locator.count();

    if (count === 0) {
      // Extract all refs to provide helpful context
      const allRefs = await this.page.locator("[aria-ref]").evaluateAll((els) =>
        els
          .map((el) => el.getAttribute("aria-ref"))
          .filter((ref): ref is string => ref !== null),
      );

      if (allRefs.length > 0) {
        // Calculate ref range
        const refNumbers = allRefs
          .map((r) => parseInt(r.replace(/[^\d]/g, ""), 10))
          .filter((n) => !isNaN(n));

        const minRef = Math.min(...refNumbers);
        const maxRef = Math.max(...refNumbers);

        // Check if this specific ref existed in the previous snapshot
        let contextMessage: string;
        if (this.lastSnapshotRefs?.has(`[${ref}]`)) {
          // This specific ref was valid before but is now missing
          contextMessage = `This ref was present in the previous snapshot but is now missing - the page content appears to have changed.`;
        } else {
          // This ref was never valid - likely a hallucination
          contextMessage = `This ref was not present in the previous snapshot. Please use only refs visible in the snapshot provided to you.`;
        }

        throw new InvalidRefException(
          ref,
          `Element with ref ${ref} not found. Valid refs range from s1e${minRef} to s1e${maxRef}. ${contextMessage}`,
        );
      }

      // No refs available at all
      throw new InvalidRefException(
        ref,
        `Element with ref ${ref} not found. No refs are available on this page.`,
      );
    }

    if (count > 1) {
      // This shouldn't happen with aria-ref, but let's be defensive
      throw new InvalidRefException(
        ref,
        `Multiple elements found with reference '${ref}'. This may indicate a page structure issue.`,
      );
    }

    return locator;
  }

  async performAction(ref: string, action: PageAction, value?: string): Promise<void> {
    if (!this.page) throw new Error("Browser not started");

    try {
      // Always validate ref for any action that uses it
      // This ensures consistent error messages and early validation
      let locator: Locator | null = null;

      // Check if this action requires an element ref
      const requiresElement = this.actionRequiresElement(action);

      if (requiresElement) {
        // Validate and get the locator
        locator = await this.validateElementRef(ref);
      }

      switch (action) {
        // Element interactions
        case PageAction.Click:
          await locator!.click({ timeout: this.actionTimeoutMs });
          // Ensure page is usable after click that may cause navigation
          await this.ensureOptimizedPageLoad();
          break;

        case PageAction.Hover:
          await locator!.hover({ timeout: this.actionTimeoutMs });
          break;

        case PageAction.Fill:
          if (!value) throw new BrowserActionException("fill", "Value required for fill action");
          await locator!.fill(value, { timeout: this.actionTimeoutMs });
          break;

        case PageAction.Focus:
          await locator!.focus({ timeout: this.actionTimeoutMs });
          break;

        case PageAction.Check:
          await locator!.check({ timeout: this.actionTimeoutMs });
          break;

        case PageAction.Uncheck:
          await locator!.uncheck({ timeout: this.actionTimeoutMs });
          break;

        case PageAction.Select:
          if (!value)
            throw new BrowserActionException("select", "Value required for select action");
          await locator!.selectOption(value, {
            timeout: this.actionTimeoutMs,
          });
          // Forms might trigger page reloads on select
          await this.ensureOptimizedPageLoad();
          break;

        case PageAction.Enter:
          await locator!.press("Enter", { timeout: this.actionTimeoutMs });
          // Forms might trigger page reloads on enter
          await this.ensureOptimizedPageLoad();
          break;

        // Navigation and workflow (these don't need element refs)
        case PageAction.Wait:
          if (!value) throw new BrowserActionException("wait", "Value required for wait action");
          const seconds = parseInt(value, 10);
          if (isNaN(seconds) || seconds < 0) {
            throw new BrowserActionException(
              "wait",
              `Invalid wait time: ${value}. Must be a positive number.`,
            );
          }
          await this.page.waitForTimeout(seconds * 1000);
          break;

        case PageAction.Goto:
          if (!value) throw new BrowserActionException("goto", "URL required for goto action");
          if (!value.trim()) throw new BrowserActionException("goto", "URL cannot be empty");
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

        case PageAction.Extract:
          // Extract is handled at a higher level in the automation flow
          // The browser implementation doesn't need to do anything
          break;

        case PageAction.Abort:
          // Abort is handled at a higher level in the automation flow
          // The browser implementation doesn't need to do anything
          break;

        case PageAction.Done:
          // This is a no-op in the browser implementation
          // It's handled at a higher level in the automation flow
          break;

        default:
          throw new BrowserActionException(String(action), `Unsupported action: ${action}`);
      }
    } catch (error) {
      // Re-throw browser exceptions as-is
      if (error instanceof InvalidRefException || error instanceof BrowserActionException) {
        throw error;
      }

      // Wrap other errors
      throw new BrowserActionException(
        String(action),
        `Failed to perform action: ${error instanceof Error ? error.message : String(error)}`,
        { originalError: error },
      );
    }
  }

  /**
   * Check if an action requires an element reference
   */
  private actionRequiresElement(action: PageAction): boolean {
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

    return elementActions.includes(action);
  }
}

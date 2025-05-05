import {
  firefox,
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

  constructor(
    private options: {
      headless?: boolean;
      device?: string;
      bypassCSP?: boolean;
      blockAds?: boolean;
      blockResources?: Array<
        "image" | "stylesheet" | "font" | "media" | "manifest"
      >;
    } = {}
  ) {}

  async start(): Promise<void> {
    // Merge constructor options with launch options
    const mergedOptions = {
      headless: this.options.headless ?? false,
    };

    this.browser = await firefox.launch(mergedOptions);

    // Setup context with device configuration
    const deviceConfig = this.options.device
      ? devices[this.options.device]
      : devices["Desktop Firefox"];

    this.context = await this.browser.newContext({
      ...deviceConfig,
      bypassCSP: this.options.bypassCSP ?? true,
    });

    this.page = await this.context.newPage();

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
    await this.page.goto(url);
  }

  async goBack(): Promise<void> {
    if (!this.page) throw new Error("Browser not started");
    await this.page.goBack();
  }

  async goForward(): Promise<void> {
    if (!this.page) throw new Error("Browser not started");
    await this.page.goForward();
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

  async waitForLoadState(
    state: LoadState,
    options?: { timeout?: number }
  ): Promise<void> {
    if (!this.page) throw new Error("Browser not started");
    await this.page.waitForLoadState(state, options);
  }

  async performAction(
    ref: string,
    action: PageAction,
    value?: string
  ): Promise<void> {
    if (!this.page) throw new Error("Browser not started");

    try {
      switch (action) {
        // Element interactions
        case PageAction.Click:
          await this.page.locator(`aria-ref=${ref}`).click();
          break;

        case PageAction.Hover:
          await this.page.locator(`aria-ref=${ref}`).hover();
          break;

        case PageAction.Fill:
          if (!value) throw new Error("Value required for fill action");
          await this.page.locator(`aria-ref=${ref}`).fill(value);
          break;

        case PageAction.Focus:
          await this.page.locator(`aria-ref=${ref}`).focus();
          break;

        case PageAction.Check:
          await this.page.locator(`aria-ref=${ref}`).check();
          break;

        case PageAction.Uncheck:
          await this.page.locator(`aria-ref=${ref}`).uncheck();
          break;

        case PageAction.Select:
          if (!value) throw new Error("Value required for select action");
          await this.page.locator(`aria-ref=${ref}`).selectOption(value);
          break;

        // Navigation and workflow
        case PageAction.Wait:
          if (!value) throw new Error("Value required for wait action");
          await this.page.waitForTimeout(parseInt(value, 10) * 1000);
          break;

        case PageAction.Goto:
          if (!value) throw new Error("URL required for goto action");
          await this.goto(value);
          break;

        case PageAction.Back:
          await this.goBack();
          break;

        case PageAction.Forward:
          await this.goForward();
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
        `Failed to perform action: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}

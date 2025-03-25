import {
  firefox,
  devices,
  Browser as PlaywrightOriginalBrowser,
  BrowserContext,
  Page,
} from "playwright";
import { AriaBrowser } from "./ariaBrowser.js";

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
    state: "networkidle" | "domcontentloaded" | "load",
    options?: { timeout?: number }
  ): Promise<void> {
    if (!this.page) throw new Error("Browser not started");
    await this.page.waitForLoadState(state, options);
  }

  async performAction(
    ref: string,
    action: string,
    value?: string
  ): Promise<void> {
    if (!this.page) throw new Error("Browser not started");

    const element = this.page.locator(`aria-ref=${ref}`);

    try {
      switch (action.toLowerCase()) {
        case "click":
          await element.click();
          break;

        case "hover":
          await element.hover();
          break;

        case "fill":
          if (!value) throw new Error("Value required for fill action");
          await element.fill(value);
          break;

        case "focus":
          await element.focus();
          break;

        case "check":
          await element.check();
          break;

        case "uncheck":
          await element.uncheck();
          break;

        case "select":
          if (!value) throw new Error("Value required for select action");
          await element.selectOption(value);
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

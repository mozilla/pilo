import {
  firefox,
  devices,
  Browser as PlaywrightOriginalBrowser,
  BrowserContext,
  Page,
} from "playwright";
import { Browser } from "./browser.js";
import { SimplifierConfig, SimplifierResult, ActionResult } from "../types.js";
import { pageTransformer, getDefaultConfig } from "../pageCapture.js";

/**
 * PlaywrightBrowser - Browser implementation using Playwright
 */
export class PlaywrightBrowser implements Browser {
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

  async launch(launchOptions?: any): Promise<void> {
    // Merge constructor options with launch options
    const mergedOptions = {
      headless: this.options.headless ?? false,
      ...launchOptions,
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

  async close(): Promise<void> {
    if (this.browser) await this.browser.close();
    this.browser = null;
    this.context = null;
    this.page = null;
  }

  async goto(url: string): Promise<void> {
    if (!this.page) throw new Error("Browser not launched");
    await this.page.goto(url);
  }

  async evaluate<T>(fn: Function, ...args: any[]): Promise<T> {
    if (!this.page) throw new Error("Browser not launched");
    return await this.page.evaluate(fn as any, ...args);
  }

  async addScriptTag(options: { content?: string }): Promise<void> {
    if (!this.page) throw new Error("Browser not launched");
    await this.page.addScriptTag(options);
  }

  async waitForLoadState(state: string, options?: any): Promise<void> {
    if (!this.page) throw new Error("Browser not launched");
    await this.page.waitForLoadState(state as any, options);
  }

  async goBack(): Promise<void> {
    if (!this.page) throw new Error("Browser not launched");
    await this.page.goBack();
  }

  async getCurrentUrl(): Promise<string> {
    if (!this.page) throw new Error("Browser not launched");
    return this.page.url();
  }

  async waitForSelector(selector: string, options?: any): Promise<void> {
    if (!this.page) throw new Error("Browser not launched");
    await this.page.waitForSelector(selector, options);
  }

  async capturePage(
    selector: string,
    userConfig?: Partial<SimplifierConfig>
  ): Promise<SimplifierResult> {
    if (!this.page) throw new Error("Browser not launched");

    // Pre-compute the default config
    const defaultConfig = getDefaultConfig();

    // Inject the pageTransformer function and pre-computed default config
    await this.addScriptTag({
      content: `
        window.defaultConfig = ${JSON.stringify(defaultConfig)};
        window.pageTransformer = ${pageTransformer.toString()};
      `,
    });

    // Execute the transformation with merged config
    return await this.evaluate(
      ({
        selector,
        userConfig,
      }: {
        selector: string;
        userConfig?: Partial<SimplifierConfig>;
      }) => {
        // Create a function that returns the injected default config
        // @ts-ignore - We're adding this property to the window
        window.getDefaultConfig = function () {
          // @ts-ignore - We're adding this property to the window
          return window.defaultConfig;
        };

        // Use the transformer with the pre-computed config
        // @ts-ignore - Using the injected function
        return window.pageTransformer(selector, userConfig);
      },
      { selector, userConfig }
    );
  }

  async performAction(
    selector: string,
    action: string,
    value?: string
  ): Promise<ActionResult> {
    if (!this.page) throw new Error("Browser not launched");

    try {
      // Use native Playwright methods instead of injecting code
      switch (action.toLowerCase()) {
        case "click":
          await this.page.click(selector);
          return { success: true };

        case "fill":
          await this.page.fill(selector, value || "");
          return { success: true };

        case "select":
          await this.page.selectOption(selector, value || "");
          return { success: true };

        case "check":
          await this.page.check(selector);
          return { success: true };

        case "uncheck":
          await this.page.uncheck(selector);
          return { success: true };

        case "focus":
          await this.page.focus(selector);
          return { success: true };

        default:
          return {
            success: false,
            error: `Unsupported action: ${action}`,
          };
      }
    } catch (error) {
      console.error("Error performing action:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

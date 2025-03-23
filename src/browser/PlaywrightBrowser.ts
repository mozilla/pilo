import {
  firefox,
  devices,
  Browser as PlaywrightOriginalBrowser,
  BrowserContext,
  Page,
} from "playwright";
import { Browser } from "./Browser";
import { SimplifierConfig, SimplifierResult, ActionResult } from "../types";
import { domTransformer, elementActionPerformer } from "../domSimplifier.js";

/**
 * PlaywrightBrowser - Browser implementation using Playwright
 */
export class PlaywrightBrowser implements Browser {
  private browser: PlaywrightOriginalBrowser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private defaultSimplifierConfig: SimplifierConfig;

  constructor(
    private options: {
      headless?: boolean;
      device?: string;
      bypassCSP?: boolean;
    } = {}
  ) {
    // Initialize with default simplifier config
    this.defaultSimplifierConfig = {
      preserveElements: {
        a: ["title", "role"],
        button: ["type", "disabled", "role"],
        input: ["type", "placeholder", "value", "checked", "disabled", "role"],
        select: ["disabled", "role"],
        option: ["value", "selected"],
        textarea: ["placeholder", "disabled", "role"],
        form: ["method", "role"],
      },
      blockElements: [
        "div",
        "p",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "ul",
        "ol",
        "li",
        "table",
        "tr",
        "form",
        "section",
        "article",
        "header",
        "footer",
        "nav",
        "aside",
        "blockquote",
        "pre",
        "hr",
      ],
      selfClosingElements: ["input", "hr", "meta", "link"],
      removeElements: [
        "script",
        "style",
        "noscript",
        "template",
        "iframe",
        "svg",
        "math",
        "head",
        "canvas",
        "object",
        "embed",
        "video",
        "audio",
        "map",
        "track",
        "param",
        "applet",
        "br",
        "meta",
        "link",
        "img",
      ],
      includeHiddenElements: false,
      preserveAriaRoles: true,
      actionableRoles: [
        "button",
        "link",
        "checkbox",
        "radio",
        "textbox",
        "combobox",
        "listbox",
        "menu",
        "menuitem",
        "tab",
        "searchbox",
        "switch",
        "spinbutton",
      ],
      cleanupWhitespace: true,
    };
  }

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

  async simplifyDOM(
    selector: string,
    userConfig?: Partial<SimplifierConfig>
  ): Promise<SimplifierResult> {
    if (!this.page) throw new Error("Browser not launched");

    // Merge default config with user provided config
    const config = userConfig
      ? { ...this.defaultSimplifierConfig, ...userConfig }
      : this.defaultSimplifierConfig;

    // Inject the DOM transformer function
    await this.addScriptTag({
      content: `window.domTransformer = ${domTransformer.toString()};`,
    });

    // Execute the transformation
    return await this.evaluate(
      ({
        selector,
        config,
      }: {
        selector: string;
        config: SimplifierConfig;
      }) => {
        if (typeof (window as any).domTransformer !== "function") {
          throw new Error("DOM transformer not properly injected");
        }
        return (window as any).domTransformer(selector, config);
      },
      { selector, config }
    );
  }

  async performAction(
    elementId: number,
    action: string,
    value?: string
  ): Promise<ActionResult> {
    if (!this.page) throw new Error("Browser not launched");

    try {
      // Inject the action performer function
      await this.addScriptTag({
        content: `window.elementActionPerformer = ${elementActionPerformer.toString()};`,
      });

      // Create the selector for the element using the data attribute
      const selector = `[data-simplifier-id="${elementId}"]`;

      // Execute the action
      return await this.evaluate(
        ({
          selector,
          action,
          value,
        }: {
          selector: string;
          action: string;
          value?: string;
        }) => {
          if (typeof (window as any).elementActionPerformer !== "function") {
            throw new Error("Element action performer not properly injected");
          }
          return (window as any).elementActionPerformer(
            selector,
            action,
            value
          );
        },
        { selector, action, value }
      );
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

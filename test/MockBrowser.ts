import { Browser } from "../src/browser/Browser";
import { SimplifierConfig, SimplifierResult, ActionResult } from "../src/types";
import {
  domTransformer,
  elementActionPerformer,
} from "../src/domSimplifier.js";

/**
 * MockBrowser - A test implementation of the Browser interface
 * This runs entirely in JSDOM without any external browser dependency
 */
export class MockBrowser implements Browser {
  constructor() {}

  async launch(): Promise<void> {
    // Nothing to launch in the mock
  }

  async close(): Promise<void> {
    // Nothing to close in the mock
  }

  async goto(url: string): Promise<void> {
    // Set the location in JSDOM
    window.location.href = url;
  }

  async evaluate<T>(fn: Function, ...args: any[]): Promise<T> {
    // In the mock, just execute the function directly
    return fn(...args) as T;
  }

  async addScriptTag(): Promise<void> {
    // Scripts are already available in the mock
  }

  async waitForLoadState(): Promise<void> {
    // No waiting needed in the mock
  }

  async goBack(): Promise<void> {
    // No real navigation in the mock
  }

  async getCurrentUrl(): Promise<string> {
    return window.location.href;
  }

  async waitForSelector(): Promise<void> {
    // No waiting needed in the mock
  }

  async simplifyDOM(
    selector: string,
    config?: Partial<SimplifierConfig>
  ): Promise<SimplifierResult> {
    // In the mock browser, we can call domTransformer directly
    return domTransformer(selector, {
      // Default test configuration
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
      includeHiddenElements: true,
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
      cleanupWhitespace: false,
      ...config,
    });
  }

  async performAction(
    elementId: number,
    action: string,
    value?: string
  ): Promise<ActionResult> {
    // Create the selector for the element using the data attribute
    const selector = `[data-simplifier-id="${elementId}"]`;

    // In the mock browser, we can call elementActionPerformer directly
    return await elementActionPerformer(selector, action, value);
  }
}

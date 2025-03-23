import { Browser } from "../src/browser/Browser";
import { SimplifierConfig, SimplifierResult, ActionResult } from "../src/types";
import {
  domTransformer,
  elementActionPerformer,
  getDefaultConfig,
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
    userConfig?: Partial<SimplifierConfig>
  ): Promise<SimplifierResult> {
    // For testing, we want a few test-specific defaults
    const testDefaults: Partial<SimplifierConfig> = {
      includeHiddenElements: true, // Always include hidden elements in tests
      cleanupWhitespace: false, // Keep whitespace for predictable test assertions
    };

    // Pass the merged config to the domTransformer
    return domTransformer(selector, {
      ...testDefaults,
      ...userConfig,
    });
  }

  async performAction(
    selector: string,
    action: string,
    value?: string
  ): Promise<ActionResult> {
    // In the mock browser, we can call elementActionPerformer directly
    return await elementActionPerformer(selector, action, value);
  }
}

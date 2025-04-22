import { AriaBrowser } from "../browser/ariaBrowser.js";

/**
 * ExtensionBrowser - Mock implementation of AriaBrowser for web extension context
 * All methods are stubs for now and should be implemented using WebExtension APIs.
 */
export class ExtensionBrowser implements AriaBrowser {
  async start(): Promise<void> {
    // No-op for extension
    console.log("[ExtensionBrowser] start()");
  }

  async shutdown(): Promise<void> {
    // No-op for extension
    console.log("[ExtensionBrowser] shutdown()");
  }

  async goto(url: string): Promise<void> {
    // TODO: Use browser.tabs.update or similar
    console.log(`[ExtensionBrowser] goto(${url})`);
    throw new Error(`stopped after attempted goto(${url})`);
  }

  async goBack(): Promise<void> {
    // TODO: Use browser.tabs.goBack or history.back
    console.log("[ExtensionBrowser] goBack()");
  }

  async goForward(): Promise<void> {
    // TODO: Use browser.tabs.goForward or history.forward
    console.log("[ExtensionBrowser] goForward()");
  }

  async getUrl(): Promise<string> {
    // TODO: Use browser.tabs.query to get current tab URL
    console.log("[ExtensionBrowser] getUrl()");
    return "https://example.com";
  }

  async getTitle(): Promise<string> {
    // TODO: Use browser.tabs.query to get current tab title
    console.log("[ExtensionBrowser] getTitle()");
    return "Example Page Title";
  }

  async getText(): Promise<string> {
    // TODO: Use content script to extract accessible text from the page
    console.log("[ExtensionBrowser] getText()");
    return "[Mocked page text snapshot]";
  }

  async getScreenshot(): Promise<Buffer> {
    // TODO: Use browser.tabs.captureVisibleTab
    console.log("[ExtensionBrowser] getScreenshot()");
    // Return an empty buffer for now
    return Buffer.from("");
  }

  async performAction(ref: string, action: string, value?: string): Promise<void> {
    // TODO: Use content script to perform actions on the page
    console.log(`[ExtensionBrowser] performAction(ref=${ref}, action=${action}, value=${value})`);
  }

  async waitForLoadState(
    state: "networkidle" | "domcontentloaded" | "load",
    options?: { timeout?: number }
  ): Promise<void> {
    // TODO: Implement waiting logic if needed
    console.log(`[ExtensionBrowser] waitForLoadState(${state}, timeout=${options?.timeout})`);
  }
}

// Add this at the top of the file for TypeScript global declaration
// eslint-disable-next-line no-var
declare var browser: any;

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
    await browser.tabs.update((await this.getTab()).id, { url });
  }

  async goBack(): Promise<void> {
    await browser.scripting.executeScript({
      target: { tabId: (await this.getTab()).id },
      func: () => history.back(),
    });
  }

  async goForward(): Promise<void> {
    await browser.scripting.executeScript({
      target: { tabId: (await this.getTab()).id },
      func: () => history.forward(),
    });
  }

  async getUrl(): Promise<string> {
    return (await this.getTab()).url;
  }

  async getTitle(): Promise<string> {
    return (await this.getTab()).title;
  }

  async getText(): Promise<string> {
    const [{ result }] = await browser.scripting.executeScript({
      target: { tabId: (await this.getTab()).id },
      func: () => document.body.innerText,
    });
    return result;
  }

  async getScreenshot(): Promise<Buffer> {
    // TODO: Use browser.tabs.captureVisibleTab
    console.log("[ExtensionBrowser] getScreenshot()");
    // Return an empty buffer for now
    return Buffer.from("");
  }

  async performAction(ref: string, action: string, value?: string): Promise<void> {
    // TODO: Use content script to perform actions on the page
    if (
        action == "click" &&
        (await browser.scripting.executeScript({
          target: { tabId: (await this.getTab()).id },
          func: () => {
            const element = document.querySelector(
              "a:is([data-cta-text*='Release Notes'],[data-link-text*='Release Notes'])"
            );
            if (element) {
              element.click();
              return true;
            }
            return false;
          }
        }))
      ) {
      return;
    }

    throw new Error(`[ExtensionBrowser] performAction(ref=${ref}, action=${action}, value=${value})`);
  }

  async waitForLoadState(
    state: "networkidle" | "domcontentloaded" | "load",
    options?: { timeout?: number }
  ): Promise<void> {
    console.log(`[ExtensionBrowser] waitForLoadState(${state}, timeout=${options?.timeout})`);
    await new Promise(resolve => setTimeout(resolve, options?.timeout ?? 1000));
  }

  /**
   * Helper to get the current active tab in the current window, or throw if not found
   */
  private async getTab(): Promise<any> {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tabs.length || !tabs[0].id) {
      throw new Error("No active tab found");
    }
    return tabs[0];
  }
}

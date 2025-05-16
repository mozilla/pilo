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
      func: () => {
        // Use the globally available functions from content script
        const snapshot = (window as any).generateAriaTree(document.body, { forAI: true, refPrefix: 's1' });
        return (window as any).renderAriaTree(snapshot, { mode: 'raw', forAI: true });
      }
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
    const [{ result }] = await browser.scripting.executeScript({
      target: { tabId: (await this.getTab()).id },
      func: (ref: string, action: string, value?: string) => {
        // Use the globally available functions from content script
        const snapshot = (window as any).generateAriaTree(document.body, { forAI: true, refPrefix: 's1' });
        const element = snapshot.elements.get(ref);

        if (!element) {
          throw new Error(`Element with ref ${ref} not found`);
        }

        switch (action) {
          case 'click':
            if (element instanceof HTMLElement) {
              element.click();
              return true;
            }
            break;
          case 'type':
            if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
              element.value = value || '';
              element.dispatchEvent(new Event('input', { bubbles: true }));
              element.dispatchEvent(new Event('change', { bubbles: true }));
              return true;
            }
            break;
          case 'select':
            if (element instanceof HTMLSelectElement) {
              element.value = value || '';
              element.dispatchEvent(new Event('change', { bubbles: true }));
              return true;
            }
            break;
        }
        throw new Error(`Action ${action} not supported for element type ${element.constructor.name}`);
      },
      args: [ref, action, value]
    });

    if (!result) {
      throw new Error(`Failed to perform action ${action} on element ${ref}`);
    }
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

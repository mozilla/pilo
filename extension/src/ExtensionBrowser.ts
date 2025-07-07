import type { AriaBrowser } from "spark/core";

/**
 * ExtensionBrowser - Implementation of AriaBrowser for web extension context
 * Uses WebExtension APIs instead of Playwright to interact with web pages
 */
export class ExtensionBrowser implements AriaBrowser {
  async start(): Promise<void> {
    // No-op for extension - browser is already running
  }

  async shutdown(): Promise<void> {
    // No-op for extension - don't close browser
  }

  async goto(url: string): Promise<void> {
    const tab = await this.getActiveTab();
    await browser.tabs.update(tab.id, { url });
  }

  async goBack(): Promise<void> {
    const tab = await this.getActiveTab();
    await browser.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => history.back(),
    });
  }

  async goForward(): Promise<void> {
    const tab = await this.getActiveTab();
    await browser.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => history.forward(),
    });
  }

  async getUrl(): Promise<string> {
    const tab = await this.getActiveTab();
    return tab.url || '';
  }

  async getTitle(): Promise<string> {
    const tab = await this.getActiveTab();
    return tab.title || '';
  }

  async getText(): Promise<string> {
    const tab = await this.getActiveTab();
    const [{ result }] = await browser.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        // Use the globally available functions from content script
        const snapshot = (window as any).generateAriaTree(document.body, { 
          forAI: true, 
          refPrefix: 's1' 
        });
        return (window as any).renderAriaTree(snapshot, { 
          mode: 'raw', 
          forAI: true 
        });
      }
    });
    return result;
  }

  async getScreenshot(): Promise<Buffer> {
    const tab = await this.getActiveTab();
    const dataUrl = await browser.tabs.captureVisibleTab(tab.windowId, {
      format: 'png'
    });
    
    // Convert data URL to Buffer
    const base64Data = dataUrl.split(',')[1];
    return Buffer.from(base64Data, 'base64');
  }

  async performAction(ref: string, action: string, value?: string): Promise<void> {
    const tab = await this.getActiveTab();
    const [{ result }] = await browser.scripting.executeScript({
      target: { tabId: tab.id },
      func: (ref: string, action: string, value?: string) => {
        // Use the globally available functions from content script
        const snapshot = (window as any).generateAriaTree(document.body, { 
          forAI: true, 
          refPrefix: 's1' 
        });
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
    // Simple implementation - wait for specified time
    // TODO: Could be improved with actual load state detection
    await new Promise(resolve => setTimeout(resolve, options?.timeout ?? 1000));
  }

  /**
   * Helper to get the current active tab in the current window
   */
  private async getActiveTab(): Promise<any> {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tabs.length || !tabs[0].id) {
      throw new Error("No active tab found");
    }
    return tabs[0];
  }
}
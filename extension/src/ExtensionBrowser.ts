import type { AriaBrowser } from "spark/core";

/**
 * ExtensionBrowser - Implementation of AriaBrowser for web extension context
 * Uses WebExtension APIs instead of Playwright to interact with web pages
 */
export class ExtensionBrowser implements AriaBrowser {
  readonly browserName = "extension:chrome";
  private tabId?: number;
  constructor(tabId?: number) {
    this.tabId = tabId;
  }

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
    return tab.url || "";
  }

  async getTitle(): Promise<string> {
    const tab = await this.getActiveTab();
    return tab.title || "";
  }

  async getText(): Promise<string> {
    const tab = await this.getActiveTab();

    try {
      const [{ result }] = await browser.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          // Check if content script functions are available
          if (
            typeof (window as any).generateAriaTree !== "function" ||
            typeof (window as any).renderAriaTree !== "function"
          ) {
            return "ERROR: Content script functions not available. Page may not be fully loaded.";
          }

          try {
            // Use the globally available functions from content script
            const snapshot = (window as any).generateAriaTree(document.body, {
              forAI: true,
              refPrefix: "s1",
            });
            return (window as any).renderAriaTree(snapshot, {
              mode: "raw",
              forAI: true,
            });
          } catch (error) {
            return `ERROR: Failed to generate ARIA tree: ${error.message}`;
          }
        },
      });

      if (typeof result === "string" && result.startsWith("ERROR:")) {
        console.error("ExtensionBrowser getText error:", result);
        // Return a basic fallback
        return `Page title: ${tab.title || "Unknown"}\nURL: ${tab.url || "Unknown"}\nContent analysis failed.`;
      }

      return result;
    } catch (error) {
      console.error("ExtensionBrowser getText execution error:", error);
      return `Page title: ${tab.title || "Unknown"}\nURL: ${tab.url || "Unknown"}\nFailed to analyze page content.`;
    }
  }

  async getScreenshot(): Promise<Buffer> {
    const tab = await this.getActiveTab();
    const dataUrl = await browser.tabs.captureVisibleTab(tab.windowId, {
      format: "png",
    });

    // Convert data URL to Buffer
    const base64Data = dataUrl.split(",")[1];
    return Buffer.from(base64Data, "base64");
  }

  async performAction(ref: string, action: string, value?: string): Promise<void> {
    const tab = await this.getActiveTab();

    try {
      const [{ result }] = await browser.scripting.executeScript({
        target: { tabId: tab.id },
        func: (paramsJson) => {
          const { ref: refParam, action: actionParam, value: valueParam } = JSON.parse(paramsJson);
          // Use the globally available functions from content script
          if (typeof (window as any).generateAriaTree !== "function") {
            return { success: false, error: "Content script functions not available" };
          }

          try {
            const snapshot = (window as any).generateAriaTree(document.body, {
              forAI: true,
              refPrefix: "s1",
            });

            const element = snapshot.elements.get(refParam);

            if (!element) {
              return { success: false, error: `Element with ref ${refParam} not found` };
            }

            switch (actionParam) {
              case "click":
                if (element instanceof HTMLElement) {
                  element.click();
                  return { success: true, message: `Clicked element ${refParam}` };
                }
                break;
              case "type":
                if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
                  element.value = valueParam || "";
                  element.dispatchEvent(new Event("input", { bubbles: true }));
                  element.dispatchEvent(new Event("change", { bubbles: true }));
                  return { success: true, message: `Typed into element ${refParam}` };
                }
                break;
              case "select":
                if (element instanceof HTMLSelectElement) {
                  element.value = valueParam || "";
                  element.dispatchEvent(new Event("change", { bubbles: true }));
                  return { success: true, message: `Selected option in ${refParam}` };
                }
                break;
            }

            return {
              success: false,
              error: `Action ${actionParam} not supported for element type ${element.constructor.name}`,
            };
          } catch (error) {
            return { success: false, error: error.message };
          }
        },
        args: [JSON.stringify({ ref, action, value })],
      });

      if (!result?.success) {
        throw new Error(result?.error || `Failed to perform action ${action} on element ${ref}`);
      }
    } catch (error) {
      console.error(`ExtensionBrowser performAction error:`, error);
      throw new Error(`Failed to perform ${action} on ${ref}: ${error.message}`);
    }
  }

  async waitForLoadState(
    state: "networkidle" | "domcontentloaded" | "load",
    options?: { timeout?: number },
  ): Promise<void> {
    // Simple implementation - wait for specified time
    // TODO: Could be improved with actual load state detection
    await new Promise((resolve) => setTimeout(resolve, options?.timeout ?? 1000));
  }

  /**
   * Helper to get the current active tab in the current window
   */
  private async getActiveTab(): Promise<any> {
    if (this.tabId) {
      const tab = await browser.tabs.get(this.tabId);
      if (!tab || !tab.id) {
        throw new Error(`Tab with ID ${this.tabId} not found`);
      }
      return tab;
    }

    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tabs.length || !tabs[0].id) {
      throw new Error("No active tab found");
    }
    return tabs[0];
  }
}

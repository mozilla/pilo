import browser from "webextension-polyfill";
import type { AriaBrowser } from "spark/core";
import type { Tabs } from "webextension-polyfill";

interface ActionResult {
  success: boolean;
  error?: string;
  message?: string;
}

interface AriaSnapshotWindow {
  generateAriaTree: (
    element: Element,
    options: { forAI: boolean; refPrefix: string },
  ) => {
    elements: Map<string, Element>;
  };
  renderAriaTree: (snapshot: any, options: { mode: string; forAI: boolean }) => string;
}

// Constants for timeouts and delays
const DEFAULT_LOAD_TIMEOUT = 3000;
const NETWORKIDLE_DELAY = 500;
const POLL_INTERVAL = 100;
const FALLBACK_TIMEOUT = 1000;

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
    await browser.tabs.update(tab.id!, { url });
  }

  async goBack(): Promise<void> {
    const tab = await this.getActiveTab();
    await browser.scripting.executeScript({
      target: { tabId: tab.id! },
      func: () => history.back(),
    });
  }

  async goForward(): Promise<void> {
    const tab = await this.getActiveTab();
    await browser.scripting.executeScript({
      target: { tabId: tab.id! },
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
        target: { tabId: tab.id! },
        func: () => {
          const win = window as Window & AriaSnapshotWindow;
          // Check if content script functions are available
          if (
            typeof win.generateAriaTree !== "function" ||
            typeof win.renderAriaTree !== "function"
          ) {
            return "ERROR: Content script functions not available. Page may not be fully loaded.";
          }

          try {
            // Use the globally available functions from content script
            const snapshot = win.generateAriaTree(document.body, {
              forAI: true,
              refPrefix: "s1",
            });
            return win.renderAriaTree(snapshot, {
              mode: "raw",
              forAI: true,
            });
          } catch (error) {
            return `ERROR: Failed to generate ARIA tree: ${error instanceof Error ? error.message : String(error)}`;
          }
        },
      });

      if (typeof result === "string" && result.startsWith("ERROR:")) {
        console.error("ExtensionBrowser getText error:", result);
        // Return a basic fallback
        return `Page title: ${tab.title || "Unknown"}\nURL: ${tab.url || "Unknown"}\nContent analysis failed.`;
      }

      return result as string;
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
    // Handle non-element actions first
    switch (action) {
      case "wait":
        if (!value) throw new Error("Value required for wait action");
        const seconds = parseInt(value, 10);
        if (isNaN(seconds) || seconds < 0) {
          throw new Error(`Invalid wait time: ${value}. Must be a positive number.`);
        }
        await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
        return;

      case "goto":
        if (!value) throw new Error("URL required for goto action");
        if (!value.trim()) throw new Error("URL cannot be empty");
        await this.goto(value.trim());
        return;

      case "back":
        await this.goBack();
        return;

      case "forward":
        await this.goForward();
        return;

      case "done":
        // This is a no-op in the browser implementation
        // It's handled at a higher level in the automation flow
        return;
    }

    // Handle element-based actions
    const tab = await this.getActiveTab();

    try {
      const [{ result }] = await browser.scripting.executeScript({
        target: { tabId: tab.id! },
        func: (paramsJson: string) => {
          const { ref: refParam, action: actionParam, value: valueParam } = JSON.parse(paramsJson);
          const win = window as Window & AriaSnapshotWindow;
          // Use the globally available functions from content script
          if (typeof win.generateAriaTree !== "function") {
            return { success: false, error: "Content script functions not available" };
          }

          try {
            const snapshot = win.generateAriaTree(document.body, {
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

              case "hover":
                if (element instanceof HTMLElement) {
                  const event = new MouseEvent("mouseover", { bubbles: true, cancelable: true });
                  element.dispatchEvent(event);
                  return { success: true, message: `Hovered over element ${refParam}` };
                }
                break;

              case "fill":
              case "type":
                if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
                  element.value = valueParam || "";
                  element.dispatchEvent(new Event("input", { bubbles: true }));
                  element.dispatchEvent(new Event("change", { bubbles: true }));
                  return { success: true, message: `Filled element ${refParam}` };
                }
                break;

              case "focus":
                if (element instanceof HTMLElement) {
                  element.focus();
                  return { success: true, message: `Focused element ${refParam}` };
                }
                break;

              case "check":
                if (element instanceof HTMLInputElement && element.type === "checkbox") {
                  element.checked = true;
                  element.dispatchEvent(new Event("change", { bubbles: true }));
                  return { success: true, message: `Checked element ${refParam}` };
                }
                break;

              case "uncheck":
                if (element instanceof HTMLInputElement && element.type === "checkbox") {
                  element.checked = false;
                  element.dispatchEvent(new Event("change", { bubbles: true }));
                  return { success: true, message: `Unchecked element ${refParam}` };
                }
                break;

              case "select":
                if (element instanceof HTMLSelectElement) {
                  element.value = valueParam || "";
                  element.dispatchEvent(new Event("change", { bubbles: true }));
                  return { success: true, message: `Selected option in ${refParam}` };
                }
                break;

              case "enter":
                if (element instanceof HTMLElement) {
                  const event = new KeyboardEvent("keydown", { key: "Enter", bubbles: true });
                  element.dispatchEvent(event);
                  return { success: true, message: `Pressed Enter on element ${refParam}` };
                }
                break;
            }

            return {
              success: false,
              error: `Action ${actionParam} not supported for element type ${element.constructor.name}`,
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : String(error),
            };
          }
        },
        args: [JSON.stringify({ ref, action, value })],
      });

      const typedResult = result as ActionResult;
      if (!typedResult?.success) {
        throw new Error(
          typedResult?.error || `Failed to perform action ${action} on element ${ref}`,
        );
      }
    } catch (error) {
      console.error(`ExtensionBrowser performAction error:`, error);
      throw new Error(
        `Failed to perform ${action} on ${ref}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async waitForLoadState(
    state: "networkidle" | "domcontentloaded" | "load",
    options?: { timeout?: number },
  ): Promise<void> {
    const tab = await this.getActiveTab();
    const timeout = options?.timeout ?? DEFAULT_LOAD_TIMEOUT;

    try {
      await browser.scripting.executeScript({
        target: { tabId: tab.id! },
        func: (state: string, timeout: number) => {
          return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(
              () => {
                reject(new Error(`Timeout waiting for load state: ${state}`));
              },
              typeof timeout === "number" ? timeout : 30000,
            );

            const checkState = () => {
              switch (state) {
                case "domcontentloaded":
                  if (document.readyState === "interactive" || document.readyState === "complete") {
                    clearTimeout(timeoutId);
                    resolve(true);
                  }
                  break;
                case "load":
                  if (document.readyState === "complete") {
                    clearTimeout(timeoutId);
                    resolve(true);
                  }
                  break;
                case "networkidle":
                  // Simple networkidle implementation - wait for no new network requests for 500ms
                  if (document.readyState === "complete") {
                    setTimeout(() => {
                      clearTimeout(timeoutId);
                      resolve(true);
                    }, NETWORKIDLE_DELAY);
                  }
                  break;
              }
            };

            // Check immediately
            checkState();

            // If not ready, poll every 100ms
            const pollInterval = setInterval(() => {
              checkState();
              if (document.readyState === "complete" && state !== "networkidle") {
                clearInterval(pollInterval);
              }
            }, POLL_INTERVAL);

            // Listen for load events
            if (state === "domcontentloaded" && document.readyState === "loading") {
              document.addEventListener(
                "DOMContentLoaded",
                () => {
                  clearInterval(pollInterval);
                  clearTimeout(timeoutId);
                  resolve(true);
                },
                { once: true },
              );
            }

            if (state === "load" && document.readyState !== "complete") {
              window.addEventListener(
                "load",
                () => {
                  clearInterval(pollInterval);
                  clearTimeout(timeoutId);
                  resolve(true);
                },
                { once: true },
              );
            }
          });
        },
        args: [state, timeout],
      });
    } catch (error) {
      // Fallback to simple timeout if script execution fails
      await new Promise((resolve) => setTimeout(resolve, Math.min(timeout, FALLBACK_TIMEOUT)));
    }
  }

  /**
   * Helper to get the current active tab in the current window
   */
  private async getActiveTab(): Promise<Tabs.Tab> {
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

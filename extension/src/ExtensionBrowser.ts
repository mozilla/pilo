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

/**
 * ExtensionBrowser - Implementation of AriaBrowser for web extension context
 * Uses WebExtension APIs instead of Playwright to interact with web pages
 */
export class ExtensionBrowser implements AriaBrowser {
  readonly browserName = "extension:chrome";
  private tabId?: number;
  private currentSnapshot?: { elements: Map<string, Element>; renderedText: string };

  // Match Playwright's timeout - 5 seconds timeout for interactive actions
  private readonly ACTION_TIMEOUT_MS = 5000;
  // Page settle time after load events (animations, dynamic content, etc.)
  private readonly PAGE_SETTLE_TIME_MS = 1000;
  // Network idle delay for networkidle state
  private readonly NETWORKIDLE_DELAY_MS = 500;
  // Max retries for content script availability
  private readonly CONTENT_SCRIPT_RETRY_COUNT = 3;
  // Delay between content script checks
  private readonly CONTENT_SCRIPT_RETRY_DELAY_MS = 500;

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
    try {
      // Extension equivalent of "commit" - just start the navigation
      await browser.tabs.update(tab.id!, { url });
      // Handle page transition
      await this.handlePageTransition();
    } catch (error) {
      throw error; // Re-throw to allow caller to handle
    }
  }

  async goBack(): Promise<void> {
    const tab = await this.getActiveTab();
    try {
      await browser.scripting.executeScript({
        target: { tabId: tab.id! },
        func: () => history.back(),
      });
      // Handle page transition
      await this.handlePageTransition();
    } catch (error) {
      throw error; // Re-throw to allow caller to handle
    }
  }

  async goForward(): Promise<void> {
    const tab = await this.getActiveTab();
    try {
      await browser.scripting.executeScript({
        target: { tabId: tab.id! },
        func: () => history.forward(),
      });
      // Handle page transition
      await this.handlePageTransition();
    } catch (error) {
      throw error; // Re-throw to allow caller to handle
    }
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
      await this.ensureContentScript();
    } catch (error) {
      console.warn("Content script not available:", error);
      // Return basic fallback when content script unavailable
      return `Page title: ${tab.title || "Unknown"}\nURL: ${tab.url || "Unknown"}\nContent script not available on this page.`;
    }

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
            throw new Error(
              "Content script functions not available. Page may not be fully loaded.",
            );
          }

          // Use the globally available functions from content script
          const snapshot = win.generateAriaTree(document.body, {
            forAI: true,
            refPrefix: "s1",
          });
          const renderedText = win.renderAriaTree(snapshot, {
            mode: "raw",
            forAI: true,
          });

          // Return both the rendered text and elements map for caching
          return {
            renderedText,
            elements: Array.from(snapshot.elements.entries()), // Convert Map to array for serialization
          };
        },
      });

      // Script succeeded, cache the snapshot
      const snapshotData = result as { renderedText: string; elements: Array<[string, Element]> };
      this.currentSnapshot = {
        elements: new Map(snapshotData.elements), // Convert array back to Map
        renderedText: snapshotData.renderedText,
      };
      return snapshotData.renderedText;
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

  async waitForLoadState(
    state: "networkidle" | "domcontentloaded" | "load",
    options?: { timeout?: number },
  ): Promise<void> {
    const tab = await this.getActiveTab();
    const timeout = options?.timeout || this.ACTION_TIMEOUT_MS;

    try {
      await browser.scripting.executeScript({
        target: { tabId: tab.id! },
        func: (stateParam: string, timeoutParam: number, networkIdleDelay: number) => {
          return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
              reject(new Error(`Timeout waiting for ${stateParam}`));
            }, timeoutParam);

            const finish = () => {
              clearTimeout(timeoutId);
              resolve(true);
            };

            if (stateParam === "domcontentloaded") {
              if (document.readyState === "interactive" || document.readyState === "complete") {
                finish();
              } else {
                document.addEventListener("DOMContentLoaded", finish, { once: true });
              }
            } else if (stateParam === "load") {
              if (document.readyState === "complete") {
                finish();
              } else {
                window.addEventListener("load", finish, { once: true });
              }
            } else if (stateParam === "networkidle") {
              // Simple networkidle: wait for load + NETWORKIDLE_DELAY_MS
              if (document.readyState === "complete") {
                setTimeout(finish, networkIdleDelay);
              } else {
                window.addEventListener("load", () => setTimeout(finish, networkIdleDelay), {
                  once: true,
                });
              }
            }
          });
        },
        args: [state, timeout, this.NETWORKIDLE_DELAY_MS],
      });
    } catch (error) {
      throw error; // Re-throw to allow caller to handle
    }
  }

  async performAction(ref: string, action: string, value?: string): Promise<void> {
    try {
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
          // Note: goto already calls ensureOptimizedPageLoad internally
          return;

        case "back":
          await this.goBack();
          // Note: goBack already calls ensureOptimizedPageLoad internally
          return;

        case "forward":
          await this.goForward();
          // Note: goForward already calls ensureOptimizedPageLoad internally
          return;

        case "done":
          // This is a no-op in the browser implementation
          // It's handled at a higher level in the automation flow
          return;
      }

      // Handle element-based actions
      const tab = await this.getActiveTab();
      await this.ensureContentScript();

      // Check if we have a cached snapshot first
      if (!this.currentSnapshot) {
        throw new Error(
          "No cached snapshot available. Call getText() first to generate page snapshot.",
        );
      }

      const [{ result }] = await browser.scripting.executeScript({
        target: { tabId: tab.id! },
        func: (paramsJson: string, elementsArray: Array<[string, any]>) => {
          const { ref: refParam, action: actionParam, value: valueParam } = JSON.parse(paramsJson);

          // Reconstruct the elements map from the cached snapshot
          const elements = new Map(elementsArray);
          const element = elements.get(refParam);

          if (!element) {
            return {
              success: false,
              error: `Element with ref ${refParam} not found in cached snapshot`,
            };
          }

          try {
            switch (actionParam) {
              // Element interactions
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
        args: [
          JSON.stringify({ ref, action, value }),
          Array.from(this.currentSnapshot.elements.entries()),
        ],
      });

      const typedResult = result as ActionResult;
      if (!typedResult?.success) {
        throw new Error(
          typedResult?.error || `Failed to perform action ${action} on element ${ref}`,
        );
      }

      // Element interactions that may cause navigation
      if (action === "click") {
        // Handle potential page transition after click
        await this.handlePageTransition();
      } else if (action === "select") {
        // Handle potential page transition after select
        await this.handlePageTransition();
      } else if (action === "enter") {
        // Handle potential page transition after enter
        await this.handlePageTransition();
      }
    } catch (error) {
      throw new Error(
        `Failed to perform action: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // Private helper method to ensure page is usable with appropriate timeouts
  // Matches Playwright's ensureOptimizedPageLoad exactly
  private async ensureOptimizedPageLoad(): Promise<void> {
    try {
      // 1. Wait for DOM to be ready - this is critical for interactivity
      await this.waitForLoadState("domcontentloaded");
    } catch (error) {
      // Still continue since we might be able to interact with what's loaded
    }

    // 2. Try to wait for full load, but cap at ACTION_TIMEOUT_MS
    // We catch and ignore timeout errors since the page is usable after domcontentloaded
    try {
      await this.waitForLoadState("load", {
        timeout: this.ACTION_TIMEOUT_MS,
      });
    } catch (error) {
      // Page load timed out - continue anyway
    }

    // 3. Wait 1 second for page to settle (animations, dynamic content, etc.)
    await new Promise((resolve) => setTimeout(resolve, this.PAGE_SETTLE_TIME_MS));
  }

  // Clear the current page snapshot
  private clearSnapshot(): void {
    this.currentSnapshot = undefined;
  }

  // Handle page transition: clear snapshot and wait for page to be ready
  private async handlePageTransition(): Promise<void> {
    this.clearSnapshot();
    await this.ensureOptimizedPageLoad();
  }

  // Ensure content script is available and retry if needed
  private async ensureContentScript(): Promise<void> {
    const tab = await this.getActiveTab();

    // Skip content script check for non-web URLs
    if (!tab.url || (!tab.url.startsWith("http://") && !tab.url.startsWith("https://"))) {
      throw new Error(`Content script not available on non-web URL: ${tab.url}`);
    }

    for (let attempt = 0; attempt < this.CONTENT_SCRIPT_RETRY_COUNT; attempt++) {
      try {
        const [{ result }] = await browser.scripting.executeScript({
          target: { tabId: tab.id! },
          func: () => {
            const win = window as Window & AriaSnapshotWindow;
            return (
              typeof win.generateAriaTree === "function" && typeof win.renderAriaTree === "function"
            );
          },
        });

        if (result) {
          return; // Content script is available
        }
      } catch (error) {
        // Script execution failed, continue to retry
      }

      // Wait before retrying
      if (attempt < this.CONTENT_SCRIPT_RETRY_COUNT - 1) {
        await new Promise((resolve) => setTimeout(resolve, this.CONTENT_SCRIPT_RETRY_DELAY_MS));
      }
    }

    throw new Error(
      `Content script not available after ${this.CONTENT_SCRIPT_RETRY_COUNT} retries for tab ${tab.id} at ${tab.url}`,
    );
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

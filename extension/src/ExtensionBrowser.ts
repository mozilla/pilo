import browser from "webextension-polyfill";
import type { AriaBrowser } from "spark/core";
import { PageAction, LoadState } from "spark/core";
import type { Tabs } from "webextension-polyfill";
import { createLogger } from "./utils/logger";
import TurndownService from "turndown";

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
  private logger = createLogger("ExtensionBrowser");

  // Match Playwright's timeout - 20 seconds timeout for interactive actions
  private readonly ACTION_TIMEOUT_MS = 20000;
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
    this.logger.info("goto() called", { url, currentUrl: tab.url, tabId: tab.id });
    try {
      // Extension equivalent of "commit" - just start the navigation
      await browser.tabs.update(tab.id!, { url });
      this.logger.debug("browser.tabs.update completed", { tabId: tab.id });
      // Handle page transition
      await this.handlePageTransition();
      this.logger.info("goto() completed successfully", { url, tabId: tab.id });
    } catch (error) {
      this.logger.error("goto() failed", { url, tabId: tab.id }, error);
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

  async getTreeWithRefs(): Promise<string> {
    const tab = await this.getActiveTab();
    this.logger.info("getTreeWithRefs() called", { tabId: tab.id, url: tab.url });

    try {
      this.logger.debug("checking content script availability...", { tabId: tab.id });
      await this.ensureContentScript();
      this.logger.debug("content script is available", { tabId: tab.id });
    } catch (error) {
      this.logger.warn("content script not available", { tabId: tab.id }, error);
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

          // Add aria-ref attributes to DOM elements for fast lookup
          // This extends the vendored code without modifying it
          for (const [ref, element] of snapshot.elements.entries()) {
            element.setAttribute("aria-ref", ref);
          }

          const renderedText = win.renderAriaTree(snapshot, {
            mode: "raw",
            forAI: true,
          });

          // Return just the rendered text - elements can be looked up via aria-ref attributes
          return {
            renderedText,
          };
        },
      });

      // Script succeeded, return the rendered text
      const snapshotData = result as { renderedText: string };
      this.logger.debug("ARIA tree generated and aria-ref attributes set", { tabId: tab.id });
      this.logger.info("getTreeWithRefs() completed successfully", { tabId: tab.id });
      return snapshotData.renderedText;
    } catch (error) {
      this.logger.error("getTreeWithRefs execution error", { tabId: tab.id }, error);
      return `Page title: ${tab.title || "Unknown"}\nURL: ${tab.url || "Unknown"}\nFailed to analyze page content.`;
    }
  }

  /**
   * Gets simplified HTML with noise elements removed in browser context
   * Reduces payload size by removing elements we don't need
   */
  async getSimpleHtml(): Promise<string> {
    const tab = await this.getActiveTab();
    this.logger.info("getSimpleHtml() called", { tabId: tab.id, url: tab.url });

    try {
      await this.ensureContentScript();
    } catch (error) {
      this.logger.warn("content script not available", { tabId: tab.id }, error);
      return "";
    }

    try {
      const [{ result }] = await browser.scripting.executeScript({
        target: { tabId: tab.id! },
        func: () => {
          const body = document.body || document.documentElement;
          if (!body) return "";

          const clone = body.cloneNode(true) as Element;

          // Remove noise elements in browser context to reduce wire transfer
          clone.querySelectorAll("head, script, style, noscript").forEach((el) => el.remove());

          return clone.innerHTML;
        },
      });

      return result as string;
    } catch (error) {
      this.logger.error("getSimpleHtml execution error", { tabId: tab.id }, error);
      return "";
    }
  }

  async getMarkdown(): Promise<string> {
    const tab = await this.getActiveTab();
    this.logger.info("getMarkdown() called", { tabId: tab.id, url: tab.url });

    try {
      // Get simplified HTML (noise removed in browser context)
      const html = await this.getSimpleHtml();

      if (!html) {
        return `Page title: ${tab.title || "Unknown"}\nURL: ${tab.url || "Unknown"}\nContent not available.`;
      }

      // Convert HTML to markdown using turndown
      const turndown = new TurndownService({
        headingStyle: "atx",
        codeBlockStyle: "fenced",
        emDelimiter: "*",
        strongDelimiter: "**",
      });

      this.logger.info("getMarkdown() completed successfully", { tabId: tab.id });
      return turndown.turndown(html);
    } catch (error) {
      this.logger.error("getMarkdown execution error", { tabId: tab.id }, error);
      return `Page title: ${tab.title || "Unknown"}\nURL: ${tab.url || "Unknown"}\nFailed to convert page content to markdown.`;
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

  async waitForLoadState(state: LoadState, options?: { timeout?: number }): Promise<void> {
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

  async performAction(ref: string, action: PageAction, value?: string): Promise<void> {
    console.log(
      `ExtensionBrowser: performAction() called with ref: ${ref}, action: ${action}, value: ${value}`,
    );
    try {
      // Handle non-element actions first
      switch (action) {
        case PageAction.Wait:
          if (!value) throw new Error("Value required for wait action");
          const seconds = parseInt(value, 10);
          if (isNaN(seconds) || seconds < 0) {
            throw new Error(`Invalid wait time: ${value}. Must be a positive number.`);
          }
          await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
          return;

        case PageAction.Goto:
          if (!value) throw new Error("URL required for goto action");
          if (!value.trim()) throw new Error("URL cannot be empty");
          await this.goto(value.trim());
          // Note: goto already calls ensureOptimizedPageLoad internally
          return;

        case PageAction.Back:
          await this.goBack();
          // Note: goBack already calls ensureOptimizedPageLoad internally
          return;

        case PageAction.Forward:
          await this.goForward();
          // Note: goForward already calls ensureOptimizedPageLoad internally
          return;

        case PageAction.Done:
          // This is a no-op in the browser implementation
          // It's handled at a higher level in the automation flow
          return;
      }

      // Handle element-based actions
      console.log(`ExtensionBrowser: handling element action ${action} for ref ${ref}`);
      const tab = await this.getActiveTab();
      await this.ensureContentScript();

      console.log(`ExtensionBrowser: attempting to find element with ref: ${ref}`);

      const [{ result }] = await browser.scripting.executeScript({
        target: { tabId: tab.id! },
        func: (paramsJson: string) => {
          const { ref: refParam, action: actionParam, value: valueParam } = JSON.parse(paramsJson);

          // Look up the element using the aria-ref attribute that's now set by ariaSnapshot
          const element = document.querySelector(`[aria-ref="${refParam}"]`);

          if (!element) {
            return {
              success: false,
              error: `Element with ref ${refParam} not found in DOM`,
            };
          }

          try {
            switch (actionParam) {
              // Element interactions
              case "click":
                console.log(`DEBUG: Click case reached for element:`, element);
                if (element instanceof HTMLElement) {
                  console.log(`DEBUG: About to click element:`, element);
                  console.log(
                    `DEBUG: Element tagName: ${element.tagName}, href: ${element.getAttribute("href")}, onclick: ${element.onclick}`,
                  );
                  console.log(
                    `DEBUG: Element visible: ${element.offsetWidth > 0 && element.offsetHeight > 0}`,
                  );
                  console.log(`DEBUG: Element in viewport:`, element.getBoundingClientRect());

                  // XXXdmose The extension code sometimes breaks when clicking
                  // links that open themselves elsewhere. For now, we hack around
                  // this a lot of the time by simply removing the HTML `target`
                  // attribute and overriding the `window.open` function. This
                  // doesn't handle all the cases where the click is redirected
                  // by JavaScript though. If we want to keep this long term,
                  // we would want to consider:
                  //
                  // * Add a background script listener for
                  // webNavigation.onCreatedNavigationTarget to catch cases
                  // that slip through
                  // * When a new tab is created, immediately:
                  //   * Close it with tabs.remove()
                  //   * Navigate the source tab with tabs.update()
                  //
                  // To do better, we wouldn't redirect clicks at all, we'd
                  // actually start watching and handling new tab creation, so
                  // we don't get repeated re-opens of the same tab.
                  //
                  // Ultimately, we may want to parallelize for speed by
                  // (often?) do the opposite: intentionally force each site
                  // in its own tab so that work can happen in parallel. That
                  // would have various UX implications that we'd want to work
                  // through.
                  //
                  const preventNewTab = () => {
                    if (element.hasAttribute("target")) {
                      element.removeAttribute("target");
                    }

                    const originalOpen = window.open;
                    window.open = function (
                      url?: string | URL,
                      _target?: string,
                      _features?: string,
                    ): WindowProxy | null {
                      if (url) {
                        window.location.href = url.toString();
                      }
                      return null;
                    };

                    return () => {
                      window.open = originalOpen;
                    };
                  };

                  const restore = preventNewTab();
                  try {
                    element.click();
                  } finally {
                    restore();
                  }

                  console.log(`DEBUG: Click executed on element ${refParam}`);
                  return { success: true, message: `Clicked element ${refParam}` };
                } else {
                  console.log(
                    `DEBUG: Element is not HTMLElement, type:`,
                    typeof element,
                    element.constructor.name,
                  );
                  return { success: false, error: `Element ${refParam} is not an HTMLElement` };
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
        args: [JSON.stringify({ ref, action, value })],
      });

      const typedResult = result as ActionResult;
      console.log(`ExtensionBrowser: script execution result:`, typedResult);
      if (!typedResult?.success) {
        console.error(`ExtensionBrowser: action failed:`, typedResult?.error);
        throw new Error(
          typedResult?.error || `Failed to perform action ${action} on element ${ref}`,
        );
      }

      // Element interactions that may cause navigation
      if (action === PageAction.Click) {
        console.log(`DEBUG: About to handle page transition after click`);
        // Handle potential page transition after click
        await this.handlePageTransition();
        console.log(`DEBUG: Page transition handling complete`);
      } else if (action === PageAction.Select) {
        // Handle potential page transition after select
        await this.handlePageTransition();
      } else if (action === PageAction.Enter) {
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
      await this.waitForLoadState(LoadState.DOMContentLoaded);
    } catch (error) {
      // Still continue since we might be able to interact with what's loaded
    }

    // 2. Try to wait for full load, but cap at ACTION_TIMEOUT_MS
    // We catch and ignore timeout errors since the page is usable after domcontentloaded
    try {
      await this.waitForLoadState(LoadState.Load, {
        timeout: this.ACTION_TIMEOUT_MS,
      });
    } catch (error) {
      // Page load timed out - continue anyway
    }

    // 3. Wait 1 second for page to settle (animations, dynamic content, etc.)
    await new Promise((resolve) => setTimeout(resolve, this.PAGE_SETTLE_TIME_MS));
  }

  // Clear aria-ref attributes from previous page
  private clearAriaRefs(): void {
    // No need to clear anything - new page will have new DOM
    // aria-ref attributes will be set fresh on next getText() call
  }

  // Handle page transition: wait for page to be ready
  private async handlePageTransition(): Promise<void> {
    this.clearAriaRefs();
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

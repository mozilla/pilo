/**
 * Background-controlled indicator via class toggle.
 * This module handles showing/hiding the visual indicator by toggling a CSS class
 * on the html element. The CSS is pre-loaded via manifest content script.
 * It also listens for navigation events to re-apply the class on navigations.
 */

import browser from "webextension-polyfill";

// Track which tabs have active indicators
const activeIndicators = new Set<number>();

// Track if navigation listener is registered
let navigationListenerRegistered = false;
let navigationListener:
  | ((
      tabId: number,
      changeInfo: browser.Tabs.OnUpdatedChangeInfoType,
      tab: browser.Tabs.Tab,
    ) => void)
  | null = null;

// CSS for the indicator - injected programmatically for reliability
const INDICATOR_CSS = `
html.spark-indicator-active::after {
  content: "";
  pointer-events: none;
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 2147483647;
  opacity: 1;
  box-shadow:
    inset 60px 60px 80px -40px rgba(139, 92, 246, 0.6),
    inset -60px 60px 80px -40px rgba(139, 92, 246, 0.6),
    inset 60px -60px 80px -40px rgba(139, 92, 246, 0.6),
    inset -60px -60px 80px -40px rgba(139, 92, 246, 0.6);
  animation: spark-pulse 3s ease-in-out infinite;
}
@keyframes spark-pulse {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}
`;

export async function showIndicator(tabId: number): Promise<void> {
  try {
    // Inject CSS first (idempotent - checks if already injected)
    await browser.scripting.insertCSS({
      target: { tabId },
      css: INDICATOR_CSS,
    });
    // Then add the class to activate the indicator
    await browser.scripting.executeScript({
      target: { tabId },
      func: () => {
        document.documentElement.classList.add("spark-indicator-active");
      },
    });
    // Only track if both succeeded
    activeIndicators.add(tabId);
  } catch {
    // Silently ignore errors (e.g., tab closed, chrome:// pages)
  }
}

export async function hideIndicator(tabId: number): Promise<void> {
  // Remove from tracking first
  activeIndicators.delete(tabId);
  try {
    // Remove the class first
    await browser.scripting.executeScript({
      target: { tabId },
      func: () => {
        document.documentElement.classList.remove("spark-indicator-active");
      },
    });
    // Then remove the CSS
    await browser.scripting.removeCSS({
      target: { tabId },
      css: INDICATOR_CSS,
    });
  } catch {
    // Silently ignore errors (e.g., tab closed, chrome:// pages)
  }
}

/**
 * Check if a tab has an active indicator
 */
export function isIndicatorActive(tabId: number): boolean {
  return activeIndicators.has(tabId);
}

/**
 * Set up the navigation listener to re-apply class on navigations.
 * This should be called once when the background script starts.
 */
export function setupNavigationListener(): void {
  if (navigationListenerRegistered) {
    return;
  }

  navigationListener = (tabId, changeInfo) => {
    // Re-apply CSS and class for tabs with active indicators
    // Inject on both "loading" (early, reduces flash) and "complete" (reliable fallback)
    if (
      (changeInfo.status === "loading" || changeInfo.status === "complete") &&
      activeIndicators.has(tabId)
    ) {
      // Re-inject CSS and add class (fire and forget)
      browser.scripting
        .insertCSS({
          target: { tabId },
          css: INDICATOR_CSS,
        })
        .then(() =>
          browser.scripting.executeScript({
            target: { tabId },
            func: () => {
              document.documentElement.classList.add("spark-indicator-active");
            },
          }),
        )
        .catch(() => {
          // Silently ignore errors - may fail on "loading" if page not ready yet
        });
    }
  };

  browser.tabs.onUpdated.addListener(navigationListener);
  navigationListenerRegistered = true;
}

/**
 * Clean up the navigation listener. Mainly useful for testing.
 */
export function cleanupNavigationListener(): void {
  if (navigationListener) {
    browser.tabs.onUpdated.removeListener(navigationListener);
    navigationListener = null;
  }
  navigationListenerRegistered = false;
  activeIndicators.clear();
}

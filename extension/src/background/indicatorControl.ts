/**
 * Background-controlled indicator via CSS injection.
 * This module handles showing/hiding the visual indicator by injecting CSS
 * directly from the background script. It also listens for navigation events
 * to re-inject CSS on cross-origin navigations.
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

export function getIndicatorCSS(): string {
  return `
@keyframes spark-pulse {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}

html::after {
  content: '';
  pointer-events: none;
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 2147483647;
  box-shadow:
    inset 60px 60px 80px -40px rgba(139, 92, 246, 0.6),
    inset -60px 60px 80px -40px rgba(139, 92, 246, 0.6),
    inset 60px -60px 80px -40px rgba(139, 92, 246, 0.6),
    inset -60px -60px 80px -40px rgba(139, 92, 246, 0.6);
  animation: spark-pulse 3s ease-in-out infinite;
}
`;
}

export async function showIndicator(tabId: number): Promise<void> {
  try {
    await browser.scripting.insertCSS({
      target: { tabId },
      css: getIndicatorCSS(),
    });
    // Only track if injection succeeded
    activeIndicators.add(tabId);
  } catch {
    // Silently ignore errors (e.g., tab closed, chrome:// pages)
  }
}

export async function hideIndicator(tabId: number): Promise<void> {
  // Remove from tracking first
  activeIndicators.delete(tabId);
  try {
    await browser.scripting.removeCSS({
      target: { tabId },
      css: getIndicatorCSS(),
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
 * Set up the navigation listener to re-inject CSS on cross-origin navigations.
 * This should be called once when the background script starts.
 */
export function setupNavigationListener(): void {
  if (navigationListenerRegistered) {
    return;
  }

  navigationListener = (tabId, changeInfo) => {
    // Re-inject CSS when page completes loading for tabs with active indicators
    if (changeInfo.status === "complete" && activeIndicators.has(tabId)) {
      // Re-inject CSS (fire and forget)
      browser.scripting
        .insertCSS({
          target: { tabId },
          css: getIndicatorCSS(),
        })
        .catch(() => {
          // Silently ignore errors
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

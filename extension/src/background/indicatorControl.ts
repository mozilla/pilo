/**
 * Background-controlled indicator via class toggle with dynamic CSS registration.
 * This module handles showing/hiding the visual indicator by:
 * 1. Registering CSS content script at document_start for future navigations
 * 2. Injecting CSS and toggling a class on the html element for the current page
 * It also listens for navigation events to re-apply the class on navigations.
 */

import browser from "webextension-polyfill";

// Track which tabs have active indicators
const activeIndicators = new Set<number>();

// Track if CSS content script is registered
let cssRegistered = false;
// Lock to prevent concurrent registration attempts
let registrationPromise: Promise<void> | null = null;

// Track if navigation listener is registered
let navigationListenerRegistered = false;
let tabsUpdatedListener:
  | ((
      tabId: number,
      changeInfo: browser.Tabs.OnUpdatedChangeInfoType,
      tab: browser.Tabs.Tab,
    ) => void)
  | null = null;
let webNavCommittedListener:
  | ((details: browser.WebNavigation.OnCommittedDetailsType) => void)
  | null = null;
let tabRemovedListener: ((tabId: number) => void) | null = null;

// CSS for the indicator - injected programmatically for reliability
// Exported for testing (to verify it matches public/indicator.css)
export const INDICATOR_CSS = `html.spark-indicator-active::after {
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

/**
 * Reset all indicator state. For testing only.
 */
export function resetIndicatorState(): void {
  activeIndicators.clear();
  cssRegistered = false;
  registrationPromise = null;
}

/**
 * Ensure the CSS content script is registered for future navigations.
 * Uses a shared registration with reference counting.
 */
export async function ensureIndicatorCSSRegistered(): Promise<void> {
  if (cssRegistered) {
    return;
  }

  // If registration is in progress, wait for it instead of starting another
  if (registrationPromise) {
    await registrationPromise;
    return;
  }

  // Start registration with lock
  registrationPromise = (async () => {
    try {
      await browser.scripting.registerContentScripts([
        {
          id: "spark-indicator",
          matches: ["<all_urls>"],
          css: ["indicator.css"],
          runAt: "document_start",
          persistAcrossSessions: false,
        },
      ]);
      cssRegistered = true;
    } catch {
      // May already be registered (e.g., from previous session)
      // Check if it exists
      try {
        const scripts = await browser.scripting.getRegisteredContentScripts({
          ids: ["spark-indicator"],
        });
        if (scripts.length > 0) {
          cssRegistered = true;
        }
      } catch {
        // Ignore
      }
    }
  })();

  await registrationPromise;
  registrationPromise = null;
}

/**
 * Unregister the CSS content script if no tabs have active indicators.
 */
async function unregisterIndicatorCSSIfUnused(): Promise<void> {
  if (activeIndicators.size > 0) {
    return;
  }
  if (!cssRegistered) {
    return;
  }
  try {
    await browser.scripting.unregisterContentScripts({
      ids: ["spark-indicator"],
    });
    cssRegistered = false;
  } catch {
    // Silently ignore - may not be registered
  }
}

export async function showIndicator(tabId: number): Promise<void> {
  // Add to activeIndicators FIRST to prevent race condition with hideIndicator
  activeIndicators.add(tabId);

  try {
    // Register CSS for future navigations (shared across all tabs)
    await ensureIndicatorCSSRegistered();

    // Inject CSS into current page (already loaded)
    await browser.scripting.insertCSS({
      target: { tabId },
      css: INDICATOR_CSS,
    });

    // Add class to activate indicator
    await browser.scripting.executeScript({
      target: { tabId },
      func: () => {
        document.documentElement.classList.add("spark-indicator-active");
      },
    });
  } catch {
    // On error, remove from activeIndicators since we failed to show
    activeIndicators.delete(tabId);
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

    // Remove CSS from current page
    await browser.scripting.removeCSS({
      target: { tabId },
      css: INDICATOR_CSS,
    });

    // Unregister content script CSS if no more active indicators
    await unregisterIndicatorCSSIfUnused();
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
 * Helper to inject indicator class into a tab.
 * CSS is already present via registerContentScripts at document_start.
 */
function injectIndicator(tabId: number): void {
  // CSS is already injected via registerContentScripts at document_start
  // We only need to add the class to activate the indicator
  browser.scripting
    .executeScript({
      target: { tabId },
      func: () => {
        document.documentElement.classList.add("spark-indicator-active");
      },
    })
    .catch(() => {
      // Silently ignore errors - may fail if page not ready yet
    });
}

/**
 * Set up the navigation listener to re-apply class on navigations.
 * This should be called once when the background script starts.
 */
export function setupNavigationListener(): void {
  if (navigationListenerRegistered) {
    return;
  }

  // Use webNavigation.onCommitted for earliest possible injection
  // This fires when the navigation is committed but before the new document is created
  webNavCommittedListener = (details) => {
    // Only handle main frame navigations (not iframes)
    if (details.frameId === 0 && activeIndicators.has(details.tabId)) {
      // Inject immediately - this is the earliest we can act
      injectIndicator(details.tabId);
    }
  };

  // Use tabs.onUpdated as a fallback for reliability
  tabsUpdatedListener = (tabId, changeInfo) => {
    // Re-apply class for tabs with active indicators
    // Only on "complete" now since webNavigation handles early injection
    if (changeInfo.status === "complete" && activeIndicators.has(tabId)) {
      injectIndicator(tabId);
    }
  };

  // Handle tab closure
  tabRemovedListener = (tabId: number) => {
    if (activeIndicators.has(tabId)) {
      activeIndicators.delete(tabId);
      unregisterIndicatorCSSIfUnused().catch(() => {});
    }
  };

  browser.webNavigation.onCommitted.addListener(webNavCommittedListener);
  browser.tabs.onUpdated.addListener(tabsUpdatedListener);
  browser.tabs.onRemoved.addListener(tabRemovedListener);
  navigationListenerRegistered = true;
}

/**
 * Clean up the navigation listener. Mainly useful for testing.
 */
export function cleanupNavigationListener(): void {
  if (webNavCommittedListener) {
    browser.webNavigation.onCommitted.removeListener(webNavCommittedListener);
    webNavCommittedListener = null;
  }
  if (tabsUpdatedListener) {
    browser.tabs.onUpdated.removeListener(tabsUpdatedListener);
    tabsUpdatedListener = null;
  }
  if (tabRemovedListener) {
    browser.tabs.onRemoved.removeListener(tabRemovedListener);
    tabRemovedListener = null;
  }
  navigationListenerRegistered = false;
  activeIndicators.clear();
}

/**
 * Clean up stale registrations from previous sessions.
 * This should be called on extension startup.
 */
export async function cleanupStaleRegistrations(): Promise<void> {
  try {
    const scripts = await browser.scripting.getRegisteredContentScripts();
    const staleIds = scripts.filter((s) => s.id === "spark-indicator").map((s) => s.id);

    if (staleIds.length > 0) {
      await browser.scripting.unregisterContentScripts({ ids: staleIds });
      cssRegistered = false;
    }
  } catch {
    // Silently ignore errors
  }
}

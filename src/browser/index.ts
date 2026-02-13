/**
 * Browser automation modules
 *
 * Core browser automation utilities including Playwright setup,
 * ARIA browser interface, and navigation retry logic.
 */

export {
  getPlaywrightBrowserPath,
  areBrowsersInstalled,
  isNonInteractive,
  installBrowsers,
} from "./playwrightSetup.js";

export { PlaywrightBrowser } from "./playwrightBrowser.js";
export { PageAction, LoadState } from "./ariaBrowser.js";
export type { AriaBrowser } from "./ariaBrowser.js";
export type { NavigationRetryConfig } from "./navigationRetry.js";
export { DEFAULT_NAVIGATION_RETRY_CONFIG, calculateTimeout } from "./navigationRetry.js";

import { chromium, firefox, webkit } from "playwright";

/**
 * Supported browser types for detection
 */
export type BrowserType = "chromium" | "firefox" | "webkit";

/**
 * Result of browser installation check
 */
export interface BrowserInstallStatus {
  /** Whether the browser is installed */
  installed: boolean;
  /** Path to the browser executable (if installed) */
  executablePath?: string;
  /** Error message if detection failed */
  error?: string;
}

/**
 * Check if a specific Playwright browser is installed.
 *
 * This function attempts to get the executable path for the browser.
 * If successful, the browser is installed. If it throws an error,
 * the browser is not installed.
 *
 * @param browserType - The browser to check (chromium, firefox, webkit)
 * @returns Installation status with path if available
 */
export async function isBrowserInstalled(
  browserType: BrowserType = "chromium",
): Promise<BrowserInstallStatus> {
  try {
    let executablePath: string;

    switch (browserType) {
      case "chromium":
        executablePath = chromium.executablePath();
        break;
      case "firefox":
        executablePath = firefox.executablePath();
        break;
      case "webkit":
        executablePath = webkit.executablePath();
        break;
      default:
        return {
          installed: false,
          error: `Unsupported browser type: ${browserType}`,
        };
    }

    // If we got here, the browser is installed
    return {
      installed: true,
      executablePath,
    };
  } catch (error) {
    // Browser not installed or other error
    return {
      installed: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Check installation status for all supported browsers.
 *
 * @returns Map of browser type to installation status
 */
export async function checkAllBrowsers(): Promise<Record<BrowserType, BrowserInstallStatus>> {
  const browsers: BrowserType[] = ["chromium", "firefox", "webkit"];
  const results: Partial<Record<BrowserType, BrowserInstallStatus>> = {};

  for (const browser of browsers) {
    results[browser] = await isBrowserInstalled(browser);
  }

  return results as Record<BrowserType, BrowserInstallStatus>;
}

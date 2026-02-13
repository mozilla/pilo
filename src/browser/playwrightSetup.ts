/**
 * Playwright browser setup utilities
 *
 * Core module for detecting and installing Playwright browsers.
 * Reusable across CLI, VS Code extension, Electron app, and server contexts.
 */

import { execSync } from "child_process";
import { existsSync, readdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";

/**
 * Returns the path where Playwright stores browser binaries for this platform.
 *
 * - Linux/macOS: ~/.cache/ms-playwright
 * - Windows: %USERPROFILE%\AppData\Local\ms-playwright
 *
 * @returns The platform-specific browser path, or null for unknown platforms
 */
export function getPlaywrightBrowserPath(): string | null {
  const platform = process.platform;

  if (platform === "win32") {
    return join(homedir(), "AppData", "Local", "ms-playwright");
  } else if (platform === "darwin" || platform === "linux") {
    return join(homedir(), ".cache", "ms-playwright");
  }

  return null;
}

/**
 * Checks if Playwright browsers are installed.
 *
 * Verifies that the platform-specific browser directory exists and contains
 * at least one browser folder (chromium-*, firefox-*, or webkit-*).
 *
 * @returns true if browsers are detected, false otherwise
 */
export function areBrowsersInstalled(): boolean {
  const browserPath = getPlaywrightBrowserPath();

  if (!browserPath || !existsSync(browserPath)) {
    return false;
  }

  // Additional check: try to see if there are any browser folders
  // Playwright typically has folders like chromium-1234, firefox-1234, etc.
  try {
    const contents = readdirSync(browserPath);
    // If there's at least one browser folder, consider browsers installed
    return contents.some(
      (item: string) =>
        item.startsWith("chromium-") || item.startsWith("firefox-") || item.startsWith("webkit-"),
    );
  } catch {
    return false;
  }
}

/**
 * Checks if running in a non-interactive environment (CI, piped input, etc.)
 *
 * @returns true if stdin/stdout is not a TTY or CI environment variable is set
 */
export function isNonInteractive(): boolean {
  return !process.stdin.isTTY || !process.stdout.isTTY || Boolean(process.env.CI);
}

/**
 * Installs Playwright browsers using npx playwright install.
 *
 * @param options.onOutput - Optional callback to receive installation output.
 *                           If not provided, output goes to stdout (inherit).
 * @throws Error if installation fails
 */
export async function installBrowsers(options?: {
  onOutput?: (data: string) => void;
}): Promise<void> {
  try {
    if (options?.onOutput) {
      // Custom output handling: capture stdout/stderr and pass to callback
      const output = execSync("npx playwright install", {
        cwd: process.cwd(),
        encoding: "utf-8",
      });
      options.onOutput(output);
    } else {
      // Default behavior: show output directly to user
      execSync("npx playwright install", {
        stdio: "inherit",
        cwd: process.cwd(),
      });
    }
  } catch (error) {
    throw new Error("Failed to install Playwright browsers");
  }
}

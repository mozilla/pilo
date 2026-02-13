/**
 * Playwright browser setup utilities
 *
 * Handles first-run detection and installation of Playwright browsers
 */

import { execSync } from "child_process";
import { existsSync, readdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import * as readline from "readline";
import chalk from "chalk";

/**
 * Checks if Playwright browsers are installed
 *
 * Playwright stores browsers in:
 * - Linux/macOS: ~/.cache/ms-playwright
 * - Windows: %USERPROFILE%\AppData\Local\ms-playwright
 */
function areBrowsersInstalled(): boolean {
  const platform = process.platform;
  let browserPath: string;

  if (platform === "win32") {
    browserPath = join(homedir(), "AppData", "Local", "ms-playwright");
  } else if (platform === "darwin" || platform === "linux") {
    browserPath = join(homedir(), ".cache", "ms-playwright");
  } else {
    // Unknown platform, assume not installed
    return false;
  }

  // Check if the directory exists and has content
  if (!existsSync(browserPath)) {
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
 * Prompts the user for permission to install Playwright browsers
 */
async function promptForInstallation(): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.log(chalk.yellow("\n⚠️  Playwright browsers are not installed."));
    console.log(chalk.gray("These are required for web automation.\n"));
    console.log(chalk.gray("This will download ~300MB of browser binaries."));

    rl.question(chalk.cyan("Would you like to install them now? [Y/n]: "), (answer) => {
      rl.close();
      const normalized = answer.trim().toLowerCase();
      // Default to yes if empty or starts with 'y'
      resolve(normalized === "" || normalized === "y" || normalized === "yes");
    });
  });
}

/**
 * Installs Playwright browsers using npx playwright install
 */
function installBrowsers(): void {
  console.log(chalk.cyan("\n📦 Installing Playwright browsers..."));
  console.log(chalk.gray("This may take a few minutes.\n"));

  try {
    // Run playwright install with progress output
    execSync("npx playwright install", {
      stdio: "inherit", // Show progress to user
      cwd: process.cwd(),
    });

    console.log(chalk.green("\n✓ Browsers installed successfully.\n"));
  } catch (error) {
    console.error(chalk.red("\n❌ Failed to install Playwright browsers."));
    console.error(chalk.gray("You can install them manually by running:"));
    console.error(chalk.gray("  npx playwright install\n"));
    throw error;
  }
}

/**
 * Checks if running in a non-interactive environment (CI, piped input, etc.)
 */
function isNonInteractive(): boolean {
  return !process.stdin.isTTY || !process.stdout.isTTY || Boolean(process.env.CI);
}

/**
 * Main entry point: checks for browser installation and prompts if needed
 *
 * This should be called before any automation command that requires browsers.
 *
 * @returns Promise that resolves when browsers are confirmed installed
 * @throws Error if installation fails or user declines
 */
export async function ensureBrowsersInstalled(): Promise<void> {
  // Check if browsers are already installed
  if (areBrowsersInstalled()) {
    return; // All good, proceed
  }

  // If running in non-interactive mode (CI, piped input), fail with clear message
  if (isNonInteractive()) {
    console.error(chalk.red("\n❌ Playwright browsers are not installed."));
    console.error(chalk.gray("Running in non-interactive mode (CI or piped input)."));
    console.error(chalk.gray("Install browsers before running automation:"));
    console.error(chalk.gray("  npx playwright install\n"));
    process.exit(1);
  }

  // Browsers not installed, prompt user
  const shouldInstall = await promptForInstallation();

  if (!shouldInstall) {
    console.log(chalk.yellow("\n⚠️  Installation declined."));
    console.log(chalk.gray("To use Spark, install Playwright browsers manually:"));
    console.log(chalk.gray("  npx playwright install\n"));
    process.exit(0); // Clean exit, not an error
  }

  // User agreed, install browsers
  installBrowsers();
}

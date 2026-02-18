/**
 * Playwright browser setup utilities (CLI-specific)
 *
 * Handles CLI-specific browser installation flow with interactive prompts
 * and colored console output. Core detection logic lives in spark-core/browser/playwrightSetup.js.
 */

import * as readline from "readline";
import chalk from "chalk";
import {
  areBrowsersInstalled,
  isNonInteractive,
  installBrowsers,
} from "spark-core/browser/playwrightSetup.js";

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
 * Installs Playwright browsers with CLI-specific output formatting
 */
async function installBrowsersWithCLIOutput(): Promise<void> {
  console.log(chalk.cyan("\n📦 Installing Playwright browsers..."));
  console.log(chalk.gray("This may take a few minutes.\n"));

  try {
    // Use core installBrowsers with default behavior (stdio: inherit)
    await installBrowsers();
    console.log(chalk.green("\n✓ Browsers installed successfully.\n"));
  } catch (error) {
    console.error(chalk.red("\n❌ Failed to install Playwright browsers."));
    console.error(chalk.gray("You can install them manually by running:"));
    console.error(chalk.gray("  npx playwright install\n"));
    throw error;
  }
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
  await installBrowsersWithCLIOutput();
}

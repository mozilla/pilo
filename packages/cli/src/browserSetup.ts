import chalk from "chalk";
import { execSync } from "child_process";
import * as readline from "readline";
import { isBrowserInstalled, type BrowserType } from "spark-core/browser/playwrightSetup.js";

/**
 * Check if we're in a non-interactive environment (CI, non-TTY, or test mode)
 */
function isNonInteractive(): boolean {
  return (
    // CI environment variables
    process.env.CI === "true" ||
    process.env.CONTINUOUS_INTEGRATION === "true" ||
    // No TTY available
    !process.stdin.isTTY ||
    !process.stdout.isTTY ||
    // Test environment
    process.env.NODE_ENV === "test"
  );
}

/**
 * Prompt user for yes/no input
 * @param question Question to ask
 * @returns true if user answered yes, false otherwise
 */
async function promptYesNo(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${question} (y/n) `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase().trim() === "y" || answer.toLowerCase().trim() === "yes");
    });
  });
}

/**
 * Install Playwright browser(s) using npx
 * @param browserType Specific browser to install, or undefined for all
 */
function installBrowser(browserType?: BrowserType): void {
  const command = browserType ? `npx playwright install ${browserType}` : "npx playwright install";

  console.log(chalk.blue(`\n📦 Installing browser${browserType ? ` (${browserType})` : "s"}...`));
  console.log(chalk.gray(`Running: ${command}\n`));

  try {
    // Run the installation with inherited stdio for progress feedback
    execSync(command, {
      stdio: "inherit",
      encoding: "utf-8",
    });

    console.log(chalk.green(`\n✓ Browser${browserType ? `` : "s"} installed successfully!\n`));
  } catch (error) {
    console.error(chalk.red(`\n❌ Failed to install browser${browserType ? `` : "s"}`));
    console.error(chalk.gray(error instanceof Error ? error.message : String(error)));
    throw error;
  }
}

/**
 * Check if required browser is installed and prompt for installation if needed
 * @param browserType Browser to check (defaults to chromium)
 * @param skipCheck If true, skip the check entirely
 * @returns true if browser is available, false if user declined installation
 */
export async function ensureBrowserInstalled(
  browserType: BrowserType = "chromium",
  skipCheck = false,
): Promise<boolean> {
  // Skip check if requested
  if (skipCheck) {
    return true;
  }

  // Check if browser is installed
  const status = await isBrowserInstalled(browserType);

  if (status.installed) {
    // Browser already installed
    return true;
  }

  // Browser not installed
  console.log(chalk.yellow(`\n⚠️ ${browserType} browser is not installed.`));

  // In non-interactive environments, show error and exit
  if (isNonInteractive()) {
    console.error(chalk.red("Running in non-interactive environment (CI/test/no-TTY)."));
    console.error(chalk.gray(`Please install the browser manually:`));
    console.error(chalk.gray(`  npx playwright install ${browserType}`));
    return false;
  }

  // Interactive environment - prompt user
  console.log(chalk.gray("Playwright browsers are required to run Spark automation tasks."));

  const shouldInstall = await promptYesNo(`\nWould you like to install ${browserType} now?`);

  if (!shouldInstall) {
    console.log(chalk.yellow("\nBrowser installation skipped."));
    console.log(chalk.gray(`You can install it later with: npx playwright install ${browserType}`));
    return false;
  }

  // User agreed - install the browser
  try {
    installBrowser(browserType);
    return true;
  } catch (error) {
    // Installation failed
    return false;
  }
}

/**
 * Map Spark browser names to Playwright browser types
 */
function mapBrowserType(sparkBrowser: string): BrowserType {
  switch (sparkBrowser) {
    case "chrome":
    case "chromium":
    case "edge":
      return "chromium";
    case "firefox":
      return "firefox";
    case "safari":
    case "webkit":
      return "webkit";
    default:
      return "chromium";
  }
}

/**
 * Check browser installation for a Spark browser option
 * @param sparkBrowser Browser option from CLI/config (e.g., "chrome", "firefox")
 * @param skipCheck If true, skip the check entirely
 * @returns true if browser is available, false otherwise
 */
export async function checkBrowserForRun(
  sparkBrowser: string,
  skipCheck = false,
): Promise<boolean> {
  const browserType = mapBrowserType(sparkBrowser);
  return ensureBrowserInstalled(browserType, skipCheck);
}

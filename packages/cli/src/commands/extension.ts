import chalk from "chalk";
import { Command } from "commander";
import { cpSync, existsSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

/**
 * Creates the 'extension' command for managing the Spark browser extension.
 */
export function createExtensionCommand(): Command {
  const command = new Command("extension")
    .alias("ext")
    .description("Manage the Spark browser extension");

  // Add install subcommand
  command
    .command("install")
    .description("Install the Spark browser extension")
    .option("-b, --browser <browser>", "Specify browser (chrome or firefox)", "chrome")
    .action(installExtension);

  return command;
}

/**
 * Install the bundled extension for the specified browser
 */
async function installExtension(options: { browser: string }): Promise<void> {
  const browser = options.browser.toLowerCase();

  // Validate browser
  if (browser !== "chrome" && browser !== "firefox") {
    console.error(chalk.red(`Error: Unsupported browser "${browser}"`));
    console.log(chalk.yellow(`Supported browsers: chrome, firefox`));
    process.exit(1);
  }

  console.log(
    chalk.blue.bold(
      `\n🚀 Installing Spark Extension for ${browser === "chrome" ? "Chrome" : "Firefox"}\n`,
    ),
  );

  // Get paths
  // When the CLI is built, this file is at dist/index.js
  // So we need to resolve extension files relative to the dist directory
  const currentFileDir = dirname(fileURLToPath(import.meta.url));

  // Find the dist directory - when built, we're directly in it; when in dev, we need to navigate up
  let distDir: string;
  if (currentFileDir.endsWith("/dist")) {
    distDir = currentFileDir;
  } else if (existsSync(join(currentFileDir, "../dist"))) {
    distDir = join(currentFileDir, "../dist");
  } else {
    distDir = currentFileDir; // Assume we're in dist
  }

  const extensionSource = join(distDir, `extension/${browser}`);
  const sparkDir = join(homedir(), ".spark");
  const extensionTarget = join(sparkDir, `extension/${browser}`);

  // Verify bundled extension exists
  if (!existsSync(extensionSource)) {
    console.error(chalk.red(`Error: Extension files not found at ${extensionSource}`));
    console.log(chalk.yellow("\nThe extension may not have been bundled during build."));
    console.log(chalk.yellow("Please rebuild the CLI with: pnpm run build"));
    process.exit(1);
  }

  // Create target directory
  console.log(chalk.gray(`Creating directory: ${extensionTarget}`));
  mkdirSync(extensionTarget, { recursive: true });

  // Copy extension files
  console.log(chalk.gray(`Copying extension files from ${extensionSource}`));
  cpSync(extensionSource, extensionTarget, { recursive: true });
  console.log(chalk.green(`✓ Extension files copied to ${extensionTarget}\n`));

  // Browser-specific instructions
  if (browser === "chrome") {
    await installChrome(extensionTarget);
  } else if (browser === "firefox") {
    await installFirefox(extensionTarget);
  }

  console.log(chalk.green.bold("\n✨ Installation complete!\n"));
}

/**
 * Install extension in Chrome/Chromium
 */
async function installChrome(extensionPath: string): Promise<void> {
  console.log(chalk.blue.bold("Chrome Installation Steps:\n"));

  // Try to detect and open Chrome
  const chromePaths = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  ];

  let chromeFound = false;
  for (const chromePath of chromePaths) {
    if (existsSync(chromePath)) {
      console.log(chalk.gray(`Opening Chrome extensions page...\n`));
      try {
        if (process.platform === "darwin") {
          execSync(`open -a "Google Chrome" "chrome://extensions/"`);
        } else if (process.platform === "win32") {
          execSync(`start chrome chrome://extensions/`);
        } else {
          execSync(`google-chrome chrome://extensions/`);
        }
        chromeFound = true;
      } catch (error) {
        console.log(chalk.yellow("Could not automatically open Chrome."));
      }
      break;
    }
  }

  if (!chromeFound) {
    console.log(chalk.yellow("Chrome not found. Please manually open Chrome.\n"));
  }

  console.log(
    chalk.white("1. Enable ") +
      chalk.cyan.bold("Developer mode") +
      chalk.white(" (toggle in top right)"),
  );
  console.log(chalk.white("2. Click ") + chalk.cyan.bold("Load unpacked"));
  console.log(chalk.white("3. Select this directory:\n"));
  console.log(chalk.cyan.bold(`   ${extensionPath}\n`));
  console.log(chalk.gray("The extension will now appear in your extensions list."));
}

/**
 * Install extension in Firefox
 */
async function installFirefox(extensionPath: string): Promise<void> {
  console.log(chalk.blue.bold("Firefox Installation Steps:\n"));

  const manifestPath = join(extensionPath, "manifest.json");

  // Try to detect and open Firefox
  const firefoxPaths = [
    "/Applications/Firefox.app/Contents/MacOS/firefox",
    "C:\\Program Files\\Mozilla Firefox\\firefox.exe",
    "C:\\Program Files (x86)\\Mozilla Firefox\\firefox.exe",
  ];

  let firefoxFound = false;
  for (const firefoxPath of firefoxPaths) {
    if (existsSync(firefoxPath)) {
      console.log(chalk.gray(`Opening Firefox debugging page...\n`));
      try {
        if (process.platform === "darwin") {
          execSync(`open -a "Firefox" "about:debugging#/runtime/this-firefox"`);
        } else if (process.platform === "win32") {
          execSync(`start firefox about:debugging#/runtime/this-firefox`);
        } else {
          execSync(`firefox about:debugging#/runtime/this-firefox`);
        }
        firefoxFound = true;
      } catch (error) {
        console.log(chalk.yellow("Could not automatically open Firefox."));
      }
      break;
    }
  }

  if (!firefoxFound) {
    console.log(chalk.yellow("Firefox not found. Please manually open Firefox.\n"));
  }

  console.log(
    chalk.white("1. Navigate to ") + chalk.cyan.bold("about:debugging#/runtime/this-firefox"),
  );
  console.log(chalk.white("2. Click ") + chalk.cyan.bold("Load Temporary Add-on..."));
  console.log(chalk.white("3. Select this file:\n"));
  console.log(chalk.cyan.bold(`   ${manifestPath}\n`));
  console.log(
    chalk.yellow.bold("⚠ Note: ") +
      chalk.white("Temporary add-ons are removed when Firefox closes."),
  );
  console.log(
    chalk.gray("For persistent installation, you'll need to package and sign the extension."),
  );
}

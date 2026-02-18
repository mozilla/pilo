import chalk from "chalk";
import { Command } from "commander";
import { existsSync } from "fs";
import { homedir, platform } from "os";
import { join } from "path";

/**
 * Creates the 'extension' command for managing the Spark browser extension
 */
export function createExtensionCommand(): Command {
  const extensionCmd = new Command("extension").description("Manage Spark browser extension");

  // extension install - Install extension for a specific browser
  extensionCmd
    .command("install")
    .description("Install Spark extension for Firefox or Chrome")
    .argument("<browser>", "Browser to install extension for (firefox or chrome)")
    .action(installExtension);

  return extensionCmd;
}

/**
 * Install the Spark extension for the specified browser
 */
async function installExtension(browser: string): Promise<void> {
  const normalizedBrowser = browser.toLowerCase();

  if (normalizedBrowser !== "firefox" && normalizedBrowser !== "chrome") {
    console.error(chalk.red("❌ Error: Invalid browser specified"));
    console.log("");
    console.log(chalk.white("Supported browsers:"));
    console.log(`  • ${chalk.cyan("firefox")}`);
    console.log(`  • ${chalk.cyan("chrome")}`);
    console.log("");
    console.log(chalk.white("Usage:"));
    console.log(`  ${chalk.green("spark extension install firefox")}`);
    console.log(`  ${chalk.green("spark extension install chrome")}`);
    process.exit(1);
  }

  if (normalizedBrowser === "firefox") {
    await installFirefoxExtension();
  } else if (normalizedBrowser === "chrome") {
    await installChromeExtension();
  }
}

/**
 * Install the Spark extension for Firefox
 */
async function installFirefoxExtension(): Promise<void> {
  console.log(chalk.blue.bold("🦊 Installing Spark Extension for Firefox"));
  console.log("");

  // Check for Firefox profile directory
  const profileDir = getFirefoxProfileDirectory();
  if (!profileDir) {
    console.error(chalk.red("❌ Error: Firefox profile directory not found"));
    console.log("");
    console.log(chalk.white("Firefox may not be installed on your system."));
    console.log("");
    console.log(chalk.white("To install Firefox:"));
    console.log(`  • Visit ${chalk.underline("https://www.mozilla.org/firefox/")}`);
    process.exit(1);
  }

  console.log(chalk.yellow("⚠️  Extension installation for Firefox coming soon"));
  console.log("");
  console.log(chalk.white("In the meantime, you can manually load the extension:"));
  console.log("");
  console.log(chalk.white("1. Open Firefox and navigate to:"));
  console.log(`   ${chalk.cyan("about:debugging#/runtime/this-firefox")}`);
  console.log("");
  console.log(chalk.white("2. Click 'Load Temporary Add-on'"));
  console.log("");
  console.log(chalk.white("3. Navigate to and select:"));
  console.log(
    `   ${chalk.cyan("[spark-installation-path]/packages/extension/dist/manifest.json")}`,
  );
  console.log("");
  console.log(chalk.gray("Profile directory found: " + profileDir));
}

/**
 * Install the Spark extension for Chrome
 */
async function installChromeExtension(): Promise<void> {
  console.log(chalk.blue.bold("🌐 Installing Spark Extension for Chrome"));
  console.log("");

  // Check for Chrome profile directory
  const profileDir = getChromeProfileDirectory();
  if (!profileDir) {
    console.error(chalk.red("❌ Error: Chrome profile directory not found"));
    console.log("");
    console.log(chalk.white("Chrome may not be installed on your system."));
    console.log("");
    console.log(chalk.white("To install Chrome:"));
    console.log(`  • Visit ${chalk.underline("https://www.google.com/chrome/")}`);
    process.exit(1);
  }

  console.log(chalk.yellow("⚠️  Extension installation for Chrome coming soon"));
  console.log("");
  console.log(chalk.white("In the meantime, you can manually load the extension:"));
  console.log("");
  console.log(chalk.white("1. Open Chrome and navigate to:"));
  console.log(`   ${chalk.cyan("chrome://extensions/")}`);
  console.log("");
  console.log(chalk.white("2. Enable 'Developer mode' (toggle in top right)"));
  console.log("");
  console.log(chalk.white("3. Click 'Load unpacked'"));
  console.log("");
  console.log(chalk.white("4. Navigate to and select:"));
  console.log(`   ${chalk.cyan("[spark-installation-path]/packages/extension/dist/")}`);
  console.log("");
  console.log(chalk.gray("Profile directory found: " + profileDir));
}

/**
 * Get the Firefox profile directory path based on OS
 */
function getFirefoxProfileDirectory(): string | null {
  const home = homedir();
  const os = platform();

  let profileBase: string;

  switch (os) {
    case "darwin": // macOS
      profileBase = join(home, "Library", "Application Support", "Firefox", "Profiles");
      break;
    case "win32": // Windows
      profileBase = join(home, "AppData", "Roaming", "Mozilla", "Firefox", "Profiles");
      break;
    case "linux": // Linux
      profileBase = join(home, ".mozilla", "firefox");
      break;
    default:
      return null;
  }

  // Check if the base directory exists
  if (existsSync(profileBase)) {
    return profileBase;
  }

  return null;
}

/**
 * Get the Chrome profile directory path based on OS
 */
function getChromeProfileDirectory(): string | null {
  const home = homedir();
  const os = platform();

  let profileDir: string;

  switch (os) {
    case "darwin": // macOS
      profileDir = join(home, "Library", "Application Support", "Google", "Chrome");
      break;
    case "win32": // Windows
      profileDir = join(home, "AppData", "Local", "Google", "Chrome", "User Data");
      break;
    case "linux": // Linux
      profileDir = join(home, ".config", "google-chrome");
      break;
    default:
      return null;
  }

  // Check if the directory exists
  if (existsSync(profileDir)) {
    return profileDir;
  }

  return null;
}

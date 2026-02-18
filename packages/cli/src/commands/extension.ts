import chalk from "chalk";
import { Command } from "commander";
import { existsSync, copyFileSync, mkdirSync, readdirSync } from "fs";
import { homedir, platform } from "os";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { isDevelopmentMode } from "spark-core/buildMode.js";

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

  // Get the bundled extension path
  const extensionZip = getExtensionAssetPath("firefox");
  if (!extensionZip) {
    console.error(chalk.red("❌ Error: Firefox extension not found"));
    console.log("");
    console.log(chalk.white("The extension may not have been bundled correctly."));
    if (isDevelopmentMode()) {
      console.log("");
      console.log(chalk.white("In development mode, build the extension first:"));
      console.log(`  ${chalk.green("cd packages/extension && pnpm run build:all")}`);
    }
    process.exit(1);
  }

  // Firefox requires extensions to be in the extensions directory
  // For unsigned extensions (development), we'll extract to a known location
  const extensionsDir = join(profileDir, "extensions");
  mkdirSync(extensionsDir, { recursive: true });

  const targetPath = join(extensionsDir, "spark-extension.xpi");

  try {
    copyFileSync(extensionZip, targetPath);
    console.log(chalk.green("✅ Extension copied successfully!"));
    console.log("");
    console.log(chalk.white("Extension location:"));
    console.log(`   ${chalk.cyan(targetPath)}`);
    console.log("");
    console.log(
      chalk.yellow("⚠️  Note: Firefox requires manual installation for unsigned extensions"),
    );
    console.log("");
    console.log(chalk.white("To complete installation:"));
    console.log("");
    console.log(chalk.white("1. Open Firefox and navigate to:"));
    console.log(`   ${chalk.cyan("about:debugging#/runtime/this-firefox")}`);
    console.log("");
    console.log(chalk.white("2. Click 'Load Temporary Add-on'"));
    console.log("");
    console.log(chalk.white("3. Navigate to and select the manifest.json from:"));
    console.log(`   ${chalk.cyan(extensionZip.replace(".zip", ""))}`);
  } catch (error) {
    console.error(chalk.red("❌ Error copying extension:"));
    console.error(chalk.red((error as Error).message));
    process.exit(1);
  }
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

  // Get the bundled extension path
  const extensionZip = getExtensionAssetPath("chrome");
  if (!extensionZip) {
    console.error(chalk.red("❌ Error: Chrome extension not found"));
    console.log("");
    console.log(chalk.white("The extension may not have been bundled correctly."));
    if (isDevelopmentMode()) {
      console.log("");
      console.log(chalk.white("In development mode, build the extension first:"));
      console.log(`  ${chalk.green("cd packages/extension && pnpm run build:all")}`);
    }
    process.exit(1);
  }

  console.log(
    chalk.yellow("⚠️  Chrome does not allow programmatic installation outside the Web Store"),
  );
  console.log("");
  console.log(chalk.white("Extension location:"));
  console.log(`   ${chalk.cyan(extensionZip)}`);
  console.log("");
  console.log(chalk.white("To manually load the extension:"));
  console.log("");
  console.log(chalk.white("1. Unzip the extension:"));
  console.log(`   ${chalk.green(`unzip ${extensionZip} -d ~/spark-chrome-extension`)}`);
  console.log("");
  console.log(chalk.white("2. Open Chrome and navigate to:"));
  console.log(`   ${chalk.cyan("chrome://extensions/")}`);
  console.log("");
  console.log(chalk.white("3. Enable 'Developer mode' (toggle in top right)"));
  console.log("");
  console.log(chalk.white("4. Click 'Load unpacked'"));
  console.log("");
  console.log(chalk.white("5. Select the unzipped directory:"));
  console.log(`   ${chalk.cyan("~/spark-chrome-extension")}`);
  console.log("");
  console.log(chalk.gray("Profile directory found: " + profileDir));
}

/**
 * Get the path to a bundled extension asset
 * @param browser - The browser to get the extension for (firefox or chrome)
 * @returns The path to the extension ZIP file, or null if not found
 */
function getExtensionAssetPath(browser: "firefox" | "chrome"): string | null {
  // Determine the base directory based on build mode
  let baseDir: string;

  if (isDevelopmentMode()) {
    // In development, extensions are in packages/extension/dist/
    const currentFile = fileURLToPath(import.meta.url);
    const cliDir = dirname(dirname(currentFile)); // Go up from dist/commands/ to cli/
    baseDir = join(cliDir, "..", "extension", "dist");
  } else {
    // In production, extensions are bundled in dist/extensions/
    const currentFile = fileURLToPath(import.meta.url);
    const distDir = dirname(dirname(currentFile)); // Go up from dist/commands/ to dist/
    baseDir = join(distDir, "extensions");
  }

  // Look for the extension ZIP file
  // The filename pattern is: spark-extension-{version}-{browser}.zip
  // We'll use a glob pattern to find any version
  const pattern = browser === "firefox" ? "firefox" : "chrome";

  try {
    const files = existsSync(baseDir) ? readdirSync(baseDir) : [];
    const extensionFile = files.find(
      (f: string) => f.includes(pattern) && f.endsWith(".zip") && !f.includes("sources"),
    );

    if (extensionFile) {
      return join(baseDir, extensionFile);
    }
  } catch (error) {
    // Directory doesn't exist or can't be read
    return null;
  }

  return null;
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

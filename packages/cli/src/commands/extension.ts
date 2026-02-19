import chalk from "chalk";
import { execFileSync, spawn } from "child_process";
import { existsSync, mkdtempSync } from "fs";
import { tmpdir } from "os";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import { Command } from "commander";

const SUPPORTED_BROWSERS = ["chrome", "firefox"] as const;
type SupportedBrowser = (typeof SUPPORTED_BROWSERS)[number];

/**
 * Creates the 'extension' command group with subcommands for managing the Spark browser extension.
 *
 * Subcommands:
 *   extension install <browser> [--tmp]  - Install extension in the specified browser
 */
export function createExtensionCommand(): Command {
  const extensionCmd = new Command("extension").description("Manage the Spark browser extension");

  extensionCmd.addCommand(createExtensionInstallCommand());

  return extensionCmd;
}

/**
 * extension install <browser> [--tmp]
 *
 * Launches the browser with the Spark extension loaded.
 *
 * Chrome: Launches with --load-extension=<path>. Pass --tmp to use a throwaway
 *         user-data directory so the default profile is never modified.
 *
 * Firefox: Uses `web-ext run --source-dir=<path>`. Pass --tmp to use
 *          --profile-create-if-missing with a generated profile name so the
 *          default profile is never modified.
 *
 * Design notes:
 *   - The pre-built extension is expected to live at:
 *       ../../extension/dist/<browser>/  (relative to this file at runtime)
 *     This path is finalised in Phase 3G when the npm package assembly is
 *     configured. The helper `resolveExtensionPath()` centralises the logic so
 *     it can be updated in one place.
 *   - Chrome is launched via `google-chrome` / `google-chrome-stable` / `chromium`
 *     (first one found on PATH). A `--chrome-binary` flag is provided to override.
 *   - Firefox is launched via `web-ext` (a devDependency bundled with the CLI).
 *     `web-ext` handles finding Firefox automatically, and a `--firefox-binary`
 *     flag lets users point at a custom binary.
 */
function createExtensionInstallCommand(): Command {
  return new Command("install")
    .description("Load the Spark extension into a browser instance")
    .argument("<browser>", `Browser to use (${SUPPORTED_BROWSERS.join("|")})`)
    .option("--tmp", "Use a temporary profile instead of the default user profile")
    .option("--chrome-binary <path>", "Path to the Chrome/Chromium executable")
    .option("--firefox-binary <path>", "Path to the Firefox executable")
    .action(
      async (
        browser: string,
        options: { tmp?: boolean; chromeBinary?: string; firefoxBinary?: string },
      ) => {
        if (!SUPPORTED_BROWSERS.includes(browser as SupportedBrowser)) {
          console.error(chalk.red(`❌ Unsupported browser: ${browser}`));
          console.error(chalk.gray(`Supported browsers: ${SUPPORTED_BROWSERS.join(", ")}`));
          process.exit(1);
          return;
        }

        const extensionPath = resolveExtensionPath(browser as SupportedBrowser);

        if (!existsSync(extensionPath)) {
          console.error(chalk.red("❌ Extension not found at:"), extensionPath);
          console.error(
            chalk.gray(
              "Run the extension build first: pnpm --filter spark-extension build:" + browser,
            ),
          );
          process.exit(1);
          return;
        }

        console.log(chalk.blue.bold(`🚀 Loading Spark extension in ${browser}...`));
        console.log(chalk.gray(`Extension path: ${extensionPath}`));

        if (browser === "chrome") {
          await launchChrome(extensionPath, options);
        } else {
          await launchFirefox(extensionPath, options);
        }
      },
    );
}

// ---------------------------------------------------------------------------
// Path resolution
// ---------------------------------------------------------------------------

/**
 * Resolve the path to the pre-built extension for the given browser.
 *
 * Resolution order (first existing path wins):
 *
 * 1. Installed npm package layout (Phase 3G):
 *      dist/cli/commands/extension.js  →  ../../extension/<browser>/
 *    i.e.  <package-root>/dist/extension/<browser>/
 *
 * 2. Monorepo dev build via WXT (.output/<browser>-mv3/):
 *      packages/cli/dist/commands/extension.js  →  (up 4) → repo root
 *      repo root / packages/extension/.output/<browser>-mv3/
 *
 * 3. Monorepo dev build via WXT (dist/<browser>-mv2/ for firefox):
 *    Same path but inside packages/extension/dist/
 *
 * The helper is intentionally tolerant so that `spark extension install`
 * gives a clear error (path not found) rather than a stack trace if the
 * extension has not been built yet.
 */
function resolveExtensionPath(browser: SupportedBrowser): string {
  const __dirname = dirname(fileURLToPath(import.meta.url));

  // 1. Installed npm package: dist/cli/commands/ → dist/extension/<browser>/
  const installedPath = resolve(__dirname, "../../extension", browser);
  if (existsSync(installedPath)) {
    return installedPath;
  }

  // 2. Monorepo dev: packages/cli/dist/commands/ → repo root → packages/extension/.output/
  const repoRoot = resolve(__dirname, "../../../../");
  const wxtOutputDir = join(repoRoot, "packages", "extension", ".output");

  // WXT names the output dir <browser>-mv3 (chrome) or <browser>-mv2 (firefox)
  const mvVariants = [`${browser}-mv3`, `${browser}-mv2`];
  for (const variant of mvVariants) {
    const wxtOutput = join(wxtOutputDir, variant);
    if (existsSync(wxtOutput)) {
      return wxtOutput;
    }
  }

  // 3. WXT outputDir set to "dist" in wxt.config.ts: packages/extension/dist/<browser>-mv*/
  const extensionDistDir = join(repoRoot, "packages", "extension", "dist");
  for (const variant of mvVariants) {
    const builtPath = join(extensionDistDir, variant);
    if (existsSync(builtPath)) {
      return builtPath;
    }
  }

  // Return the installed path as the canonical "expected" location for error messaging
  return installedPath;
}

// ---------------------------------------------------------------------------
// Browser launchers
// ---------------------------------------------------------------------------

/**
 * Launch Chrome with the extension loaded via --load-extension.
 *
 * Chrome does not support loading unpacked extensions from the default profile
 * when it is already open. Using --tmp creates a fresh data dir each time,
 * which avoids the conflict and is the recommended approach for development.
 *
 * Mechanism:
 *   chrome --load-extension=<ext-path> [--user-data-dir=<tmp-dir>]
 */
async function launchChrome(
  extensionPath: string,
  options: { tmp?: boolean; chromeBinary?: string },
): Promise<void> {
  const binary = options.chromeBinary ?? findChromeBinary();

  if (!binary) {
    console.error(chalk.red("❌ Chrome/Chromium executable not found on PATH."));
    console.error(
      chalk.gray("Install Chrome or Chromium, or specify a path with --chrome-binary."),
    );
    process.exit(1);
    return;
  }

  const args: string[] = [
    `--load-extension=${extensionPath}`,
    "--no-first-run",
    "--no-default-browser-check",
  ];

  if (options.tmp) {
    const tmpDir = mkdtempSync(join(tmpdir(), "spark-chrome-"));
    args.push(`--user-data-dir=${tmpDir}`);
    console.log(chalk.gray(`Temporary profile: ${tmpDir}`));
  }

  console.log(chalk.green(`✅ Launching Chrome: ${binary}`));
  console.log(chalk.gray(`Args: ${args.join(" ")}`));

  const proc = spawn(binary, args, { stdio: "inherit", detached: false });

  proc.on("error", (err) => {
    console.error(chalk.red("❌ Failed to launch Chrome:"), err.message);
    process.exit(1);
  });

  await new Promise<void>((resolve) => {
    proc.on("close", (code) => {
      if (code !== 0 && code !== null) {
        console.error(chalk.yellow(`Chrome exited with code ${code}`));
      }
      resolve();
    });
  });
}

/**
 * Launch Firefox with the extension loaded via web-ext.
 *
 * web-ext is the official Mozilla tool for loading unsigned extensions into
 * Firefox for development. It handles:
 *   - Temporary installation (extensions are removed when Firefox closes)
 *   - Profile management (--profile-create-if-missing)
 *   - Live reloading (not used here, but available)
 *
 * Mechanism:
 *   web-ext run --source-dir=<ext-path> [--profile-create-if-missing]
 *               [--firefox=<binary>]
 */
async function launchFirefox(
  extensionPath: string,
  options: { tmp?: boolean; firefoxBinary?: string },
): Promise<void> {
  const webExtBin = findWebExtBinary();

  if (!webExtBin) {
    console.error(chalk.red("❌ web-ext not found."));
    console.error(chalk.gray("web-ext is bundled with spark-cli. Try reinstalling: pnpm install"));
    process.exit(1);
    return;
  }

  const args: string[] = ["run", `--source-dir=${extensionPath}`];

  if (options.tmp) {
    // Create a named temporary profile so Firefox starts fresh
    const profileName = `spark-tmp-${Date.now()}`;
    args.push("--profile-create-if-missing", `--firefox-profile=${profileName}`);
    console.log(chalk.gray(`Temporary Firefox profile: ${profileName}`));
  }

  if (options.firefoxBinary) {
    args.push(`--firefox=${options.firefoxBinary}`);
  }

  console.log(chalk.green(`✅ Launching Firefox via web-ext`));
  console.log(chalk.gray(`web-ext ${args.join(" ")}`));

  const proc = spawn(webExtBin, args, { stdio: "inherit", detached: false });

  proc.on("error", (err) => {
    console.error(chalk.red("❌ Failed to launch Firefox via web-ext:"), err.message);
    process.exit(1);
  });

  await new Promise<void>((resolve) => {
    proc.on("close", (code) => {
      if (code !== 0 && code !== null) {
        console.error(chalk.yellow(`web-ext exited with code ${code}`));
      }
      resolve();
    });
  });
}

// ---------------------------------------------------------------------------
// Binary discovery helpers
// ---------------------------------------------------------------------------

/**
 * Find the Chrome/Chromium executable on PATH.
 * Tries a list of common binary names in order.
 */
function findChromeBinary(): string | null {
  const candidates = [
    "google-chrome",
    "google-chrome-stable",
    "chromium",
    "chromium-browser",
    // macOS
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
  ];

  for (const candidate of candidates) {
    try {
      // `which` works on macOS/Linux; for absolute paths we just check existence
      if (candidate.startsWith("/")) {
        if (existsSync(candidate)) return candidate;
      } else {
        execFileSync("which", [candidate], { stdio: "pipe" });
        return candidate;
      }
    } catch {
      // not found, try next
    }
  }

  return null;
}

/**
 * Locate the web-ext binary bundled with the CLI package.
 * Falls back to a global web-ext on PATH.
 */
function findWebExtBinary(): string | null {
  const __dirname = dirname(fileURLToPath(import.meta.url));

  // Bundled via node_modules/.bin when web-ext is a dependency of spark-cli
  const localBin = resolve(__dirname, "../../node_modules/.bin/web-ext");
  if (existsSync(localBin)) return localBin;

  // Monorepo root node_modules
  const rootBin = resolve(__dirname, "../../../../node_modules/.bin/web-ext");
  if (existsSync(rootBin)) return rootBin;

  // Global PATH fallback
  try {
    execFileSync("which", ["web-ext"], { stdio: "pipe" });
    return "web-ext";
  } catch {
    return null;
  }
}

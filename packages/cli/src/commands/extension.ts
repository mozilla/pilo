import chalk from "chalk";
import { execFileSync, spawn } from "child_process";
import { existsSync, mkdtempSync } from "fs";
import { tmpdir } from "os";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import { Command } from "commander";
import { isProduction } from "spark-core";

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
 * Production mode (npm-installed, __SPARK_PRODUCTION__ === true):
 *   Resolves the pre-built extension from dist/extension/<browser>/ and
 *   launches the browser directly.
 *
 *   Chrome: Launches with --load-extension=<path>. Pass --tmp to use a
 *           throwaway user-data directory so the default profile is never
 *           modified.
 *
 *   Firefox: Uses `web-ext run --source-dir=<path> --no-reload`. Pass --tmp
 *            to use --profile-create-if-missing with a generated profile name
 *            so the default profile is never modified.
 *
 * Dev mode (running from source, __SPARK_PRODUCTION__ === false):
 *   Shells out to `pnpm -F spark-extension dev:<browser>`. The WXT dev server
 *   handles browser launch, HMR, and profile management. The --tmp flag is
 *   forwarded if provided so future dev scripts can use it.
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

        if (isProduction()) {
          await runProduction(browser as SupportedBrowser, options);
        } else {
          await runDev(browser as SupportedBrowser, options);
        }
      },
    );
}

// ---------------------------------------------------------------------------
// Production path
// ---------------------------------------------------------------------------

/**
 * Production mode: resolve the pre-built extension from dist/extension/<browser>/
 * and launch the browser directly.
 */
async function runProduction(
  browser: SupportedBrowser,
  options: { tmp?: boolean; chromeBinary?: string; firefoxBinary?: string },
): Promise<void> {
  const extensionPath = resolveProductionExtensionPath(browser);

  if (!existsSync(extensionPath)) {
    console.error(chalk.red("❌ Extension not found at:"), extensionPath);
    console.error(
      chalk.gray(
        "The pre-built extension is missing from the npm package. Try reinstalling: npm install -g @tabstack/spark",
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
}

/**
 * Resolve the path to the pre-built extension for the given browser.
 *
 * In the npm-installed package layout, compiled CLI files live at:
 *   dist/cli/commands/extension.js
 *
 * The extension artifacts are assembled alongside the CLI at:
 *   dist/extension/<browser>/
 *
 * So from __dirname (dist/cli/commands/) we go up two levels to reach
 * dist/, then into extension/<browser>/.
 */
function resolveProductionExtensionPath(browser: SupportedBrowser): string {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  return resolve(__dirname, "../../extension", browser);
}

// ---------------------------------------------------------------------------
// Dev path
// ---------------------------------------------------------------------------

/**
 * Dev mode: shell out to `pnpm -F spark-extension dev:<browser>`.
 *
 * The WXT dev server handles browser launch, HMR, extension loading, and
 * profile management. We do not need binary detection or manual Chrome/Firefox
 * args here; those are production-only concerns.
 *
 * If the dev script doesn't exist yet (it's added in a future plan), pnpm will
 * exit with a non-zero code and we surface a clear error message.
 */
async function runDev(browser: SupportedBrowser, options: { tmp?: boolean }): Promise<void> {
  const script = `dev:${browser}`;
  const args = ["-F", "spark-extension", "run", script];

  if (options.tmp) {
    // Forward --tmp as a CLI arg to the WXT dev script via the pnpm run `--` separator
    args.push("--", "--tmp");
  }

  console.log(chalk.blue.bold(`🚀 Starting Spark extension dev server for ${browser}...`));
  console.log(chalk.gray(`Running: pnpm ${args.join(" ")}`));

  const proc = spawn("pnpm", args, { stdio: "inherit", detached: false });

  proc.on("error", (err) => {
    console.error(chalk.red("❌ Failed to start extension dev server:"), err.message);
    console.error(
      chalk.gray(
        `Extension dev script not found. Run 'pnpm --filter spark-extension run ${script}' manually, ` +
          `or build the extension first with 'pnpm --filter spark-extension run build:${browser}'.`,
      ),
    );
    process.exit(1);
  });

  await new Promise<void>((resolve) => {
    proc.on("close", (code) => {
      if (code !== 0 && code !== null) {
        console.error(chalk.yellow(`pnpm ${script} exited with code ${code}`));
        console.error(
          chalk.gray(
            `Extension dev script not found. Run 'pnpm --filter spark-extension run ${script}' manually, ` +
              `or build the extension first with 'pnpm --filter spark-extension run build:${browser}'.`,
          ),
        );
      }
      resolve();
    });
  });
}

// ---------------------------------------------------------------------------
// Browser launchers (production only)
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
  console.log(chalk.gray("Browser launched. The CLI will now exit; Chrome runs independently."));

  const proc = spawn(binary, args, { stdio: "ignore", detached: true });
  proc.unref();
}

/**
 * Launch Firefox with the extension loaded via web-ext.
 *
 * web-ext is the official Mozilla tool for loading unsigned extensions into
 * Firefox for development. It handles:
 *   - Temporary installation (extensions are removed when Firefox closes)
 *   - Profile management (--profile-create-if-missing)
 *
 * `--no-reload` is always passed so web-ext does not watch for file changes
 * and auto-reload the extension. In production the extension is static; HMR
 * is the dev server's responsibility (WXT handles it in dev mode).
 *
 * Mechanism:
 *   web-ext run --source-dir=<ext-path> --no-reload [--profile-create-if-missing]
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

  const args: string[] = ["run", `--source-dir=${extensionPath}`, "--no-reload"];

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
  console.log(chalk.gray("Browser launched. The CLI will now exit; Firefox runs independently."));

  const proc = spawn(webExtBin, args, { stdio: "ignore", detached: true });
  proc.unref();
}

// ---------------------------------------------------------------------------
// Binary discovery helpers (production only)
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
      // Absolute paths are checked with existsSync; names are resolved via `which`
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

  // Local bin linked by pnpm when web-ext is a dependency of spark-cli
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

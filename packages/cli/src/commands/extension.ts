import chalk from "chalk";
import { execFileSync, spawn } from "child_process";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { Command } from "commander";
import { isProduction, config as configManager } from "pilo-core";
import { mapConfigToExtensionSettings } from "../extensionConfig.js";

const SUPPORTED_BROWSERS = ["chrome", "firefox"] as const;
type SupportedBrowser = (typeof SUPPORTED_BROWSERS)[number];

/**
 * Creates the 'extension' command group with subcommands for managing the Pilo browser extension.
 *
 * Subcommands:
 *   extension install <browser> [--tmp]  - Install extension in the specified browser
 *   extension config-sync               - Re-write pilo.config.json into extension directory(ies)
 */
export function createExtensionCommand(): Command {
  const extensionCmd = new Command("extension").description("Manage the Pilo browser extension");

  extensionCmd.addCommand(createExtensionInstallCommand());
  extensionCmd.addCommand(createExtensionConfigSyncCommand());

  return extensionCmd;
}

/**
 * extension install <browser> [--tmp]
 *
 * Loads the Pilo extension into a browser instance.
 *
 * Production mode (npm-installed, __PILO_PRODUCTION__ === true):
 *   Resolves the pre-built extension from dist/extension/<browser>/ and
 *   either prints instructions (Chrome) or launches the browser directly (Firefox).
 *
 *   Chrome: Prints the extension path and step-by-step "Load unpacked" instructions.
 *           Chrome stable silently ignores --load-extension, so the user must load
 *           the extension manually via chrome://extensions.
 *
 *   Firefox: Uses `web-ext run --source-dir=<path> --no-reload`. Pass --tmp
 *            to use --profile-create-if-missing with a generated profile name
 *            so the default profile is never modified.
 *
 * Dev mode (running from source, __PILO_PRODUCTION__ === false):
 *   Shells out to `pnpm -F pilo-extension dev:<browser>`. The WXT dev server
 *   handles browser launch, HMR, and profile management. The --tmp flag is
 *   forwarded if provided so future dev scripts can use it.
 */
function createExtensionInstallCommand(): Command {
  return new Command("install")
    .description("Load the Pilo extension into a browser instance")
    .argument("<browser>", `Browser to use (${SUPPORTED_BROWSERS.join("|")})`)
    .option("--tmp", "Use a temporary profile instead of the default user profile")
    .option("--firefox-binary <path>", "Path to the Firefox executable")
    .action(async (browser: string, options: { tmp?: boolean; firefoxBinary?: string }) => {
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
    });
}

/**
 * extension config-sync
 *
 * Re-writes the `pilo.config.json` file into the extension directory(ies) so
 * that an already-installed extension picks up the latest global config on its
 * next reload. No reinstall required.
 *
 * Production mode: writes into both dist/extension/chrome/ and
 *   dist/extension/firefox/, but only for directories that actually exist (the
 *   user may have installed only one browser).
 *
 * Dev mode: writes into packages/extension/public/. WXT's file watcher
 *   propagates the change to all browser output directories.
 *
 * Exits with an error if no global config file is found.
 */
function createExtensionConfigSyncCommand(): Command {
  return new Command("config-sync")
    .description("Push updated global config to an already-installed extension")
    .action(async () => {
      const configPath = configManager.getConfigPath();

      if (!existsSync(configPath)) {
        console.error(
          chalk.red(
            "❌ No configuration found. Run 'pilo config init' to set up your configuration.",
          ),
        );
        process.exit(1);
        return;
      }

      if (isProduction()) {
        await syncConfigProduction();
      } else {
        syncConfigDev();
      }
    });
}

/**
 * Production config-sync: write pilo.config.json into every browser extension
 * directory that exists. Skips browsers whose directory is absent (the user
 * may have installed only one).
 */
async function syncConfigProduction(): Promise<void> {
  const synced: string[] = [];

  for (const browser of SUPPORTED_BROWSERS) {
    const extPath = resolveProductionExtensionPath(browser);
    if (existsSync(extPath)) {
      seedExtensionConfig(extPath);
      synced.push(browser);
    }
  }

  if (synced.length === 0) {
    console.error(chalk.red("❌ No installed extension directories found."));
    console.error(
      chalk.gray(
        "Run 'pilo extension install <browser>' first, or rebuild the package with 'pnpm run build'.",
      ),
    );
    process.exit(1);
    return;
  }

  console.log(chalk.green(`✅ Synced config to extension (${synced.join(", ")})`));
  console.log(chalk.gray("Reload the extension for changes to take effect."));
}

/**
 * Dev config-sync: write pilo.config.json into packages/extension/public/.
 * WXT's file watcher propagates the file to all browser output directories.
 */
function syncConfigDev(): void {
  const publicDir = resolveDevExtensionPublicPath();
  seedExtensionConfig(publicDir);
  console.log(chalk.green("✅ Synced config to extension (dev mode)"));
  console.log(chalk.gray("Reload the extension for changes to take effect."));
}

// ---------------------------------------------------------------------------
// Config seeding
// ---------------------------------------------------------------------------

/**
 * Seed the extension directory with a `pilo.config.json` file derived from
 * the user's global Pilo config. Best-effort: if no config exists, or if the
 * mapped result has no useful fields, or if writing fails, a warning is logged
 * and the install proceeds normally.
 *
 * @param extensionDir - Absolute path to the directory that will be loaded as
 *   the unpacked extension (Chrome) or passed to web-ext (Firefox), or the
 *   WXT public/ directory for dev mode.
 */
function seedExtensionConfig(extensionDir: string): void {
  const configPath = configManager.getConfigPath();

  if (!existsSync(configPath)) {
    console.warn(chalk.yellow("⚠  No config file found, skipping extension config seeding"));
    return;
  }

  let settings: ReturnType<typeof mapConfigToExtensionSettings>;
  try {
    const globalConfig = configManager.getGlobalConfig();
    settings = mapConfigToExtensionSettings(globalConfig);
  } catch (err) {
    console.warn(
      chalk.yellow("⚠  Failed to read config for extension seeding, skipping:"),
      err instanceof Error ? err.message : String(err),
    );
    return;
  }

  // Skip writing if there are no meaningful fields to seed.
  if (Object.keys(settings).length === 0) {
    return;
  }

  const seedFilePath = resolve(extensionDir, "pilo.config.json");

  try {
    mkdirSync(extensionDir, { recursive: true });
    writeFileSync(seedFilePath, JSON.stringify(settings, null, 2), "utf-8");
    console.log(chalk.green(`✅ Seeded extension with config from ${configPath}`));
  } catch (err) {
    console.warn(
      chalk.yellow("⚠  Failed to write extension seed config, skipping:"),
      err instanceof Error ? err.message : String(err),
    );
  }
}

// ---------------------------------------------------------------------------
// Production path
// ---------------------------------------------------------------------------

/**
 * Production mode: resolve the pre-built extension from dist/extension/<browser>/
 * and either print instructions (Chrome) or launch the browser directly (Firefox).
 */
async function runProduction(
  browser: SupportedBrowser,
  options: { tmp?: boolean; firefoxBinary?: string },
): Promise<void> {
  const extensionPath = resolveProductionExtensionPath(browser);

  if (!existsSync(extensionPath)) {
    console.error(chalk.red("❌ Extension not found at:"), extensionPath);
    console.error(
      chalk.gray(
        "The pre-built extension is missing from the npm package. Try reinstalling: npm install -g @tabstack/pilo",
      ),
    );
    process.exit(1);
    return;
  }

  // Seed before instructions are printed (Chrome) or browser is launched (Firefox),
  // so the file is in place when the extension loads.
  seedExtensionConfig(extensionPath);

  if (browser === "chrome") {
    printChromeInstructions(extensionPath);
  } else {
    console.log(chalk.blue.bold(`🚀 Loading Pilo extension in ${browser}...`));
    console.log(chalk.gray(`Extension path: ${extensionPath}`));
    await launchFirefox(extensionPath, options);
  }
}

/**
 * Resolve the path to the pre-built extension for the given browser.
 *
 * In the npm-installed package the compiled CLI is bundled at:
 *   dist/cli/src/cli.js
 *
 * The extension artifacts are assembled at:
 *   dist/extension/<browser>/
 *
 * From __dirname (dist/cli/src/) we go up two levels to reach
 * dist/, then into extension/<browser>/.
 */
function resolveProductionExtensionPath(browser: SupportedBrowser): string {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  return resolve(__dirname, "../../extension", browser);
}

/**
 * Print step-by-step instructions for loading the Pilo extension in Chrome.
 *
 * Chrome stable (since ~mid-2022) silently ignores the --load-extension
 * command-line flag, so the extension must be loaded manually via the
 * chrome://extensions UI.
 */
function printChromeInstructions(extensionPath: string): void {
  const absPath = resolve(extensionPath);

  console.log();
  console.log(chalk.blue.bold("📦 Pilo Extension — Chrome Setup"));
  console.log();
  console.log(
    chalk.white("Chrome does not support loading unpacked extensions via command-line flags."),
  );
  console.log(chalk.white("Please follow these steps to load the extension manually:"));
  console.log();
  console.log(chalk.gray("  1. Open Chrome"));
  console.log(chalk.gray("  2. Navigate to: ") + chalk.cyan("chrome://extensions"));
  console.log(chalk.gray('  3. Enable "Developer mode" (toggle in the top-right corner)'));
  console.log(chalk.gray('  4. Click "Load unpacked"'));
  console.log(chalk.gray("  5. Select the following directory:"));
  console.log();
  console.log("     " + chalk.green.bold(absPath));
  console.log();
  console.log(chalk.gray("  (Copy the path above and paste it into the directory picker)"));
  console.log();
}

// ---------------------------------------------------------------------------
// Dev path
// ---------------------------------------------------------------------------

/**
 * Resolve the path to the WXT public/ directory for dev mode seeding.
 *
 * WXT copies every file from public/ into the extension output directory
 * during the build/serve step. Writing pilo.config.json here is idempotent
 * and works with WXT's file watching (any rebuild picks up the file).
 *
 * From __dirname (dist/cli/commands/ in production, or src/commands/ in dev
 * when running via tsx), we navigate up to the monorepo root and then into
 * packages/extension/public/.
 */
function resolveDevExtensionPublicPath(): string {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  // __dirname is .../packages/cli/src/commands (dev) or .../dist/cli/commands (prod)
  // Walk up to monorepo root: 4 levels in dev, same in prod (dist is still inside workspace).
  // We use a relative path from the known CLI package position.
  return resolve(__dirname, "../../../extension/public");
}

/**
 * Dev mode: shell out to `pnpm -F pilo-extension run dev -- --<browser> [--tmp]`.
 *
 * The WXT dev server handles browser launch, HMR, extension loading, and
 * profile management. We do not need binary detection or manual Chrome/Firefox
 * args here; those are production-only concerns.
 */
async function runDev(browser: SupportedBrowser, options: { tmp?: boolean }): Promise<void> {
  // Seed the extension public/ directory so WXT copies pilo.config.json into
  // the output when it builds. This must happen before the dev server starts.
  const publicDir = resolveDevExtensionPublicPath();
  seedExtensionConfig(publicDir);

  // Use a single "dev" script with browser flag, forwarding args via "--"
  const args = ["-F", "pilo-extension", "run", "dev", "--", `--${browser}`];

  if (options.tmp) {
    args.push("--tmp");
  }

  console.log(chalk.blue.bold(`🚀 Starting Pilo extension dev server for ${browser}...`));
  console.log(chalk.gray(`Running: pnpm ${args.join(" ")}`));

  const proc = spawn("pnpm", args, { stdio: "inherit", detached: false });

  proc.on("error", (err) => {
    console.error(chalk.red("❌ Failed to start extension dev server:"), err.message);
    console.error(
      chalk.gray(
        `Extension dev script not found. Run 'pnpm --filter pilo-extension run dev -- --${browser}' manually, ` +
          `or build the extension first with 'pnpm --filter pilo-extension run build:${browser}'.`,
      ),
    );
    process.exit(1);
  });

  await new Promise<void>((resolve) => {
    proc.on("close", (code) => {
      if (code !== 0 && code !== null) {
        console.error(chalk.yellow(`pnpm dev exited with code ${code}`));
        console.error(
          chalk.gray(
            `Extension dev script not found. Run 'pnpm --filter pilo-extension run dev -- --${browser}' manually, ` +
              `or build the extension first with 'pnpm --filter pilo-extension run build:${browser}'.`,
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
    console.error(chalk.gray("web-ext is bundled with pilo-cli. Try reinstalling: pnpm install"));
    process.exit(1);
    return;
  }

  const args: string[] = ["run", `--source-dir=${extensionPath}`, "--no-reload"];

  if (options.tmp) {
    // Create a named temporary profile so Firefox starts fresh
    const profileName = `pilo-tmp-${Date.now()}`;
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
    proc.on("close", () => {
      resolve();
    });
  });
}

// ---------------------------------------------------------------------------
// Binary discovery helpers (production only)
// ---------------------------------------------------------------------------

/**
 * Locate the web-ext binary relative to the given directory.
 * @internal Exported only for testing. Production callers should use the private findWebExtBinary() wrapper.
 *
 * In the npm-installed package the compiled CLI is bundled into a single file
 * at dist/cli/src/cli.js (tsup with splitting: false). node_modules lives at
 * the package root, 3 levels up from dist/cli/src/.
 *
 * For local scoped installs (<project>/node_modules/@tabstack/pilo/), web-ext
 * may be hoisted to the project root's node_modules, 6 levels up.
 *
 * Falls back to a global web-ext on PATH.
 */
export function findWebExtBinaryFrom(dir: string): string | null {
  // Package root node_modules: dist/cli/src/ → ../../.. → <package-root>/
  const localBin = resolve(dir, "../../../node_modules/.bin/web-ext");
  if (existsSync(localBin)) return localBin;

  // Hoisted node_modules in a local scoped install:
  // dist/cli/src/ → ../../../../../.. → <project>/
  // (covers <project>/node_modules/@tabstack/pilo/dist/cli/src/)
  const hoistedBin = resolve(dir, "../../../../../../node_modules/.bin/web-ext");
  if (existsSync(hoistedBin)) return hoistedBin;

  // Global PATH fallback
  try {
    execFileSync("which", ["web-ext"], { stdio: "pipe" });
    return "web-ext";
  } catch {
    return null;
  }
}

function findWebExtBinary(): string | null {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  return findWebExtBinaryFrom(__dirname);
}

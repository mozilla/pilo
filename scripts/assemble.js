#!/usr/bin/env node
/**
 * scripts/assemble.js
 *
 * Assembles the publishable @tabstack/spark npm package from the outputs of
 * the three workspace packages:
 *   - spark-core      → dist/  (flat TypeScript output)
 *   - spark-cli       → dist/cli/
 *   - spark-extension → dist/extension/chrome/ and dist/extension/firefox/
 *
 * Run via: node scripts/assemble.js
 * Called by: pnpm build (root), pnpm prepublishOnly (root)
 *
 * The script is intentionally written without any non-Node.js dependencies
 * so it runs with `node` directly without needing tsx or a bundler.
 */

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DIST = join(ROOT, "dist");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(msg) {
  process.stdout.write(`[assemble] ${msg}\n`);
}

function step(label) {
  process.stdout.write(`\n▶ ${label}\n`);
}

/** Run a command, streaming output to stdout/stderr. Throws on non-zero exit. */
function run(cmd, args, cwd = ROOT) {
  log(`$ ${cmd} ${args.join(" ")}`);
  execFileSync(cmd, args, { cwd, stdio: "inherit" });
}

/** Copy src directory into dest, overwriting existing files. */
function copyDir(src, dest) {
  if (!existsSync(src)) {
    throw new Error(`Source directory not found: ${src}`);
  }
  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, { recursive: true });
  log(`Copied ${src} → ${dest}`);
}

// ---------------------------------------------------------------------------
// Step 1: Clean root dist
// ---------------------------------------------------------------------------

step("1/5  Clean root dist/");
if (existsSync(DIST)) {
  rmSync(DIST, { recursive: true, force: true });
  log("Removed existing dist/");
}
mkdirSync(DIST, { recursive: true });

// ---------------------------------------------------------------------------
// Step 2: Build spark-core
// ---------------------------------------------------------------------------

step("2/5  Build spark-core");
run("pnpm", ["--filter", "spark-core", "run", "build"]);

const CORE_DIST = join(ROOT, "packages", "core", "dist");
if (!existsSync(CORE_DIST)) {
  throw new Error(`spark-core build produced no dist/ at ${CORE_DIST}`);
}

// Copy core's flat dist output directly into root dist/.
// This means dist/index.js, dist/core.js, dist/browser/, etc.
// Consumers can then do: import { WebAgent } from "@tabstack/spark"
const coreEntries = readdirSync(CORE_DIST);
for (const entry of coreEntries) {
  const src = join(CORE_DIST, entry);
  const dest = join(DIST, entry);
  cpSync(src, dest, { recursive: true });
}
log(`Copied ${coreEntries.length} entries from spark-core dist/ → root dist/`);

// ---------------------------------------------------------------------------
// Step 3: Build spark-cli
// ---------------------------------------------------------------------------

step("3/5  Build spark-cli");
run("pnpm", ["--filter", "spark-cli", "run", "build"]);

const CLI_DIST = join(ROOT, "packages", "cli", "dist");
if (!existsSync(CLI_DIST)) {
  throw new Error(`spark-cli build produced no dist/ at ${CLI_DIST}`);
}

// Copy CLI output into dist/cli/
copyDir(CLI_DIST, join(DIST, "cli"));

// ---------------------------------------------------------------------------
// Step 4: Build spark-extension for both browsers
// ---------------------------------------------------------------------------

step("4/5  Build spark-extension (chrome + firefox)");
// spark-core is already built (step 2), so build:publish just runs WXT for
// both browsers. The prebuild:chrome/firefox pre-hooks have been removed to
// avoid the nested pnpm-workspace resolution issue.
run("pnpm", ["--filter", "spark-extension", "run", "build:publish"]);

// WXT outputs to packages/extension/dist/ with subdirectory names:
//   chrome-mv3/   → we publish as extension/chrome/
//   firefox-mv2/  → we publish as extension/firefox/
const EXT_DIST = join(ROOT, "packages", "extension", "dist");
if (!existsSync(EXT_DIST)) {
  throw new Error(`spark-extension build produced no dist/ at ${EXT_DIST}`);
}

const BROWSER_MAP = {
  "chrome-mv3": "chrome",
  "firefox-mv2": "firefox",
};

for (const [wxtName, publishName] of Object.entries(BROWSER_MAP)) {
  const src = join(EXT_DIST, wxtName);
  const dest = join(DIST, "extension", publishName);
  if (!existsSync(src)) {
    throw new Error(
      `Expected extension build output not found: ${src}\n` +
        `Make sure 'pnpm --filter spark-extension run build:publish' succeeds.`,
    );
  }
  copyDir(src, dest);
}

// ---------------------------------------------------------------------------
// Step 5: Verify assembly
// ---------------------------------------------------------------------------

step("5/5  Verify assembly");

const required = [
  join(DIST, "index.js"),
  join(DIST, "index.d.ts"),
  join(DIST, "core.js"),
  join(DIST, "core.d.ts"),
  join(DIST, "cli", "cli.js"),
  join(DIST, "extension", "chrome", "manifest.json"),
  join(DIST, "extension", "firefox", "manifest.json"),
];

let allOk = true;
for (const file of required) {
  if (existsSync(file)) {
    log(`✓ ${file.replace(ROOT + "/", "")}`);
  } else {
    process.stderr.write(`[assemble] ✗ MISSING: ${file.replace(ROOT + "/", "")}\n`);
    allOk = false;
  }
}

if (!allOk) {
  process.stderr.write("[assemble] Assembly verification failed. See missing files above.\n");
  process.exit(1);
}

log("\n✅ Assembly complete. root dist/ is ready for npm publish.");

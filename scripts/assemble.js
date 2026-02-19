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
 * Depends on esbuild (root devDependency) for the production-flag injection
 * step. All other steps use Node.js built-ins only.
 */

import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "fs";
import { dirname, join, relative, resolve } from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";
import { transform } from "esbuild";

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

// Process core's dist output into root dist/:
//   - .js files: run through esbuild with define to inject the production flag
//   - All other files (.d.ts, .d.ts.map, etc.): copied as-is with cpSync
//
// This replaces the old inject-prod-flag.mjs post-compile script. esbuild's
// `transform` API replaces the bare `__SPARK_PRODUCTION__` identifier with
// the literal `true`, so the runtime check evaluates correctly and bundlers
// can dead-code-eliminate the dev-only branches.

/**
 * Recursively walk a directory, calling `fn` for every file path.
 * @param {string} dir
 * @param {(filePath: string) => void} fn
 */
function walkDir(dir, fn) {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      walkDir(fullPath, fn);
    } else {
      fn(fullPath);
    }
  }
}

let jsCount = 0;
let otherCount = 0;
const jsFiles = [];

walkDir(CORE_DIST, (filePath) => {
  if (filePath.endsWith(".js")) {
    jsFiles.push(filePath);
  } else {
    // Non-JS file (e.g. .d.ts, .d.ts.map): copy directly.
    const rel = relative(CORE_DIST, filePath);
    const destPath = join(DIST, rel);
    mkdirSync(dirname(destPath), { recursive: true });
    cpSync(filePath, destPath);
    otherCount++;
  }
});

// Process all JS files through esbuild in parallel, then write results.
const transforms = jsFiles.map(async (filePath) => {
  const source = readFileSync(filePath, "utf-8");
  const result = await transform(source, {
    define: { __SPARK_PRODUCTION__: "true" },
    format: "esm",
    platform: "node",
    // sourcefile keeps source map references correct
    sourcefile: filePath,
  });
  const rel = relative(CORE_DIST, filePath);
  const destPath = join(DIST, rel);
  mkdirSync(dirname(destPath), { recursive: true });
  writeFileSync(destPath, result.code, "utf-8");
  jsCount++;
});

await Promise.all(transforms);

log(
  `spark-core dist/ → root dist/: processed ${jsCount} JS file${jsCount !== 1 ? "s" : ""} with esbuild define, copied ${otherCount} non-JS file${otherCount !== 1 ? "s" : ""}`,
);

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

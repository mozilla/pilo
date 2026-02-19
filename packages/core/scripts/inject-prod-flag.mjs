#!/usr/bin/env node
/**
 * scripts/inject-prod-flag.mjs
 *
 * Post-compile step: replaces the runtime __SPARK_PRODUCTION__ guard in
 * compiled JS files with the literal `true` so that the published npm package
 * always runs in production mode.
 *
 * The TypeScript source uses:
 *   typeof __SPARK_PRODUCTION__ !== "undefined" && __SPARK_PRODUCTION__
 *
 * After tsc compiles, this expression appears verbatim in the .js output.
 * This script rewrites it to `true` so bundlers and runtimes can dead-code-
 * eliminate the dev-only branches (dotenv loading, env var parsing, etc.).
 *
 * Usage: node scripts/inject-prod-flag.mjs
 * Called by: the "build" script in package.json (after tsc)
 *
 * Only .js files in dist/ are modified. Source files are never touched.
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST_DIR = join(__dirname, "..", "dist");

// The exact string that tsc emits for the isProduction() body.
const SEARCH = `typeof __SPARK_PRODUCTION__ !== "undefined" && __SPARK_PRODUCTION__`;
const REPLACE = "true";

let patchedFiles = 0;
let scannedFiles = 0;

/**
 * Recursively walk a directory, calling `fn` for every file.
 * @param {string} dir
 * @param {(filePath: string) => void} fn
 */
function walk(dir, fn) {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      walk(fullPath, fn);
    } else if (stat.isFile()) {
      fn(fullPath);
    }
  }
}

walk(DIST_DIR, (filePath) => {
  if (!filePath.endsWith(".js")) return;

  scannedFiles++;
  const original = readFileSync(filePath, "utf-8");

  if (!original.includes(SEARCH)) return;

  const patched = original.replaceAll(SEARCH, REPLACE);
  writeFileSync(filePath, patched, "utf-8");

  const occurrences = (
    original.match(new RegExp(SEARCH.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) ?? []
  ).length;
  console.log(
    `[inject-prod-flag] Patched ${filePath.replace(join(__dirname, "..") + "/", "")} (${occurrences} replacement${occurrences !== 1 ? "s" : ""})`,
  );
  patchedFiles++;
});

if (patchedFiles === 0) {
  console.error(
    `[inject-prod-flag] ERROR: No files were patched. ` +
      `Expected to find "${SEARCH}" in at least one .js file under dist/. ` +
      `Check that tsc ran first and that the source pattern has not changed.`,
  );
  process.exit(1);
}

console.log(
  `[inject-prod-flag] Done. Scanned ${scannedFiles} .js file${scannedFiles !== 1 ? "s" : ""}, patched ${patchedFiles}.`,
);

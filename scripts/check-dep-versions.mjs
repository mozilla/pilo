#!/usr/bin/env node
/**
 * scripts/check-dep-versions.mjs
 *
 * Scans all package.json files in the pnpm workspace (root + packages/*)
 * and verifies that every dependency shared across two or more packages
 * uses the same version specifier.
 *
 * Exits 1 if mismatches are found; 0 if everything is aligned.
 *
 * Rules:
 *  - Checks both "dependencies" and "devDependencies".
 *  - Skips "workspace:*" references (internal workspace links).
 *  - For simple "^x.y.z" or "x.y.z" ranges, the "newest" is the one
 *    with the highest base version. For anything else, all versions are
 *    reported and the mismatch is still flagged.
 */

import { readFileSync, readdirSync, existsSync } from "fs";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse a version specifier into a numeric tuple for comparison, or null. */
function parseVersion(spec) {
  // Strip leading range chars: ^, ~, >=, <=, >, <, =
  const stripped = spec.replace(/^[~^>=<]+/, "").trim();
  const parts = stripped.split(".").map(Number);
  if (parts.length < 1 || parts.some(isNaN)) return null;
  // Pad to 3 parts
  while (parts.length < 3) parts.push(0);
  return parts;
}

/** Compare two version tuples. Returns positive if a > b, negative if a < b, 0 if equal. */
function compareTuples(a, b) {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

/**
 * Given a map of { packageName -> specifier }, determine which specifier is the
 * "newest" by comparing the base versions. Returns { version, usedBy } or null
 * if versions are too complex to compare automatically.
 */
function findNewest(usageMap) {
  let newest = null;
  let newestTuple = null;
  let canCompare = true;

  for (const [pkgName, spec] of Object.entries(usageMap)) {
    const tuple = parseVersion(spec);
    if (!tuple) {
      canCompare = false;
      break;
    }
    if (!newestTuple || compareTuples(tuple, newestTuple) > 0) {
      newest = { version: spec, usedBy: pkgName };
      newestTuple = tuple;
    }
  }

  return canCompare ? newest : null;
}

// ---------------------------------------------------------------------------
// Collect package.json files
// ---------------------------------------------------------------------------

function loadPackageJson(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch (err) {
    console.error(`Failed to parse ${filePath}: ${err.message}`);
    process.exit(1);
  }
}

const packageFiles = [];

// Root package.json
packageFiles.push({ label: "@tabstack/pilo (root)", path: join(ROOT, "package.json") });

// packages/* directories
const packagesDir = join(ROOT, "packages");
if (existsSync(packagesDir)) {
  for (const entry of readdirSync(packagesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const pkgJsonPath = join(packagesDir, entry.name, "package.json");
    if (!existsSync(pkgJsonPath)) continue;
    const pkg = loadPackageJson(pkgJsonPath);
    const label = pkg.name || entry.name;
    packageFiles.push({ label, path: pkgJsonPath });
  }
}

// ---------------------------------------------------------------------------
// Build dependency map: depName -> { pkgLabel -> version }
// ---------------------------------------------------------------------------

/** Maps dependency name -> Map<packageLabel, versionSpec> */
const depMap = new Map();

for (const { label, path } of packageFiles) {
  const pkg = loadPackageJson(path);
  const sections = [pkg.dependencies ?? {}, pkg.devDependencies ?? {}];

  for (const section of sections) {
    for (const [dep, version] of Object.entries(section)) {
      // Skip internal workspace references
      if (version === "workspace:*" || version.startsWith("workspace:")) continue;

      if (!depMap.has(dep)) depMap.set(dep, new Map());
      const existing = depMap.get(dep);

      // If this package already has this dep recorded (e.g., in both deps and
      // devDeps), keep only the first occurrence to avoid self-mismatch noise.
      if (!existing.has(label)) {
        existing.set(label, version);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Find mismatches: deps that appear in 2+ packages with different versions
// ---------------------------------------------------------------------------

const mismatches = [];

for (const [dep, usageMap] of depMap.entries()) {
  if (usageMap.size < 2) continue;

  const versions = new Set(usageMap.values());
  if (versions.size === 1) continue; // All agree - good.

  // Convert Map to plain object for helpers
  const usageObj = Object.fromEntries(usageMap.entries());
  const newest = findNewest(usageObj);

  mismatches.push({ dep, usageObj, newest });
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

if (mismatches.length === 0) {
  console.log("✅ All shared dependencies use consistent versions across all packages.");
  process.exit(0);
}

// Sort mismatches alphabetically by dep name for stable output
mismatches.sort((a, b) => a.dep.localeCompare(b.dep));

console.error("❌ Dependency version mismatches found:\n");

for (const { dep, usageObj, newest } of mismatches) {
  console.error(`  ${dep}:`);
  for (const [pkgName, version] of Object.entries(usageObj)) {
    console.error(`    - ${pkgName}: ${version}`);
  }
  if (newest) {
    console.error(`    → Newest: ${newest.version} (used by ${newest.usedBy})`);
  } else {
    console.error(`    → Unable to auto-determine newest; manual review required.`);
  }
  console.error("");
}

console.error(
  `Found ${mismatches.length} mismatched ${mismatches.length === 1 ? "dependency" : "dependencies"}.`,
);
console.error("Align all packages to use the same version specifier and re-run.");

process.exit(1);

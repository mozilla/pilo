#!/usr/bin/env node
/**
 * Script to bundle the extension build outputs into the CLI dist directory.
 * This allows `spark extension install` to sideload the extension.
 */

import { cpSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "../../..");
const extensionOutputDir = join(rootDir, "packages/extension/.output");
const cliDistDir = join(__dirname, "../dist");

// Define source and target paths
const bundleMappings = [
  {
    source: join(extensionOutputDir, "chrome-mv3"),
    target: join(cliDistDir, "extension/chrome"),
    browser: "Chrome",
  },
  {
    source: join(extensionOutputDir, "firefox-mv2"),
    target: join(cliDistDir, "extension/firefox"),
    browser: "Firefox",
  },
];

console.log("📦 Bundling extension builds into CLI dist...\n");

let bundled = 0;
let skipped = 0;

for (const mapping of bundleMappings) {
  if (existsSync(mapping.source)) {
    console.log(`✓ Copying ${mapping.browser} extension from ${mapping.source}`);
    console.log(`  → ${mapping.target}`);

    // Create target directory if it doesn't exist
    mkdirSync(mapping.target, { recursive: true });

    // Copy extension files
    cpSync(mapping.source, mapping.target, { recursive: true });

    bundled++;
  } else {
    console.log(`⚠ Skipping ${mapping.browser}: Build output not found at ${mapping.source}`);
    skipped++;
  }
}

console.log(`\n✨ Bundled ${bundled} browser extension(s) into CLI dist`);
if (skipped > 0) {
  console.log(`⚠ Skipped ${skipped} browser extension(s) (not built)`);
  console.log("\nTip: Build extensions first with:");
  console.log("  cd packages/extension && pnpm run build:chrome && pnpm run build:firefox");
}

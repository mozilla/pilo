#!/usr/bin/env tsx
/**
 * Extension dev script.
 * Usage: tsx scripts/dev.ts --chrome|--firefox [--tmp]
 *
 * Flags:
 *   --chrome   Launch in Chrome
 *   --firefox  Launch in Firefox
 *   --tmp      Use a temporary profile (skip persistent profile env vars)
 */

import { spawn } from "node:child_process";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const isChrome = args.includes("--chrome");
const isFirefox = args.includes("--firefox");
const useTmp = args.includes("--tmp");

if (!isChrome && !isFirefox) {
  console.error("Usage: tsx scripts/dev.ts --chrome|--firefox [--tmp]");
  process.exit(1);
}

const browser = isFirefox ? "firefox" : "chrome";

// Build the child env: start from the current process env.
// If --tmp is set, strip profile env vars so WXT uses a fresh temporary profile.
// If --tmp is not set, let any existing env vars pass through naturally so
// wxt.config.ts can pick them up for persistent profile management.
const env: NodeJS.ProcessEnv = { ...process.env };

if (useTmp) {
  delete env.WEB_EXT_CHROMIUM_PROFILE;
  delete env.WEB_EXT_FIREFOX_PROFILE;
  delete env.WEB_EXT_KEEP_PROFILE_CHANGES;
}

// Resolve the extension package root regardless of where this script is
// invoked from. WXT uses cwd to locate entrypoints, wxt.config.ts, etc.
const extensionRoot = resolve(import.meta.dirname, "..");

// Resolve the wxt binary explicitly from the extension package's node_modules.
// spawn() does not search node_modules/.bin in the child's cwd; it only uses
// the inherited PATH, which pnpm adds as a relative "./node_modules/.bin" entry.
// That relative entry resolves against the parent process cwd (the workspace
// root), not extensionRoot, so bare "wxt" would ENOENT.
const wxtBin = resolve(extensionRoot, "node_modules/.bin/wxt");

const proc = spawn(wxtBin, ["-b", browser], {
  cwd: extensionRoot,
  stdio: "inherit",
  env,
});

proc.on("error", (err) => {
  console.error(`Failed to start wxt: ${err.message}`);
  process.exit(1);
});

proc.on("close", (code) => {
  process.exit(code ?? 0);
});

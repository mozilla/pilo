#!/usr/bin/env node
/**
 * Extension dev script.
 * Usage: node scripts/dev.js [--chrome|--firefox] [--tmp]
 *
 * Flags:
 *   --chrome   Launch in Chrome (default)
 *   --firefox  Launch in Firefox
 *   --tmp      Use a temporary profile (no persistent data)
 */

import { mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const isFirefox = args.includes("--firefox");
const isChrome = args.includes("--chrome");
const useTmp = args.includes("--tmp");

// Default to chrome when neither flag is provided
const browser = isFirefox ? "firefox" : "chrome";

const env = { ...process.env };

if (!useTmp) {
  if (browser === "chrome") {
    const profileDir = ".wxt/chrome-data";
    mkdirSync(profileDir, { recursive: true });
    env.WEB_EXT_CHROMIUM_PROFILE = profileDir;
    env.WEB_EXT_KEEP_PROFILE_CHANGES = "true";
  } else {
    const profileDir = ".wxt/firefox-data";
    mkdirSync(profileDir, { recursive: true });
    env.WEB_EXT_FIREFOX_PROFILE = profileDir;
    env.WEB_EXT_KEEP_PROFILE_CHANGES = "true";
  }
}

const result = spawnSync("wxt", ["-b", browser], {
  stdio: "inherit",
  env,
});

process.exit(result.status ?? 0);

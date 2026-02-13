/**
 * Manual test for browserSetup module
 *
 * This is not an automated test. Run it manually to verify the browser detection
 * and installation prompt logic.
 *
 * Usage:
 *   tsx src/cli/browserSetup.test.ts
 */

import { ensureBrowsersInstalled } from "./browserSetup.js";

console.log("Testing browser setup detection...\n");

ensureBrowsersInstalled()
  .then(() => {
    console.log("✓ Browser setup check completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("✗ Browser setup check failed:", error);
    process.exit(1);
  });

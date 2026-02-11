/**
 * Bundles the ariaTree module into a self-contained IIFE script
 * that can be injected into browser pages via Playwright's addInitScript.
 *
 * Usage: tsx scripts/bundle-aria-tree.ts
 * Output: dist/browser/ariaTree/bundle.iife.js
 */

import { build } from "esbuild";
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");

async function main() {
  const outDir = join(projectRoot, "dist/browser/ariaTree");
  const outPath = join(outDir, "bundle.iife.js");

  // Ensure output directory exists
  mkdirSync(outDir, { recursive: true });

  // Bundle the ariaTree entry point into a single IIFE
  const result = await build({
    entryPoints: [join(projectRoot, "src/browser/ariaTree/ariaSnapshot.ts")],
    bundle: true,
    format: "iife",
    globalName: "__sparkAriaTree",
    write: false,
    minify: false,
    target: "es2022",
    platform: "browser",
  });

  let bundledCode = result.outputFiles[0].text;

  // The IIFE creates `var __sparkAriaTree = (...)()` which is local.
  // Append an explicit globalThis assignment so the injected script
  // works regardless of execution context.
  bundledCode += "\nglobalThis.__sparkAriaTree = __sparkAriaTree;\n";

  writeFileSync(outPath, bundledCode);
  console.log(`Wrote ${outPath} (${bundledCode.length} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

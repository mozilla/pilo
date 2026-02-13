import { defineConfig } from "tsup";
import { copyFileSync } from "fs";

export default defineConfig({
  // Entry point: thin wrapper that imports from ../../src/cli/
  entry: ["src/index.ts"],

  // Output configuration
  outDir: "dist",
  format: ["esm"],
  target: "node22",

  // Keep all node_modules external (will be installed alongside the CLI)
  // This prevents bundling issues with ESM/CJS interop
  esbuildOptions(options) {
    options.packages = "external";
  },

  // Generate source maps for better debugging
  sourcemap: true,

  // Clean output directory before build
  clean: true,

  // Add shebang for CLI entry point
  banner: {
    js: "#!/usr/bin/env node",
  },

  // Don't split code, keep it as a single bundle
  splitting: false,

  // No TypeScript declarations needed for CLI
  dts: false,

  // Keep readable for debugging
  minify: false,

  // Node platform
  platform: "node",

  // Copy package.json to dist after build
  onSuccess: async () => {
    copyFileSync("package.json", "dist/package.json");
    console.log("✓ Copied package.json to dist/");
  },
});

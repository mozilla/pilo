import { defineConfig } from "tsup";
import { copyFileSync } from "fs";

export default defineConfig({
  // Entry point that re-exports from root
  entry: ["src/index.ts"],

  // Output configuration
  outDir: "dist",
  format: ["esm"],
  target: "node22",

  // Bundle everything except large external dependencies
  // Playwright, AI SDKs, and other large deps stay external
  external: [
    "playwright",
    "@ai-sdk/google",
    "@ai-sdk/google-vertex",
    "@ai-sdk/openai",
    "@ai-sdk/openai-compatible",
    "@openrouter/ai-sdk-provider",
    "ollama-ai-provider-v2",
    "ai",
    "@ghostery/adblocker-playwright",
    "turndown",
    "liquidjs",
    "jsdom",
  ],

  // Generate source maps for better debugging
  sourcemap: true,

  // Clean output directory before build
  clean: true,

  // Preserve shebang for CLI entry point
  shims: true,

  // Don't split code, keep it as a single bundle
  splitting: false,

  // Generate TypeScript declaration files
  dts: false, // We don't need type definitions for a CLI tool

  // Minify for production
  minify: false, // Keep readable for debugging

  // Don't bundle node built-ins
  platform: "node",

  // Copy package.json to dist after build
  onSuccess: async () => {
    copyFileSync("package.json", "dist/package.json");
    console.log("✓ Copied package.json to dist/");
  },
});

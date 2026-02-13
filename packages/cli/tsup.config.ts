import { defineConfig } from "tsup";
import { resolve } from "node:path";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  minify: false,
  target: "node22",
  banner: {
    js: "#!/usr/bin/env node",
  },
  // Externalize all dependencies so they're not bundled
  // They will be resolved from node_modules at runtime
  external: [
    "@ai-sdk/google",
    "@ai-sdk/google-vertex",
    "@ai-sdk/openai",
    "@ai-sdk/openai-compatible",
    "@ghostery/adblocker-playwright",
    "@openrouter/ai-sdk-provider",
    "ai",
    "chalk",
    "commander",
    "cross-fetch",
    "dotenv",
    "eventemitter3",
    "liquidjs",
    "nanoid",
    "ollama-ai-provider-v2",
    "playwright",
    "turndown",
    "zod",
    // Playwright native dependencies that can't be bundled
    "playwright-core",
    "chromium-bidi",
  ],
  esbuildOptions(options) {
    options.alias = {
      "@core": resolve(__dirname, "../../src"),
    };
  },
});

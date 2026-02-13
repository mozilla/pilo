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
  // Externalize all dependencies so they're not bundled
  external: [
    "@hono/node-server",
    "@hono/sentry",
    "dotenv",
    "hono",
    // Shared dependencies from @core
    "chalk",
    "commander",
    "playwright",
    "playwright-core",
    "chromium-bidi",
  ],
  esbuildOptions(options) {
    options.alias = {
      "@core": resolve(__dirname, "../../src"),
    };
  },
});

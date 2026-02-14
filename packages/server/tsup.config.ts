import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  outDir: "dist",
  target: "node22",
  clean: true,
  sourcemap: true,
  splitting: false,
  treeshake: true,
});

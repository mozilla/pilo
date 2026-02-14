import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/cli.ts"],
  format: ["esm"],
  dts: true,
  outDir: "dist",
  target: "node22",
  clean: true,
  sourcemap: true,
  splitting: false,
  treeshake: true,
  // Shebang is preserved from the source file
});

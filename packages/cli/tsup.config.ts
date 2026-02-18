import { readFileSync } from "fs";
import { defineConfig } from "tsup";

// Read package.json to get version and name
const packageJson = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf-8"));

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
  define: {
    __SPARK_VERSION__: JSON.stringify(packageJson.version),
    __SPARK_NAME__: JSON.stringify(packageJson.name),
    SPARK_BUILD_MODE: JSON.stringify("production"),
  },
});

import { defineConfig } from "tsup";
import { readFileSync } from "fs";

const packageJson = JSON.parse(readFileSync("./package.json", "utf-8"));

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
    "process.env.SPARK_BUILD_MODE": '"production"',
    __SPARK_VERSION__: JSON.stringify(packageJson.version),
    __SPARK_NAME__: JSON.stringify(packageJson.name),
  },
});

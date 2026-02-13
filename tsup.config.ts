import { defineConfig } from "tsup";
import { readFileSync } from "fs";

const packageJson = JSON.parse(readFileSync("./package.json", "utf-8"));

export default defineConfig({
  entry: {
    cli: "src/cli.ts",
    index: "src/index.ts",
    core: "src/core.ts",
  },
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  outDir: "dist",
  target: "es2022",
  define: {
    "process.env.SPARK_BUILD_MODE": '"production"',
    __SPARK_VERSION__: JSON.stringify(packageJson.version),
    __SPARK_NAME__: JSON.stringify(packageJson.name),
    __SPARK_DESCRIPTION__: JSON.stringify(packageJson.description),
  },
});

import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  resolve: {
    alias: {
      // Point spark-core to the source so vi.mock can intercept internal modules
      "spark-core": resolve(__dirname, "../core/src/index.ts"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["test/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    testTimeout: 10000,
  },
});

import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  resolve: {
    alias: {
      // Point pilo-core to the source so Vitest can resolve it without a prior build
      "pilo-core": resolve(__dirname, "../core/src/index.ts"),
    },
  },
  test: {
    environment: "node",
  },
});

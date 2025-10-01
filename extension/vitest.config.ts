import { defineConfig } from "vitest/config";
import { WxtVitest } from "wxt/testing";
import path from "path";

export default defineConfig({
  plugins: [WxtVitest()],
  resolve: {
    alias: {
      "spark/core": path.resolve(__dirname, "../src/core.ts"),
    },
  },
  test: {
    globals: true,
    environment: "happy-dom",
    include: ["test/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    setupFiles: ["./test/setup.ts"],
    testTimeout: 10000,
  },
});

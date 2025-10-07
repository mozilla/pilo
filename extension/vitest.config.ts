import { defineConfig } from "vitest/config";
import { WxtVitest } from "wxt/testing";

export default defineConfig({
  plugins: [WxtVitest()],
  test: {
    globals: true,
    environment: "happy-dom",
    include: ["test/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    setupFiles: ["./test/setup.ts"],
    testTimeout: 10000,
  },
});

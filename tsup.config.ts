import { cpSync, existsSync, readFileSync } from "fs";
import { defineConfig } from "tsup";

// Read root package.json to dynamically derive the external list from dependencies.
// This prevents tsup from bundling npm packages that consumers install themselves.
// pilo-core is intentionally excluded: it's a workspace package that must be
// resolved and bundled so the published CLI has no unresolvable workspace imports.
const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf-8"));
const externalDeps = Object.keys(pkg.dependencies || {});

export default defineConfig({
  entry: [
    // Core library - all source files (generates dist/core/src/**/*.js)
    "packages/core/src/**/*.ts",
    "!packages/core/src/**/*.test.ts",

    // CLI - binary entry point only (generates dist/cli/src/cli.js)
    "packages/cli/src/cli.ts",
  ],
  format: ["esm"],
  // pilo-core is bundled (see above), which pulls its transitive CommonJS
  // dependencies into the ESM output. Some of them — mute-stream, via
  // @inquirer/core — call bare `require("stream")`. Bare builtins are not matched
  // by the /^node:/ external rule below, so esbuild inlines them behind a shim
  // that throws `Dynamic require of "stream" is not supported`, and the CLI dies
  // on startup before it can print anything.
  //
  // Defining a real `require` gives that shim something to delegate to. esbuild
  // renames this binding and every reference to it inside the shim consistently,
  // so the throwing branch becomes unreachable.
  banner: {
    js: [
      'import { createRequire } from "node:module";',
      "const require = createRequire(import.meta.url);",
    ].join("\n"),
  },
  // tsup injects `baseUrl` into the compiler options it synthesises for the
  // declaration build. TypeScript 6 reports that as an error (TS5101) rather than a
  // warning, so `pnpm run build` fails at "DTS Build start" on a clean checkout.
  // Acknowledging the deprecation keeps the declaration build working until tsup
  // stops setting it.
  dts: {
    compilerOptions: {
      ignoreDeprecations: "6.0",
    },
  },
  outDir: "dist",
  target: "node22",
  clean: true,
  sourcemap: true,
  splitting: false,
  treeshake: true,
  // Preserve the output directory structure so consumers can import by path.
  // packages/core/src/foo.ts → dist/core/src/foo.js
  outExtension: () => ({ js: ".js" }),
  // Inject the production flag at build time. The ConfigManager checks this to
  // choose between production (config file required) and dev (env vars allowed) mode.
  define: {
    __PILO_PRODUCTION__: "true",
  },
  external: [
    // Node built-ins (node: protocol)
    /^node:/,
    // All runtime npm dependencies - resolved by the consumer's node_modules.
    // pilo-core is intentionally NOT listed here: tsup must bundle it.
    ...externalDeps,
  ],
  async onSuccess() {
    // Copy WXT extension build artifacts into the root dist/.
    // WXT outputs to packages/extension/dist/<browser>-<manifest>/ but we
    // publish them under the simpler dist/extension/<browser>/ paths that
    // match what pilo-cli expects at runtime.
    const BROWSER_MAP: Record<string, string> = {
      "chrome-mv3": "chrome",
      "firefox-mv2": "firefox",
    };

    for (const [wxtName, publishName] of Object.entries(BROWSER_MAP)) {
      const src = `packages/extension/dist/${wxtName}`;
      const dest = `dist/extension/${publishName}`;
      if (existsSync(src)) {
        cpSync(src, dest, { recursive: true });
        console.log(`✓ Copied ${wxtName} extension → dist/extension/${publishName}`);
      } else {
        console.warn(`⚠  Extension build not found at ${src} — skipping`);
      }
    }
  },
});

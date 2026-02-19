// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { defineConfig, type WebExtConfig, type Wxt } from "wxt";
import tailwindcss from "@tailwindcss/vite";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Resolve module paths relative to this config file so Vite can find them
// regardless of where the build process is invoked from. This is necessary in
// pnpm workspaces where hoisting is strict and the polyfill package lives only
// in packages/extension/node_modules, not in the root node_modules.
const _require = createRequire(import.meta.url);
const wxtPolyfillBrowser = _require.resolve("@wxt-dev/webextension-polyfill/browser");

function generateWebExtJSON(): WebExtConfig {
  const config: WebExtConfig = {
    // Open developer tools on startup (mostly to see the logs) during development
    // (requires Firefox 106+). Only seems to work in Firefox.
    openDevtools: true,
    // Enable Chrome DevTools Protocol
    // Connect via: curl http://localhost:9222/json
    chromiumArgs: ["--remote-debugging-port=9222"],
  };

  // Firefox profile persistence - controlled by environment variables
  // Set by dev:firefox script to maintain logins, settings, etc.
  // Uses web-ext's firefoxProfile and keepProfileChanges options
  const firefoxProfile = process.env.WEB_EXT_FIREFOX_PROFILE;
  if (firefoxProfile) {
    config.firefoxProfile = firefoxProfile;
  }

  // Chrome/Chromium profile persistence - controlled by environment variables
  // Set by dev:chrome script to maintain logins, settings, etc.
  const chromiumProfile = process.env.WEB_EXT_CHROMIUM_PROFILE;
  if (chromiumProfile) {
    // Use absolute path for Windows compatibility
    config.chromiumProfile = resolve(chromiumProfile);
  }

  if (process.env.WEB_EXT_KEEP_PROFILE_CHANGES === "true") {
    config.keepProfileChanges = true;
  }

  return config;
}

// See https://wxt.dev/api/config.html
let config = {
  outDir: "dist",
  modules: ["@wxt-dev/module-react", "@wxt-dev/webextension-polyfill"],
  hooks: {
    // WXT dev mode strips content_scripts from manifest even with registration: "manifest".
    // This hook ensures content scripts are included in the manifest during dev mode.
    "build:manifestGenerated": (wxt: Wxt, manifest: Browser.runtime.Manifest) => {
      if (wxt.config.command === "serve") {
        manifest.content_scripts = [
          {
            matches: ["<all_urls>"],
            run_at: "document_start",
            js: ["content-scripts/content.js"],
          },
        ];
      }
    },
  },
  vite: () => ({
    plugins: [tailwindcss()] as any,
    resolve: {
      // In pnpm workspaces, strict hoisting means @wxt-dev/webextension-polyfill
      // lives only in packages/extension/node_modules. Vite's load-fallback plugin
      // cannot resolve the bare specifier when traversing symlinked workspace deps.
      // Pin both the WXT-module alias target and the direct specifier to the
      // concrete absolute file path so resolution always succeeds.
      alias: [
        {
          find: "spark-core/core",
          replacement: resolve(__dirname, "../core/src/core.ts"),
        },
        {
          find: "spark-core/ariaTree",
          replacement: resolve(__dirname, "../core/src/browser/ariaTree/index.ts"),
        },
        {
          find: "@wxt-dev/webextension-polyfill/browser",
          replacement: wxtPolyfillBrowser,
        },
        {
          find: "wxt/browser",
          replacement: wxtPolyfillBrowser,
        },
      ],
    },
    server: {
      fs: {
        // Allow serving files from parent node_modules (for @fontsource-variable/inter)
        allow: [".."],
      },
    },
  }),
  manifest: ({ browser }: { browser: string }) => {
    // Common configuration for all browsers
    const baseManifest = {
      name: "Spark Extension",
      description: "AI-powered web automation browser extension",
      permissions: ["activeTab", "storage", "scripting", "tabs", "webNavigation"],
      host_permissions: ["*://*/*"],
    };

    // Chrome-specific configuration (Manifest V3)
    if (browser === "chrome") {
      return {
        ...baseManifest,
        permissions: [...baseManifest.permissions, "sidePanel"],
        side_panel: {
          default_path: "sidepanel.html",
        },
        action: {
          default_title: "Open Spark Sidepanel",
          default_icon: {
            16: "icon/16.png",
            24: "icon/24.png",
            32: "icon/32.png",
          },
        },
      };
    }

    // Firefox-specific configuration (Manifest V2)
    if (browser === "firefox") {
      return {
        ...baseManifest,
        sidebar_action: {
          default_panel: "sidepanel.html",
          default_title: "Spark",
          open_at_install: true,
          default_icon: {
            16: "icon/16.png",
            32: "icon/32.png",
            48: "icon/48.png",
            128: "icon/128.png",
          },
        },
        browser_action: {
          default_title: "Spark Extension",
          default_icon: {
            16: "icon/16.png",
            32: "icon/32.png",
            48: "icon/48.png",
            128: "icon/128.png",
          },
        },
        browser_specific_settings: {
          // XXX need to do the equivalent thing for Chrome
          gecko: {
            // Need a stable identifier so wxt doesn't use a random one each
            // time and break persistence.
            id: "spark@mozilla.org",
          },
        },
      };
    }

    // Fallback for other browsers
    return baseManifest;
  },
  webExt: generateWebExtJSON(),
};

export default defineConfig(config);

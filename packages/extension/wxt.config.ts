// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { defineConfig, type WebExtConfig, type Wxt } from "wxt";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";

// Custom Vite plugin to fix WXT auto-import module resolution for files outside package root
function fixWxtImportsPlugin() {
  return {
    name: "fix-wxt-imports",
    enforce: "pre" as const, // Run before other plugins
    async resolveId(source: string, importer: string | undefined) {
      // If a file in ../../src is importing wxt/browser or @wxt-dev/webextension-polyfill/browser,
      // resolve it to webextension-polyfill instead
      if (
        importer &&
        importer.includes("../../src") &&
        (source === "wxt/browser" || source === "@wxt-dev/webextension-polyfill/browser")
      ) {
        // Return the module ID that should be used instead
        console.log(
          `[fix-wxt-imports] Redirecting ${source} to webextension-polyfill for ${importer}`,
        );
        return "webextension-polyfill";
      }
      return null; // Let other plugins handle it
    },
  };
}

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
    plugins: [fixWxtImportsPlugin(), tailwindcss()] as any,
    resolve: {
      alias: {
        // Point to local re-export file to avoid WXT trying to polyfill files outside package
        "@core": resolve(__dirname, "src/core-imports.ts"),
        // Map the WXT polyfill module to the actual polyfill package
        "@wxt-dev/webextension-polyfill/browser": "webextension-polyfill",
      },
      // Ensure node module resolution works for files in ../../src
      conditions: ["import", "module", "browser", "default"],
    },
    optimizeDeps: {
      // Don't pre-bundle core library files
      exclude: ["@core"],
    },
    build: {
      rollupOptions: {
        external: ["wxt/browser", "@wxt-dev/webextension-polyfill/browser"],
      },
    },
    server: {
      fs: {
        // Allow serving files from parent node_modules (for @fontsource-variable/inter)
        allow: ["../.."],
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

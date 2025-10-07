import { defineConfig } from "wxt";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ["@wxt-dev/module-react", "@wxt-dev/webextension-polyfill"],
  vite: () => ({
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        // Point to the compiled JS file, not source TS
        // This avoids Vite trying to bundle source dependencies
        "spark/core": resolve(__dirname, "../dist/core.js"),
      },
    },
    build: {
      rollupOptions: {
        // Treat certain imports as external to avoid bundling issues
        external: (id) => {
          // Don't try to bundle webextension-polyfill from parent package
          return id.includes("webextension-polyfill") && !id.includes("node_modules/@wxt-dev");
        },
      },
    },
  }),
  manifest: ({ browser }) => {
    // Common configuration for all browsers
    const baseManifest = {
      name: "Spark Extension",
      description: "AI-powered web automation browser extension",
      permissions: ["activeTab", "storage", "scripting", "tabs"],
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
});

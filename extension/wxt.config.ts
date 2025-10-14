import { defineConfig } from "wxt";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// See https://wxt.dev/api/config.html
export default defineConfig({
  imports: false,
  modules: ["@wxt-dev/module-react"],
  vite: () => ({
    plugins: [
      tailwindcss(),
      {
        name: "resolve-wxt-browser",
        enforce: "pre",
        resolveId(id) {
          if (id === "wxt/browser" || id === "@wxt-dev/webextension-polyfill/browser") {
            return "\0wxt-browser-shim";
          }
          return null;
        },
        load(id) {
          if (id === "\0wxt-browser-shim") {
            // Provide a virtual module that exports browser from webextension-polyfill
            return `import browser from "webextension-polyfill"; export { browser }; export default browser;`;
          }
          return null;
        },
      },
    ],
    resolve: {
      alias: {
        "../../src": resolve(__dirname, "../dist"),
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

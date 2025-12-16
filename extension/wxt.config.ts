import { defineConfig, type WebExtConfig } from "wxt";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";

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
  modules: ["@wxt-dev/module-react", "@wxt-dev/webextension-polyfill"],
  vite: () => ({
    plugins: [tailwindcss()] as any,
  }),
  manifest: ({ browser }: { browser: string }) => {
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
  webExt: generateWebExtJSON(),
};

export default defineConfig(config);

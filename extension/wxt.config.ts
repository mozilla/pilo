import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: ({ browser }) => {
    // Common configuration for all browsers
    const baseManifest = {
      name: 'Spark Extension',
      description: 'AI-powered web automation browser extension',
      permissions: ['activeTab', 'storage', 'scripting'],
    };

    // Chrome-specific configuration (Manifest V3)
    if (browser === 'chrome') {
      return {
        ...baseManifest,
        permissions: [...baseManifest.permissions, 'sidePanel'],
        side_panel: {
          default_path: 'sidepanel.html'
        },
        action: {
          default_title: 'Spark Extension',
          default_icon: {
            16: 'icon/16.png',
            32: 'icon/32.png',
            48: 'icon/48.png',
            128: 'icon/128.png'
          }
        }
      };
    }

    // Firefox-specific configuration (Manifest V2)
    if (browser === 'firefox') {
      return {
        ...baseManifest,
        sidebar_action: {
          default_panel: 'sidepanel.html',
          default_title: 'Spark',
          open_at_install: true,
          default_icon: {
            16: 'icon/16.png',
            32: 'icon/32.png',
            48: 'icon/48.png',
            128: 'icon/128.png'
          }
        },
        browser_action: {
          default_title: 'Spark Extension',
          default_icon: {
            16: 'icon/16.png',
            32: 'icon/32.png',
            48: 'icon/48.png',
            128: 'icon/128.png'
          }
        }
      };
    }

    // Fallback for other browsers
    return baseManifest;
  },
});

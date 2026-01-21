import { test as base, chromium, BrowserContext } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ExtensionFixtures {
  context: BrowserContext;
  extensionId: string;
  sidepanelUrl: string;
}

function findExtensionPath(): string {
  const baseDir = path.resolve(__dirname, "../..");

  // Try production build first, then dev build
  const candidates = [".output/chrome-mv3", ".output/chrome-mv3-dev"];

  for (const dir of candidates) {
    const fullPath = path.join(baseDir, dir);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }

  throw new Error("Extension not found. Run 'pnpm build:chrome' first.");
}

export const test = base.extend<ExtensionFixtures>({
  // Launch Chrome with the extension loaded
  context: async ({}, use) => {
    const extensionPath = findExtensionPath();
    const headless = process.env.HEADLESS === "true";

    const context = await chromium.launchPersistentContext("", {
      headless,
      ...(headless ? { channel: "chromium" } : {}),
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        ...(headless ? ["--disable-gpu", "--disable-dev-shm-usage"] : []),
      ],
    });

    await use(context);
    await context.close();
  },

  // Get the extension ID from the service worker URL
  extensionId: async ({ context }, use) => {
    // Wait for service worker to register (MV3)
    let serviceWorker = context.serviceWorkers()[0];
    if (!serviceWorker) {
      serviceWorker = await context.waitForEvent("serviceworker", { timeout: 10000 });
    }

    // Wait for service worker to activate (critical for MV3 in headless mode)
    await serviceWorker.evaluate(() => {
      const sw = self as unknown as ServiceWorkerGlobalScope;
      return sw.registration.active;
    });

    // Extract extension ID from service worker URL: chrome-extension://<id>/background.js
    const url = serviceWorker.url();
    const match = url.match(/chrome-extension:\/\/([^/]+)/);
    if (!match) {
      throw new Error(`Could not extract extension ID from service worker URL: ${url}`);
    }

    await use(match[1]);
  },

  // Build the sidepanel URL
  sidepanelUrl: async ({ extensionId }, use) => {
    const url = `chrome-extension://${extensionId}/sidepanel.html`;
    await use(url);
  },
});

export { expect } from "@playwright/test";

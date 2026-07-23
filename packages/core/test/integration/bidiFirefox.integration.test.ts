/**
 * Gated integration test: BiDiBrowser against a real (Playwright-bundled) Firefox.
 *
 * Skipped by default — only runs when `PILO_BIDI_INTEGRATION=1` is set (see the
 * `test:integration` script in package.json). This keeps the default `pnpm test`
 * run fast and hermetic; it never launches a browser.
 *
 * Prerequisite: `pnpm --filter pilo-core exec playwright install firefox`
 * (downloads Playwright's bundled Firefox binary if not already cached).
 *
 * Run: `pnpm --filter pilo-core run test:integration`
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { BiDiBrowser, PageAction } from "../../src/index.js";
import { serveFixtures, startFirefoxBiDi } from "./support/firefoxHarness.js";

const ENABLED = process.env.PILO_BIDI_INTEGRATION === "1";
const here = dirname(fileURLToPath(import.meta.url));

describe.skipIf(!ENABLED)("BiDiBrowser integration (real Firefox)", () => {
  let ff: Awaited<ReturnType<typeof startFirefoxBiDi>>;
  let site: Awaited<ReturnType<typeof serveFixtures>>;
  let browser: BiDiBrowser;

  beforeAll(async () => {
    ff = await startFirefoxBiDi();
    site = await serveFixtures(join(here, "fixtures"));
    browser = new BiDiBrowser({
      bidiUrl: ff.bidiUrl,
      allowFileUpload: { allowedPaths: [here] },
    });
    await browser.start();
  }, 60_000);

  afterAll(async () => {
    await browser?.shutdown();
    await site?.stop();
    await ff?.stop();
  });

  it("uploads a file into <input type=file> via input.setFiles", async () => {
    await browser.goto(`${site.baseUrl}/upload.html`);
    await browser.getTreeWithRefs(); // populate __piloRefMap so ref "file1" resolves
    await browser.performAction("file1", PageAction.UploadFile, fileURLToPath(import.meta.url));
    const count = await (
      browser as unknown as { evaluate: (e: string) => Promise<unknown> }
    ).evaluate("document.getElementById('count').textContent");
    // count is a BiDi typed value; assert the file registered.
    expect(JSON.stringify(count)).toContain("1");
  }, 30_000);
});

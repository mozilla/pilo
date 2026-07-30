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
 * On PowerShell, where the script's `VAR=1 cmd` prefix does not apply:
 *   `$env:PILO_BIDI_INTEGRATION=1; pnpm --filter pilo-core exec vitest run test/integration`
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { BiDiBrowser, PageAction, LoadState } from "../../src/index.js";
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
    // The fixture hardcodes data-pilo-ref="file1"; the ref resolves via the
    // attribute-selector fallback. We deliberately do NOT call getTreeWithRefs()
    // here — the ARIA-tree pass reassigns data-pilo-ref to its own generated IDs,
    // which would clobber the fixture's "file1".
    await browser.performAction("file1", PageAction.UploadFile, fileURLToPath(import.meta.url));
    const count = await (
      browser as unknown as { evaluate: (e: string) => Promise<unknown> }
    ).evaluate("document.getElementById('count').textContent");
    // count is a BiDi typed value; assert the file registered.
    expect(JSON.stringify(count)).toContain("1");
  }, 30_000);
});

describe.skipIf(!ENABLED)("BiDiBrowser network blocking (real Firefox)", () => {
  let ff: Awaited<ReturnType<typeof startFirefoxBiDi>>;
  let site: Awaited<ReturnType<typeof serveFixtures>>;

  beforeAll(async () => {
    ff = await startFirefoxBiDi();
    site = await serveFixtures(join(here, "fixtures"));
  }, 60_000);

  afterAll(async () => {
    await site?.stop();
    await ff?.stop();
  });

  // Verifies the full Task 5 chain against real Firefox: network.addIntercept,
  // the network.beforeRequestSent event shape, destination-based classification,
  // and that network.failRequest actually aborts the request before it hits the
  // network. A control run (no blocking) proves the image is normally fetched,
  // so the blocked run's absence is attributable to blocking, not to the image
  // simply never being requested.
  it("aborts image requests when blockResources includes 'image'", async () => {
    const imagePath = "/blocked-image.png";
    const pagePath = "/blocking.html";
    const settle = () => new Promise((r) => setTimeout(r, 800));

    // Control: no blocking → the image request reaches the server.
    const control = new BiDiBrowser({ bidiUrl: ff.bidiUrl });
    await control.start();
    site.requests.length = 0;
    await control.goto(`${site.baseUrl}${pagePath}`);
    await settle();
    const controlRequestedImage = site.requests.includes(imagePath);
    await control.shutdown();

    // Blocked: blockResources ["image"] → the image is aborted before the network.
    const blocked = new BiDiBrowser({ bidiUrl: ff.bidiUrl, blockResources: ["image"] });
    await blocked.start();
    site.requests.length = 0;
    await blocked.goto(`${site.baseUrl}${pagePath}`);
    await settle();
    const blockedRequestedPage = site.requests.includes(pagePath);
    const blockedRequestedImage = site.requests.includes(imagePath);

    // A failRequest'd request must still terminate (network.fetchError) so the
    // in-flight counter decrements; otherwise NetworkIdle would never settle.
    let networkIdleSettled = true;
    try {
      await blocked.waitForLoadState(LoadState.NetworkIdle, { timeout: 5_000 });
    } catch {
      networkIdleSettled = false;
    }
    await blocked.shutdown();

    expect(controlRequestedImage).toBe(true); // image is normally fetched
    expect(blockedRequestedPage).toBe(true); // the page itself still loads
    expect(blockedRequestedImage).toBe(false); // the image was blocked
    expect(networkIdleSettled).toBe(true); // failRequest decremented the counter
  }, 60_000);
});

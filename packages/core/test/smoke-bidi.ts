/**
 * Smoke test: BiDiBrowser against a real Firefox instance.
 *
 * Prerequisites:
 *   firefox --remote-debugging-port 9222 --headless --no-remote --profile "$(mktemp -d)"
 *
 * Run:
 *   pnpm --filter pilo-core exec tsx test/smoke-bidi.ts
 */
import { BiDiBrowser } from "../src/browser/bidiBrowser.js";

async function main() {
  const browser = new BiDiBrowser({ bidiUrl: "ws://127.0.0.1:9222/session" });

  try {
    console.log("Starting BiDiBrowser...");
    await browser.start();
    console.log("  browserName:", browser.browserName);

    console.log("\n--- Navigation ---");
    await browser.goto("https://example.com");
    console.log("  URL:", await browser.getUrl());
    console.log("  Title:", await browser.getTitle());

    console.log("\n--- ARIA Tree ---");
    const tree = await browser.getTreeWithRefs();
    console.log(tree.substring(0, 600));

    console.log("\n--- Markdown ---");
    const md = await browser.getMarkdown();
    console.log(md.substring(0, 400));

    console.log("\n--- Screenshot ---");
    const screenshot = await browser.getScreenshot();
    console.log("  Size:", screenshot.length, "bytes");

    console.log("\n--- History Navigation ---");
    await browser.goBack();
    console.log("  After goBack, URL:", await browser.getUrl());
    await browser.goForward();
    console.log("  After goForward, URL:", await browser.getUrl());

    console.log("\n=== All smoke tests passed! ===");
  } catch (e: unknown) {
    const err = e as Error;
    console.error("\nFAILED:", err.message);
    console.error(err.stack?.split("\n").slice(0, 5).join("\n"));
    process.exitCode = 1;
  } finally {
    await browser.shutdown();
  }
}

main();

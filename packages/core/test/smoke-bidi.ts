/**
 * Smoke test: BiDiBrowser against a real Firefox instance.
 *
 * Prerequisites:
 *   firefox --remote-debugging-port 9222 --headless --no-remote --profile "$(mktemp -d)"
 *
 * Run:
 *   pnpm --filter pilo-core exec tsx test/smoke-bidi.ts
 */
import { BiDiBrowser, unwrapBiDiValue } from "../src/browser/bidiBrowser.js";
import { PageAction } from "../src/browser/ariaBrowser.js";

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
  }

  // Each section below is wrapped independently so a failure in one doesn't
  // prevent the rest from running during a manual smoke pass.

  try {
    console.log("\n--- Scroll ---");
    await browser.goto("https://en.wikipedia.org/wiki/Web_browser");
    const before = unwrapBiDiValue(
      await (browser as unknown as { evaluate: (expr: string) => Promise<unknown> }).evaluate(
        "window.scrollY",
      ),
    );
    await browser.performAction("", PageAction.Scroll, "down");
    const after = unwrapBiDiValue(
      await (browser as unknown as { evaluate: (expr: string) => Promise<unknown> }).evaluate(
        "window.scrollY",
      ),
    );
    console.log("  scrollY:", before, "->", after);
  } catch (e: unknown) {
    console.error("  Scroll section FAILED:", (e as Error).message);
  }

  try {
    console.log("\n--- Field metadata ---");
    await browser.goto("https://httpbin.org/forms/post");
    const tree = await browser.getTreeWithRefs(); // populate ref map
    console.log(tree.substring(0, 600));
    // Pick a known ref from the tree output above, then uncomment:
    // const ref = "<ref>";
    // console.log("  Field metadata:", await browser.getFieldMetadata(ref));
    // console.log("  Form submission context:", await browser.getFormSubmissionContext(ref));
  } catch (e: unknown) {
    console.error("  Field metadata section FAILED:", (e as Error).message);
  }

  try {
    console.log("\n--- Network blocking ---");
    const blockingBrowser = new BiDiBrowser({
      bidiUrl: "ws://127.0.0.1:9222/session",
      blockResources: ["image", "stylesheet"],
    });
    try {
      await blockingBrowser.start();
      await blockingBrowser.goto("https://en.wikipedia.org/wiki/Web_browser");
      console.log(
        "  Navigated with images/stylesheets blocked. Confirm via the Firefox devtools " +
          "Network panel (or `about:debugging`) that no image/stylesheet requests completed.",
      );
    } finally {
      await blockingBrowser.shutdown();
    }
  } catch (e: unknown) {
    console.error("  Network blocking section FAILED:", (e as Error).message);
  }

  try {
    console.log("\n--- Upload ---");
    const uploadBrowser = new BiDiBrowser({
      bidiUrl: "ws://127.0.0.1:9222/session",
      allowFileUpload: { allowedPaths: [process.cwd()] },
    });
    try {
      await uploadBrowser.start();
      // Navigate to a page with an <input type=file>, then pick its ref from
      // getTreeWithRefs() and uncomment the lines below to exercise the upload.
      // await uploadBrowser.goto("<url with a file input>");
      // await uploadBrowser.getTreeWithRefs();
      // const uploadRef = "<ref>";
      // const uploadPath = "<path to a file under an allowed root>";
      // await uploadBrowser.performAction(uploadRef, PageAction.UploadFile, uploadPath);
      // const filesLength = unwrapBiDiValue(
      //   await (uploadBrowser as unknown as { evaluate: (expr: string) => Promise<unknown> }).evaluate(
      //     `document.querySelector('[data-pilo-ref="${uploadRef}"]').files.length`,
      //   ),
      // );
      // console.log("  files.length:", filesLength);
      console.log(
        "  Skipped: fill in a target URL/ref/path above to exercise the upload interactively.",
      );
    } finally {
      await uploadBrowser.shutdown();
    }
  } catch (e: unknown) {
    console.error("  Upload section FAILED:", (e as Error).message);
  }

  await browser.shutdown();
}

main();

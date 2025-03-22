import { firefox, devices } from "playwright";
import { PageMapper } from "./pageSnapshot.js";

// Function to calculate compression stats
function calculateCompressionStats(original: string, compressed: string) {
  const originalSize = original.length;
  const compressedSize = compressed.length;
  const compressionRatio =
    ((originalSize - compressedSize) / originalSize) * 100;

  // Approximate token calculation (4 chars per token)
  const originalTokens = Math.ceil(originalSize / 4);
  const compressedTokens = Math.ceil(compressedSize / 4);
  const tokenSavings = originalTokens - compressedTokens;

  return {
    originalTokens,
    compressedTokens,
    compressionRatio: compressionRatio.toFixed(2),
    tokenSavings,
    // Keep byte stats for reference
    originalSize,
    compressedSize,
    savings: originalSize - compressedSize,
  };
}

const browser = await firefox.launch({ headless: false });
const context = await browser.newContext(devices["Desktop Firefox"]);
const page = await context.newPage();

// The actual interesting bit
await page.goto(
  "https://www.amazon.com/HP-Laserjet-3201dw-Wireless-Printer/dp/B0CTTY7BSG/"
);

// Get original HTML
const originalHtml = await page.content();

const pageSnapshot = new PageMapper(page);
const snapshot = await pageSnapshot.createCompactSnapshot();

// Calculate and display compression stats
const stats = calculateCompressionStats(originalHtml, snapshot);
console.log("\nCompression Statistics:");
console.log("----------------------");
console.log(
  `Original Size: ${stats.originalSize.toLocaleString()} bytes (≈${stats.originalTokens.toLocaleString()} tokens)`
);
console.log(
  `Compressed Size: ${stats.compressedSize.toLocaleString()} bytes (≈${stats.compressedTokens.toLocaleString()} tokens)`
);
console.log(`Compression Ratio: ${stats.compressionRatio}%`);
console.log(
  `Space Saved: ${stats.savings.toLocaleString()} bytes (≈${stats.tokenSavings.toLocaleString()} tokens)\n`
);

console.log("Snapshot:");
console.log(snapshot);

// Teardown
await context.close();
await browser.close();

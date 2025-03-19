import { firefox, devices } from "playwright";
import { PageMapper } from "./pageSnapshot.js";
const browser = await firefox.launch({ headless: false });
const context = await browser.newContext(devices["Desktop Firefox"]);
const page = await context.newPage();

// The actual interesting bit
await page.goto(
  "https://www.amazon.com/HP-Laserjet-3201dw-Wireless-Printer/dp/B0CTTY7BSG/"
);

const pageSnapshot = new PageMapper(page);

const snapshot = await pageSnapshot.createCompactSnapshot();

console.log(snapshot);

// Teardown
await context.close();
await browser.close();

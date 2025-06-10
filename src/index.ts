#!/usr/bin/env node

import { config } from "dotenv";
import chalk from "chalk";
import { WebAgent } from "./webAgent.js";
import { PlaywrightBrowser } from "./browser/playwrightBrowser.js";

// Load environment variables from .env file
config();

// Get the task and optional URL from the args
const task = process.argv[2];
const startingUrl = process.argv[3];

if (!task) {
  console.error(chalk.red.bold("❌ Error: Missing task argument"));
  console.log("");
  console.log(chalk.white.bold("Usage:"));
  console.log(`  ${chalk.cyan("spark")} ${chalk.green("<task>")} ${chalk.yellow("[url]")}`);
  console.log("");
  console.log(chalk.white.bold("Examples:"));
  console.log(`  ${chalk.cyan("spark")} ${chalk.green('"search for flights to Paris"')}`);
  console.log(
    `  ${chalk.cyan("spark")} ${chalk.green('"find the latest news"')} ${chalk.yellow("https://news.ycombinator.com")}`,
  );
  console.log("");
  process.exit(1);
}

// Debug flag - set to true to see page snapshots
const DEBUG = false;

// Main execution
(async () => {
  try {
    // Create a browser instance with customized configuration
    const browser = new PlaywrightBrowser({
      headless: false,
      device: "Desktop Firefox",
      blockAds: true,
      // blockResources: ["image", "font", "media", "manifest"],
      blockResources: ["media", "manifest"],
    });

    // Create WebAgent with the browser
    const webAgent = new WebAgent(browser, {
      debug: DEBUG,
    });

    // Execute the task
    await webAgent.execute(task, startingUrl);

    // Close the browser when done
    await webAgent.close();
  } catch (error) {
    console.error(chalk.red.bold("\n❌ Error:"), chalk.whiteBright(error));
    process.exit(1);
  }
})();

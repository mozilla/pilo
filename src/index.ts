#!/usr/bin/env node

import { config } from "dotenv";
import chalk from "chalk";
import { WebAgent } from "./webAgent.js";
import { PlaywrightBrowser } from "./browser/playwrightBrowser.js";

// Load environment variables from .env file
config();

// Get the task, optional URL, optional data, and optional guardrails from the args
const task = process.argv[2];
const startingUrl = process.argv[3];
const dataArg = process.argv[4];
const guardrailsArg = process.argv[5];

if (!task) {
  console.error(chalk.red.bold("❌ Error: Missing task argument"));
  console.log("");
  console.log(chalk.white.bold("Usage:"));
  console.log(
    `  ${chalk.cyan("spark")} ${chalk.green("<task>")} ${chalk.yellow("[url]")} ${chalk.magenta("[data]")} ${chalk.blue("[guardrails]")}`,
  );
  console.log("");
  console.log(chalk.white.bold("Examples:"));
  console.log(`  ${chalk.cyan("spark")} ${chalk.green('"search for flights to Paris"')}`);
  console.log(
    `  ${chalk.cyan("spark")} ${chalk.green('"find the latest news"')} ${chalk.yellow("https://news.ycombinator.com")}`,
  );
  console.log(
    `  ${chalk.cyan("spark")} ${chalk.green('"book a flight"')} ${chalk.yellow("https://airline.com")} ${chalk.magenta('\'{"departure":"NYC","destination":"LAX","date":"2024-12-25"}\'')}`,
  );
  console.log(
    `  ${chalk.cyan("spark")} ${chalk.green('"search for hotels"')} ${chalk.yellow("https://booking.com")} ${chalk.magenta('\'{"location":"Paris"}\'')} ${chalk.blue('"Do not book anything, only search"')}`,
  );
  console.log("");
  process.exit(1);
}

// Parse data argument if provided
let data = null;
if (dataArg) {
  try {
    data = JSON.parse(dataArg);
  } catch (error) {
    console.error(chalk.red.bold("❌ Error: Invalid JSON in data argument"));
    console.log(chalk.gray(`Data argument: ${dataArg}`));
    console.log(chalk.gray(`Error: ${error instanceof Error ? error.message : String(error)}`));
    process.exit(1);
  }
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
      guardrails: guardrailsArg || undefined,
    });

    // Execute the task
    await webAgent.execute(task, startingUrl, data);

    // Close the browser when done
    await webAgent.close();
  } catch (error) {
    console.error(chalk.red.bold("\n❌ Error:"), chalk.whiteBright(error));
    process.exit(1);
  }
})();

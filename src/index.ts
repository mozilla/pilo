import { config } from "dotenv";
import chalk from "chalk";
import { WebAgent } from "./webAgent.js";
import { PlaywrightBrowser } from "./browser/PlaywrightBrowser.js";

// Load environment variables from .env file
config();

// Get the task from the args
const task = process.argv[2];

if (!task) {
  console.error(chalk.red.bold("❌ Please provide a task to complete."));
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
      bypassCSP: true,
    });

    // Create WebAgent with the browser
    const webAgent = new WebAgent(browser, DEBUG);

    // Execute the task
    await webAgent.execute(task);

    // Close the browser when done
    await webAgent.close();
  } catch (error) {
    console.error(chalk.red.bold("\n❌ Error:"), chalk.whiteBright(error));
    process.exit(1);
  }
})();

import { config } from "dotenv";
import chalk from "chalk";
import { WebAgent } from "./webAgent.js";

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
    const webAgent = new WebAgent(DEBUG);
    await webAgent.execute(task);
    await webAgent.close();
  } catch (error) {
    console.error(chalk.red.bold("\n❌ Error:"), chalk.whiteBright(error));
    process.exit(1);
  }
})();

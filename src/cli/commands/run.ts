import chalk from "chalk";
import { Command } from "commander";
import { WebAgent } from "../../webAgent.js";
import { PlaywrightBrowser } from "../../browser/playwrightBrowser.js";
import { config } from "../config.js";
import { validateBrowser, getValidBrowsers, parseJsonData, parseResourcesList } from "../utils.js";
import { createAIProvider } from "../provider.js";

/**
 * Creates the 'run' command for executing web automation tasks
 */
export function createRunCommand(): Command {
  return new Command("run")
    .alias("r")
    .description("Execute a web automation task")
    .argument("<task>", "Natural language description of the task to perform")
    .option("-u, --url <url>", "Starting URL for the task")
    .option("-d, --data <json>", "JSON data to provide context for the task")
    .option("-g, --guardrails <text>", "Safety constraints for the task execution")
    .option(
      "-b, --browser <browser>",
      "Browser to use (firefox, chrome, chromium, safari, webkit, edge)",
      config.get("browser") || "firefox",
    )
    .option("--headless", "Run browser in headless mode", config.get("headless") || false)
    .option("--debug", "Enable debug mode with page snapshots", false)
    .option("--vision", "Enable vision capabilities to include screenshots", false)
    .option("--no-block-ads", "Disable ad blocking")
    .option(
      "--block-resources <resources>",
      "Comma-separated list of resources to block",
      config.get("block_resources") || "media,manifest",
    )
    .option("--pw-endpoint <endpoint>", "Playwright endpoint URL to connect to remote browser")
    .action(executeRunCommand);
}

/**
 * Execute the run command with the provided arguments and options
 */
async function executeRunCommand(task: string, options: any): Promise<void> {
  try {
    // Parse data if provided
    let data = null;
    if (options.data) {
      try {
        data = parseJsonData(options.data);
      } catch (error) {
        console.error(chalk.red.bold("❌ Error: Invalid JSON in --data option"));
        console.log(chalk.gray(`Data: ${options.data}`));
        console.log(chalk.gray(`Error: ${error instanceof Error ? error.message : String(error)}`));
        process.exit(1);
      }
    }

    // Parse blocked resources
    const blockResources = options.blockResources
      ? (parseResourcesList(options.blockResources) as Array<
          "image" | "stylesheet" | "font" | "media" | "manifest"
        >)
      : [];

    // Validate browser option
    if (!validateBrowser(options.browser)) {
      console.error(chalk.red.bold("❌ Error: Invalid browser option"));
      console.log(chalk.gray(`Valid browsers: ${getValidBrowsers().join(", ")}`));
      process.exit(1);
    }

    // Create browser instance
    const browser = new PlaywrightBrowser({
      browser: options.browser,
      blockAds: options.blockAds,
      blockResources,
      pwEndpoint: options.pwEndpoint,
      headless: options.headless,
    });

    // Create AI provider
    const aiProvider = createAIProvider();

    // Create WebAgent
    const webAgent = new WebAgent(browser, {
      debug: options.debug,
      vision: options.vision,
      guardrails: options.guardrails,
      provider: aiProvider,
    });

    console.log(chalk.blue.bold("🚀 Spark Automation Starting"));
    console.log(chalk.gray(`Task: ${task}`));
    console.log(chalk.gray(`Browser: ${options.browser}`));
    if (options.pwEndpoint) console.log(chalk.gray(`Remote endpoint: ${options.pwEndpoint}`));
    if (options.url) console.log(chalk.gray(`Starting URL: ${options.url}`));
    if (data) console.log(chalk.gray(`Data: ${JSON.stringify(data)}`));
    if (options.guardrails) console.log(chalk.gray(`Guardrails: ${options.guardrails}`));
    if (options.vision) console.log(chalk.gray(`Vision: enabled`));
    console.log("");

    // Execute the task
    await webAgent.execute(task, options.url, data);

    // Close the browser
    await webAgent.close();
    console.log(chalk.green.bold("\n✅ Task completed successfully!"));
  } catch (error) {
    console.error(chalk.red.bold("\n❌ Error:"), chalk.whiteBright(error));
    process.exit(1);
  }
}

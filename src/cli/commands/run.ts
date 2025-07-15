import chalk from "chalk";
import { Command } from "commander";
import { WebAgent } from "../../webAgent.js";
import { PlaywrightBrowser } from "../../browser/playwrightBrowser.js";
import { config } from "../config.js";
import { validateBrowser, getValidBrowsers, parseJsonData, parseResourcesList } from "../utils.js";
import { createAIProvider } from "../provider.js";
import { ChalkConsoleLogger } from "../../loggers/chalkConsole.js";
import { JSONConsoleLogger } from "../../loggers/json.js";

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
      "--provider <provider>",
      "AI provider to use (openai, openrouter)",
      config.get("provider") || "openai",
    )
    .option("--model <model>", "AI model to use", config.get("model"))
    .option("--openai-api-key <key>", "OpenAI API key")
    .option("--openrouter-api-key <key>", "OpenRouter API key")
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
    .option(
      "--pw-cdp-endpoint <endpoint>",
      "Chrome DevTools Protocol endpoint URL (chromium browsers only)",
      config.get("pw_cdp_endpoint"),
    )
    .option("--bypass-csp", "Bypass Content Security Policy", config.get("bypass_csp") || false)
    .option(
      "--max-iterations <number>",
      "Maximum total iterations to prevent infinite loops",
      String(config.get("max_iterations") || 50),
    )
    .option(
      "--max-validation-attempts <number>",
      "Maximum validation attempts",
      String(config.get("max_validation_attempts") || 3),
    )
    .option(
      "--proxy <url>",
      "Proxy server URL (http://host:port, https://host:port, socks5://host:port)",
      config.get("proxy"),
    )
    .option(
      "--proxy-username <username>",
      "Proxy authentication username",
      config.get("proxy_username"),
    )
    .option(
      "--proxy-password <password>",
      "Proxy authentication password",
      config.get("proxy_password"),
    )
    .option("--logger <logger>", "Logger to use (console, json)", config.get("logger") || "console")
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

    // Create logger
    const logger = options.logger === "json" ? new JSONConsoleLogger() : new ChalkConsoleLogger();

    // Create browser instance
    const browser = new PlaywrightBrowser({
      browser: options.browser,
      blockAds: options.blockAds,
      blockResources,
      pwEndpoint: options.pwEndpoint,
      pwCdpEndpoint: options.pwCdpEndpoint,
      headless: options.headless,
      bypassCSP: options.bypassCsp,
      proxyServer: options.proxy,
      proxyUsername: options.proxyUsername,
      proxyPassword: options.proxyPassword,
    });

    // Create AI provider with CLI overrides
    const providerOverrides: any = {};
    if (options.provider) providerOverrides.provider = options.provider;
    if (options.model) providerOverrides.model = options.model;
    if (options.openaiApiKey) providerOverrides.openai_api_key = options.openaiApiKey;
    if (options.openrouterApiKey) providerOverrides.openrouter_api_key = options.openrouterApiKey;

    const aiProvider = createAIProvider(providerOverrides);

    // Create WebAgent
    const webAgent = new WebAgent(browser, {
      debug: options.debug,
      vision: options.vision,
      guardrails: options.guardrails,
      maxIterations: options.maxIterations ? parseInt(options.maxIterations) : undefined,
      maxValidationAttempts: options.maxValidationAttempts
        ? parseInt(options.maxValidationAttempts)
        : undefined,
      provider: aiProvider,
      logger,
    });

    // Execute the task
    await webAgent.execute(task, options.url, data);

    // Close the browser
    await webAgent.close();
  } catch (error) {
    console.error(chalk.red.bold("\n❌ Error:"), chalk.whiteBright(error));
    process.exit(1);
  }
}

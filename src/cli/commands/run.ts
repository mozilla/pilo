import chalk from "chalk";
import { Command } from "commander";
import { WebAgent } from "../../webAgent.js";
import { PlaywrightBrowser } from "../../browser/playwrightBrowser.js";
import { config } from "../config.js";
import { validateBrowser, getValidBrowsers, parseJsonData, parseResourcesList } from "../utils.js";
import { createAIProvider } from "../provider.js";
import { ChalkConsoleLogger } from "../../loggers/chalkConsole.js";
import { JSONConsoleLogger } from "../../loggers/json.js";
import { WebAgentEventType, WebAgentEventEmitter } from "../../events.js";
import * as fs from "fs";
import * as path from "path";
import { MetricsCollector } from "../../loggers/metricsCollector.js";
import { Logger } from "../../loggers/types.js";
import { SecretsRedactor } from "../../loggers/secretsRedactor.js";

/**
 * Creates the 'run' command for executing web automation tasks
 */
export function createRunCommand(): Command {
  return new Command("run")
    .alias("r")
    .description("Execute a web automation task")
    .argument("<task>", "Natural language description of the task to perform")
    .option("-u, --url <url>", "Starting URL for the task", config.get("starting_url"))
    .option("-d, --data <json>", "JSON data to provide context for the task", config.get("data"))
    .option(
      "-g, --guardrails <text>",
      "Safety constraints for the task execution",
      config.get("guardrails"),
    )
    .option(
      "--provider <provider>",
      "AI provider to use (openai, openrouter)",
      config.get("provider", "openai"),
    )
    .option("--model <model>", "AI model to use", config.get("model"))
    .option("--openai-api-key <key>", "OpenAI API key", config.get("openai_api_key"))
    .option("--openrouter-api-key <key>", "OpenRouter API key", config.get("openrouter_api_key"))
    .option(
      "-b, --browser <browser>",
      "Browser to use (firefox, chrome, chromium, safari, webkit, edge)",
      config.get("browser", "firefox"),
    )
    .option(
      "--channel <channel>",
      "Browser channel to use (e.g., chrome, msedge, chrome-beta, moz-firefox)",
      config.get("channel"),
    )
    .option(
      "--executable-path <path>",
      "Path to browser executable (e.g., /usr/bin/firefox, /Applications/Firefox.app/Contents/MacOS/firefox)",
      config.get("executable_path"),
    )
    .option("--headless", "Run browser in headless mode", config.get("headless", false))
    .option("--debug", "Enable debug mode with page snapshots", config.get("debug", false))
    .option(
      "--vision",
      "Enable vision capabilities to include screenshots",
      config.get("vision", false),
    )
    .option("--no-block-ads", "Disable ad blocking")
    .option(
      "--block-resources <resources>",
      "Comma-separated list of resources to block",
      config.get("block_resources", "media,manifest"),
    )
    .option(
      "--pw-endpoint <endpoint>",
      "Playwright endpoint URL to connect to remote browser",
      config.get("pw_endpoint"),
    )
    .option(
      "--pw-cdp-endpoint <endpoint>",
      "Chrome DevTools Protocol endpoint URL (chromium browsers only)",
      config.get("pw_cdp_endpoint"),
    )
    .option("--bypass-csp", "Bypass Content Security Policy", config.get("bypass_csp", false))
    .option(
      "--max-iterations <number>",
      "Maximum total iterations to prevent infinite loops",
      String(config.get("max_iterations", 50)),
    )
    .option(
      "--max-validation-attempts <number>",
      "Maximum validation attempts",
      String(config.get("max_validation_attempts", 3)),
    )
    .option(
      "--max-repeated-actions <number>",
      "Maximum times an action can be repeated before warning/aborting",
      String(config.get("max_repeated_actions", 2)),
    )
    .option(
      "--reasoning-effort <effort>",
      "Reasoning effort level (none, low, medium, high)",
      config.get("reasoning_effort", "none"),
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
    .option("--logger <logger>", "Logger to use (console, json)", config.get("logger", "console"))
    .option(
      "--metrics-incremental",
      "Show incremental metrics updates during task execution",
      config.get("metrics_incremental", false),
    )
    .action(executeRunCommand);
}

/**
 * Execute the run command with the provided arguments and options
 */
async function executeRunCommand(task: string, options: any): Promise<void> {
  try {
    // Parse JSON data if provided
    let parsedData = null;
    if (options.data) {
      try {
        parsedData = parseJsonData(options.data);
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
      console.log(chalk.gray(`Browser: ${options.browser}`));
      console.log(chalk.gray(`Valid browsers: ${getValidBrowsers().join(", ")}`));
      process.exit(1);
    }

    // Create logger
    const logger: Logger = new MetricsCollector(
      new SecretsRedactor(
        options.logger === "json"
          ? new JSONConsoleLogger()
          : new ChalkConsoleLogger({ metricsIncremental: options.metricsIncremental }),
      ),
    );

    // Create browser instance
    const browser = new PlaywrightBrowser({
      browser: options.browser,
      bypassCSP: options.bypassCsp,
      channel: options.channel,
      executablePath: options.executablePath,
      blockAds: options.blockAds ?? config.get("block_ads", true),
      blockResources,
      headless: options.headless,
      proxyServer: options.proxy,
      proxyUsername: options.proxyUsername,
      proxyPassword: options.proxyPassword,
      pwEndpoint: options.pwEndpoint,
      pwCdpEndpoint: options.pwCdpEndpoint,
    });

    // Create AI provider with CLI overrides
    const providerOverrides: any = {};
    if (options.provider !== undefined) {
      providerOverrides.provider = options.provider;
    }
    if (options.model !== undefined) {
      providerOverrides.model = options.model;
    }
    if (options.openaiApiKey !== undefined) {
      providerOverrides.openai_api_key = options.openaiApiKey;
    }
    if (options.openrouterApiKey !== undefined) {
      providerOverrides.openrouter_api_key = options.openrouterApiKey;
    }
    if (options.reasoningEffort !== undefined) {
      providerOverrides.reasoning_effort = options.reasoningEffort;
    }

    const providerConfig = createAIProvider(providerOverrides);

    // Create event emitter for handling events
    const eventEmitter = new WebAgentEventEmitter();

    // Set up generation logging if debug mode is enabled
    if (options.debug) {
      // Create debug/generations directory if it doesn't exist
      const debugDir = path.join(process.cwd(), "debug", "generations");
      fs.mkdirSync(debugDir, { recursive: true });

      console.log(chalk.gray(`📝 Generation logs will be written to: ${debugDir}`));

      // Listen for AI generation events
      eventEmitter.onEvent(WebAgentEventType.AI_GENERATION, (data) => {
        // Create a timestamped file for this generation
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const generationLogPath = path.join(debugDir, `${timestamp}.json`);

        // Write the exact data object to file
        fs.writeFileSync(generationLogPath, JSON.stringify(data, null, 2));
      });
    }

    // Create WebAgent
    const webAgent = new WebAgent(browser, {
      debug: options.debug,
      vision: options.vision,
      guardrails: options.guardrails,
      maxIterations: options.maxIterations ? parseInt(options.maxIterations) : undefined,
      maxValidationAttempts: options.maxValidationAttempts
        ? parseInt(options.maxValidationAttempts)
        : undefined,
      maxRepeatedActions: options.maxRepeatedActions
        ? parseInt(options.maxRepeatedActions)
        : undefined,
      providerConfig,
      logger,
      eventEmitter,
    });

    // Execute the task
    await webAgent.execute(task, {
      startingUrl: options.url,
      data: parsedData,
    });

    // Close the browser
    await webAgent.close();
  } catch (error) {
    console.error(chalk.red.bold("\n❌ Error:"), chalk.whiteBright(error));
    process.exit(1);
  }
}

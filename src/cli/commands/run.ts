import chalk from "chalk";
import { Command } from "commander";
import { WebAgent } from "../../webAgent.js";
import { PlaywrightBrowser } from "../../browser/playwrightBrowser.js";
import { config, addConfigOptions } from "../../config.js";
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
 * Creates the 'run' command for executing web automation tasks.
 * Options are generated from CONFIG_SCHEMA via addSchemaOptions().
 */
export function createRunCommand(): Command {
  const command = new Command("run")
    .alias("r")
    .description("Execute a web automation task")
    .argument("<task>", "Natural language description of the task to perform");

  // Add all CLI options from schema
  addConfigOptions(command);

  // Set action handler
  command.action(executeRunCommand);

  return command;
}

/**
 * Execute the run command with the provided arguments and options
 */
async function executeRunCommand(task: string, options: any): Promise<void> {
  try {
    // Get merged config (defaults < global config < env vars)
    const cfg = config.getConfig();

    // Parse JSON data if provided
    let parsedData = null;
    const dataOption = options.data ?? cfg.data;
    if (dataOption) {
      try {
        parsedData = parseJsonData(dataOption);
      } catch (error) {
        console.error(chalk.red.bold("❌ Error: Invalid JSON in --data option"));
        console.log(chalk.gray(`Data: ${dataOption}`));
        console.log(chalk.gray(`Error: ${error instanceof Error ? error.message : String(error)}`));
        process.exit(1);
      }
    }

    // Parse blocked resources (CLI option overrides config)
    const blockResourcesOption = options.blockResources ?? cfg.block_resources;
    const blockResources = blockResourcesOption
      ? (parseResourcesList(blockResourcesOption) as Array<
          "image" | "stylesheet" | "font" | "media" | "manifest"
        >)
      : [];

    // Merge CLI options with config (CLI takes precedence)
    const browserOption = options.browser ?? cfg.browser;

    // Validate browser option
    if (!validateBrowser(browserOption)) {
      console.error(chalk.red.bold("❌ Error: Invalid browser option"));
      console.log(chalk.gray(`Browser: ${browserOption}`));
      console.log(chalk.gray(`Valid browsers: ${getValidBrowsers().join(", ")}`));
      process.exit(1);
    }

    // Create logger
    const loggerType = options.logger ?? cfg.logger;
    const metricsIncremental = options.metricsIncremental ?? cfg.metrics_incremental;
    const logger: Logger = new MetricsCollector(
      new SecretsRedactor(
        loggerType === "json"
          ? new JSONConsoleLogger()
          : new ChalkConsoleLogger({ metricsIncremental }),
      ),
    );

    // Create browser instance with navigation retry config
    // CLI options take precedence over config values
    const browser = new PlaywrightBrowser({
      browser: browserOption,
      bypassCSP: options.bypassCsp ?? cfg.bypass_csp,
      channel: options.channel ?? cfg.channel,
      executablePath: options.executablePath ?? cfg.executable_path,
      blockAds: options.blockAds ?? cfg.block_ads,
      blockResources,
      headless: options.headless ?? cfg.headless,
      proxyServer: options.proxy ?? cfg.proxy,
      proxyUsername: options.proxyUsername ?? cfg.proxy_username,
      proxyPassword: options.proxyPassword ?? cfg.proxy_password,
      pwEndpoint: options.pwEndpoint ?? cfg.pw_endpoint,
      pwCdpEndpoint: options.pwCdpEndpoint ?? cfg.pw_cdp_endpoint,
      actionTimeoutMs: options.actionTimeoutMs ?? cfg.action_timeout_ms,
      navigationRetry: {
        baseTimeoutMs: options.navigationTimeoutMs ?? cfg.navigation_timeout_ms,
        maxTimeoutMs: options.navigationMaxTimeoutMs ?? cfg.navigation_max_timeout_ms,
        maxAttempts: options.navigationMaxAttempts ?? cfg.navigation_max_attempts,
        timeoutMultiplier: options.navigationTimeoutMultiplier ?? cfg.navigation_timeout_multiplier,
        onRetry: (attempt, error, nextTimeout) => {
          console.log(
            chalk.yellow(`⚠️ Navigation retry ${attempt}: ${error.message}`),
            chalk.gray(`(next timeout: ${Math.round(nextTimeout / 1000)}s)`),
          );
        },
      },
    });

    // Create AI provider with CLI overrides (only pass if explicitly set on CLI)
    // Unlike other options, we use explicit undefined checks here because
    // createAIProvider() has its own config merging logic - we only want to
    // pass true overrides, not values that would shadow the config system.
    const providerOverrides: Partial<Parameters<typeof createAIProvider>[0]> = {};
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

    // Check debug mode (used for logging setup and WebAgent config)
    const debugMode = options.debug ?? cfg.debug;

    // Set up generation logging if debug mode is enabled
    if (debugMode) {
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
      debug: debugMode,
      vision: options.vision ?? cfg.vision,
      guardrails: options.guardrails ?? cfg.guardrails,
      maxIterations: options.maxIterations ?? cfg.max_iterations,
      maxValidationAttempts: options.maxValidationAttempts ?? cfg.max_validation_attempts,
      maxRepeatedActions: options.maxRepeatedActions ?? cfg.max_repeated_actions,
      initialNavigationRetries: options.initialNavigationRetries ?? cfg.initial_navigation_retries,
      maxConsecutiveErrors: options.maxConsecutiveErrors ?? cfg.max_consecutive_errors,
      maxTotalErrors: options.maxTotalErrors ?? cfg.max_total_errors,
      searchProvider: options.searchProvider ?? cfg.search_provider,
      providerConfig,
      logger,
      eventEmitter,
    });

    // Execute the task
    await webAgent.execute(task, {
      startingUrl: options.url ?? cfg.starting_url,
      data: parsedData,
    });

    // Close the browser
    await webAgent.close();
  } catch (error) {
    console.error(chalk.red.bold("\n❌ Error:"), chalk.whiteBright(error));
    process.exit(1);
  }
}

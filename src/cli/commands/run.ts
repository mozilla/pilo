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

    // Create browser instance with navigation retry config
    // Note: Numeric options are already parsed by Commander's argParser
    const browser = new PlaywrightBrowser({
      browser: options.browser,
      bypassCSP: options.bypassCsp,
      channel: options.channel,
      executablePath: options.executablePath,
      blockAds: options.blockAds ?? config.get("block_ads"),
      blockResources,
      headless: options.headless,
      proxyServer: options.proxy,
      proxyUsername: options.proxyUsername,
      proxyPassword: options.proxyPassword,
      pwEndpoint: options.pwEndpoint,
      pwCdpEndpoint: options.pwCdpEndpoint,
      actionTimeoutMs: options.actionTimeoutMs,
      navigationRetry: {
        baseTimeoutMs: options.navigationTimeoutMs,
        maxTimeoutMs: options.navigationMaxTimeoutMs,
        maxAttempts: options.navigationMaxAttempts,
        timeoutMultiplier: options.navigationTimeoutMultiplier,
        onRetry: (attempt, error, nextTimeout) => {
          console.log(
            chalk.yellow(`⚠️ Navigation retry ${attempt}: ${error.message}`),
            chalk.gray(`(next timeout: ${Math.round(nextTimeout / 1000)}s)`),
          );
        },
      },
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
      maxIterations: options.maxIterations,
      maxValidationAttempts: options.maxValidationAttempts,
      maxRepeatedActions: options.maxRepeatedActions,
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

import chalk from "chalk";
import { Command } from "commander";
import {
  WebAgent,
  PlaywrightBrowser,
  config,
  addConfigOptions,
  createAIProvider,
  ChalkConsoleLogger,
  JSONConsoleLogger,
  WebAgentEventType,
  WebAgentEventEmitter,
  MetricsCollector,
  SecretsRedactor,
} from "pilo-core";
import type { Logger, InputRequest, InputResponse } from "pilo-core";
import { validateBrowser, getValidBrowsers, parseJsonData, parseResourcesList } from "../utils.js";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";

/**
 * Guard: verify that config exists before running a task.
 * Passes if the global config file exists, or if an API key is available
 * from environment variables (e.g. a local .env file in dev mode).
 * Prints an error and exits with code 1 when neither is present.
 */
function assertConfigExists(): boolean {
  if (fs.existsSync(config.getConfigPath())) {
    return true;
  }

  // Also accept config fully provided via environment variables (dev mode / .env)
  const cfg = config.getConfig();
  const hasApiKey = !!(
    cfg.openai_api_key ||
    cfg.openrouter_api_key ||
    cfg.google_generative_ai_api_key ||
    cfg.vertex_project ||
    cfg.ollama_base_url ||
    cfg.openai_compatible_base_url
  );
  if (hasApiKey) {
    return true;
  }

  console.error(
    chalk.red.bold("Error:"),
    "No configuration found. Run 'pilo config init' to set up your configuration.",
  );
  process.exit(1);
  return false; // unreachable, but satisfies the return type for tests that mock process.exit
}

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
  // Guard: config file must exist before we attempt to run a task.
  assertConfigExists();

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
      pwCdpEndpoints:
        (options.pwCdpEndpoints as string[] | undefined) ??
        cfg.pw_cdp_endpoints ??
        (cfg.pw_cdp_endpoint ? [cfg.pw_cdp_endpoint] : undefined),
      actionTimeoutMs: options.actionTimeoutMs ?? cfg.action_timeout_ms,
      navigationRetry: {
        baseTimeoutMs: options.navigationTimeoutMs ?? cfg.navigation_timeout_ms,
        maxTimeoutMs: options.navigationMaxTimeoutMs ?? cfg.navigation_max_timeout_ms,
        maxAttempts: options.navigationMaxAttempts ?? cfg.navigation_max_attempts,
        timeoutMultiplier: options.navigationTimeoutMultiplier ?? cfg.navigation_timeout_multiplier,
        onRetry: (attempt: number, error: Error, nextTimeout: number) => {
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
      eventEmitter.onEvent(WebAgentEventType.AI_GENERATION, (data: unknown) => {
        // Create a timestamped file for this generation
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const generationLogPath = path.join(debugDir, `${timestamp}.json`);

        // Write the exact data object to file
        fs.writeFileSync(generationLogPath, JSON.stringify(data, null, 2));
      });
    }

    // Input handler for human-in-the-loop (prompts user via stdio)
    const onInput = async (request: InputRequest): Promise<InputResponse> => {
      if (request.type === "form") {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        const promptField = (text: string): Promise<string> =>
          new Promise((resolve) => rl.question(text, resolve));

        // Prompt for sensitive fields without echoing input
        const promptSensitive = (text: string): Promise<string> =>
          new Promise((resolve) => {
            process.stdout.write(text);
            const stdin = process.stdin;
            const wasRaw = stdin.isRaw;
            if (stdin.isTTY) stdin.setRawMode(true);

            let input = "";
            const onData = (ch: Buffer) => {
              const char = ch.toString();
              if (char === "\n" || char === "\r") {
                if (stdin.isTTY) stdin.setRawMode(wasRaw ?? false);
                stdin.removeListener("data", onData);
                process.stdout.write("\n");
                resolve(input);
              } else if (char === "\u007F" || char === "\b") {
                // Backspace
                if (input.length > 0) input = input.slice(0, -1);
              } else if (char === "\u0003") {
                // Ctrl+C
                process.exit(1);
              } else {
                input += char;
              }
            };
            stdin.on("data", onData);
          });

        try {
          console.log(chalk.yellow(`\n[Input needed] ${request.question}`));
          if (request.pageUrl) {
            console.log(chalk.gray(`  Page: ${request.pageUrl}`));
          }
          console.log();

          const fields: Record<string, string> = {};
          for (const field of request.fields) {
            if (field.type === "select" && field.options && field.options.length > 0) {
              // Display options for select fields
              console.log(chalk.cyan(`  ${field.label}:`));
              field.options.forEach((option, i) => {
                console.log(chalk.gray(`    ${i + 1}. ${option}`));
              });
              const choice = await promptField(chalk.cyan(`  Enter choice (1-${field.options.length}): `));
              const index = parseInt(choice, 10) - 1;
              if (index >= 0 && index < field.options.length) {
                fields[field.name] = field.options[index];
              } else {
                // Treat as raw input if not a valid number
                fields[field.name] = choice;
              }
            } else if (field.sensitive) {
              // Mask input for sensitive fields
              fields[field.name] = await promptSensitive(chalk.cyan(`  ${field.label}: `));
            } else {
              fields[field.name] = await promptField(chalk.cyan(`  ${field.label}: `));
            }
          }
          return { type: "form", fields };
        } finally {
          rl.close();
          // readline puts stdin into flowing mode; pause it so the
          // event loop can exit cleanly after the task completes.
          process.stdin.pause();
        }
      }
      return { type: "declined", reason: `Unsupported input type: ${(request as any).type}` };
    };

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
      searchApiKey: cfg.parallel_api_key,
      tabstackApiKey: options.tabstackApiKey ?? cfg.tabstack_api_key,
      tabstackApiUrl: options.tabstackApiUrl ?? cfg.tabstack_api_url,
      providerConfig,
      logger,
      eventEmitter,
      onInput,
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

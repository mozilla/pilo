import chalk from "chalk";
import { Command } from "commander";
import { input, password, select, confirm } from "@inquirer/prompts";
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
  PLAYWRIGHT_BROWSERS,
  resolveAdvertisedUploadFiles,
} from "pilo-core";
import type {
  FileUploadConfig,
  Logger,
  UserDataCallback,
  UserDataRequest,
  UserDataResponse,
} from "pilo-core";
import { validateBrowser, getValidBrowsers, parseJsonData, parseResourcesList } from "../utils.js";
import * as fs from "fs";
import * as path from "path";

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
 * Prompt for a single field value using the appropriate inquirer prompt
 * based on the field type.
 */
async function promptForField(field: UserDataRequest["fields"][number]): Promise<string> {
  const hint = field.description ? chalk.yellow(field.description) : undefined;
  const requiredTag = field.required ? chalk.red(" *") : "";
  const message = `${field.label}${requiredTag}`;

  switch (field.fieldType) {
    case "password":
      return password({ message, mask: "*" });

    case "select":
      if (field.options?.length) {
        return select({
          message,
          choices: field.options.map((opt) => ({ name: opt, value: opt })),
          default: field.currentValue,
        });
      }
      return input({ message, default: field.currentValue });

    case "checkbox":
      return (await confirm({ message, default: field.currentValue === "true" }))
        ? "true"
        : "false";

    default:
      return input({
        message: hint ? `${message} ${hint}` : message,
        default: field.currentValue,
      });
  }
}

/**
 * Creates a UserDataCallback that prompts the user in the terminal
 * for form field values using @inquirer/prompts.
 */
function createTerminalPromptCallback(): UserDataCallback {
  return async (request: UserDataRequest): Promise<UserDataResponse> => {
    // Detect validation errors by checking if any field has a description (error message)
    const hasErrors = request.fields.some((f) => f.description);
    const errorLabel = hasErrors ? chalk.red.bold(" (validation error, please correct)") : "";
    console.error(
      chalk.cyan.bold(`\n📋 Form data requested: ${request.formDescription}${errorLabel}`),
    );
    console.error(chalk.gray(`   Page: ${request.pageTitle} (${request.pageUrl})`));
    console.error();

    const fields: UserDataResponse["fields"] = [];

    for (const field of request.fields) {
      try {
        const value = await promptForField(field);
        fields.push({ ref: field.ref, value });
      } catch {
        // User pressed Ctrl+C during a prompt, treat as cancellation
        return { requestId: request.requestId, fields: [], cancelled: true };
      }
    }

    console.error();
    return { requestId: request.requestId, fields };
  };
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

  // Add interactive mode flag (CLI-only, not in config schema)
  command.option("-i, --interactive", "Enable interactive mode: agent will prompt for form data");

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

    const uploadAllowedPaths =
      (options.uploadAllowedPaths as string[] | undefined) ?? cfg.upload_allowed_paths;
    const allowFileUpload: false | FileUploadConfig =
      PLAYWRIGHT_BROWSERS.includes(browserOption as (typeof PLAYWRIGHT_BROWSERS)[number]) &&
      uploadAllowedPaths?.length > 0
        ? { allowedPaths: uploadAllowedPaths }
        : false;

    const advertisedUploadFiles = await resolveAdvertisedUploadFiles(allowFileUpload);

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
    let browser;
    if (browserOption === "bidi") {
      const { BiDiBrowser } = await import("pilo-core");
      const bidiUrl = options.bidiUrl ?? cfg.bidi_url;
      if (!bidiUrl) {
        throw new Error("--bidi-url or PILO_BIDI_URL is required when using --browser bidi");
      }
      browser = new BiDiBrowser({
        bidiUrl,
        actionTimeoutMs: options.actionTimeoutMs ?? cfg.action_timeout_ms,
      });
    } else if (browserOption === "foxcloud") {
      const { FoxcloudBrowser } = await import("pilo-core");
      const foxcloudUrl = options.foxcloudUrl ?? cfg.foxcloud_url;
      if (!foxcloudUrl) {
        throw new Error(
          "--foxcloud-url or PILO_FOXCLOUD_URL is required when using --browser foxcloud",
        );
      }
      browser = new FoxcloudBrowser({
        brokerUrl: foxcloudUrl,
        proxyUrl: options.foxcloudProxyUrl ?? cfg.foxcloud_proxy_url,
        actionTimeoutMs: options.actionTimeoutMs ?? cfg.action_timeout_ms,
      });
    } else {
      browser = new PlaywrightBrowser({
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
        cdpConnectRetry: {
          maxAttempts: options.cdpConnectMaxAttempts ?? cfg.cdp_connect_max_attempts,
          backoffBaseMs: options.cdpConnectBackoffBaseMs ?? cfg.cdp_connect_backoff_base_ms,
          backoffMaxMs: options.cdpConnectBackoffMaxMs ?? cfg.cdp_connect_backoff_max_ms,
        },
        actionTimeoutMs: options.actionTimeoutMs ?? cfg.action_timeout_ms,
        allowFileUpload,
        navigationRetry: {
          baseTimeoutMs: options.navigationTimeoutMs ?? cfg.navigation_timeout_ms,
          maxTimeoutMs: options.navigationMaxTimeoutMs ?? cfg.navigation_max_timeout_ms,
          maxAttempts: options.navigationMaxAttempts ?? cfg.navigation_max_attempts,
          timeoutMultiplier:
            options.navigationTimeoutMultiplier ?? cfg.navigation_timeout_multiplier,
          onRetry: (attempt: number, error: Error, nextTimeout: number) => {
            console.log(
              chalk.yellow(`⚠️ Navigation retry ${attempt}: ${error.message}`),
              chalk.gray(`(next timeout: ${Math.round(nextTimeout / 1000)}s)`),
            );
          },
        },
      });
    }

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

    // Create WebAgent
    const searchProvider = options.searchProvider ?? cfg.search_provider;
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
      searchProvider,
      // Only pass a key for providers that use one; browser providers and
      // "none" don't, so we avoid threading an unrelated key through config.
      searchApiKey:
        searchProvider === "exa-api"
          ? cfg.exa_api_key
          : searchProvider === "parallel-api"
            ? cfg.parallel_api_key
            : undefined,
      tabstackApiKey: options.tabstackApiKey ?? cfg.tabstack_api_key,
      tabstackApiUrl: options.tabstackApiUrl ?? cfg.tabstack_api_url,
      trustedHostnames: options.trustedHostnames ?? cfg.trusted_hostnames,
      unsafeMode: options.unsafe ?? cfg.unsafe_mode,
      allowFileUpload,
      advertisedUploadFiles,
      providerConfig,
      logger,
      eventEmitter,
      onUserDataRequired: options.interactive ? createTerminalPromptCallback() : undefined,
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

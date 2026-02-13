import chalk from "chalk";
import { Command } from "commander";
import { existsSync, unlinkSync, mkdirSync, writeFileSync } from "fs";
import { dirname } from "path";
import { config } from "../../config.js";
import { getPackageInfo, parseConfigKeyValue, parseConfigValue } from "../utils.js";

/**
 * Creates the 'config' command for managing Spark configuration
 */
export function createConfigCommand(): Command {
  const configCmd = new Command("config").description("Manage Spark configuration");

  // config init - Initialize global configuration file
  configCmd
    .command("init")
    .description("Initialize global configuration file")
    .action(initializeGlobalConfiguration);

  // config show - Show current configuration
  configCmd
    .command("show")
    .description("Show current configuration from all sources")
    .action(async () => {
      const currentConfig = config.getCliConfig();
      await showConfiguration(currentConfig);
    });

  // config list - List configuration sources and values
  configCmd
    .command("list")
    .description("List configuration sources and values")
    .action(showConfigurationSources);

  // config get - Get a specific configuration value
  configCmd
    .command("get")
    .description("Get a specific configuration value")
    .argument("<key>", "Configuration key to retrieve")
    .action(getConfigurationValue);

  // config set - Set a global configuration value
  configCmd
    .command("set")
    .description("Set a global configuration value")
    .argument("<key-value>", "Configuration key=value pair")
    .action(setConfigurationValue);

  // config unset - Remove a global configuration value
  configCmd
    .command("unset")
    .description("Remove a global configuration value")
    .argument("<key>", "Configuration key to remove")
    .action(unsetConfigurationValue);

  // config reset - Reset global configuration
  configCmd
    .command("reset")
    .description("Reset global configuration (removes all settings)")
    .action(resetGlobalConfiguration);

  return configCmd;
}

/**
 * Show the current configuration
 */
async function showConfiguration(currentConfig: any): Promise<void> {
  const globalConfig = config.getGlobalConfig();

  // Determine AI provider info from global config only
  const provider = globalConfig.provider || currentConfig.provider;
  const model = globalConfig.model || currentConfig.model;
  let hasApiKey = false;
  let keySource = "not set";

  if (provider === "openai" && globalConfig.openai_api_key) {
    hasApiKey = true;
    keySource = "global config";
  } else if (provider === "openrouter" && globalConfig.openrouter_api_key) {
    hasApiKey = true;
    keySource = "global config";
  } else if (provider === "google" && globalConfig.google_generative_ai_api_key) {
    hasApiKey = true;
    keySource = "global config";
  }

  console.log(chalk.blue.bold("🔧 Current Configuration"));
  console.log("");
  console.log(chalk.white.bold("AI Provider:"));
  console.log(`  Provider: ${provider}`);
  console.log(`  Model: ${model || chalk.gray("(default)")}`);
  console.log(
    `  API Key: ${hasApiKey ? chalk.green(`✓ Set (${keySource})`) : chalk.red("✗ Not set")}`,
  );
  console.log("");
  console.log(chalk.white.bold("Browser Settings:"));
  console.log(`  Browser: ${currentConfig.browser}`);
  console.log(`  Headless: ${currentConfig.headless}`);
  console.log(`  Block Ads: ${currentConfig.block_ads}`);
  console.log(`  Block Resources: ${currentConfig.block_resources}`);
  console.log("");
  const packageInfo = getPackageInfo();
  console.log(`Config File: ${config.getConfigPath()}`);
  console.log(`Node Version: ${process.version}`);
  console.log(`Spark Version: ${packageInfo.version}`);
  console.log("");
  console.log(chalk.gray("Note: CLI uses only the global config file"));
}

/**
 * Show configuration sources and their values for debugging
 */
function showConfigurationSources(): void {
  const globalConfig = config.getGlobalConfig();
  const cliConfig = config.getCliConfig();

  console.log(chalk.blue.bold("🔧 Configuration Sources"));
  console.log("");
  console.log(chalk.white.bold("Global Config File:"));
  console.log(JSON.stringify(globalConfig, null, 2));
  console.log("");
  console.log(chalk.white.bold("CLI Merged (with defaults):"));
  console.log(JSON.stringify(cliConfig, null, 2));
  console.log("");
  console.log(
    chalk.gray("Note: CLI uses only the global config file (environment variables are ignored)"),
  );
}

/**
 * Get a specific configuration value
 */
function getConfigurationValue(key: string): void {
  const cliConfig = config.getCliConfig();
  const value = cliConfig[key as keyof typeof cliConfig];
  if (value !== undefined) {
    console.log(value);
  } else {
    console.log(chalk.gray("(not set)"));
    process.exit(1);
  }
}

/**
 * Set a global configuration value
 */
function setConfigurationValue(keyValue: string): void {
  try {
    const { key, value } = parseConfigKeyValue(keyValue);
    const parsedValue = parseConfigValue(value);

    config.set(key as any, parsedValue);
    console.log(chalk.green(`✅ Set ${key} = ${value}`));
  } catch (error) {
    console.error(chalk.red("❌ Error:"), error instanceof Error ? error.message : String(error));
    console.log(chalk.gray("Example: spark config set browser=chrome"));
    process.exit(1);
  }
}

/**
 * Remove a global configuration value
 */
function unsetConfigurationValue(key: string): void {
  try {
    config.unset(key as any);
    console.log(chalk.green(`✅ Removed ${key}`));
  } catch (error) {
    console.error(chalk.red("❌ Error:"), error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

/**
 * Initialize global configuration file
 */
async function initializeGlobalConfiguration(): Promise<void> {
  const configPath = config.getConfigPath();

  // Check if config file already exists
  if (existsSync(configPath)) {
    console.error(chalk.red("❌ Error: Configuration file already exists"));
    console.log(chalk.gray("Config file: " + configPath));
    console.log("");
    console.log(
      chalk.white("To view your configuration, run: ") + chalk.green("spark config show"),
    );
    console.log(
      chalk.white("To reset your configuration, run: ") + chalk.green("spark config reset"),
    );
    process.exit(1);
  }

  // Create parent directory if it doesn't exist
  const configDir = dirname(configPath);
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }

  // Create empty config file
  try {
    writeFileSync(configPath, "{}\n", "utf-8");
    console.log(chalk.green("✅ Global configuration initialized successfully"));
    console.log(chalk.gray("Config file: " + configPath));
    console.log("");
    console.log(chalk.white.bold("Next Steps:"));
    console.log("");
    console.log(chalk.white("1. Configure an AI provider:"));
    console.log("");
    console.log(chalk.cyan.bold("   Option 1: OpenAI (Default)"));
    console.log(
      "   • Get an API key from " + chalk.underline("https://platform.openai.com/api-keys"),
    );
    console.log("   • Run: " + chalk.green("spark config set openai_api_key=your-key"));
    console.log("");
    console.log(chalk.cyan.bold("   Option 2: OpenRouter (Alternative)"));
    console.log("   • Get an API key from " + chalk.underline("https://openrouter.ai/keys"));
    console.log("   • Run: " + chalk.green("spark config set provider=openrouter"));
    console.log("   • Run: " + chalk.green("spark config set openrouter_api_key=your-key"));
    console.log("");
    console.log(chalk.white("2. Verify your configuration:"));
    console.log("   • Run: " + chalk.green("spark config show"));
  } catch (error) {
    console.error(
      chalk.red("❌ Error creating configuration file:"),
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  }
}

/**
 * Reset global configuration by removing the config file
 */
function resetGlobalConfiguration(): void {
  try {
    const configPath = config.getConfigPath();

    if (existsSync(configPath)) {
      unlinkSync(configPath);
      console.log(chalk.green("✅ Global configuration reset successfully"));
      console.log(chalk.gray("Config file removed: " + configPath));
      console.log("");
      console.log(chalk.white("To get started again, run: ") + chalk.green("spark config init"));
    } else {
      console.log(chalk.yellow("⚠️  No global configuration found to reset"));
      console.log(chalk.gray("Config file: " + configPath));
    }
  } catch (error) {
    console.error(
      chalk.red("❌ Error resetting configuration:"),
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  }
}

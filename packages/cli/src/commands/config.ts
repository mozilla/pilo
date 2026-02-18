import chalk from "chalk";
import { Command } from "commander";
import { existsSync, unlinkSync, writeFileSync, mkdirSync } from "fs";
import { config } from "spark-core/config.js";
import { getConfigPath } from "spark-core/config/globalConfig.js";
import { getAIProviderInfo } from "spark-core/provider.js";
import { getPackageInfo, parseConfigKeyValue, parseConfigValue } from "../utils.js";
import { dirname } from "path";

/**
 * Creates the 'config' command for managing Spark configuration
 */
export function createConfigCommand(): Command {
  const configCmd = new Command("config").description("Manage Spark configuration");

  // spark config init
  configCmd
    .command("init")
    .description("Initialize global configuration file")
    .action(async () => {
      await initializeGlobalConfiguration();
    });

  // spark config show
  configCmd
    .command("show")
    .description("Show current configuration from all sources")
    .action(async () => {
      await showConfiguration();
    });

  // spark config set <key> <value>
  configCmd
    .command("set")
    .description("Set a global configuration value")
    .argument("<key-value>", "Configuration key=value pair (e.g., browser=chrome)")
    .action((keyValue: string) => {
      setConfigurationValue(keyValue);
    });

  // spark config get <key>
  configCmd
    .command("get")
    .description("Get a specific configuration value")
    .argument("<key>", "Configuration key to retrieve")
    .action((key: string) => {
      getConfigurationValue(key);
    });

  // spark config reset
  configCmd
    .command("reset")
    .description("Reset global configuration (removes config file)")
    .action(() => {
      resetGlobalConfiguration();
    });

  return configCmd;
}

/**
 * Show the current configuration from all sources
 */
async function showConfiguration(): Promise<void> {
  const currentConfig = config.getConfig();
  const aiInfo = getAIProviderInfo();

  console.log(chalk.blue.bold("🔧 Current Configuration"));
  console.log("");
  console.log(chalk.white.bold("AI Provider:"));
  console.log(`  Provider: ${aiInfo.provider}`);
  console.log(`  Model: ${aiInfo.model}`);
  console.log(
    `  API Key: ${aiInfo.hasApiKey ? chalk.green(`✓ Set (${aiInfo.keySource})`) : chalk.red("✗ Not set")}`,
  );
  console.log("");
  console.log(chalk.white.bold("Browser Settings:"));
  console.log(`  Browser: ${currentConfig.browser || chalk.gray("firefox (default)")}`);
  console.log(
    `  Headless: ${currentConfig.headless !== undefined ? currentConfig.headless : chalk.gray("false (default)")}`,
  );
  console.log(
    `  Block Ads: ${currentConfig.block_ads !== undefined ? currentConfig.block_ads : chalk.gray("true (default)")}`,
  );
  console.log(
    `  Block Resources: ${currentConfig.block_resources || chalk.gray("media,manifest (default)")}`,
  );
  console.log("");
  const packageInfo = getPackageInfo();
  console.log(`Config File: ${getConfigPath()}`);
  console.log(`Node Version: ${process.version}`);
  console.log(`Spark Version: ${packageInfo.version}`);
}

/**
 * Get a specific configuration value
 */
function getConfigurationValue(key: string): void {
  const value = config.get(key as any);
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
 * Initialize global configuration with guided setup
 */
async function initializeGlobalConfiguration(): Promise<void> {
  const configPath = getConfigPath();

  // Check if config file already exists
  if (existsSync(configPath)) {
    console.log(chalk.yellow("⚠️  Configuration file already exists"));
    console.log(chalk.gray("Config file: " + configPath));
    console.log("");
    console.log(
      chalk.white("Use ") +
        chalk.green("spark config show") +
        chalk.white(" to view configuration"),
    );
    console.log(
      chalk.white("Use ") +
        chalk.green("spark config set <key>=<value>") +
        chalk.white(" to modify settings"),
    );
    return;
  }

  // Create empty config file
  try {
    const configDir = dirname(configPath);
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true });
    }

    writeFileSync(configPath, JSON.stringify({}, null, 2), "utf-8");
    console.log(chalk.green("✅ Configuration file created successfully"));
    console.log(chalk.gray("Config file: " + configPath));
    console.log("");
    console.log(chalk.blue.bold("🔧 Getting Started"));
    console.log("");
    console.log(chalk.white.bold("To configure an AI provider:"));
    console.log("");
    console.log(chalk.cyan.bold("Option 1: OpenAI (Default)"));
    console.log(
      "1. Get an API key from " + chalk.underline("https://platform.openai.com/api-keys"),
    );
    console.log("2. Run: " + chalk.green("spark config set openai_api_key=your-key"));
    console.log("");
    console.log(chalk.cyan.bold("Option 2: OpenRouter (Alternative)"));
    console.log("1. Get an API key from " + chalk.underline("https://openrouter.ai/keys"));
    console.log("2. Run: " + chalk.green("spark config set provider=openrouter"));
    console.log("3. Run: " + chalk.green("spark config set openrouter_api_key=your-key"));
    console.log("");
    console.log(chalk.white.bold("Verification:"));
    console.log("Run " + chalk.green("spark config show") + " to verify your configuration");
    console.log("");
    console.log(chalk.white.bold("Configuration Priority:"));
    console.log(chalk.gray("1. Environment variables (highest priority)"));
    console.log(chalk.gray("2. Local .env file (development)"));
    console.log(chalk.gray("3. Global config file (lowest priority)"));
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
    const configPath = getConfigPath();

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

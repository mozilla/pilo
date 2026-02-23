import chalk from "chalk";
import { Command } from "commander";
import { existsSync } from "fs";
import { config, getAIProviderInfo } from "pilo-core";
import { getPackageInfo, parseConfigValue } from "../utils.js";

/**
 * Creates the 'config' command group with subcommands for managing Pilo configuration.
 *
 * Subcommands:
 *   config init              - Guided setup for global configuration
 *   config set <key> <value> - Set a global configuration value
 *   config get <key>         - Get a specific configuration value
 *   config list              - List configuration sources and values
 *   config show              - Show current configuration summary
 *   config unset <key>       - Remove a global configuration value
 *   config reset             - Reset global configuration (removes all settings)
 */
export function createConfigCommand(): Command {
  const configCmd = new Command("config").description("Manage Pilo configuration");

  configCmd.addCommand(createConfigInitCommand());
  configCmd.addCommand(createConfigSetCommand());
  configCmd.addCommand(createConfigGetCommand());
  configCmd.addCommand(createConfigListCommand());
  configCmd.addCommand(createConfigShowCommand());
  configCmd.addCommand(createConfigUnsetCommand());
  configCmd.addCommand(createConfigResetCommand());

  return configCmd;
}

/**
 * config init - Initialize global configuration with guided setup
 */
function createConfigInitCommand(): Command {
  return new Command("init")
    .description("Initialize global configuration with guided setup")
    .action(initializeGlobalConfiguration);
}

/**
 * config set <key> <value> - Set a global configuration value
 */
function createConfigSetCommand(): Command {
  return new Command("set")
    .description("Set a global configuration value")
    .argument("<key>", "Configuration key")
    .argument("<value>", "Configuration value")
    .action((key: string, value: string) => {
      setConfigurationValue(key, value);
    });
}

/**
 * config get <key> - Get a specific configuration value
 */
function createConfigGetCommand(): Command {
  return new Command("get")
    .description("Get a specific configuration value")
    .argument("<key>", "Configuration key")
    .action((key: string) => {
      getConfigurationValue(key);
    });
}

/**
 * config list - List configuration sources and their values
 */
function createConfigListCommand(): Command {
  return new Command("list").description("List configuration sources and values").action(() => {
    showConfigurationSources();
  });
}

/**
 * config show - Show current configuration summary
 */
function createConfigShowCommand(): Command {
  return new Command("show")
    .description("Show current configuration from all sources")
    .action(async () => {
      const currentConfig = config.getConfig();
      await showConfiguration(currentConfig);
    });
}

/**
 * config unset <key> - Remove a global configuration value
 */
function createConfigUnsetCommand(): Command {
  return new Command("unset")
    .description("Remove a global configuration value")
    .argument("<key>", "Configuration key to remove")
    .action((key: string) => {
      unsetConfigurationValue(key);
    });
}

/**
 * config reset - Reset global configuration by removing the config file
 */
function createConfigResetCommand(): Command {
  return new Command("reset")
    .description("Reset global configuration (removes all settings)")
    .action(() => {
      resetGlobalConfiguration();
    });
}

// ---------------------------------------------------------------------------
// Implementation helpers
// ---------------------------------------------------------------------------

/**
 * Show the current configuration from all sources
 */
async function showConfiguration(currentConfig: any): Promise<void> {
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
  console.log(`Config File: ${config.getConfigPath()}`);
  console.log(`Node Version: ${process.version}`);
  console.log(`Pilo Version: ${packageInfo.version}`);
}

/**
 * Show configuration sources and their values for debugging
 */
function showConfigurationSources(): void {
  const sources = config.listSources();
  console.log(chalk.blue.bold("🔧 Configuration Sources"));
  console.log("");
  console.log(chalk.white.bold("Global Config:"));
  console.log(JSON.stringify(sources.global, null, 2));
  console.log("");
  console.log(chalk.white.bold("Environment Variables:"));
  console.log(JSON.stringify(sources.env, null, 2));
  console.log("");
  console.log(chalk.white.bold("Merged (Final):"));
  console.log(JSON.stringify(sources.merged, null, 2));
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
function setConfigurationValue(key: string, value: string): void {
  try {
    const parsedValue = parseConfigValue(value);
    config.set(key as any, parsedValue);
    console.log(chalk.green(`✅ Set ${key} = ${value}`));
  } catch (error) {
    console.error(chalk.red("❌ Error:"), error instanceof Error ? error.message : String(error));
    console.log(chalk.gray("Example: pilo config set browser chrome"));
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
 * Initialize global configuration with guided setup
 */
async function initializeGlobalConfiguration(): Promise<void> {
  console.log(chalk.blue.bold("🔧 Initializing Pilo Global Configuration"));
  console.log("");

  config.initialize();

  const currentConfig = config.getConfig();

  // Check if already configured
  if (
    currentConfig.provider &&
    (currentConfig.openai_api_key || currentConfig.openrouter_api_key)
  ) {
    console.log(chalk.yellow("⚠️  Configuration already exists"));
    console.log(chalk.gray("Current provider: " + (currentConfig.provider || "openai")));
    console.log(chalk.gray("Use 'pilo config show' to see full configuration"));
    console.log(chalk.gray("Use 'pilo config set key value' to modify settings"));
    return;
  }

  // Guide user through setup
  console.log(chalk.white.bold("To get started, you need to configure an AI provider:"));
  console.log("");
  console.log(chalk.cyan.bold("Option 1: OpenAI (Default)"));
  console.log("1. Get an API key from " + chalk.underline("https://platform.openai.com/api-keys"));
  console.log("2. Run: " + chalk.green("pilo config set openai_api_key your-key"));
  console.log("");
  console.log(chalk.cyan.bold("Option 2: OpenRouter (Alternative)"));
  console.log("1. Get an API key from " + chalk.underline("https://openrouter.ai/keys"));
  console.log("2. Run: " + chalk.green("pilo config set provider openrouter"));
  console.log("3. Run: " + chalk.green("pilo config set openrouter_api_key your-key"));
  console.log("");
  console.log(chalk.white.bold("Verification:"));
  console.log("Run " + chalk.green("pilo config show") + " to verify your configuration");
  console.log("");
  console.log(chalk.white.bold("Configuration Priority:"));
  console.log(chalk.gray("1. Environment variables (highest priority)"));
  console.log(chalk.gray("2. Local .env file (development)"));
  console.log(chalk.gray("3. Global config file (lowest priority)"));
  console.log("");
  console.log(chalk.gray("Global config location: " + config.getConfigPath()));
}

/**
 * Reset global configuration by removing the config file via ConfigManager.
 */
function resetGlobalConfiguration(): void {
  try {
    const configPath = config.getConfigPath();

    if (existsSync(configPath)) {
      config.reset();
      console.log(chalk.green("✅ Global configuration reset successfully"));
      console.log(chalk.gray("Config file removed: " + configPath));
      console.log("");
      console.log(chalk.white("To get started again, run: ") + chalk.green("pilo config init"));
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

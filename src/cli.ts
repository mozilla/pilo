#!/usr/bin/env node

import { Command } from "commander";
import { existsSync } from "fs";
import chalk from "chalk";
import { createRunCommand } from "./cli/commands/run.js";
import { createConfigCommand } from "./cli/commands/config.js";
import { createExamplesCommand } from "./cli/commands/examples.js";
import { getPackageInfo } from "./cli/utils.js";
import { config } from "./config.js";
import { isDevelopmentMode } from "./buildMode.js";

/**
 * Spark CLI - AI-powered web automation tool
 *
 * This is the main entry point for the Spark command-line interface.
 * It sets up the commander.js program and registers all available commands.
 */

// Get package information
const packageInfo = getPackageInfo();

// Create the main program
const program = new Command();

// Configure the main program
program
  .name(packageInfo.name)
  .description(packageInfo.description)
  .version(packageInfo.version)
  .configureHelp({
    sortSubcommands: true,
    subcommandTerm: (cmd) => cmd.name() + " " + cmd.usage(),
  });

// Add pre-action hook to ensure config file exists (except for 'config init' or dev mode)
program.hook("preAction", () => {
  // Check if the command being run is 'config init' by inspecting process.argv
  const args = process.argv.slice(2); // Skip 'node' and script path
  const isConfigInit = args[0] === "config" && args[1] === "init";

  // Allow 'config init' to run without a config file
  if (isConfigInit) {
    return;
  }

  // In development mode, config file is optional (env vars can be used)
  if (isDevelopmentMode()) {
    return;
  }

  // In production mode, require config file to exist
  const configPath = config.getConfigPath();
  if (!existsSync(configPath)) {
    console.error(chalk.red("❌ Error: Global configuration file not found"));
    console.log(chalk.gray("Config file: " + configPath));
    console.log("");
    console.log(
      chalk.white("Please initialize your configuration first by running: ") +
        chalk.green("spark config init"),
    );
    process.exit(1);
  }
});

// Register all commands
program.addCommand(createRunCommand());
program.addCommand(createConfigCommand());
program.addCommand(createExamplesCommand());

// Parse command line arguments
program.parse();

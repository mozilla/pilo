#!/usr/bin/env node

import { Command } from "commander";
import { createRunCommand } from "./commands/run.js";
import { createConfigCommand } from "./commands/config.js";
import { createExamplesCommand } from "./commands/examples.js";
import { getPackageInfo } from "./utils.js";
import { isProductionMode } from "spark-core";
import { getConfigPath } from "spark-core/config/globalConfig.js";
import { existsSync } from "fs";
import chalk from "chalk";

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

// Add pre-action hook to check for config file in production mode
program.hook("preAction", (_thisCommand, actionCommand) => {
  // Skip config file check for config init and config show commands
  const commandName = actionCommand.name();
  const parentName = actionCommand.parent?.name();

  // Allow config init and config show without a config file
  if (parentName === "config" && (commandName === "init" || commandName === "show")) {
    return;
  }

  // In production mode, require a config file to exist
  if (isProductionMode()) {
    const configPath = getConfigPath();
    if (!existsSync(configPath)) {
      console.error(chalk.red.bold("❌ Error: Configuration file not found"));
      console.log("");
      console.log(chalk.white("Spark requires a configuration file to run."));
      console.log(chalk.gray("Config file: " + configPath));
      console.log("");
      console.log(chalk.white("To create a configuration file, run:"));
      console.log(chalk.green("  spark config init"));
      console.log("");
      console.log(chalk.white("Then configure your AI provider:"));
      console.log(chalk.green("  spark config set openai_api_key=your-key"));
      console.log("");
      console.log(chalk.white("View configuration:"));
      console.log(chalk.green("  spark config show"));
      process.exit(1);
    }
  }
});

// Register all commands
program.addCommand(createRunCommand());
program.addCommand(createConfigCommand());
program.addCommand(createExamplesCommand());

// Parse command line arguments
program.parse();

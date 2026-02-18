#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import { existsSync } from "fs";
import { isProductionBuild } from "spark-core/buildMode.js";
import { config } from "spark-core/config.js";
import { createRunCommand } from "./commands/run.js";
import { createConfigCommand } from "./commands/config.js";
import { createExamplesCommand } from "./commands/examples.js";
import { getPackageInfo } from "./utils.js";

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

// Pre-action hook: require config file in production mode
program.hook("preAction", (thisCommand) => {
  // Skip config check for config command and version/help flags
  const commandName = thisCommand.name();
  if (commandName === "config") {
    return;
  }

  // In production mode, require config file to exist
  if (isProductionBuild()) {
    const configPath = config.getConfigPath();
    if (!existsSync(configPath)) {
      console.error(chalk.red("❌ Error: Configuration file not found"));
      console.log("");
      console.log(chalk.white("Spark requires a configuration file to run in production mode."));
      console.log("");
      console.log(chalk.white("To create a configuration file, run:"));
      console.log("  " + chalk.green("spark config init"));
      console.log("");
      console.log(chalk.gray("Config file location: " + configPath));
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

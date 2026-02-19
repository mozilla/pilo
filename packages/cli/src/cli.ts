#!/usr/bin/env node

import { Command } from "commander";
import { createRunCommand } from "./commands/run.js";
import { createConfigCommand } from "./commands/config.js";
import { createExamplesCommand } from "./commands/examples.js";
import { createExtensionCommand } from "./commands/extension.js";
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

// Register all commands
program.addCommand(createRunCommand());
program.addCommand(createConfigCommand());
program.addCommand(createExamplesCommand());
program.addCommand(createExtensionCommand());

// Parse command line arguments
program.parse();

#!/usr/bin/env node

/**
 * @tabstack/spark-cli entry point
 *
 * This re-implements the CLI entry from the root package but with
 * proper package.json resolution for the published npm package.
 */

import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { Command } from "commander";
import { createRunCommand } from "../../../src/cli/commands/run.js";
import { createConfigCommand } from "../../../src/cli/commands/config.js";
import { createExamplesCommand } from "../../../src/cli/commands/examples.js";

/**
 * Get package.json information from the CLI package
 */
function getPackageInfo(): { version: string; name: string; description: string } {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const packageJson = JSON.parse(readFileSync(join(__dirname, "./package.json"), "utf-8"));

  return {
    version: packageJson.version,
    name: "spark", // Keep the command name as "spark"
    description: packageJson.description,
  };
}

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

// Parse command line arguments
program.parse();

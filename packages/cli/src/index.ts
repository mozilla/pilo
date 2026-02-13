/**
 * @tabstack/spark-cli entry point
 *
 * This is a thin wrapper that imports the CLI implementation from src/cli.ts
 */

// Set up package info injection before importing CLI
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(readFileSync(join(__dirname, "./package.json"), "utf-8"));

(globalThis as any).__SPARK_PACKAGE_INFO = {
  version: packageJson.version,
  name: "spark",
  description: packageJson.description,
};

// Import CLI components
import { Command } from "commander";
import { createRunCommand } from "../../../src/cli/commands/run.js";
import { createConfigCommand } from "../../../src/cli/commands/config.js";
import { createExamplesCommand } from "../../../src/cli/commands/examples.js";
import { getPackageInfo } from "../../../src/cli/utils.js";

// Get package information (will use the injected __SPARK_PACKAGE_INFO)
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

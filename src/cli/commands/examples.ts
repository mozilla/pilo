import chalk from "chalk";
import { Command } from "commander";

/**
 * Creates the 'examples' command for showing usage examples
 */
export function createExamplesCommand(): Command {
  return new Command("examples").description("Show usage examples").action(showExamples);
}

/**
 * Display comprehensive usage examples for Spark CLI
 */
function showExamples(): void {
  console.log(chalk.blue.bold("🌟 Spark Usage Examples\n"));

  showBasicUsageExamples();
  showDataContextExamples();
  showGuardrailsExamples();
  showAdvancedOptionsExamples();
  showConfigurationExamples();
}

/**
 * Show basic usage examples
 */
function showBasicUsageExamples(): void {
  console.log(chalk.white.bold("Basic Usage:"));
  console.log(`  ${chalk.cyan("spark run")} ${chalk.green('"search for flights to Paris"')}`);
  console.log(
    `  ${chalk.cyan("spark run")} ${chalk.green('"find the latest news"')} ${chalk.yellow("--url https://news.ycombinator.com")}`,
  );
  console.log("");
}

/**
 * Show examples with data context
 */
function showDataContextExamples(): void {
  console.log(chalk.white.bold("With Data Context:"));
  console.log(`  ${chalk.cyan("spark run")} ${chalk.green('"book a flight"')} \\`);
  console.log(`    ${chalk.yellow("--url https://airline.com")} \\`);
  console.log(
    `    ${chalk.magenta('--data \'{"departure":"NYC","destination":"LAX","date":"2024-12-25"}\'')}`,
  );
  console.log("");
}

/**
 * Show examples with guardrails
 */
function showGuardrailsExamples(): void {
  console.log(chalk.white.bold("With Guardrails:"));
  console.log(`  ${chalk.cyan("spark run")} ${chalk.green('"search for hotels"')} \\`);
  console.log(`    ${chalk.yellow("--url https://booking.com")} \\`);
  console.log(`    ${chalk.magenta('--data \'{"location":"Paris"}\'')} \\`);
  console.log(`    ${chalk.blue('--guardrails "Do not book anything, only search"')}`);
  console.log("");
}

/**
 * Show advanced option examples
 */
function showAdvancedOptionsExamples(): void {
  console.log(chalk.white.bold("Advanced Options:"));
  console.log(
    `  ${chalk.cyan("spark run")} ${chalk.green('"check my dashboard"')} ${chalk.yellow("--headless --debug")}`,
  );
  console.log(
    `  ${chalk.cyan("spark run")} ${chalk.green('"mobile test"')} ${chalk.yellow('--device "iPhone 12"')}`,
  );
  console.log(
    `  ${chalk.cyan("spark run")} ${chalk.green('"test in Chrome"')} ${chalk.yellow("--browser chrome")}`,
  );
  console.log(
    `  ${chalk.cyan("spark run")} ${chalk.green('"Safari testing"')} ${chalk.yellow("--browser safari --headless")}`,
  );
  console.log("");
}

/**
 * Show configuration examples
 */
function showConfigurationExamples(): void {
  console.log(chalk.white.bold("Configuration:"));
  console.log(`  ${chalk.cyan("spark config --show")}`);
  console.log(`  ${chalk.cyan("spark config --set")} ${chalk.green("provider=openrouter")}`);
  console.log(
    `  ${chalk.cyan("spark config --set")} ${chalk.green("model=anthropic/claude-3-5-sonnet-20241022")}`,
  );
  console.log(
    `  ${chalk.cyan("spark config --set")} ${chalk.green("openrouter_api_key=sk-or-...")}`,
  );
  console.log(`  ${chalk.cyan("spark config --set")} ${chalk.green("browser=chrome")}`);
  console.log(`  ${chalk.cyan("spark config --set")} ${chalk.green("headless=true")}`);
  console.log(`  ${chalk.cyan("spark config --get")} ${chalk.green("provider")}`);
  console.log(`  ${chalk.cyan("spark config --list")}`);
  console.log(`  ${chalk.cyan("spark config --init")} ${chalk.gray("# Setup wizard")}`);
  console.log(`  ${chalk.cyan("spark config --reset")} ${chalk.gray("# Clear all settings")}`);
}

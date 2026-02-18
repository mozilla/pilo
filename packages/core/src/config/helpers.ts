/**
 * Configuration Helper Functions
 *
 * Utility functions for CLI option generation.
 * Node.js only - uses Commander.
 */

import { Command, Option } from "commander";
import { FIELDS, type FieldDef } from "./defaults.js";

/**
 * Build CLI option flags from a field definition.
 */
export function buildOptionFlags(field: FieldDef): string {
  const parts: string[] = [];

  if (field.cliShort) {
    parts.push(field.cliShort);
  }

  if (field.cli) {
    if (field.type === "boolean") {
      parts.push(field.cli);
    } else {
      const placeholder = field.placeholder || "value";
      parts.push(`${field.cli} <${placeholder}>`);
    }
  }

  return parts.join(", ");
}

/**
 * Add all config options to a Commander command.
 */
export function addConfigOptions(command: Command, exclude: string[] = []): Command {
  for (const [key, field] of Object.entries(FIELDS)) {
    if (!field.cli || exclude.includes(key)) continue;

    const flags = buildOptionFlags(field);
    const option = new Option(flags, field.description);

    // Set choices for enum types
    if (field.type === "enum" && field.values) {
      option.choices([...field.values]);
    }

    // For numbers, use argParser to return actual numbers
    if (field.type === "number") {
      option.argParser(parseFloat);
    }

    // Don't set Commander defaults - our config system handles defaults via
    // DEFAULTS, and setting them here would override env vars and config file values

    command.addOption(option);

    // For negatable booleans, add --no-* option
    if (field.type === "boolean" && field.negatable && field.cli) {
      const optionName = field.cli.replace(/^--/, "");
      const negatedOption = new Option(
        `--no-${optionName}`,
        `Disable ${optionName.replace(/-/g, " ")}`,
      );
      command.addOption(negatedOption);
    }
  }

  return command;
}

export const addSchemaOptions = addConfigOptions;

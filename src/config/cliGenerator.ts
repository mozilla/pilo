/**
 * Schema-driven CLI option generator.
 *
 * Generates Commander.js options from CONFIG_SCHEMA, eliminating manual option definitions.
 */

import { Command, Option } from "commander";
import { CONFIG_SCHEMA, type ConfigField, getCliFields } from "./schema.js";
import { config } from "../config.js";

/**
 * Build CLI option flags from a config field definition.
 * Combines short and long options with value placeholder.
 *
 * @example
 * buildOptionFlags({ cliOption: "--browser", cliShortOption: "-b", type: "string" })
 * // Returns: "-b, --browser <value>"
 */
export function buildOptionFlags(field: ConfigField): string {
  const parts: string[] = [];

  if (field.cliShortOption) {
    parts.push(field.cliShortOption);
  }

  if (field.cliOption) {
    // Boolean options don't need <value> placeholder
    if (field.type === "boolean" && !field.negatable) {
      parts.push(field.cliOption);
    } else if (field.type === "boolean" && field.negatable) {
      // Negatable booleans use --no-option format
      parts.push(field.cliOption);
    } else {
      parts.push(`${field.cliOption} <value>`);
    }
  }

  return parts.join(", ");
}

/**
 * Get the default value for a CLI option.
 * Checks config file first, then falls back to schema default.
 */
export function getCliDefault(field: ConfigField): unknown {
  const configValue = config.get(field.configKey as any);
  if (configValue !== undefined) {
    return configValue;
  }
  return field.defaultValue;
}

/**
 * Create a Commander Option from a config field.
 */
export function createOption(field: ConfigField): Option {
  const flags = buildOptionFlags(field);
  const option = new Option(flags, field.description);

  // Set choices for enum types
  if (field.type === "enum" && field.enumValues) {
    option.choices(field.enumValues as string[]);
  }

  // Set default value (from config or schema default)
  const defaultValue = getCliDefault(field);
  if (defaultValue !== undefined) {
    // For numbers, convert to string as Commander expects string defaults for display
    if (field.type === "number") {
      option.default(String(defaultValue));
    } else {
      option.default(defaultValue);
    }
  }

  return option;
}

/**
 * Add all schema-defined options to a Commander command.
 * This replaces manual option definitions in run.ts.
 *
 * @param command - The Commander command to add options to
 * @param exclude - Config keys to exclude (for options handled manually)
 * @returns The command with options added
 *
 * @example
 * const runCommand = new Command("run")
 *   .argument("<task>", "Task description");
 * addSchemaOptions(runCommand, ["starting_url", "data", "guardrails"]);
 */
export function addSchemaOptions(command: Command, exclude: string[] = []): Command {
  const cliFields = getCliFields();

  for (const field of cliFields) {
    // Skip excluded fields
    if (exclude.includes(field.configKey)) {
      continue;
    }

    const option = createOption(field);
    command.addOption(option);
  }

  return command;
}

/**
 * Convert CLI option name to config key format.
 * Commander converts --kebab-case to camelCase in parsed options.
 *
 * @example
 * cliOptionToConfigKey("navigationTimeoutMs") // "navigation_timeout_ms"
 */
export function cliOptionToConfigKey(optionName: string): string {
  // Convert camelCase to snake_case
  return optionName.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/**
 * Convert config key to CLI option name format.
 *
 * @example
 * configKeyToCliOption("navigation_timeout_ms") // "navigationTimeoutMs"
 */
export function configKeyToCliOption(configKey: string): string {
  return configKey.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Parse CLI options into values matching config keys.
 * Handles type coercion for number fields.
 *
 * @param options - Parsed Commander options (camelCase keys)
 * @returns Object with snake_case keys and properly typed values
 */
export function parseCliOptions(options: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const field of CONFIG_SCHEMA) {
    if (!field.cliOption) continue;

    // Commander converts --kebab-case to camelCase
    const cliKey = configKeyToCliOption(field.configKey);
    const value = options[cliKey];

    if (value !== undefined) {
      // Parse string values for number types
      if (field.type === "number" && typeof value === "string") {
        result[field.configKey] = parseFloat(value);
      } else {
        result[field.configKey] = value;
      }
    }
  }

  return result;
}

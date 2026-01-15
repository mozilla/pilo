/**
 * Schema-driven environment variable parser.
 *
 * Replaces manual env var parsing with a data-driven approach based on CONFIG_SCHEMA.
 */

import type { SparkConfig } from "../config.js";
import { CONFIG_SCHEMA, type ConfigField, type ConfigFieldType } from "./schema.js";

/**
 * Coerce a string value to the appropriate type based on field definition.
 * Returns undefined for invalid values (allows falling back to defaults).
 */
export function coerceValue(value: string, type: ConfigFieldType): unknown {
  switch (type) {
    case "boolean":
      // Accept common truthy values (case-insensitive)
      return ["true", "1", "yes", "on"].includes(value.toLowerCase());
    case "number": {
      const num = parseFloat(value);
      if (isNaN(num)) {
        return undefined; // Invalid number, skip to use default
      }
      return num;
    }
    case "string":
    case "enum":
      return value;
    default:
      return value;
  }
}

/**
 * Get the value of an environment variable for a config field.
 * Checks all env vars in the field's envVars array in priority order.
 *
 * @returns The first found value, or undefined if none set
 */
export function getEnvValue(field: ConfigField): string | undefined {
  for (const envVar of field.envVars) {
    const value = process.env[envVar];
    if (value !== undefined) {
      return value;
    }
  }
  return undefined;
}

/**
 * Parse environment variables into a partial SparkConfig object.
 * Only includes values that are actually set in the environment.
 * Invalid values (wrong type, invalid enum) are silently skipped.
 *
 * @returns Partial config object with values from environment variables
 */
export function parseEnvConfig(): Partial<SparkConfig> {
  const config: Record<string, unknown> = {};

  for (const field of CONFIG_SCHEMA) {
    const envValue = getEnvValue(field);
    if (envValue !== undefined) {
      // Validate enum values against allowed list
      if (field.type === "enum" && field.enumValues) {
        if (!field.enumValues.includes(envValue)) {
          continue; // Skip invalid enum value
        }
      }

      const coercedValue = coerceValue(envValue, field.type);
      if (coercedValue !== undefined) {
        config[field.configKey] = coercedValue;
      }
    }
  }

  return config as Partial<SparkConfig>;
}

/**
 * Check if an environment variable is set for a specific config key.
 */
export function hasEnvValue(configKey: keyof SparkConfig): boolean {
  const field = CONFIG_SCHEMA.find((f) => f.configKey === configKey);
  if (!field) return false;
  return getEnvValue(field) !== undefined;
}

/**
 * Get environment variable names for a config key.
 * Useful for error messages and documentation.
 */
export function getEnvVarNames(configKey: keyof SparkConfig): string[] {
  const field = CONFIG_SCHEMA.find((f) => f.configKey === configKey);
  return field?.envVars ?? [];
}

/**
 * Schema-driven environment variable parser.
 *
 * Replaces manual env var parsing with a data-driven approach based on CONFIG_SCHEMA.
 */

import type { SparkConfig } from "./schema.js";
import { CONFIG_SCHEMA, type ConfigField, type ConfigFieldType } from "./schema.js";

/**
 * Coerce a string value to the appropriate type based on field definition.
 * Returns undefined for invalid values (allows falling back to defaults).
 *
 * @param value - The string value to coerce
 * @param type - The target type
 * @param envVar - Optional env var name for warning messages
 */
export function coerceValue(value: string, type: ConfigFieldType, envVar?: string): unknown {
  switch (type) {
    case "boolean": {
      const lower = value.toLowerCase();
      const truthy = ["true", "1", "yes", "on"];
      const falsy = ["false", "0", "no", "off"];
      if (truthy.includes(lower)) return true;
      if (falsy.includes(lower)) return false;
      if (envVar) {
        console.warn(
          `Config warning: ${envVar}="${value}" is not a valid boolean (true/false), treating as false`,
        );
      }
      return false;
    }
    case "number": {
      const num = parseFloat(value);
      if (isNaN(num)) {
        if (envVar) {
          console.warn(`Config warning: ${envVar}="${value}" is not a valid number, using default`);
        }
        return undefined;
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
 * Warnings are logged for invalid values (wrong type, invalid enum).
 *
 * @returns Partial config object with values from environment variables
 */
export function parseEnvConfig(): Partial<SparkConfig> {
  const config: Record<string, unknown> = {};

  for (const field of CONFIG_SCHEMA) {
    const envValue = getEnvValue(field);
    if (envValue !== undefined) {
      // Get the env var name that was actually set (for error messages)
      const envVarName =
        field.envVars.find((v) => process.env[v] !== undefined) || field.envVars[0];

      // Validate enum values against allowed list
      if (field.type === "enum" && field.enumValues) {
        if (!field.enumValues.includes(envValue)) {
          console.warn(
            `Config warning: ${envVarName}="${envValue}" is not valid. ` +
              `Allowed values: ${field.enumValues.join(", ")}. Using default.`,
          );
          continue;
        }
      }

      const coercedValue = coerceValue(envValue, field.type, envVarName);
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

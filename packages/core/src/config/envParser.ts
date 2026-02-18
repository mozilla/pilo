/**
 * Environment Variable Parser
 *
 * Parses environment variables into a partial SparkConfig object.
 * Node.js only (uses process.env).
 */

import { FIELDS, type SparkConfig, type ConfigFieldType } from "./defaults.js";

/**
 * Coerce a string value to the appropriate type.
 */
function coerceValue(
  value: string,
  type: ConfigFieldType,
  envVar?: string,
): string | number | boolean | undefined {
  switch (type) {
    case "boolean": {
      const lower = value.toLowerCase();
      const truthy = ["true", "1", "yes", "on"];
      const falsy = ["false", "0", "no", "off"];
      if (truthy.includes(lower)) return true;
      if (falsy.includes(lower)) return false;
      if (envVar) {
        console.warn(
          `Config warning: ${envVar}="${value}" is not a valid boolean (true/false), using default`,
        );
      }
      return undefined;
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
 * Parse environment variables into a partial SparkConfig object.
 */
export function parseEnvConfig(): Partial<SparkConfig> {
  const result: Record<string, unknown> = {};

  for (const [key, field] of Object.entries(FIELDS)) {
    // Find first set env var
    let envValue: string | undefined;
    let envVarName: string | undefined;
    for (const envVar of field.env) {
      const val = process.env[envVar];
      if (val !== undefined) {
        envValue = val;
        envVarName = envVar;
        break;
      }
    }

    if (envValue !== undefined && envVarName) {
      // Validate enum values
      if (field.type === "enum" && field.values) {
        if (!field.values.includes(envValue)) {
          console.warn(
            `Config warning: ${envVarName}="${envValue}" is not valid. ` +
              `Allowed values: ${field.values.join(", ")}. Using default.`,
          );
          continue;
        }
      }

      const coerced = coerceValue(envValue, field.type, envVarName);
      if (coerced !== undefined) {
        result[key] = coerced;
      }
    }
  }

  return result as Partial<SparkConfig>;
}

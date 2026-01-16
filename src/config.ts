/**
 * Configuration System - Node.js
 *
 * Full config functionality including file I/O, env parsing, and CLI generation.
 * Re-exports browser-compatible types and defaults from configDefaults.ts.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { config as loadDotenv } from "dotenv";
import { Command, Option } from "commander";

// Re-export everything from browser-compatible module
export {
  PROVIDERS,
  BROWSERS,
  REASONING_LEVELS,
  LOGGERS,
  FIELDS,
  DEFAULTS,
  CONFIG_SCHEMA,
  getConfigDefaults,
  getSchemaField,
  getSchemaFieldsByCategory,
  getCliFields,
  getEnvFields,
  getSchemaConfigKeys,
} from "./configDefaults.js";

export type {
  Provider,
  Browser,
  ReasoningLevel,
  LoggerType,
  ConfigFieldType,
  ConfigCategory,
  SparkConfig,
  SparkConfigResolved,
  ConfigKey,
  FieldDef,
  ConfigField,
} from "./configDefaults.js";

// Import for internal use
import {
  FIELDS,
  DEFAULTS,
  type SparkConfig,
  type SparkConfigResolved,
  type ConfigFieldType,
  type FieldDef,
} from "./configDefaults.js";

// =============================================================================
// Environment Variable Parsing (Node.js only - uses process.env)
// =============================================================================

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

// =============================================================================
// CLI Option Generation (Node.js only - uses Commander)
// =============================================================================

/**
 * Build CLI option flags from a field definition.
 */
function buildOptionFlags(field: FieldDef): string {
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

    // Set default value
    if (field.default !== undefined) {
      option.default(field.default);
    }

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

// =============================================================================
// Config Manager (Node.js only - uses fs, path, os, dotenv)
// =============================================================================

export class ConfigManager {
  private static instance: ConfigManager;
  private configPath: string;
  private configDir: string;

  private constructor() {
    const platform = process.platform;
    if (platform === "win32") {
      this.configDir = join(process.env.APPDATA || join(homedir(), "AppData", "Roaming"), "spark");
    } else {
      this.configDir = join(homedir(), ".spark");
    }
    this.configPath = join(this.configDir, "config.json");
  }

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  /**
   * Get the full merged configuration from all sources.
   * Priority: Environment Variables > Local .env > Global Config
   */
  public getConfig(): SparkConfigResolved {
    const globalConfig = this.getGlobalConfig();

    // Load local .env file if it exists
    try {
      loadDotenv({ path: ".env", quiet: true });
    } catch {
      // Ignore if .env doesn't exist
    }

    const envConfig = parseEnvConfig();

    // Merge: defaults < global config < env vars
    const merged = {
      ...DEFAULTS,
      ...globalConfig,
      ...envConfig,
    };

    return merged as SparkConfigResolved;
  }

  /**
   * Get only the global config file contents
   */
  public getGlobalConfig(): SparkConfig {
    try {
      if (existsSync(this.configPath)) {
        const configContent = readFileSync(this.configPath, "utf-8");
        return JSON.parse(configContent);
      }
    } catch (error) {
      console.warn(
        `Warning: Could not read config file: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    return {};
  }

  /**
   * Set a value in the global config file
   */
  public setGlobalConfig(key: keyof SparkConfig, value: unknown): void {
    if (!existsSync(this.configDir)) {
      mkdirSync(this.configDir, { recursive: true });
    }

    const currentConfig = this.getGlobalConfig();
    const newConfig = { ...currentConfig, [key]: value };

    try {
      writeFileSync(this.configPath, JSON.stringify(newConfig, null, 2), "utf-8");
    } catch (error) {
      throw new Error(
        `Failed to write config: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Get a specific config value
   */
  public get<K extends keyof SparkConfigResolved>(key: K): SparkConfigResolved[K] {
    return this.getConfig()[key];
  }

  /**
   * Set a global config value
   */
  public set<K extends keyof SparkConfig>(key: K, value: SparkConfig[K]): void {
    this.setGlobalConfig(key, value);
  }

  /**
   * Get the path to the global config file
   */
  public getConfigPath(): string {
    return this.configPath;
  }

  /**
   * Delete a key from the global config
   */
  public unset(key: keyof SparkConfig): void {
    const currentConfig = this.getGlobalConfig();
    delete currentConfig[key];

    try {
      writeFileSync(this.configPath, JSON.stringify(currentConfig, null, 2), "utf-8");
    } catch (error) {
      throw new Error(
        `Failed to write config: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * List all config sources and their values
   */
  public listSources(): {
    global: Partial<SparkConfig>;
    env: Partial<SparkConfig>;
    merged: SparkConfigResolved;
  } {
    const global = this.getGlobalConfig();
    const env = parseEnvConfig();
    const merged = this.getConfig();
    return { global, env, merged };
  }
}

/** Singleton config manager instance */
export const config = ConfigManager.getInstance();

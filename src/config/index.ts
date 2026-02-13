/**
 * Configuration System - Node.js
 *
 * Full config functionality including file I/O, env parsing, and CLI generation.
 * Re-exports browser-compatible types and defaults from defaults.ts.
 */

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
} from "./defaults.js";

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
} from "./defaults.js";

// Export environment variable parsing
export { parseEnvConfig } from "./envParser.js";

// Export CLI option generation
export { addConfigOptions, addSchemaOptions } from "./helpers.js";

// Export ConfigManager class and singleton instance
export { ConfigManager, config } from "./ConfigManager.js";

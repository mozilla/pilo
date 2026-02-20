/**
 * Configuration System - Node.js
 *
 * Full config functionality including file I/O, env parsing, and CLI generation.
 * Re-exports browser-compatible types and defaults from config/defaults.ts.
 */

// Re-export everything from browser-compatible module
export {
  PROVIDERS,
  BROWSERS,
  REASONING_LEVELS,
  LOGGERS,
  SEARCH_PROVIDERS,
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
  SearchProviderName,
  ConfigFieldType,
  ConfigCategory,
  SparkConfig,
  SparkConfigResolved,
  ConfigKey,
  FieldDef,
  ConfigField,
} from "./defaults.js";

// Environment variable parsing
export { parseEnvConfig } from "./env.js";

// CLI option generation
export { addConfigOptions, addSchemaOptions } from "./commander.js";

// Config manager and singleton
export { ConfigManager, config, isProduction } from "./manager.js";

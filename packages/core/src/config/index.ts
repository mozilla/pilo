/**
 * Configuration System
 *
 * Re-exports all config functionality from modular components.
 * This file maintains backward compatibility for existing imports.
 */

// Re-export browser-compatible types and defaults
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

// Re-export environment variable parser
export { parseEnvConfig } from "./envParser.js";

// Re-export CLI option helpers
export { addConfigOptions, addSchemaOptions } from "./helpers.js";

// Re-export global config file operations
export {
  getConfigPath,
  getGlobalConfig,
  setGlobalConfig,
  unsetGlobalConfig,
} from "./globalConfig.js";

// Re-export config manager and singleton
export { ConfigManager, config } from "./configManager.js";

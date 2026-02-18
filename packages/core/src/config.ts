/**
 * Configuration System - Facade
 *
 * Backward compatibility re-exports for existing imports.
 * New code should import directly from config/* modules.
 */

// Re-export everything from defaults
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
} from "./config/defaults.js";

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
} from "./config/defaults.js";

// Re-export environment variable parsing
export { parseEnvConfig } from "./config/envParser.js";

// Re-export CLI option generation
export { addConfigOptions, addSchemaOptions } from "./config/helpers.js";

// Re-export ConfigManager class and singleton instance
export { ConfigManager, config } from "./config/configManager.js";

// Re-export global config functions
export {
  getConfigDir,
  getConfigPath,
  readGlobalConfig,
  writeGlobalConfig,
  deleteGlobalConfigKey,
} from "./config/globalConfig.js";

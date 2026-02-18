/**
 * Config Schema - Backward Compatibility Shim
 *
 * This file re-exports from config/defaults.js for backward compatibility.
 * New code should import directly from config/defaults.js.
 */

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

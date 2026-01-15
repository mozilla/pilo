/**
 * Unified configuration system.
 *
 * Re-exports all schema-driven config utilities from a single entry point.
 */

// Schema definitions
export {
  CONFIG_SCHEMA,
  getSchemaField,
  getSchemaFieldsByCategory,
  getCliFields,
  getEnvFields,
  type ConfigField,
  type ConfigFieldType,
  type ConfigCategory,
} from "./schema.js";

// Type utilities
export { isValidFieldType, isValidCategory, type FieldTypeToTS } from "./types.js";

// Environment variable parsing
export {
  parseEnvConfig,
  hasEnvValue,
  getEnvVarNames,
  coerceValue,
  getEnvValue,
} from "./envParser.js";

// CLI option generation
export {
  addSchemaOptions,
  createOption,
  buildOptionFlags,
  getCliDefault,
  parseCliOptions,
  cliOptionToConfigKey,
  configKeyToCliOption,
} from "./cliGenerator.js";

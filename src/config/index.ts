/**
 * Unified configuration system.
 *
 * Re-exports all config utilities from a single entry point.
 *
 * Structure:
 * - schema.ts: Zod schema (single source of truth for types and defaults)
 * - metadata.ts: CLI/env metadata for config fields
 * - manager.ts: ConfigManager class for loading/saving config
 * - envParser.ts: Environment variable parsing
 * - cliGenerator.ts: CLI option generation
 * - constants.ts: Internal constants (not part of config schema)
 * - types.ts: Type utilities and guards
 */

// Zod schema and types (single source of truth)
export {
  SparkConfigSchema,
  type SparkConfig,
  type SparkConfigResolved,
  type ConfigKey,
  type ConfigFieldType,
  getConfigDefaults,
  getZodFieldType,
  getZodEnumValues,
} from "./schema.js";

// CLI/env metadata
export {
  CONFIG_SCHEMA,
  CONFIG_METADATA,
  type ConfigField,
  type ConfigFieldMeta,
  type ConfigCategory,
  getSchemaField,
  getSchemaFieldsByCategory,
  getCliFields,
  getEnvFields,
  getSchemaConfigKeys,
} from "./metadata.js";

// Config manager
export { ConfigManager, config } from "./manager.js";

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

// Internal constants (not part of config schema)
export {
  DEFAULT_MAX_CONSECUTIVE_ERRORS,
  DEFAULT_MAX_TOTAL_ERRORS,
  DEFAULT_GENERATION_MAX_TOKENS,
  DEFAULT_PLANNING_MAX_TOKENS,
  DEFAULT_VALIDATION_MAX_TOKENS,
  DEFAULT_RETRY_MAX_ATTEMPTS,
  DEFAULT_RETRY_INITIAL_DELAY_MS,
  DEFAULT_RETRY_MAX_DELAY_MS,
  DEFAULT_RETRY_BACKOFF_FACTOR,
} from "./constants.js";

// Type utilities
export { isValidFieldType, isValidCategory, type FieldTypeToTS } from "./types.js";

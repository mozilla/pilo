/**
 * Spark - AI-powered web automation library
 *
 * This is the main entry point for the Spark library.
 * Import this module to use Spark programmatically in your applications.
 */

// Re-export everything from core (platform-agnostic)
export * from "./core.js";

// Add Node.js-specific exports
export { PlaywrightBrowser } from "./browser/playwrightBrowser.js";
export type {
  PlaywrightBrowserOptions,
  ExtendedPlaywrightBrowserOptions,
} from "./browser/playwrightBrowser.js";
export { ChalkConsoleLogger } from "./loggers/chalkConsole.js";

// Configuration and Provider System
export {
  config,
  ConfigManager,
  CONFIG_SCHEMA,
  FIELDS,
  DEFAULTS,
  PROVIDERS,
  BROWSERS,
  REASONING_LEVELS,
  LOGGERS,
  getSchemaField,
  getSchemaFieldsByCategory,
  getCliFields,
  getEnvFields,
  getSchemaConfigKeys,
  parseEnvConfig,
  addSchemaOptions,
  addConfigOptions,
} from "./config/index.js";
export type {
  SparkConfig,
  SparkConfigResolved,
  ConfigField,
  FieldDef,
  ConfigFieldType,
  ConfigCategory,
  Provider,
  Browser,
  ReasoningLevel,
  LoggerType,
} from "./config/index.js";
export { createAIProvider, getAIProviderInfo } from "./provider.js";
export type { ProviderConfig } from "./provider.js";

// Build Mode Detection
export { SPARK_BUILD_MODE, isProductionBuild, isDevelopmentMode } from "./buildMode.js";

// Config merge utilities
export { mergeWithDefaults, createNavigationRetryConfig } from "./utils/configMerge.js";

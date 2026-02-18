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
export { config, ConfigManager } from "./config/configManager.js";
export {
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
} from "./config/defaults.js";
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
} from "./config/defaults.js";
export { parseEnvConfig } from "./config/envParser.js";
export { addSchemaOptions, addConfigOptions } from "./config/helpers.js";
export { createAIProvider, getAIProviderInfo } from "./provider.js";
export type { ProviderConfig } from "./provider.js";

// Config merge utilities
export { mergeWithDefaults, createNavigationRetryConfig } from "./utils/configMerge.js";

// Build mode detection
export { isProductionMode, isDevelopmentMode, getBuildMode } from "./buildMode.js";

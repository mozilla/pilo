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
export { config, ConfigManager } from "./config.js";
export type { SparkConfig } from "./config.js";
export { createAIProvider, getAIProviderInfo } from "./provider.js";
export type { ProviderConfig } from "./provider.js";

// Config merge utilities
export { mergeWithDefaults, createNavigationRetryConfig } from "./utils/configMerge.js";

// Config schema utilities
export {
  CONFIG_SCHEMA,
  getSchemaField,
  getSchemaFieldsByCategory,
  getCliFields,
  getEnvFields,
  parseEnvConfig,
  addSchemaOptions,
  parseCliOptions,
} from "./config/index.js";
export type { ConfigField, ConfigFieldType, ConfigCategory } from "./config/index.js";

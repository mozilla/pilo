/**
 * Pilo - AI-powered web automation library
 *
 * This is the main entry point for the Pilo library.
 * Import this module to use Pilo programmatically in your applications.
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

// Additional loggers (not in core.ts re-exports)
export { MetricsCollector } from "./loggers/metricsCollector.js";
export { SecretsRedactor } from "./loggers/secretsRedactor.js";

// Configuration and Provider System
export {
  config,
  ConfigManager,
  isProduction,
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
  getConfigDefaults,
  parseEnvConfig,
  addSchemaOptions,
  addConfigOptions,
} from "./config/index.js";
export type {
  PiloConfig,
  PiloConfigResolved,
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

// Config merge utilities
export { mergeWithDefaults, createNavigationRetryConfig } from "./utils/configMerge.js";

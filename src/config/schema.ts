/**
 * Unified Configuration Schema
 *
 * Uses Zod as the single source of truth for config types and defaults.
 * CLI/env metadata is defined separately but kept in sync via TypeScript.
 */

import { z } from "zod";
import {
  DEFAULT_PROVIDER,
  DEFAULT_BROWSER,
  DEFAULT_HEADLESS,
  DEFAULT_BLOCK_ADS,
  DEFAULT_BLOCK_RESOURCES,
  DEFAULT_BYPASS_CSP,
  DEFAULT_DEBUG,
  DEFAULT_VISION,
  DEFAULT_MAX_ITERATIONS,
  DEFAULT_MAX_VALIDATION_ATTEMPTS,
  DEFAULT_MAX_REPEATED_ACTIONS,
  DEFAULT_REASONING_EFFORT,
  DEFAULT_NAVIGATION_BASE_TIMEOUT_MS,
  DEFAULT_NAVIGATION_MAX_TIMEOUT_MS,
  DEFAULT_NAVIGATION_MAX_ATTEMPTS,
  DEFAULT_NAVIGATION_TIMEOUT_MULTIPLIER,
  DEFAULT_ACTION_TIMEOUT_MS,
  DEFAULT_LOGGER,
  DEFAULT_METRICS_INCREMENTAL,
} from "../defaults.js";

// =============================================================================
// Zod Schema - Single Source of Truth for Types and Defaults
// =============================================================================

const PROVIDERS = [
  "openai",
  "openrouter",
  "vertex",
  "ollama",
  "openai-compatible",
  "lmstudio",
  "google",
] as const;
const BROWSERS = ["firefox", "chrome", "chromium", "safari", "webkit", "edge"] as const;
const REASONING_LEVELS = ["none", "low", "medium", "high"] as const;
const LOGGERS = ["console", "json"] as const;

/** The Zod schema defining all config fields, types, and defaults */
export const SparkConfigSchema = z.object({
  // AI Configuration
  provider: z.enum(PROVIDERS).default(DEFAULT_PROVIDER),
  model: z.string().optional(),
  openai_api_key: z.string().optional(),
  openrouter_api_key: z.string().optional(),
  google_generative_ai_api_key: z.string().optional(),
  vertex_project: z.string().optional(),
  vertex_location: z.string().optional(),
  ollama_base_url: z.string().optional(),
  openai_compatible_base_url: z.string().optional(),
  openai_compatible_name: z.string().optional(),
  reasoning_effort: z.enum(REASONING_LEVELS).default(DEFAULT_REASONING_EFFORT),

  // Browser Configuration
  browser: z.enum(BROWSERS).default(DEFAULT_BROWSER),
  channel: z.string().optional(),
  executable_path: z.string().optional(),
  headless: z.boolean().default(DEFAULT_HEADLESS),
  block_ads: z.boolean().default(DEFAULT_BLOCK_ADS),
  block_resources: z.string().default(DEFAULT_BLOCK_RESOURCES),

  // Proxy Configuration
  proxy: z.string().optional(),
  proxy_username: z.string().optional(),
  proxy_password: z.string().optional(),

  // Logging Configuration
  logger: z.enum(LOGGERS).default(DEFAULT_LOGGER),
  metrics_incremental: z.boolean().default(DEFAULT_METRICS_INCREMENTAL),

  // Agent Configuration
  debug: z.boolean().default(DEFAULT_DEBUG),
  vision: z.boolean().default(DEFAULT_VISION),
  max_iterations: z.number().default(DEFAULT_MAX_ITERATIONS),
  max_validation_attempts: z.number().default(DEFAULT_MAX_VALIDATION_ATTEMPTS),
  max_repeated_actions: z.number().default(DEFAULT_MAX_REPEATED_ACTIONS),
  starting_url: z.string().optional(),
  data: z.string().optional(),
  guardrails: z.string().optional(),

  // Playwright Configuration
  pw_endpoint: z.string().optional(),
  pw_cdp_endpoint: z.string().optional(),
  bypass_csp: z.boolean().default(DEFAULT_BYPASS_CSP),

  // Navigation Configuration
  navigation_timeout_ms: z.number().default(DEFAULT_NAVIGATION_BASE_TIMEOUT_MS),
  navigation_max_timeout_ms: z.number().default(DEFAULT_NAVIGATION_MAX_TIMEOUT_MS),
  navigation_max_attempts: z.number().default(DEFAULT_NAVIGATION_MAX_ATTEMPTS),
  navigation_timeout_multiplier: z.number().default(DEFAULT_NAVIGATION_TIMEOUT_MULTIPLIER),

  // Action Configuration
  action_timeout_ms: z.number().default(DEFAULT_ACTION_TIMEOUT_MS),
});

/** SparkConfig type - input type (all optional, before defaults applied) */
export type SparkConfig = z.input<typeof SparkConfigSchema>;

/** SparkConfigResolved type - output type (defaults applied) */
export type SparkConfigResolved = z.output<typeof SparkConfigSchema>;

/** All config field keys */
export type ConfigKey = keyof SparkConfigResolved;

/** Get all defaults by parsing an empty object */
export function getConfigDefaults(): SparkConfigResolved {
  return SparkConfigSchema.parse({});
}

// =============================================================================
// Type Derivation from Zod Schema
// =============================================================================

export type ConfigFieldType = "string" | "number" | "boolean" | "enum";

/** Derive the field type from the Zod schema */
export function getZodFieldType(key: ConfigKey): ConfigFieldType {
  // Determine type by checking the default value type
  const defaults = getConfigDefaults();
  const value = defaults[key];

  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";

  // Check if it's an enum by looking at the enumMap (single source of truth)
  if (getZodEnumValues(key) !== undefined) return "enum";

  return "string";
}

/** Get enum values for a field if applicable */
export function getZodEnumValues(key: ConfigKey): readonly string[] | undefined {
  const enumMap: Partial<Record<ConfigKey, readonly string[]>> = {
    provider: PROVIDERS,
    browser: BROWSERS,
    reasoning_effort: REASONING_LEVELS,
    logger: LOGGERS,
  };
  return enumMap[key];
}

// =============================================================================
// CLI/Env Metadata - Separate from Zod (Zod doesn't handle CLI concerns)
// =============================================================================

export type ConfigCategory =
  | "ai"
  | "browser"
  | "proxy"
  | "logging"
  | "agent"
  | "playwright"
  | "navigation"
  | "action";

/** Metadata for a config field (CLI options, env vars, etc.) - type/enumValues derived from Zod */
export interface ConfigFieldMeta {
  cliOption?: string;
  cliShortOption?: string;
  placeholder?: string;
  envVars: string[];
  description: string;
  category: ConfigCategory;
  negatable?: boolean;
}

/** CLI/env metadata for all config fields */
export const CONFIG_METADATA: Record<ConfigKey, ConfigFieldMeta> = {
  // AI Configuration
  provider: {
    cliOption: "--provider",
    placeholder: "name",
    envVars: ["SPARK_PROVIDER"],
    description: "AI provider to use",
    category: "ai",
  },
  model: {
    cliOption: "--model",
    placeholder: "name",
    envVars: ["SPARK_MODEL"],
    description: "AI model to use",
    category: "ai",
  },
  openai_api_key: {
    cliOption: "--openai-api-key",
    placeholder: "key",
    envVars: ["OPENAI_API_KEY"],
    description: "OpenAI API key",
    category: "ai",
  },
  openrouter_api_key: {
    cliOption: "--openrouter-api-key",
    placeholder: "key",
    envVars: ["OPENROUTER_API_KEY"],
    description: "OpenRouter API key",
    category: "ai",
  },
  google_generative_ai_api_key: {
    envVars: ["GOOGLE_GENERATIVE_AI_API_KEY"],
    description: "Google Generative AI API key",
    category: "ai",
  },
  vertex_project: {
    envVars: ["GOOGLE_VERTEX_PROJECT", "GOOGLE_CLOUD_PROJECT", "GCP_PROJECT"],
    description: "Google Vertex AI project ID",
    category: "ai",
  },
  vertex_location: {
    envVars: ["GOOGLE_VERTEX_LOCATION", "GOOGLE_CLOUD_REGION"],
    description: "Google Vertex AI location",
    category: "ai",
  },
  ollama_base_url: {
    envVars: ["SPARK_OLLAMA_BASE_URL"],
    description: "Ollama base URL",
    category: "ai",
  },
  openai_compatible_base_url: {
    envVars: ["SPARK_OPENAI_COMPATIBLE_BASE_URL"],
    description: "OpenAI-compatible API base URL",
    category: "ai",
  },
  openai_compatible_name: {
    envVars: ["SPARK_OPENAI_COMPATIBLE_NAME"],
    description: "OpenAI-compatible provider name",
    category: "ai",
  },
  reasoning_effort: {
    cliOption: "--reasoning-effort",
    placeholder: "level",
    envVars: ["SPARK_REASONING_EFFORT"],
    description: "Reasoning effort level",
    category: "ai",
  },

  // Browser Configuration
  browser: {
    cliOption: "--browser",
    cliShortOption: "-b",
    placeholder: "name",
    envVars: ["SPARK_BROWSER"],
    description: "Browser to use",
    category: "browser",
  },
  channel: {
    cliOption: "--channel",
    placeholder: "name",
    envVars: ["SPARK_CHANNEL"],
    description: "Browser channel (e.g., chrome, msedge, chrome-beta)",
    category: "browser",
  },
  executable_path: {
    cliOption: "--executable-path",
    placeholder: "path",
    envVars: ["SPARK_EXECUTABLE_PATH"],
    description: "Path to browser executable",
    category: "browser",
  },
  headless: {
    cliOption: "--headless",
    envVars: ["SPARK_HEADLESS"],
    description: "Run browser in headless mode",
    category: "browser",
  },
  block_ads: {
    cliOption: "--block-ads",
    envVars: ["SPARK_BLOCK_ADS"],
    description: "Enable ad blocking",
    category: "browser",
    negatable: true,
  },
  block_resources: {
    cliOption: "--block-resources",
    placeholder: "types",
    envVars: ["SPARK_BLOCK_RESOURCES"],
    description: "Comma-separated list of resources to block",
    category: "browser",
  },

  // Proxy Configuration
  proxy: {
    cliOption: "--proxy",
    placeholder: "url",
    envVars: ["SPARK_PROXY"],
    description: "Proxy server URL (http, https, or socks5)",
    category: "proxy",
  },
  proxy_username: {
    cliOption: "--proxy-username",
    placeholder: "user",
    envVars: ["SPARK_PROXY_USERNAME"],
    description: "Proxy authentication username",
    category: "proxy",
  },
  proxy_password: {
    cliOption: "--proxy-password",
    placeholder: "pass",
    envVars: ["SPARK_PROXY_PASSWORD"],
    description: "Proxy authentication password",
    category: "proxy",
  },

  // Logging Configuration
  logger: {
    cliOption: "--logger",
    placeholder: "type",
    envVars: ["SPARK_LOGGER"],
    description: "Logger to use",
    category: "logging",
  },
  metrics_incremental: {
    cliOption: "--metrics-incremental",
    envVars: ["SPARK_METRICS_INCREMENTAL"],
    description: "Show incremental metrics updates",
    category: "logging",
  },

  // Agent Configuration
  debug: {
    cliOption: "--debug",
    envVars: ["SPARK_DEBUG"],
    description: "Enable debug mode with page snapshots",
    category: "agent",
  },
  vision: {
    cliOption: "--vision",
    envVars: ["SPARK_VISION"],
    description: "Enable vision capabilities to include screenshots",
    category: "agent",
  },
  max_iterations: {
    cliOption: "--max-iterations",
    placeholder: "n",
    envVars: ["SPARK_MAX_ITERATIONS"],
    description: "Maximum total iterations to prevent infinite loops",
    category: "agent",
  },
  max_validation_attempts: {
    cliOption: "--max-validation-attempts",
    placeholder: "n",
    envVars: ["SPARK_MAX_VALIDATION_ATTEMPTS"],
    description: "Maximum validation attempts",
    category: "agent",
  },
  max_repeated_actions: {
    cliOption: "--max-repeated-actions",
    placeholder: "n",
    envVars: ["SPARK_MAX_REPEATED_ACTIONS"],
    description: "Maximum times an action can be repeated before warning",
    category: "agent",
  },
  starting_url: {
    cliOption: "--url",
    cliShortOption: "-u",
    placeholder: "url",
    envVars: ["SPARK_STARTING_URL"],
    description: "Starting URL for the task",
    category: "agent",
  },
  data: {
    cliOption: "--data",
    cliShortOption: "-d",
    placeholder: "json",
    envVars: ["SPARK_DATA"],
    description: "JSON data to provide context for the task",
    category: "agent",
  },
  guardrails: {
    cliOption: "--guardrails",
    cliShortOption: "-g",
    placeholder: "text",
    envVars: ["SPARK_GUARDRAILS"],
    description: "Safety constraints for the task execution",
    category: "agent",
  },

  // Playwright Configuration
  pw_endpoint: {
    cliOption: "--pw-endpoint",
    placeholder: "url",
    envVars: ["SPARK_PW_ENDPOINT"],
    description: "Playwright endpoint URL to connect to remote browser",
    category: "playwright",
  },
  pw_cdp_endpoint: {
    cliOption: "--pw-cdp-endpoint",
    placeholder: "url",
    envVars: ["SPARK_PW_CDP_ENDPOINT"],
    description: "Chrome DevTools Protocol endpoint URL (chromium only)",
    category: "playwright",
  },
  bypass_csp: {
    cliOption: "--bypass-csp",
    envVars: ["SPARK_BYPASS_CSP"],
    description: "Bypass Content Security Policy",
    category: "playwright",
  },

  // Navigation Configuration
  navigation_timeout_ms: {
    cliOption: "--navigation-timeout-ms",
    placeholder: "ms",
    envVars: ["SPARK_NAVIGATION_TIMEOUT_MS"],
    description: "Base navigation timeout in milliseconds",
    category: "navigation",
  },
  navigation_max_timeout_ms: {
    cliOption: "--navigation-max-timeout-ms",
    placeholder: "ms",
    envVars: ["SPARK_NAVIGATION_MAX_TIMEOUT_MS"],
    description: "Maximum timeout for navigation retries in milliseconds",
    category: "navigation",
  },
  navigation_max_attempts: {
    cliOption: "--navigation-max-attempts",
    placeholder: "n",
    envVars: ["SPARK_NAVIGATION_MAX_ATTEMPTS"],
    description: "Maximum navigation attempts (e.g., 3 = try up to 3 times)",
    category: "navigation",
  },
  navigation_timeout_multiplier: {
    cliOption: "--navigation-timeout-multiplier",
    placeholder: "n",
    envVars: ["SPARK_NAVIGATION_TIMEOUT_MULTIPLIER"],
    description: "Timeout multiplier for each retry (e.g., 2 = 30s → 60s → 120s)",
    category: "navigation",
  },

  // Action Configuration
  action_timeout_ms: {
    cliOption: "--action-timeout-ms",
    placeholder: "ms",
    envVars: ["SPARK_ACTION_TIMEOUT_MS"],
    description: "Timeout for page load and element actions in milliseconds",
    category: "action",
  },
};

// =============================================================================
// Legacy CONFIG_SCHEMA Array (for backward compatibility with cliGenerator)
// =============================================================================

/** Full config field with all derived properties (type, enumValues from Zod) */
export interface ConfigField extends ConfigFieldMeta {
  configKey: ConfigKey;
  type: ConfigFieldType;
  enumValues?: readonly string[];
  defaultValue?: unknown;
}

/** CONFIG_SCHEMA array - combines metadata with type/enumValues/defaults from Zod */
export const CONFIG_SCHEMA: ConfigField[] = (() => {
  const defaults = getConfigDefaults();
  return (Object.keys(CONFIG_METADATA) as ConfigKey[]).map((key) => ({
    configKey: key,
    ...CONFIG_METADATA[key],
    type: getZodFieldType(key),
    enumValues: getZodEnumValues(key),
    defaultValue: defaults[key],
  }));
})();

// =============================================================================
// Helper Functions
// =============================================================================

export function getSchemaField(configKey: string): ConfigField | undefined {
  return CONFIG_SCHEMA.find((field) => field.configKey === configKey);
}

export function getSchemaFieldsByCategory(category: ConfigCategory): ConfigField[] {
  return CONFIG_SCHEMA.filter((field) => field.category === category);
}

export function getCliFields(): ConfigField[] {
  return CONFIG_SCHEMA.filter((field) => field.cliOption !== undefined);
}

export function getEnvFields(): ConfigField[] {
  return CONFIG_SCHEMA.filter((field) => field.envVars.length > 0);
}

export function getSchemaConfigKeys(): ConfigKey[] {
  return Object.keys(CONFIG_METADATA) as ConfigKey[];
}

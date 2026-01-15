/**
 * Unified Configuration Schema
 *
 * Single source of truth for all configuration options.
 * Defines config keys, CLI options, environment variables, defaults, and types.
 */

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

export type ConfigFieldType = "string" | "number" | "boolean" | "enum";

export type ConfigCategory =
  | "ai"
  | "browser"
  | "proxy"
  | "logging"
  | "agent"
  | "playwright"
  | "navigation"
  | "action";

export interface ConfigField<T = unknown> {
  /** Config file key (snake_case) - also used as SparkConfig property */
  configKey: string;
  /** CLI option flag (--kebab-case), undefined if not exposed via CLI */
  cliOption?: string;
  /** CLI option short flag (-x) */
  cliShortOption?: string;
  /** Environment variable names to check (in priority order) */
  envVars: string[];
  /** Default value from defaults.ts */
  defaultValue?: T;
  /** Value type for parsing and validation */
  type: ConfigFieldType;
  /** Valid values for enum type */
  enumValues?: readonly string[];
  /** Description for CLI help text */
  description: string;
  /** Category for grouping */
  category: ConfigCategory;
  /** Whether this is a negatable boolean (e.g., --no-block-ads) */
  negatable?: boolean;
}

/**
 * Complete configuration schema.
 * Order matches the SparkConfig interface.
 */
export const CONFIG_SCHEMA: ConfigField[] = [
  // ============================================================================
  // AI Configuration
  // ============================================================================
  {
    configKey: "provider",
    cliOption: "--provider",
    envVars: ["SPARK_PROVIDER"],
    defaultValue: DEFAULT_PROVIDER,
    type: "enum",
    enumValues: [
      "openai",
      "openrouter",
      "vertex",
      "ollama",
      "openai-compatible",
      "lmstudio",
      "google",
    ] as const,
    description: "AI provider to use",
    category: "ai",
  },
  {
    configKey: "model",
    cliOption: "--model",
    envVars: ["SPARK_MODEL"],
    type: "string",
    description: "AI model to use",
    category: "ai",
  },
  {
    configKey: "openai_api_key",
    cliOption: "--openai-api-key",
    envVars: ["OPENAI_API_KEY"],
    type: "string",
    description: "OpenAI API key",
    category: "ai",
  },
  {
    configKey: "openrouter_api_key",
    cliOption: "--openrouter-api-key",
    envVars: ["OPENROUTER_API_KEY"],
    type: "string",
    description: "OpenRouter API key",
    category: "ai",
  },
  {
    configKey: "google_generative_ai_api_key",
    envVars: ["GOOGLE_GENERATIVE_AI_API_KEY"],
    type: "string",
    description: "Google Generative AI API key",
    category: "ai",
  },
  {
    configKey: "vertex_project",
    envVars: ["GOOGLE_VERTEX_PROJECT", "GOOGLE_CLOUD_PROJECT", "GCP_PROJECT"],
    type: "string",
    description: "Google Vertex AI project ID",
    category: "ai",
  },
  {
    configKey: "vertex_location",
    envVars: ["GOOGLE_VERTEX_LOCATION", "GOOGLE_CLOUD_REGION"],
    type: "string",
    description: "Google Vertex AI location",
    category: "ai",
  },
  {
    configKey: "ollama_base_url",
    envVars: ["SPARK_OLLAMA_BASE_URL"],
    type: "string",
    description: "Ollama base URL",
    category: "ai",
  },
  {
    configKey: "openai_compatible_base_url",
    envVars: ["SPARK_OPENAI_COMPATIBLE_BASE_URL"],
    type: "string",
    description: "OpenAI-compatible API base URL",
    category: "ai",
  },
  {
    configKey: "openai_compatible_name",
    envVars: ["SPARK_OPENAI_COMPATIBLE_NAME"],
    type: "string",
    description: "OpenAI-compatible provider name",
    category: "ai",
  },
  {
    configKey: "reasoning_effort",
    cliOption: "--reasoning-effort",
    envVars: ["SPARK_REASONING_EFFORT"],
    defaultValue: DEFAULT_REASONING_EFFORT,
    type: "enum",
    enumValues: ["none", "low", "medium", "high"] as const,
    description: "Reasoning effort level",
    category: "ai",
  },

  // ============================================================================
  // Browser Configuration
  // ============================================================================
  {
    configKey: "browser",
    cliOption: "--browser",
    cliShortOption: "-b",
    envVars: ["SPARK_BROWSER"],
    defaultValue: DEFAULT_BROWSER,
    type: "enum",
    enumValues: ["firefox", "chrome", "chromium", "safari", "webkit", "edge"] as const,
    description: "Browser to use",
    category: "browser",
  },
  {
    configKey: "channel",
    cliOption: "--channel",
    envVars: ["SPARK_CHANNEL"],
    type: "string",
    description: "Browser channel (e.g., chrome, msedge, chrome-beta)",
    category: "browser",
  },
  {
    configKey: "executable_path",
    cliOption: "--executable-path",
    envVars: ["SPARK_EXECUTABLE_PATH"],
    type: "string",
    description: "Path to browser executable",
    category: "browser",
  },
  {
    configKey: "headless",
    cliOption: "--headless",
    envVars: ["SPARK_HEADLESS"],
    defaultValue: DEFAULT_HEADLESS,
    type: "boolean",
    description: "Run browser in headless mode",
    category: "browser",
  },
  {
    configKey: "block_ads",
    cliOption: "--block-ads",
    envVars: ["SPARK_BLOCK_ADS"],
    defaultValue: DEFAULT_BLOCK_ADS,
    type: "boolean",
    description: "Enable ad blocking",
    category: "browser",
    negatable: true,
  },
  {
    configKey: "block_resources",
    cliOption: "--block-resources",
    envVars: ["SPARK_BLOCK_RESOURCES"],
    defaultValue: DEFAULT_BLOCK_RESOURCES,
    type: "string",
    description: "Comma-separated list of resources to block",
    category: "browser",
  },

  // ============================================================================
  // Proxy Configuration
  // ============================================================================
  {
    configKey: "proxy",
    cliOption: "--proxy",
    envVars: ["SPARK_PROXY"],
    type: "string",
    description: "Proxy server URL (http, https, or socks5)",
    category: "proxy",
  },
  {
    configKey: "proxy_username",
    cliOption: "--proxy-username",
    envVars: ["SPARK_PROXY_USERNAME"],
    type: "string",
    description: "Proxy authentication username",
    category: "proxy",
  },
  {
    configKey: "proxy_password",
    cliOption: "--proxy-password",
    envVars: ["SPARK_PROXY_PASSWORD"],
    type: "string",
    description: "Proxy authentication password",
    category: "proxy",
  },

  // ============================================================================
  // Logging Configuration
  // ============================================================================
  {
    configKey: "logger",
    cliOption: "--logger",
    envVars: ["SPARK_LOGGER"],
    defaultValue: DEFAULT_LOGGER,
    type: "enum",
    enumValues: ["console", "json"] as const,
    description: "Logger to use",
    category: "logging",
  },
  {
    configKey: "metrics_incremental",
    cliOption: "--metrics-incremental",
    envVars: ["SPARK_METRICS_INCREMENTAL"],
    defaultValue: DEFAULT_METRICS_INCREMENTAL,
    type: "boolean",
    description: "Show incremental metrics updates",
    category: "logging",
  },

  // ============================================================================
  // WebAgent Configuration
  // ============================================================================
  {
    configKey: "debug",
    cliOption: "--debug",
    envVars: ["SPARK_DEBUG"],
    defaultValue: DEFAULT_DEBUG,
    type: "boolean",
    description: "Enable debug mode with page snapshots",
    category: "agent",
  },
  {
    configKey: "vision",
    cliOption: "--vision",
    envVars: ["SPARK_VISION"],
    defaultValue: DEFAULT_VISION,
    type: "boolean",
    description: "Enable vision capabilities to include screenshots",
    category: "agent",
  },
  {
    configKey: "max_iterations",
    cliOption: "--max-iterations",
    envVars: ["SPARK_MAX_ITERATIONS"],
    defaultValue: DEFAULT_MAX_ITERATIONS,
    type: "number",
    description: "Maximum total iterations to prevent infinite loops",
    category: "agent",
  },
  {
    configKey: "max_validation_attempts",
    cliOption: "--max-validation-attempts",
    envVars: ["SPARK_MAX_VALIDATION_ATTEMPTS"],
    defaultValue: DEFAULT_MAX_VALIDATION_ATTEMPTS,
    type: "number",
    description: "Maximum validation attempts",
    category: "agent",
  },
  {
    configKey: "max_repeated_actions",
    cliOption: "--max-repeated-actions",
    envVars: ["SPARK_MAX_REPEATED_ACTIONS"],
    defaultValue: DEFAULT_MAX_REPEATED_ACTIONS,
    type: "number",
    description: "Maximum times an action can be repeated before warning",
    category: "agent",
  },
  {
    configKey: "starting_url",
    cliOption: "--url",
    cliShortOption: "-u",
    envVars: ["SPARK_STARTING_URL"],
    type: "string",
    description: "Starting URL for the task",
    category: "agent",
  },
  {
    configKey: "data",
    cliOption: "--data",
    cliShortOption: "-d",
    envVars: ["SPARK_DATA"],
    type: "string",
    description: "JSON data to provide context for the task",
    category: "agent",
  },
  {
    configKey: "guardrails",
    cliOption: "--guardrails",
    cliShortOption: "-g",
    envVars: ["SPARK_GUARDRAILS"],
    type: "string",
    description: "Safety constraints for the task execution",
    category: "agent",
  },

  // ============================================================================
  // Playwright Configuration
  // ============================================================================
  {
    configKey: "pw_endpoint",
    cliOption: "--pw-endpoint",
    envVars: ["SPARK_PW_ENDPOINT"],
    type: "string",
    description: "Playwright endpoint URL to connect to remote browser",
    category: "playwright",
  },
  {
    configKey: "pw_cdp_endpoint",
    cliOption: "--pw-cdp-endpoint",
    envVars: ["SPARK_PW_CDP_ENDPOINT"],
    type: "string",
    description: "Chrome DevTools Protocol endpoint URL (chromium only)",
    category: "playwright",
  },
  {
    configKey: "bypass_csp",
    cliOption: "--bypass-csp",
    envVars: ["SPARK_BYPASS_CSP"],
    defaultValue: DEFAULT_BYPASS_CSP,
    type: "boolean",
    description: "Bypass Content Security Policy",
    category: "playwright",
  },

  // ============================================================================
  // Navigation Configuration
  // ============================================================================
  {
    configKey: "navigation_timeout_ms",
    cliOption: "--navigation-timeout-ms",
    envVars: ["SPARK_NAVIGATION_TIMEOUT_MS"],
    defaultValue: DEFAULT_NAVIGATION_BASE_TIMEOUT_MS,
    type: "number",
    description: "Base navigation timeout in milliseconds",
    category: "navigation",
  },
  {
    configKey: "navigation_max_timeout_ms",
    cliOption: "--navigation-max-timeout-ms",
    envVars: ["SPARK_NAVIGATION_MAX_TIMEOUT_MS"],
    defaultValue: DEFAULT_NAVIGATION_MAX_TIMEOUT_MS,
    type: "number",
    description: "Maximum timeout for navigation retries in milliseconds",
    category: "navigation",
  },
  {
    configKey: "navigation_max_attempts",
    cliOption: "--navigation-max-attempts",
    envVars: ["SPARK_NAVIGATION_MAX_ATTEMPTS"],
    defaultValue: DEFAULT_NAVIGATION_MAX_ATTEMPTS,
    type: "number",
    description: "Maximum navigation attempts (e.g., 3 = try up to 3 times)",
    category: "navigation",
  },
  {
    configKey: "navigation_timeout_multiplier",
    cliOption: "--navigation-timeout-multiplier",
    envVars: ["SPARK_NAVIGATION_TIMEOUT_MULTIPLIER"],
    defaultValue: DEFAULT_NAVIGATION_TIMEOUT_MULTIPLIER,
    type: "number",
    description: "Timeout multiplier for each retry (e.g., 2 = 30s → 60s → 120s)",
    category: "navigation",
  },

  // ============================================================================
  // Action Configuration
  // ============================================================================
  {
    configKey: "action_timeout_ms",
    cliOption: "--action-timeout-ms",
    envVars: ["SPARK_ACTION_TIMEOUT_MS"],
    defaultValue: DEFAULT_ACTION_TIMEOUT_MS,
    type: "number",
    description: "Timeout for page load and element actions in milliseconds",
    category: "action",
  },
];

/**
 * Get a schema field by its config key
 */
export function getSchemaField(configKey: string): ConfigField | undefined {
  return CONFIG_SCHEMA.find((field) => field.configKey === configKey);
}

/**
 * Get all schema fields for a category
 */
export function getSchemaFieldsByCategory(category: ConfigCategory): ConfigField[] {
  return CONFIG_SCHEMA.filter((field) => field.category === category);
}

/**
 * Get all schema fields that have CLI options
 */
export function getCliFields(): ConfigField[] {
  return CONFIG_SCHEMA.filter((field) => field.cliOption !== undefined);
}

/**
 * Get all schema fields that have environment variables
 */
export function getEnvFields(): ConfigField[] {
  return CONFIG_SCHEMA.filter((field) => field.envVars.length > 0);
}

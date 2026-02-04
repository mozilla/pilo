/**
 * Config Schema - Browser-Compatible
 *
 * Types, field definitions, and defaults that can run in any environment.
 *
 * IMPORTANT: This module must remain free of Node.js dependencies.
 * Do NOT import: fs, path, os, dotenv, commander, or access process.env.
 * The browser extension (spark/core) depends on this module being bundleable.
 */

// =============================================================================
// Type Definitions
// =============================================================================

export const PROVIDERS = [
  "openai",
  "openrouter",
  "vertex",
  "ollama",
  "openai-compatible",
  "lmstudio",
  "google",
] as const;
export type Provider = (typeof PROVIDERS)[number];

export const BROWSERS = ["firefox", "chrome", "chromium", "safari", "webkit", "edge"] as const;
export type Browser = (typeof BROWSERS)[number];

export const REASONING_LEVELS = ["none", "low", "medium", "high"] as const;
export type ReasoningLevel = (typeof REASONING_LEVELS)[number];

export const LOGGERS = ["console", "json"] as const;
export type LoggerType = (typeof LOGGERS)[number];

export const SEARCH_PROVIDERS = ["none", "duckduckgo", "google", "bing", "parallel"] as const;
export type SearchProvider = (typeof SEARCH_PROVIDERS)[number];

export type ConfigFieldType = "string" | "number" | "boolean" | "enum";

export type ConfigCategory =
  | "ai"
  | "browser"
  | "proxy"
  | "logging"
  | "agent"
  | "playwright"
  | "navigation"
  | "action"
  | "search";

// =============================================================================
// SparkConfig Interface (Manual for Readability)
// =============================================================================

/** SparkConfig type - input type (all optional, before defaults applied) */
export interface SparkConfig {
  // AI Configuration
  provider?: Provider;
  model?: string;
  openai_api_key?: string;
  openrouter_api_key?: string;
  google_generative_ai_api_key?: string;
  vertex_project?: string;
  vertex_location?: string;
  ollama_base_url?: string;
  openai_compatible_base_url?: string;
  openai_compatible_name?: string;
  reasoning_effort?: ReasoningLevel;

  // Browser Configuration
  browser?: Browser;
  channel?: string;
  executable_path?: string;
  headless?: boolean;
  block_ads?: boolean;
  block_resources?: string;

  // Proxy Configuration
  proxy?: string;
  proxy_username?: string;
  proxy_password?: string;

  // Logging Configuration
  logger?: LoggerType;
  metrics_incremental?: boolean;

  // Agent Configuration
  debug?: boolean;
  vision?: boolean;
  max_iterations?: number;
  max_validation_attempts?: number;
  max_repeated_actions?: number;
  max_consecutive_errors?: number;
  max_total_errors?: number;
  initial_navigation_retries?: number;
  starting_url?: string;
  data?: string;
  guardrails?: string;

  // Playwright Configuration
  pw_endpoint?: string;
  pw_cdp_endpoint?: string;
  bypass_csp?: boolean;

  // Navigation Configuration (timeouts in milliseconds)
  navigation_timeout_ms?: number;
  navigation_max_timeout_ms?: number;
  navigation_max_attempts?: number;
  navigation_timeout_multiplier?: number;

  // Action Configuration
  action_timeout_ms?: number;

  // Search Configuration
  search_provider?: SearchProvider;
  parallel_api_key?: string;
}

/** SparkConfigResolved type - output type (defaults applied) */
export interface SparkConfigResolved {
  // AI Configuration
  provider: Provider;
  model?: string;
  openai_api_key?: string;
  openrouter_api_key?: string;
  google_generative_ai_api_key?: string;
  vertex_project?: string;
  vertex_location?: string;
  ollama_base_url?: string;
  openai_compatible_base_url?: string;
  openai_compatible_name?: string;
  reasoning_effort: ReasoningLevel;

  // Browser Configuration
  browser: Browser;
  channel?: string;
  executable_path?: string;
  headless: boolean;
  block_ads: boolean;
  block_resources: string;

  // Proxy Configuration
  proxy?: string;
  proxy_username?: string;
  proxy_password?: string;

  // Logging Configuration
  logger: LoggerType;
  metrics_incremental: boolean;

  // Agent Configuration
  debug: boolean;
  vision: boolean;
  max_iterations: number;
  max_validation_attempts: number;
  max_repeated_actions: number;
  max_consecutive_errors: number;
  max_total_errors: number;
  initial_navigation_retries: number;
  starting_url?: string;
  data?: string;
  guardrails?: string;

  // Playwright Configuration
  pw_endpoint?: string;
  pw_cdp_endpoint?: string;
  bypass_csp: boolean;

  // Navigation Configuration (timeouts in milliseconds)
  navigation_timeout_ms: number;
  navigation_max_timeout_ms: number;
  navigation_max_attempts: number;
  navigation_timeout_multiplier: number;

  // Action Configuration
  action_timeout_ms: number;

  // Search Configuration
  search_provider: SearchProvider;
  parallel_api_key?: string;
}

export type ConfigKey = keyof SparkConfigResolved;

// =============================================================================
// Field Definition Interface
// =============================================================================

export interface FieldDef {
  default?: unknown;
  type: ConfigFieldType;
  values?: readonly string[];
  cli?: string;
  cliShort?: string;
  placeholder?: string;
  env: string[];
  description: string;
  category: ConfigCategory;
  negatable?: boolean;
}

/** Full config field with configKey included (for iteration) */
export interface ConfigField extends FieldDef {
  configKey: ConfigKey;
  enumValues?: readonly string[];
  defaultValue?: unknown;
}

// =============================================================================
// FIELDS - Single Source of Truth
// =============================================================================

export const FIELDS: Record<ConfigKey, FieldDef> = {
  // AI Configuration
  provider: {
    default: "openai",
    type: "enum",
    values: PROVIDERS,
    cli: "--provider",
    placeholder: "name",
    env: ["SPARK_PROVIDER"],
    description: "AI provider to use",
    category: "ai",
  },
  model: {
    type: "string",
    cli: "--model",
    placeholder: "name",
    env: ["SPARK_MODEL"],
    description: "AI model to use",
    category: "ai",
  },
  openai_api_key: {
    type: "string",
    cli: "--openai-api-key",
    placeholder: "key",
    env: ["OPENAI_API_KEY"],
    description: "OpenAI API key",
    category: "ai",
  },
  openrouter_api_key: {
    type: "string",
    cli: "--openrouter-api-key",
    placeholder: "key",
    env: ["OPENROUTER_API_KEY"],
    description: "OpenRouter API key",
    category: "ai",
  },
  google_generative_ai_api_key: {
    type: "string",
    env: ["GOOGLE_GENERATIVE_AI_API_KEY"],
    description: "Google Generative AI API key",
    category: "ai",
  },
  vertex_project: {
    type: "string",
    env: ["GOOGLE_VERTEX_PROJECT", "GOOGLE_CLOUD_PROJECT", "GCP_PROJECT"],
    description: "Google Vertex AI project ID",
    category: "ai",
  },
  vertex_location: {
    type: "string",
    env: ["GOOGLE_VERTEX_LOCATION", "GOOGLE_CLOUD_REGION"],
    description: "Google Vertex AI location",
    category: "ai",
  },
  ollama_base_url: {
    type: "string",
    env: ["SPARK_OLLAMA_BASE_URL"],
    description: "Ollama base URL",
    category: "ai",
  },
  openai_compatible_base_url: {
    type: "string",
    env: ["SPARK_OPENAI_COMPATIBLE_BASE_URL"],
    description: "OpenAI-compatible API base URL",
    category: "ai",
  },
  openai_compatible_name: {
    type: "string",
    env: ["SPARK_OPENAI_COMPATIBLE_NAME"],
    description: "OpenAI-compatible provider name",
    category: "ai",
  },
  reasoning_effort: {
    default: "none",
    type: "enum",
    values: REASONING_LEVELS,
    cli: "--reasoning-effort",
    placeholder: "level",
    env: ["SPARK_REASONING_EFFORT"],
    description: "Reasoning effort level",
    category: "ai",
  },

  // Browser Configuration
  browser: {
    default: "firefox",
    type: "enum",
    values: BROWSERS,
    cli: "--browser",
    cliShort: "-b",
    placeholder: "name",
    env: ["SPARK_BROWSER"],
    description: "Browser to use",
    category: "browser",
  },
  channel: {
    type: "string",
    cli: "--channel",
    placeholder: "name",
    env: ["SPARK_CHANNEL"],
    description: "Browser channel (e.g., chrome, msedge, chrome-beta)",
    category: "browser",
  },
  executable_path: {
    type: "string",
    cli: "--executable-path",
    placeholder: "path",
    env: ["SPARK_EXECUTABLE_PATH"],
    description: "Path to browser executable",
    category: "browser",
  },
  headless: {
    default: false,
    type: "boolean",
    cli: "--headless",
    env: ["SPARK_HEADLESS"],
    description: "Run browser in headless mode",
    category: "browser",
  },
  block_ads: {
    default: true,
    type: "boolean",
    cli: "--block-ads",
    env: ["SPARK_BLOCK_ADS"],
    description: "Enable ad blocking",
    category: "browser",
    negatable: true,
  },
  block_resources: {
    default: "media,manifest",
    type: "string",
    cli: "--block-resources",
    placeholder: "types",
    env: ["SPARK_BLOCK_RESOURCES"],
    description: "Comma-separated list of resources to block",
    category: "browser",
  },

  // Proxy Configuration
  proxy: {
    type: "string",
    cli: "--proxy",
    placeholder: "url",
    env: ["SPARK_PROXY"],
    description: "Proxy server URL (http, https, or socks5)",
    category: "proxy",
  },
  proxy_username: {
    type: "string",
    cli: "--proxy-username",
    placeholder: "user",
    env: ["SPARK_PROXY_USERNAME"],
    description: "Proxy authentication username",
    category: "proxy",
  },
  proxy_password: {
    type: "string",
    cli: "--proxy-password",
    placeholder: "pass",
    env: ["SPARK_PROXY_PASSWORD"],
    description: "Proxy authentication password",
    category: "proxy",
  },

  // Logging Configuration
  logger: {
    default: "console",
    type: "enum",
    values: LOGGERS,
    cli: "--logger",
    placeholder: "type",
    env: ["SPARK_LOGGER"],
    description: "Logger to use",
    category: "logging",
  },
  metrics_incremental: {
    default: false,
    type: "boolean",
    cli: "--metrics-incremental",
    env: ["SPARK_METRICS_INCREMENTAL"],
    description: "Show incremental metrics updates",
    category: "logging",
  },

  // Agent Configuration
  debug: {
    default: false,
    type: "boolean",
    cli: "--debug",
    env: ["SPARK_DEBUG"],
    description: "Enable debug mode with page snapshots",
    category: "agent",
  },
  vision: {
    default: false,
    type: "boolean",
    cli: "--vision",
    env: ["SPARK_VISION"],
    description: "Enable vision capabilities to include screenshots",
    category: "agent",
  },
  max_iterations: {
    default: 50,
    type: "number",
    cli: "--max-iterations",
    placeholder: "n",
    env: ["SPARK_MAX_ITERATIONS"],
    description: "Maximum total iterations to prevent infinite loops",
    category: "agent",
  },
  max_validation_attempts: {
    default: 3,
    type: "number",
    cli: "--max-validation-attempts",
    placeholder: "n",
    env: ["SPARK_MAX_VALIDATION_ATTEMPTS"],
    description: "Maximum validation attempts",
    category: "agent",
  },
  max_repeated_actions: {
    default: 2,
    type: "number",
    cli: "--max-repeated-actions",
    placeholder: "n",
    env: ["SPARK_MAX_REPEATED_ACTIONS"],
    description: "Maximum times an action can be repeated before warning",
    category: "agent",
  },
  max_consecutive_errors: {
    default: 5,
    type: "number",
    cli: "--max-consecutive-errors",
    placeholder: "n",
    env: ["SPARK_MAX_CONSECUTIVE_ERRORS"],
    description: "Maximum consecutive errors before failing the task",
    category: "agent",
  },
  max_total_errors: {
    default: 15,
    type: "number",
    cli: "--max-total-errors",
    placeholder: "n",
    env: ["SPARK_MAX_TOTAL_ERRORS"],
    description: "Maximum total errors before failing the task",
    category: "agent",
  },
  initial_navigation_retries: {
    default: 1,
    type: "number",
    cli: "--initial-navigation-retries",
    placeholder: "n",
    env: ["SPARK_INITIAL_NAVIGATION_RETRIES"],
    description: "Retries for initial navigation with browser restart (0 = no retries)",
    category: "agent",
  },
  starting_url: {
    type: "string",
    cli: "--url",
    cliShort: "-u",
    placeholder: "url",
    env: ["SPARK_STARTING_URL"],
    description: "Starting URL for the task",
    category: "agent",
  },
  data: {
    type: "string",
    cli: "--data",
    cliShort: "-d",
    placeholder: "json",
    env: ["SPARK_DATA"],
    description: "JSON data to provide context for the task",
    category: "agent",
  },
  guardrails: {
    type: "string",
    cli: "--guardrails",
    cliShort: "-g",
    placeholder: "text",
    env: ["SPARK_GUARDRAILS"],
    description: "Safety constraints for the task execution",
    category: "agent",
  },

  // Playwright Configuration
  pw_endpoint: {
    type: "string",
    cli: "--pw-endpoint",
    placeholder: "url",
    env: ["SPARK_PW_ENDPOINT"],
    description: "Playwright endpoint URL to connect to remote browser",
    category: "playwright",
  },
  pw_cdp_endpoint: {
    type: "string",
    cli: "--pw-cdp-endpoint",
    placeholder: "url",
    env: ["SPARK_PW_CDP_ENDPOINT"],
    description: "Chrome DevTools Protocol endpoint URL (chromium only)",
    category: "playwright",
  },
  bypass_csp: {
    default: true,
    type: "boolean",
    cli: "--bypass-csp",
    env: ["SPARK_BYPASS_CSP"],
    description: "Bypass Content Security Policy",
    category: "playwright",
  },

  // Navigation Configuration
  navigation_timeout_ms: {
    default: 30000,
    type: "number",
    cli: "--navigation-timeout-ms",
    placeholder: "ms",
    env: ["SPARK_NAVIGATION_TIMEOUT_MS"],
    description: "Base navigation timeout in milliseconds",
    category: "navigation",
  },
  navigation_max_timeout_ms: {
    default: 120000,
    type: "number",
    cli: "--navigation-max-timeout-ms",
    placeholder: "ms",
    env: ["SPARK_NAVIGATION_MAX_TIMEOUT_MS"],
    description: "Maximum timeout for navigation retries in milliseconds",
    category: "navigation",
  },
  navigation_max_attempts: {
    default: 3,
    type: "number",
    cli: "--navigation-max-attempts",
    placeholder: "n",
    env: ["SPARK_NAVIGATION_MAX_ATTEMPTS"],
    description: "Maximum navigation attempts (e.g., 3 = try up to 3 times)",
    category: "navigation",
  },
  navigation_timeout_multiplier: {
    default: 2,
    type: "number",
    cli: "--navigation-timeout-multiplier",
    placeholder: "n",
    env: ["SPARK_NAVIGATION_TIMEOUT_MULTIPLIER"],
    description: "Timeout multiplier for each retry (e.g., 2 = 30s → 60s → 120s)",
    category: "navigation",
  },

  // Action Configuration
  action_timeout_ms: {
    default: 30000,
    type: "number",
    cli: "--action-timeout-ms",
    placeholder: "ms",
    env: ["SPARK_ACTION_TIMEOUT_MS"],
    description: "Timeout for page load and element actions in milliseconds",
    category: "action",
  },

  // Search Configuration
  search_provider: {
    default: "none",
    type: "enum",
    values: SEARCH_PROVIDERS,
    cli: "--search-provider",
    placeholder: "name",
    env: ["SPARK_SEARCH_PROVIDER"],
    description: "Search provider to use (none disables search tool)",
    category: "search",
  },
  parallel_api_key: {
    type: "string",
    cli: "--parallel-api-key",
    placeholder: "key",
    env: ["PARALLEL_API_KEY"],
    description: "Parallel API key for search",
    category: "search",
  },
};

// =============================================================================
// DEFAULTS - Derived from FIELDS
// =============================================================================

function buildDefaults(): SparkConfigResolved {
  const defaults: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(FIELDS)) {
    if (field.default !== undefined) {
      defaults[key] = field.default;
    }
  }

  // Runtime validation for required fields (fields with non-optional types in SparkConfigResolved)
  const requiredFields: (keyof SparkConfigResolved)[] = [
    "provider",
    "reasoning_effort",
    "browser",
    "headless",
    "block_ads",
    "block_resources",
    "logger",
    "metrics_incremental",
    "debug",
    "vision",
    "max_iterations",
    "max_validation_attempts",
    "max_repeated_actions",
    "max_consecutive_errors",
    "max_total_errors",
    "initial_navigation_retries",
    "bypass_csp",
    "navigation_timeout_ms",
    "navigation_max_timeout_ms",
    "navigation_max_attempts",
    "navigation_timeout_multiplier",
    "action_timeout_ms",
    "search_provider",
  ];

  for (const field of requiredFields) {
    if (defaults[field] === undefined) {
      throw new Error(`Missing default for required config field: ${field}`);
    }
  }

  return defaults as unknown as SparkConfigResolved;
}

export const DEFAULTS: SparkConfigResolved = buildDefaults();

/** Get all config defaults */
export function getConfigDefaults(): SparkConfigResolved {
  return DEFAULTS;
}

// =============================================================================
// CONFIG_SCHEMA - Array format for iteration
// =============================================================================

export const CONFIG_SCHEMA: ConfigField[] = (Object.keys(FIELDS) as ConfigKey[]).map((key) => {
  const field = FIELDS[key];
  return {
    configKey: key,
    ...field,
    enumValues: field.values,
    defaultValue: field.default,
  } as ConfigField;
});

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
  return CONFIG_SCHEMA.filter((field) => field.cli !== undefined);
}

export function getEnvFields(): ConfigField[] {
  return CONFIG_SCHEMA.filter((field) => field.env.length > 0);
}

export function getSchemaConfigKeys(): ConfigKey[] {
  return Object.keys(FIELDS) as ConfigKey[];
}

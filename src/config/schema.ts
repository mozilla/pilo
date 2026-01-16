/**
 * Unified Configuration Schema
 *
 * Uses Zod as the single source of truth for config types and defaults.
 * CLI/env metadata is defined separately but kept in sync via TypeScript.
 */

import { z } from "zod";

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
  provider: z.enum(PROVIDERS).default("openai"),
  model: z.string().optional(),
  openai_api_key: z.string().optional(),
  openrouter_api_key: z.string().optional(),
  google_generative_ai_api_key: z.string().optional(),
  vertex_project: z.string().optional(),
  vertex_location: z.string().optional(),
  ollama_base_url: z.string().optional(),
  openai_compatible_base_url: z.string().optional(),
  openai_compatible_name: z.string().optional(),
  reasoning_effort: z.enum(REASONING_LEVELS).default("none"),

  // Browser Configuration
  browser: z.enum(BROWSERS).default("firefox"),
  channel: z.string().optional(),
  executable_path: z.string().optional(),
  headless: z.boolean().default(false),
  block_ads: z.boolean().default(true),
  block_resources: z.string().default("media,manifest"),

  // Proxy Configuration
  proxy: z.string().optional(),
  proxy_username: z.string().optional(),
  proxy_password: z.string().optional(),

  // Logging Configuration
  logger: z.enum(LOGGERS).default("console"),
  metrics_incremental: z.boolean().default(false),

  // Agent Configuration
  debug: z.boolean().default(false),
  vision: z.boolean().default(false),
  max_iterations: z.number().default(50),
  max_validation_attempts: z.number().default(3),
  max_repeated_actions: z.number().default(2),
  starting_url: z.string().optional(),
  data: z.string().optional(),
  guardrails: z.string().optional(),

  // Playwright Configuration
  pw_endpoint: z.string().optional(),
  pw_cdp_endpoint: z.string().optional(),
  bypass_csp: z.boolean().default(true),

  // Navigation Configuration (timeouts in milliseconds)
  navigation_timeout_ms: z.number().default(30000),
  navigation_max_timeout_ms: z.number().default(120000),
  navigation_max_attempts: z.number().default(3),
  navigation_timeout_multiplier: z.number().default(2),

  // Action Configuration
  action_timeout_ms: z.number().default(30000),
});

/** SparkConfig type - input type (all optional, before defaults applied) */
export type SparkConfig = z.input<typeof SparkConfigSchema>;

/** SparkConfigResolved type - output type (defaults applied) */
export type SparkConfigResolved = z.output<typeof SparkConfigSchema>;

/** All config field keys */
export type ConfigKey = keyof SparkConfigResolved;

/** Cached defaults - parsed once since they're static */
let cachedDefaults: SparkConfigResolved | null = null;

/** Get all defaults by parsing an empty object (cached) */
export function getConfigDefaults(): SparkConfigResolved {
  if (!cachedDefaults) {
    cachedDefaults = SparkConfigSchema.parse({});
  }
  return cachedDefaults;
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

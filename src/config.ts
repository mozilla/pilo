import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { config as loadDotenv } from "dotenv";

export interface SparkConfig {
  // AI Configuration
  provider?: "openai" | "openrouter" | "vertex" | "ollama" | "openai-compatible" | "lmstudio";
  model?: string;
  openai_api_key?: string;
  openrouter_api_key?: string;
  vertex_project?: string;
  vertex_location?: string;

  // Local AI Provider Configuration
  ollama_base_url?: string;
  openai_compatible_base_url?: string;
  openai_compatible_name?: string;

  // Browser Configuration
  browser?: "firefox" | "chrome" | "chromium" | "safari" | "webkit" | "edge";
  headless?: boolean;
  block_ads?: boolean;
  block_resources?: string;

  // Proxy Configuration
  proxy?: string;
  proxy_username?: string;
  proxy_password?: string;

  // Logging Configuration
  logger?: "console" | "json";

  // WebAgent Configuration
  debug?: boolean;
  vision?: boolean;
  max_iterations?: number;
  max_validation_attempts?: number;
  max_repeated_actions?: number;
  reasoning_effort?: "none" | "low" | "medium" | "high";
  starting_url?: string;
  data?: string;
  guardrails?: string;

  // Playwright Configuration
  pw_endpoint?: string;
  pw_cdp_endpoint?: string;
  bypass_csp?: boolean;
}

export class ConfigManager {
  private static instance: ConfigManager;
  private configPath: string;
  private configDir: string;

  private constructor() {
    // Determine config directory based on platform
    const platform = process.platform;
    if (platform === "win32") {
      // Windows: %APPDATA%\spark\
      this.configDir = join(process.env.APPDATA || join(homedir(), "AppData", "Roaming"), "spark");
    } else {
      // Unix/Linux/macOS: ~/.spark/
      this.configDir = join(homedir(), ".spark");
    }

    this.configPath = join(this.configDir, "config.json");
  }

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  /**
   * Get the full merged configuration from all sources
   * Priority: Environment Variables > Local .env > Global Config
   */
  public getConfig(): SparkConfig {
    // Start with global config as base
    const globalConfig = this.getGlobalConfig();

    // Load local .env file if it exists (for development)
    try {
      loadDotenv({ path: ".env" });
    } catch {
      // Ignore if .env doesn't exist
    }

    // Merge with environment variables (highest priority)
    const config: SparkConfig = {
      ...globalConfig,
      // Override with environment variables if they exist
      // AI Configuration
      ...(process.env.SPARK_PROVIDER && {
        provider: process.env.SPARK_PROVIDER as SparkConfig["provider"],
      }),
      ...(process.env.SPARK_MODEL && { model: process.env.SPARK_MODEL }),
      ...(process.env.OPENAI_API_KEY && { openai_api_key: process.env.OPENAI_API_KEY }),
      ...(process.env.OPENROUTER_API_KEY && { openrouter_api_key: process.env.OPENROUTER_API_KEY }),
      ...((process.env.GOOGLE_VERTEX_PROJECT ||
        process.env.GOOGLE_CLOUD_PROJECT ||
        process.env.GCP_PROJECT) && {
        vertex_project:
          process.env.GOOGLE_VERTEX_PROJECT ||
          process.env.GOOGLE_CLOUD_PROJECT ||
          process.env.GCP_PROJECT,
      }),
      ...((process.env.GOOGLE_VERTEX_LOCATION || process.env.GOOGLE_CLOUD_REGION) && {
        vertex_location: process.env.GOOGLE_VERTEX_LOCATION || process.env.GOOGLE_CLOUD_REGION,
      }),

      // Local AI Provider Configuration
      ...(process.env.SPARK_OLLAMA_BASE_URL && {
        ollama_base_url: process.env.SPARK_OLLAMA_BASE_URL,
      }),
      ...(process.env.SPARK_OPENAI_COMPATIBLE_BASE_URL && {
        openai_compatible_base_url: process.env.SPARK_OPENAI_COMPATIBLE_BASE_URL,
      }),
      ...(process.env.SPARK_OPENAI_COMPATIBLE_NAME && {
        openai_compatible_name: process.env.SPARK_OPENAI_COMPATIBLE_NAME,
      }),

      // Browser Configuration
      ...(process.env.SPARK_BROWSER && {
        browser: process.env.SPARK_BROWSER as SparkConfig["browser"],
      }),
      ...(process.env.SPARK_HEADLESS && {
        headless: process.env.SPARK_HEADLESS === "true",
      }),
      ...(process.env.SPARK_BLOCK_ADS && {
        block_ads: process.env.SPARK_BLOCK_ADS === "true",
      }),
      ...(process.env.SPARK_BLOCK_RESOURCES && {
        block_resources: process.env.SPARK_BLOCK_RESOURCES,
      }),

      // Proxy Configuration
      ...(process.env.SPARK_PROXY && {
        proxy: process.env.SPARK_PROXY,
      }),
      ...(process.env.SPARK_PROXY_USERNAME && {
        proxy_username: process.env.SPARK_PROXY_USERNAME,
      }),
      ...(process.env.SPARK_PROXY_PASSWORD && {
        proxy_password: process.env.SPARK_PROXY_PASSWORD,
      }),

      // Logging Configuration
      ...(process.env.SPARK_LOGGER && {
        logger: process.env.SPARK_LOGGER as SparkConfig["logger"],
      }),

      // WebAgent Configuration
      ...(process.env.SPARK_DEBUG && {
        debug: process.env.SPARK_DEBUG === "true",
      }),
      ...(process.env.SPARK_VISION && {
        vision: process.env.SPARK_VISION === "true",
      }),
      ...(process.env.SPARK_MAX_ITERATIONS && {
        max_iterations: parseInt(process.env.SPARK_MAX_ITERATIONS, 10),
      }),
      ...(process.env.SPARK_MAX_VALIDATION_ATTEMPTS && {
        max_validation_attempts: parseInt(process.env.SPARK_MAX_VALIDATION_ATTEMPTS, 10),
      }),
      ...(process.env.SPARK_MAX_REPEATED_ACTIONS && {
        max_repeated_actions: parseInt(process.env.SPARK_MAX_REPEATED_ACTIONS, 10),
      }),
      ...(process.env.SPARK_REASONING_EFFORT && {
        reasoning_effort: process.env.SPARK_REASONING_EFFORT as SparkConfig["reasoning_effort"],
      }),
      ...(process.env.SPARK_STARTING_URL && {
        starting_url: process.env.SPARK_STARTING_URL,
      }),
      ...(process.env.SPARK_DATA && {
        data: process.env.SPARK_DATA,
      }),
      ...(process.env.SPARK_GUARDRAILS && {
        guardrails: process.env.SPARK_GUARDRAILS,
      }),

      // Playwright Configuration
      ...(process.env.SPARK_PW_ENDPOINT && {
        pw_endpoint: process.env.SPARK_PW_ENDPOINT,
      }),
      ...(process.env.SPARK_PW_CDP_ENDPOINT && {
        pw_cdp_endpoint: process.env.SPARK_PW_CDP_ENDPOINT,
      }),
      ...(process.env.SPARK_BYPASS_CSP && {
        bypass_csp: process.env.SPARK_BYPASS_CSP === "true",
      }),
    };

    return config;
  }

  /**
   * Get only the global config file contents
   */
  public getGlobalConfig(): SparkConfig {
    try {
      if (existsSync(this.configPath)) {
        const configContent = readFileSync(this.configPath, "utf-8");
        return JSON.parse(configContent);
      }
    } catch (error) {
      console.warn(
        `Warning: Could not read config file: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    return {};
  }

  /**
   * Set a value in the global config file
   */
  public setGlobalConfig(key: keyof SparkConfig, value: any): void {
    // Ensure config directory exists
    if (!existsSync(this.configDir)) {
      mkdirSync(this.configDir, { recursive: true });
    }

    // Read existing config
    const currentConfig = this.getGlobalConfig();

    // Update the value
    const newConfig = {
      ...currentConfig,
      [key]: value,
    };

    // Write back to file
    try {
      writeFileSync(this.configPath, JSON.stringify(newConfig, null, 2), "utf-8");
    } catch (error) {
      throw new Error(
        `Failed to write config: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Get a specific config value with fallback hierarchy
   */
  public get<K extends keyof SparkConfig>(key: K, defaultValue?: SparkConfig[K]): SparkConfig[K] {
    const config = this.getConfig();
    return config[key] ?? defaultValue;
  }

  /**
   * Set a global config value
   */
  public set<K extends keyof SparkConfig>(key: K, value: SparkConfig[K]): void {
    this.setGlobalConfig(key, value);
  }

  /**
   * Get the path to the global config file
   */
  public getConfigPath(): string {
    return this.configPath;
  }

  /**
   * Delete a key from the global config
   */
  public unset(key: keyof SparkConfig): void {
    const currentConfig = this.getGlobalConfig();
    delete currentConfig[key];

    try {
      writeFileSync(this.configPath, JSON.stringify(currentConfig, null, 2), "utf-8");
    } catch (error) {
      throw new Error(
        `Failed to write config: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * List all config sources and their values for debugging
   */
  public listSources(): {
    global: SparkConfig;
    env: Partial<SparkConfig>;
    merged: SparkConfig;
  } {
    const global = this.getGlobalConfig();

    const env: Partial<SparkConfig> = {};
    // AI Configuration
    if (process.env.SPARK_PROVIDER)
      env.provider = process.env.SPARK_PROVIDER as SparkConfig["provider"];
    if (process.env.SPARK_MODEL) env.model = process.env.SPARK_MODEL;
    if (process.env.OPENAI_API_KEY) env.openai_api_key = process.env.OPENAI_API_KEY;
    if (process.env.OPENROUTER_API_KEY) env.openrouter_api_key = process.env.OPENROUTER_API_KEY;
    if (
      process.env.GOOGLE_VERTEX_PROJECT ||
      process.env.GOOGLE_CLOUD_PROJECT ||
      process.env.GCP_PROJECT
    ) {
      env.vertex_project =
        process.env.GOOGLE_VERTEX_PROJECT ||
        process.env.GOOGLE_CLOUD_PROJECT ||
        process.env.GCP_PROJECT;
    }
    if (process.env.GOOGLE_VERTEX_LOCATION || process.env.GOOGLE_CLOUD_REGION) {
      env.vertex_location = process.env.GOOGLE_VERTEX_LOCATION || process.env.GOOGLE_CLOUD_REGION;
    }

    // Browser Configuration
    if (process.env.SPARK_BROWSER)
      env.browser = process.env.SPARK_BROWSER as SparkConfig["browser"];
    if (process.env.SPARK_HEADLESS) env.headless = process.env.SPARK_HEADLESS === "true";
    if (process.env.SPARK_BLOCK_ADS) env.block_ads = process.env.SPARK_BLOCK_ADS === "true";
    if (process.env.SPARK_BLOCK_RESOURCES) env.block_resources = process.env.SPARK_BLOCK_RESOURCES;

    // Proxy Configuration
    if (process.env.SPARK_PROXY) env.proxy = process.env.SPARK_PROXY;
    if (process.env.SPARK_PROXY_USERNAME) env.proxy_username = process.env.SPARK_PROXY_USERNAME;
    if (process.env.SPARK_PROXY_PASSWORD) env.proxy_password = process.env.SPARK_PROXY_PASSWORD;

    // Logging Configuration
    if (process.env.SPARK_LOGGER) env.logger = process.env.SPARK_LOGGER as SparkConfig["logger"];

    // WebAgent Configuration
    if (process.env.SPARK_DEBUG) env.debug = process.env.SPARK_DEBUG === "true";
    if (process.env.SPARK_VISION) env.vision = process.env.SPARK_VISION === "true";
    if (process.env.SPARK_MAX_ITERATIONS)
      env.max_iterations = parseInt(process.env.SPARK_MAX_ITERATIONS, 10);
    if (process.env.SPARK_MAX_VALIDATION_ATTEMPTS)
      env.max_validation_attempts = parseInt(process.env.SPARK_MAX_VALIDATION_ATTEMPTS, 10);
    if (process.env.SPARK_MAX_REPEATED_ACTIONS)
      env.max_repeated_actions = parseInt(process.env.SPARK_MAX_REPEATED_ACTIONS, 10);
    if (process.env.SPARK_REASONING_EFFORT)
      env.reasoning_effort = process.env.SPARK_REASONING_EFFORT as SparkConfig["reasoning_effort"];
    if (process.env.SPARK_STARTING_URL) env.starting_url = process.env.SPARK_STARTING_URL;
    if (process.env.SPARK_DATA) env.data = process.env.SPARK_DATA;
    if (process.env.SPARK_GUARDRAILS) env.guardrails = process.env.SPARK_GUARDRAILS;

    // Playwright Configuration
    if (process.env.SPARK_PW_ENDPOINT) env.pw_endpoint = process.env.SPARK_PW_ENDPOINT;
    if (process.env.SPARK_PW_CDP_ENDPOINT) env.pw_cdp_endpoint = process.env.SPARK_PW_CDP_ENDPOINT;
    if (process.env.SPARK_BYPASS_CSP) env.bypass_csp = process.env.SPARK_BYPASS_CSP === "true";

    const merged = this.getConfig();

    return { global, env, merged };
  }
}

// Export singleton instance
export const config = ConfigManager.getInstance();

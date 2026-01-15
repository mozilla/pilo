import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { config as loadDotenv } from "dotenv";
import { parseEnvConfig } from "./config/envParser.js";

export interface SparkConfig {
  // AI Configuration
  provider?:
    | "openai"
    | "openrouter"
    | "vertex"
    | "ollama"
    | "openai-compatible"
    | "lmstudio"
    | "google";
  model?: string;
  openai_api_key?: string;
  openrouter_api_key?: string;
  google_generative_ai_api_key?: string;
  vertex_project?: string;
  vertex_location?: string;

  // Local AI Provider Configuration
  ollama_base_url?: string;
  openai_compatible_base_url?: string;
  openai_compatible_name?: string;

  // Browser Configuration
  browser?: "firefox" | "chrome" | "chromium" | "safari" | "webkit" | "edge";
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
  logger?: "console" | "json";
  metrics_incremental?: boolean;

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

  // Navigation Retry Configuration
  navigation_timeout_ms?: number;
  navigation_max_timeout_ms?: number;
  navigation_max_attempts?: number;
  navigation_timeout_multiplier?: number;

  // Action Timeout Configuration
  action_timeout_ms?: number;
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
      loadDotenv({ path: ".env", quiet: true });
    } catch {
      // Ignore if .env doesn't exist
    }

    // Use schema-driven env parsing (handles all env vars automatically)
    const envConfig = parseEnvConfig();

    // Merge: global config < env vars (env has higher priority)
    return {
      ...globalConfig,
      ...envConfig,
    };
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

    // Use schema-driven env parsing (no manual env var listing needed)
    const env = parseEnvConfig();

    const merged = this.getConfig();

    return { global, env, merged };
  }
}

// Export singleton instance
export const config = ConfigManager.getInstance();

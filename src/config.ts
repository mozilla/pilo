import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { config as loadDotenv } from "dotenv";
import { parseEnvConfig } from "./config/envParser.js";
import { SparkConfigSchema } from "./config/schema.js";
import type { SparkConfig, SparkConfigResolved } from "./config/schema.js";

// Re-export types from schema (single source of truth)
export type { SparkConfig, SparkConfigResolved } from "./config/schema.js";

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
   * Get the full merged configuration from all sources, validated through Zod.
   * Priority: Environment Variables > Local .env > Global Config
   * Returns resolved config with defaults applied.
   */
  public getConfig(): SparkConfigResolved {
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
    const merged = {
      ...globalConfig,
      ...envConfig,
    };

    // Validate through Zod and apply defaults
    const result = SparkConfigSchema.safeParse(merged);

    if (!result.success) {
      // Log validation issues but don't fail - use defaults for invalid fields
      const errors = result.error.flatten();
      for (const [field, messages] of Object.entries(errors.fieldErrors)) {
        console.warn(`Config warning: ${field} - ${messages?.join(", ")}`);
      }
      // Parse again allowing Zod to use defaults for invalid fields
      // by stripping invalid values
      const sanitized = { ...merged };
      for (const field of Object.keys(errors.fieldErrors)) {
        delete sanitized[field as keyof typeof sanitized];
      }
      return SparkConfigSchema.parse(sanitized);
    }

    return result.data;
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
   * Get a specific config value with fallback hierarchy.
   * Since getConfig() returns SparkConfigResolved, defaults are already applied.
   */
  public get<K extends keyof SparkConfigResolved>(
    key: K,
    defaultValue?: SparkConfigResolved[K],
  ): SparkConfigResolved[K] {
    const config = this.getConfig();
    return config[key] ?? (defaultValue as SparkConfigResolved[K]);
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
    env: SparkConfig;
    merged: SparkConfigResolved;
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

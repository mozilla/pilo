/**
 * Configuration Manager
 *
 * Singleton class for managing configuration from multiple sources.
 * Node.js only - uses fs, path, os, and dotenv.
 */

import { config as loadDotenv } from "dotenv";
import { DEFAULTS, type SparkConfig, type SparkConfigResolved } from "./defaults.js";
import { isDevelopmentMode } from "../buildMode.js";
import { parseEnvConfig } from "./envParser.js";
import {
  getConfigPath,
  readGlobalConfig,
  writeGlobalConfig,
  deleteGlobalConfigKey,
} from "./globalConfig.js";

export class ConfigManager {
  private static instance: ConfigManager;

  private constructor() {
    // Singleton - no initialization needed
  }

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  /**
   * Get the full merged configuration from all sources.
   * Priority: Environment Variables > Local .env > Global Config
   */
  public getConfig(): SparkConfigResolved {
    const globalConfig = readGlobalConfig();

    // Load local .env file if it exists
    try {
      loadDotenv({ path: ".env", quiet: true });
    } catch {
      // Ignore if .env doesn't exist
    }

    const envConfig = parseEnvConfig();

    // Merge: defaults < global config < env vars
    const merged = {
      ...DEFAULTS,
      ...globalConfig,
      ...envConfig,
    };

    return merged as SparkConfigResolved;
  }

  /**
   * Get CLI-specific configuration.
   *
   * In production mode (installed via npm):
   *   - Merges defaults with global config file (no env vars)
   *   - Ensures consistent behavior independent of environment
   *
   * In development mode (running from source):
   *   - Merges defaults with global config (if exists) with env vars
   *   - Allows developers to override settings with environment variables
   *   - Config file is optional, not required
   */
  public getCliConfig(): SparkConfigResolved {
    const globalConfig = readGlobalConfig();

    if (isDevelopmentMode()) {
      // Dev mode: defaults < global config (optional) < env vars
      // Load local .env file if it exists
      try {
        loadDotenv({ path: ".env", quiet: true });
      } catch {
        // Ignore if .env doesn't exist
      }

      const envConfig = parseEnvConfig();

      const merged = {
        ...DEFAULTS,
        ...globalConfig,
        ...envConfig,
      };

      return merged as SparkConfigResolved;
    } else {
      // Production mode: defaults < global config (no env vars)
      const merged = {
        ...DEFAULTS,
        ...globalConfig,
      };

      return merged as SparkConfigResolved;
    }
  }

  /**
   * Get only the global config file contents
   */
  public getGlobalConfig(): SparkConfig {
    return readGlobalConfig();
  }

  /**
   * Set a value in the global config file
   */
  public setGlobalConfig(key: keyof SparkConfig, value: unknown): void {
    writeGlobalConfig(key, value);
  }

  /**
   * Get a specific config value
   */
  public get<K extends keyof SparkConfigResolved>(key: K): SparkConfigResolved[K] {
    return this.getConfig()[key];
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
    return getConfigPath();
  }

  /**
   * Delete a key from the global config
   */
  public unset(key: keyof SparkConfig): void {
    deleteGlobalConfigKey(key);
  }

  /**
   * List all config sources and their values
   */
  public listSources(): {
    global: Partial<SparkConfig>;
    env: Partial<SparkConfig>;
    merged: SparkConfigResolved;
  } {
    const global = readGlobalConfig();
    const env = parseEnvConfig();
    const merged = this.getConfig();
    return { global, env, merged };
  }
}

/** Singleton config manager instance */
export const config = ConfigManager.getInstance();

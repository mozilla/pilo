/**
 * Config Manager
 *
 * Singleton config manager with build-mode-aware resolution.
 * Merges config from multiple sources: defaults < global config < env vars.
 * Node.js only (uses dotenv).
 */

import { config as loadDotenv } from "dotenv";
import { DEFAULTS, type SparkConfig, type SparkConfigResolved } from "./defaults.js";
import { parseEnvConfig } from "./envParser.js";
import {
  getGlobalConfig,
  setGlobalConfig,
  unsetGlobalConfig,
  getConfigPath,
} from "./globalConfig.js";

export class ConfigManager {
  private static instance: ConfigManager;

  private constructor() {}

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
    const globalConfig = getGlobalConfig();

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
   * Get only the global config file contents
   */
  public getGlobalConfig(): SparkConfig {
    return getGlobalConfig();
  }

  /**
   * Set a value in the global config file
   */
  public setGlobalConfig(key: keyof SparkConfig, value: unknown): void {
    setGlobalConfig(key, value);
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
    unsetGlobalConfig(key);
  }

  /**
   * List all config sources and their values
   */
  public listSources(): {
    global: Partial<SparkConfig>;
    env: Partial<SparkConfig>;
    merged: SparkConfigResolved;
  } {
    const global = getGlobalConfig();
    const env = parseEnvConfig();
    const merged = this.getConfig();
    return { global, env, merged };
  }
}

/** Singleton config manager instance */
export const config = ConfigManager.getInstance();

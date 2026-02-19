/**
 * Config Manager (Node.js only - uses fs, path, os, dotenv)
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { config as loadDotenv } from "dotenv";

import { DEFAULTS, type SparkConfig, type SparkConfigResolved } from "./defaults.js";
import { parseEnvConfig } from "./env.js";

export class ConfigManager {
  private static instance: ConfigManager;
  private configPath: string;
  private configDir: string;

  private constructor() {
    const platform = process.platform;
    if (platform === "win32") {
      this.configDir = join(process.env.APPDATA || join(homedir(), "AppData", "Roaming"), "spark");
    } else {
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
   * Get the full merged configuration from all sources.
   * Priority: Environment Variables > Local .env > Global Config
   */
  public getConfig(): SparkConfigResolved {
    const globalConfig = this.getGlobalConfig();

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
  public setGlobalConfig(key: keyof SparkConfig, value: unknown): void {
    if (!existsSync(this.configDir)) {
      mkdirSync(this.configDir, { recursive: true });
    }

    const currentConfig = this.getGlobalConfig();
    const newConfig = { ...currentConfig, [key]: value };

    try {
      writeFileSync(this.configPath, JSON.stringify(newConfig, null, 2), "utf-8");
    } catch (error) {
      throw new Error(
        `Failed to write config: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
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
   * List all config sources and their values
   */
  public listSources(): {
    global: Partial<SparkConfig>;
    env: Partial<SparkConfig>;
    merged: SparkConfigResolved;
  } {
    const global = this.getGlobalConfig();
    const env = parseEnvConfig();
    const merged = this.getConfig();
    return { global, env, merged };
  }
}

/** Singleton config manager instance */
export const config = ConfigManager.getInstance();

/**
 * Config Manager (Node.js only - uses fs, path, os, dotenv)
 */

// Build-time flag: replaced with `true` by the production build step.
// In dev (running from source), this variable is undefined, which is safe.
declare const __PILO_PRODUCTION__: boolean;

/** Returns true only when the production build flag is set. */
export function isProduction(): boolean {
  return typeof __PILO_PRODUCTION__ !== "undefined" && __PILO_PRODUCTION__;
}

import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { config as loadDotenv } from "dotenv";

import { DEFAULTS, type PiloConfig, type PiloConfigResolved } from "./defaults.js";
import { parseEnvConfig } from "./env.js";

export class ConfigManager {
  private static instance: ConfigManager;
  private configPath: string;
  private configDir: string;

  private constructor() {
    const platform = process.platform;
    if (platform === "win32") {
      this.configDir = join(process.env.APPDATA || join(homedir(), "AppData", "Roaming"), "pilo");
    } else {
      // XDG_CONFIG_HOME takes precedence; default is ~/.config
      const xdgConfigHome = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
      this.configDir = join(xdgConfigHome, "pilo");
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
   *
   * Dev mode:   defaults → global config → env vars
   * Production: defaults → global config (env vars and .env are skipped)
   */
  public getConfig(): PiloConfigResolved {
    const globalConfig = this.getGlobalConfig();

    if (isProduction()) {
      // Production: env vars and .env are intentionally skipped.
      const merged = {
        ...DEFAULTS,
        ...globalConfig,
      };
      return merged as PiloConfigResolved;
    }

    // Dev mode: load local .env file and include env vars.
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

    return merged as PiloConfigResolved;
  }

  /**
   * Get only the global config file contents
   */
  public getGlobalConfig(): PiloConfig {
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
  public setGlobalConfig(key: keyof PiloConfig, value: unknown): void {
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
  public get<K extends keyof PiloConfigResolved>(key: K): PiloConfigResolved[K] {
    return this.getConfig()[key];
  }

  /**
   * Set a global config value
   */
  public set<K extends keyof PiloConfig>(key: K, value: PiloConfig[K]): void {
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
  public unset(key: keyof PiloConfig): void {
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
   * Create the config directory and an empty config file if neither exists yet.
   * Safe to call multiple times — does nothing if the file already exists.
   */
  public initialize(): void {
    if (!existsSync(this.configDir)) {
      mkdirSync(this.configDir, { recursive: true });
    }
    if (!existsSync(this.configPath)) {
      writeFileSync(this.configPath, JSON.stringify({}, null, 2), "utf-8");
    }
  }

  /**
   * Reset the global config by removing the config file.
   */
  public reset(): void {
    if (existsSync(this.configPath)) {
      try {
        unlinkSync(this.configPath);
      } catch (error) {
        throw new Error(
          `Failed to reset config: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  /**
   * List all config sources and their values
   */
  public listSources(): {
    global: Partial<PiloConfig>;
    env: Partial<PiloConfig>;
    merged: PiloConfigResolved;
  } {
    const global = this.getGlobalConfig();
    const env = parseEnvConfig();
    const merged = this.getConfig();
    return { global, env, merged };
  }
}

/** Singleton config manager instance */
export const config = ConfigManager.getInstance();

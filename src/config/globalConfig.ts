/**
 * Global Configuration File Management
 *
 * Handles reading and writing the global config file.
 * Node.js only - uses fs, path, and os modules.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import type { SparkConfig } from "../configDefaults.js";

/**
 * Get platform-specific config directory path.
 */
export function getConfigDir(): string {
  const platform = process.platform;
  if (platform === "win32") {
    return join(process.env.APPDATA || join(homedir(), "AppData", "Roaming"), "spark");
  } else {
    // XDG-compliant location for Unix-like systems
    const xdgConfigHome = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
    return join(xdgConfigHome, "spark");
  }
}

/**
 * Get the full path to the global config file.
 */
export function getConfigPath(): string {
  return join(getConfigDir(), "config.json");
}

/**
 * Read the global config file.
 */
export function readGlobalConfig(): SparkConfig {
  const configPath = getConfigPath();
  try {
    if (existsSync(configPath)) {
      const configContent = readFileSync(configPath, "utf-8");
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
 * Write a value to the global config file.
 */
export function writeGlobalConfig(key: keyof SparkConfig, value: unknown): void {
  const configDir = getConfigDir();
  const configPath = getConfigPath();

  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }

  const currentConfig = readGlobalConfig();
  const newConfig = { ...currentConfig, [key]: value };

  try {
    writeFileSync(configPath, JSON.stringify(newConfig, null, 2), "utf-8");
  } catch (error) {
    throw new Error(
      `Failed to write config: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Delete a key from the global config file.
 */
export function deleteGlobalConfigKey(key: keyof SparkConfig): void {
  const configPath = getConfigPath();
  const currentConfig = readGlobalConfig();
  delete currentConfig[key];

  try {
    writeFileSync(configPath, JSON.stringify(currentConfig, null, 2), "utf-8");
  } catch (error) {
    throw new Error(
      `Failed to write config: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

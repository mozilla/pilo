/**
 * Global Config File Operations
 *
 * File I/O operations with XDG-compliant paths (~/.config/spark/).
 * Node.js only (uses fs, path, os).
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import type { SparkConfig } from "./defaults.js";

/**
 * Get the config directory path (XDG-compliant on Linux/macOS).
 */
function getConfigDir(): string {
  const platform = process.platform;
  if (platform === "win32") {
    return join(process.env.APPDATA || join(homedir(), "AppData", "Roaming"), "spark");
  } else {
    // XDG-compliant: ~/.config/spark/
    const xdgConfigHome = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
    return join(xdgConfigHome, "spark");
  }
}

/**
 * Get the config file path.
 */
export function getConfigPath(): string {
  return join(getConfigDir(), "config.json");
}

/**
 * Get only the global config file contents.
 */
export function getGlobalConfig(): SparkConfig {
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
 * Set a value in the global config file.
 */
export function setGlobalConfig(key: keyof SparkConfig, value: unknown): void {
  const configDir = getConfigDir();
  const configPath = getConfigPath();

  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }

  const currentConfig = getGlobalConfig();
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
 * Delete a key from the global config.
 */
export function unsetGlobalConfig(key: keyof SparkConfig): void {
  const configPath = getConfigPath();
  const currentConfig = getGlobalConfig();
  delete currentConfig[key];

  try {
    writeFileSync(configPath, JSON.stringify(currentConfig, null, 2), "utf-8");
  } catch (error) {
    throw new Error(
      `Failed to write config: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

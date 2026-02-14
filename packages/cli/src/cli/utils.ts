import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

/**
 * CLI-specific utilities and helpers
 */

/**
 * Get package.json information
 */
export function getPackageInfo(): { version: string; name: string; description: string } {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const packageJson = JSON.parse(
    readFileSync(join(__dirname, "../../../../package.json"), "utf-8"),
  );

  return {
    version: packageJson.version,
    name: packageJson.name,
    description: packageJson.description,
  };
}

/**
 * Validate browser option
 */
export function validateBrowser(browser: string): boolean {
  const validBrowsers = ["firefox", "chrome", "chromium", "safari", "webkit", "edge"];
  return validBrowsers.includes(browser);
}

/**
 * Get list of valid browsers
 */
export function getValidBrowsers(): string[] {
  return ["firefox", "chrome", "chromium", "safari", "webkit", "edge"];
}

/**
 * Parse JSON data with error handling
 */
export function parseJsonData(jsonString: string): any {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    throw new Error(`Invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Parse comma-separated resources list
 */
export function parseResourcesList(resourcesString: string): string[] {
  return resourcesString
    .split(",")
    .map((r: string) => r.trim())
    .filter(Boolean);
}

/**
 * Validate configuration key-value format
 */
export function parseConfigKeyValue(keyValue: string): { key: string; value: string } {
  const equalsIndex = keyValue.indexOf("=");
  if (equalsIndex === -1) {
    throw new Error("Invalid format. Use: key=value");
  }

  const key = keyValue.substring(0, equalsIndex);
  const value = keyValue.substring(equalsIndex + 1);

  if (!key.trim()) {
    throw new Error("Key cannot be empty");
  }

  return { key: key.trim(), value };
}

/**
 * Parse configuration value to appropriate type
 */
export function parseConfigValue(value: string): any {
  // Parse boolean values
  if (value === "true") return true;
  if (value === "false") return false;

  // Parse numeric values
  if (!isNaN(Number(value)) && value !== "") {
    return Number(value);
  }

  // Return as string
  return value;
}

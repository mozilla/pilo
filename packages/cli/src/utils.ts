import { existsSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

/**
 * CLI-specific utilities and helpers
 */

/**
 * Get package.json information.
 *
 * Searches upward from the compiled file's location so the path works both:
 *   - In development:  packages/cli/dist/utils.js  → ../package.json (spark-cli)
 *   - When installed:  dist/cli/utils.js            → ../../package.json (@tabstack/spark)
 *
 * Falls back through candidate paths until a package.json is found.
 */
export function getPackageInfo(): { version: string; name: string; description: string } {
  const __dirname = dirname(fileURLToPath(import.meta.url));

  // Walk up from the current file directory looking for package.json
  const candidates = [
    join(__dirname, "../package.json"), // dev: packages/cli/package.json
    join(__dirname, "../../package.json"), // installed: @tabstack/spark root package.json
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      const pkg = JSON.parse(readFileSync(candidate, "utf-8")) as {
        version?: string;
        name?: string;
        description?: string;
      };
      return {
        version: pkg.version ?? "0.0.0",
        name: pkg.name ?? "spark",
        description: pkg.description ?? "",
      };
    }
  }

  // Should never reach here in a properly assembled package
  return { version: "0.0.0", name: "spark", description: "AI-powered web automation" };
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

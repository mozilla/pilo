/**
 * Build Mode Detection
 *
 * This module provides runtime detection of whether the CLI is running
 * in production mode (installed via npm) or development mode (running from source).
 *
 * The build mode is determined at build time using tsup's `define` option.
 * During development (running with tsx), process.env.SPARK_BUILD_MODE is undefined.
 * During production build, tsup replaces process.env.SPARK_BUILD_MODE with "production".
 */

export const SPARK_BUILD_MODE = process.env.SPARK_BUILD_MODE;

/**
 * Check if the CLI is running in production mode (installed via npm).
 * @returns true if running from an npm-installed build, false if running from source
 */
export function isProductionBuild(): boolean {
  return SPARK_BUILD_MODE === "production";
}

/**
 * Check if the CLI is running in development mode (from source).
 * @returns true if running from source, false if running from an npm-installed build
 */
export function isDevelopmentMode(): boolean {
  return !isProductionBuild();
}

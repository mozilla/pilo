/**
 * Build Mode Detection
 *
 * This module provides runtime detection of whether the CLI is running
 * in production mode (installed via npm) or development mode (running from source).
 *
 * The build mode is determined at build time and baked into the bundle.
 * During development, this file is not replaced, so it defaults to dev mode.
 * During production build, the build script generates a version with production mode set.
 */

/**
 * This constant is set at build time:
 * - During 'npm run build' or 'npm publish': "production" (file gets replaced)
 * - During development (running with tsx): undefined (this file is used as-is)
 */
export const SPARK_BUILD_MODE: string | undefined = undefined;

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

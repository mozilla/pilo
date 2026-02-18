/**
 * Build mode detection for Spark.
 *
 * Determines whether the code is running in:
 * - Production mode: Built and distributed via npm (SPARK_BUILD_MODE is defined)
 * - Development mode: Running via tsx/ts-node (SPARK_BUILD_MODE is undefined)
 *
 * This is used to adjust behavior such as requiring config files in production
 * but allowing defaults in development.
 */

/**
 * Detect if running in production mode (built via tsup with SPARK_BUILD_MODE defined).
 *
 * Returns true if the code was built for production (SPARK_BUILD_MODE is "production"),
 * false if running in development mode via tsx/ts-node.
 *
 * @returns true if running in production mode, false if in development mode
 */
export function isProductionMode(): boolean {
  // Check if SPARK_BUILD_MODE was defined at build time by tsup
  // In development (tsx/ts-node), this will be undefined
  // In production builds, tsup replaces this with "production"
  try {
    // @ts-expect-error - SPARK_BUILD_MODE is defined by tsup at build time
    return typeof SPARK_BUILD_MODE !== "undefined" && SPARK_BUILD_MODE === "production";
  } catch {
    // If SPARK_BUILD_MODE is not defined at all, we're in development
    return false;
  }
}

/**
 * Detect if running in development mode (tsx/ts-node without build).
 *
 * @returns true if running in development mode, false if in production mode
 */
export function isDevelopmentMode(): boolean {
  return !isProductionMode();
}

/**
 * Get the current build mode as a string.
 *
 * @returns "production" or "development"
 */
export function getBuildMode(): "production" | "development" {
  return isProductionMode() ? "production" : "development";
}

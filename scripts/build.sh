#!/usr/bin/env bash
#
# Build script for Spark CLI
# Sets SPARK_BUILD_MODE=production during the build process
#

set -e

echo "🔨 Building Spark CLI (production mode)..."

# Backup the original buildMode.ts
cp src/buildMode.ts src/buildMode.ts.backup

# Create production version of buildMode.ts
cat > src/buildMode.ts << 'EOF'
/**
 * Build Mode Detection (PRODUCTION BUILD)
 *
 * This file has been modified during the build process to set production mode.
 * The original file is in src/buildMode.ts.backup and will be restored after build.
 */

/**
 * Build mode set to production during build process.
 */
export const SPARK_BUILD_MODE: string | undefined = "production";

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
EOF

# Run TypeScript compiler
tsc

# Restore the original buildMode.ts
mv src/buildMode.ts.backup src/buildMode.ts

echo "✅ Build complete"

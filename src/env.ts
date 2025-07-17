/**
 * Browser-safe environment variable helper
 * Returns undefined in browser environments where process doesn't exist
 */
export function getEnv(key: string): string | undefined {
  if (typeof process === "undefined" || !process.env) {
    return undefined;
  }
  return process.env[key];
}

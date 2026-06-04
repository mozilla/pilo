// Load .env from CWD as a side effect, before any other module is evaluated.
// Imported first in index.ts so env vars are present before telemetry/OTel
// initialization reads them. Uses Node's built-in env-file loader (Node 21+).
try {
  process.loadEnvFile();
} catch {
  // No .env file present; ignore.
}

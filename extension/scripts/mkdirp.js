import { mkdirSync } from "node:fs";

// Create directory (and any parent directories) if it doesn't exist
const dir = process.argv[2];

if (!dir) {
  console.error("Usage: node mkdirp.js <directory-path>");
  process.exit(1);
}

try {
  mkdirSync(dir, { recursive: true });
} catch (err) {
  console.error(`Failed to create directory "${dir}": ${err?.message || String(err)}`);
  process.exit(1);
}

#!/usr/bin/env node
/**
 * Post-processes a JSON Schema file from ts-json-schema-generator to fix
 * a compatibility issue:
 *
 * The generator emits `@deprecated "<msg>"` JSDoc annotations as
 * `"deprecated": "<msg>"` (string). JSON Schema / OpenAPI tooling expects
 * `deprecated` to be a boolean — the message belongs in `description`.
 *
 * This script walks the JSON tree, and for every object that has
 * `"deprecated": <string>`:
 *   - sets `deprecated: true`
 *   - prepends the original message to `description` (creating one if absent)
 *
 * Output is re-serialized with 2-space indent and alphabetically-sorted keys,
 * matching ts-json-schema-generator's default output shape so the drift gate
 * stays happy.
 *
 * Usage:
 *   node packages/core/scripts/normalize-schema.cjs <schema.json>
 */

const fs = require("node:fs");
const path = require("node:path");

const [inputPath] = process.argv.slice(2);
if (!inputPath) {
  console.error("usage: normalize-schema.cjs <schema.json>");
  process.exit(1);
}

const schema = JSON.parse(fs.readFileSync(inputPath, "utf-8"));

let fixCount = 0;

function walk(node) {
  if (node === null || typeof node !== "object") return;
  if (Array.isArray(node)) {
    node.forEach(walk);
    return;
  }
  if (typeof node.deprecated === "string") {
    const msg = node.deprecated.trim();
    node.deprecated = true;
    const prefix = `Deprecated. ${msg}`.trim();
    node.description = node.description ? `${prefix} ${node.description}`.trim() : prefix;
    fixCount++;
  }
  for (const key of Object.keys(node)) {
    walk(node[key]);
  }
}

walk(schema);

// Sort keys alphabetically at every object level to match the generator's
// default output so the drift gate continues to compare cleanly.
function sortReplacer(_key, value) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const sorted = {};
    for (const k of Object.keys(value).sort()) {
      sorted[k] = value[k];
    }
    return sorted;
  }
  return value;
}

fs.writeFileSync(inputPath, JSON.stringify(schema, sortReplacer, 2) + "\n");
console.error(
  `normalize-schema: fixed ${fixCount} deprecated string value(s) in ${path.basename(inputPath)}`,
);

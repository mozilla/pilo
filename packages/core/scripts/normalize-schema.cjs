#!/usr/bin/env node
/**
 * Post-processes a JSON Schema file from ts-json-schema-generator to fix two
 * issues that would otherwise cause spurious drift in the committed artifact:
 *
 * 1. Deprecated annotations. The generator emits `@deprecated "<msg>"` JSDoc as
 *    `"deprecated": "<msg>"` (string). JSON Schema / OpenAPI tooling expects
 *    `deprecated` to be a boolean — the message belongs in `description`.
 *    For every object with `"deprecated": <string>` we set `deprecated: true`
 *    and prepend the original message to `description`.
 *
 * 2. Volatile alias names. The generator names anonymous/aliased definitions
 *    from their source *position* (e.g.
 *    `alias-1623388915-2282-2347-1623388915-0-228060`). Those names churn
 *    whenever an upstream dependency reshuffles its types, even when the
 *    resulting schema is identical in shape — which makes benign dependency
 *    bumps trip the drift gate. We rename each volatile alias to a stable
 *    `alias-<contenthash>` derived from the definition's structure (with alias
 *    references neutralized so mutual recursion doesn't leak the volatile names
 *    into the hash), then rewrite every `$ref` to match.
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
const crypto = require("node:crypto");

// Matches the generator's position-derived alias names: `alias-` followed by
// two or more dash-separated numeric segments. Our stabilized names
// (`alias-<hex>`, a single segment) deliberately don't match this.
const VOLATILE_ALIAS = /^alias-\d+(-\d+)+$/;
const ALIAS_SENTINEL = " ALIAS ";

function fixDeprecatedStrings(schema) {
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
  return fixCount;
}

/**
 * Deep-clone `def`, replacing every `$ref` that points at a volatile alias
 * with a fixed sentinel. This yields a canonical form whose hash depends only
 * on the definition's shape — not on the specific (churning) alias names, and
 * not on which mutually-recursive alias we happen to be looking at.
 */
function canonicalize(def) {
  if (def === null || typeof def !== "object") return def;
  if (Array.isArray(def)) return def.map(canonicalize);
  const out = {};
  for (const key of Object.keys(def).sort()) {
    const value = def[key];
    if (key === "$ref" && typeof value === "string") {
      const name = value.replace("#/definitions/", "");
      out[key] = VOLATILE_ALIAS.test(name) ? ALIAS_SENTINEL : value;
    } else {
      out[key] = canonicalize(value);
    }
  }
  return out;
}

/**
 * Rename every volatile alias definition to a stable content-derived name and
 * rewrite all `$ref`s accordingly. Returns the number of aliases renamed.
 */
function stabilizeAliasNames(schema) {
  const definitions = schema.definitions;
  if (!definitions || typeof definitions !== "object") return 0;

  const volatileNames = Object.keys(definitions).filter((name) => VOLATILE_ALIAS.test(name));
  if (volatileNames.length === 0) return 0;

  const rename = {};
  const used = new Set();
  for (const oldName of volatileNames) {
    const canonical = JSON.stringify(canonicalize(definitions[oldName]));
    const digest = crypto.createHash("sha256").update(canonical).digest("hex").slice(0, 16);
    let newName = `alias-${digest}`;
    // Disambiguate the vanishingly unlikely case of two distinct shapes
    // hashing to the same prefix so we never collapse separate definitions.
    let suffix = 1;
    while (used.has(newName)) {
      newName = `alias-${digest}-${suffix++}`;
    }
    used.add(newName);
    rename[oldName] = newName;
  }

  // Rewrite every $ref throughout the tree.
  function rewriteRefs(node) {
    if (node === null || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach(rewriteRefs);
      return;
    }
    if (typeof node.$ref === "string") {
      const name = node.$ref.replace("#/definitions/", "");
      if (rename[name]) node.$ref = `#/definitions/${rename[name]}`;
    }
    for (const key of Object.keys(node)) {
      rewriteRefs(node[key]);
    }
  }
  rewriteRefs(schema);

  // Rewrite the definition keys themselves.
  for (const oldName of volatileNames) {
    const def = definitions[oldName];
    delete definitions[oldName];
    definitions[rename[oldName]] = def;
  }

  return volatileNames.length;
}

/**
 * Apply all normalization passes to a parsed schema object, mutating it in
 * place and returning it. Pure with respect to the filesystem so it can be
 * unit-tested directly.
 */
function normalizeSchema(schema) {
  fixDeprecatedStrings(schema);
  stabilizeAliasNames(schema);
  return schema;
}

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

function normalizeFile(inputPath) {
  const schema = JSON.parse(fs.readFileSync(inputPath, "utf-8"));
  const deprecatedFixes = fixDeprecatedStrings(schema);
  const aliasesRenamed = stabilizeAliasNames(schema);
  fs.writeFileSync(inputPath, JSON.stringify(schema, sortReplacer, 2) + "\n");
  console.error(
    `normalize-schema: fixed ${deprecatedFixes} deprecated string value(s), ` +
      `stabilized ${aliasesRenamed} alias name(s) in ${path.basename(inputPath)}`,
  );
}

module.exports = { normalizeSchema };

if (require.main === module) {
  const [inputPath] = process.argv.slice(2);
  if (!inputPath) {
    console.error("usage: normalize-schema.cjs <schema.json>");
    process.exit(1);
  }
  normalizeFile(inputPath);
}

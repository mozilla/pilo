/**
 * Debug helpers for search providers.
 */

const MAX_STRING_LEN = 120;

/**
 * Deep-clone a value for debug logging, truncating any long string so the
 * "flavor" of a response (text, summaries, snippets, etc.) is visible without
 * dumping the full payload. Non-string values pass through unchanged.
 */
export function abbreviateForDebug(value: unknown): unknown {
  const json = JSON.stringify(value, (_key, v) =>
    typeof v === "string" && v.length > MAX_STRING_LEN ? `${v.slice(0, MAX_STRING_LEN)}…` : v,
  );
  return json === undefined ? value : JSON.parse(json);
}

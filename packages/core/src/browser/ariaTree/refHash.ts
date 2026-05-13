/**
 * Pure, browser-safe utilities for content-derived element refs.
 * Single source of truth for ref format. No DOM walking, no globals.
 */

export const REF_HASH_LENGTH = 4;
export const REF_PREFIX = "E_";

const FNV_OFFSET_BASIS_32 = 0x811c9dc5;
const FNV_PRIME_32 = 0x01000193;

/**
 * FNV-1a 32-bit hash over the UTF-16 code units of `s`. Adequate for
 * deriving short, structurally-keyed element IDs; not cryptographic.
 */
export function fnv1a32(s: string): number {
  let h = FNV_OFFSET_BASIS_32;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    // Multiply with Math.imul to keep within 32-bit signed range, then
    // mask back to unsigned 32-bit at the end.
    h = Math.imul(h, FNV_PRIME_32);
  }
  return h >>> 0;
}

const FIELD_SEP = ""; // Unit Separator character, unlikely to appear in tag/role/name

/**
 * Compute a 32-bit identity hash for one ariaNode. Inputs delimited so that
 * field-boundary confusion (e.g. tagName "BUTTONbutton" vs tagName "BUTTON" +
 * role "button") cannot collide.
 *
 * `parentHash` propagates the structural path from the root; the root caller
 * supplies a frame-level sentinel (frameIndex + pathname).
 */
export function computeNodeHash(
  parentHash: number,
  tagName: string,
  role: string,
  accessibleName: string,
  gatedAttrs: string,
  siblingIndex: number,
): number {
  const payload =
    parentHash.toString(16) +
    FIELD_SEP +
    tagName +
    FIELD_SEP +
    role +
    FIELD_SEP +
    accessibleName +
    FIELD_SEP +
    gatedAttrs +
    FIELD_SEP +
    siblingIndex.toString(10);
  return fnv1a32(payload);
}

/**
 * Extract identity-bearing attributes from an element, keyed by tag.
 * The set is intentionally conservative — adding inputs is a future decision
 * driven by observed failure modes, not speculation.
 */
export function gatedAttrsFor(element: Element): string {
  const tag = element.tagName;
  switch (tag) {
    case "A":
      return "href=" + (element.getAttribute("href") ?? "");
    case "BUTTON":
      return "type=" + (element.getAttribute("type") ?? "");
    case "INPUT":
      return (
        "type=" +
        (element.getAttribute("type") ?? "") +
        "|name=" +
        (element.getAttribute("name") ?? "")
      );
    case "SELECT":
    case "TEXTAREA":
      return "name=" + (element.getAttribute("name") ?? "");
    default:
      return "";
  }
}

/**
 * Format a hash + occurrence number into a rendered ref string.
 * `occurrence` is 1-based: the first node with a given hash is `1` (no suffix),
 * the second is `2` (rendered `_2`), and so on.
 */
export function formatRef(hash: number, occurrence: number): string {
  const hex = hash.toString(16).padStart(REF_HASH_LENGTH, "0").slice(-REF_HASH_LENGTH);
  const base = REF_PREFIX + hex;
  return occurrence > 1 ? `${base}_${occurrence}` : base;
}

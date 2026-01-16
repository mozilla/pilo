/**
 * Configuration type utilities.
 *
 * Provides helper types and guards for working with the config schema.
 */

import type { ConfigFieldType } from "./schema.js";
import type { ConfigCategory } from "./metadata.js";
import { CONFIG_METADATA } from "./metadata.js";

/**
 * Extract the TypeScript type from a ConfigFieldType
 */
export type FieldTypeToTS<T extends ConfigFieldType> = T extends "string"
  ? string
  : T extends "number"
    ? number
    : T extends "boolean"
      ? boolean
      : T extends "enum"
        ? string
        : unknown;

/**
 * Type guard for checking if a value is a valid config field type
 */
export function isValidFieldType(type: string): type is ConfigFieldType {
  return ["string", "number", "boolean", "enum"].includes(type);
}

// Derive valid categories from CONFIG_METADATA to avoid hardcoding
const VALID_CATEGORIES = new Set(Object.values(CONFIG_METADATA).map((m) => m.category));

/**
 * Type guard for checking if a value is a valid config category
 */
export function isValidCategory(category: string): category is ConfigCategory {
  return VALID_CATEGORIES.has(category as ConfigCategory);
}

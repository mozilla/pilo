/**
 * Configuration type utilities.
 *
 * Note: SparkConfig interface is defined in ../config.ts for backward compatibility.
 * This file provides helper types and guards for working with the schema.
 */

import type { ConfigFieldType, ConfigCategory } from "./schema.js";

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

/**
 * Type guard for checking if a value is a valid config category
 */
export function isValidCategory(category: string): category is ConfigCategory {
  return [
    "ai",
    "browser",
    "proxy",
    "logging",
    "agent",
    "playwright",
    "navigation",
    "action",
  ].includes(category);
}

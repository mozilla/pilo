/**
 * Type guard helper functions for runtime type checking
 */

import type {
  TaskStartedEventData,
  AgentReasonedEventData,
  AgentStatusEventData,
  AIGenerationErrorEventData,
  TaskValidationErrorEventData,
  BrowserActionCompletedEventData,
} from "../types/browser";

/**
 * Check if an object has an optional string property
 */
export function hasOptionalStringProp(obj: unknown, prop: string): boolean {
  if (typeof obj !== "object" || obj === null) return false;
  const record = obj as Record<string, unknown>;
  // If property doesn't exist in object, that's fine (optional)
  if (!(prop in record)) return true;
  // If property exists, it must be a string (not undefined, null, etc)
  return typeof record[prop] === "string";
}

/**
 * Check if an object has an optional boolean property
 */
export function hasOptionalBooleanProp(obj: unknown, prop: string): boolean {
  if (typeof obj !== "object" || obj === null) return false;
  const record = obj as Record<string, unknown>;
  if (!(prop in record)) return true;
  return typeof record[prop] === "boolean";
}

/**
 * Check if an object has an optional number property
 */
export function hasOptionalNumberProp(obj: unknown, prop: string): boolean {
  if (typeof obj !== "object" || obj === null) return false;
  const record = obj as Record<string, unknown>;
  if (!(prop in record)) return true;
  return typeof record[prop] === "number";
}

/**
 * Check if an object has an optional string array property
 */
export function hasOptionalStringArrayProp(obj: unknown, prop: string): boolean {
  if (typeof obj !== "object" || obj === null) return false;
  const record = obj as Record<string, unknown>;
  if (!(prop in record)) return true;
  const value = record[prop];
  if (!Array.isArray(value)) return false;
  return value.every((item) => typeof item === "string");
}

/**
 * Check if an object has a required boolean property
 */
export function hasRequiredBooleanProp(obj: unknown, prop: string): boolean {
  if (typeof obj !== "object" || obj === null) return false;
  const value = (obj as Record<string, unknown>)[prop];
  return typeof value === "boolean";
}

/**
 * Type guard for TaskStartedEventData
 */
export function isTaskStartedData(data: unknown): data is TaskStartedEventData {
  if (typeof data !== "object" || data === null) return false;
  return hasOptionalStringProp(data, "plan") && hasOptionalStringProp(data, "taskId");
}

/**
 * Type guard for AgentReasonedEventData
 */
export function isAgentReasonedData(data: unknown): data is AgentReasonedEventData {
  if (typeof data !== "object" || data === null) return false;
  return hasOptionalStringProp(data, "thought");
}

/**
 * Type guard for AgentStatusEventData
 */
export function isAgentStatusData(data: unknown): data is AgentStatusEventData {
  if (typeof data !== "object" || data === null) return false;
  return hasOptionalStringProp(data, "message");
}

/**
 * Type guard for AIGenerationErrorEventData
 */
export function isAIGenerationErrorData(data: unknown): data is AIGenerationErrorEventData {
  if (typeof data !== "object" || data === null) return false;
  return (
    hasOptionalStringProp(data, "error") && hasOptionalBooleanProp(data, "isToolError")
  );
}

/**
 * Type guard for TaskValidationErrorEventData
 */
export function isTaskValidationErrorData(
  data: unknown,
): data is TaskValidationErrorEventData {
  if (typeof data !== "object" || data === null) return false;
  return (
    hasOptionalStringArrayProp(data, "errors") && hasOptionalNumberProp(data, "retryCount")
  );
}

/**
 * Type guard for BrowserActionCompletedEventData
 */
export function isBrowserActionCompletedData(
  data: unknown,
): data is BrowserActionCompletedEventData {
  if (typeof data !== "object" || data === null) return false;
  return (
    hasRequiredBooleanProp(data, "success") &&
    hasOptionalStringProp(data, "error") &&
    hasOptionalBooleanProp(data, "isRecoverable")
  );
}

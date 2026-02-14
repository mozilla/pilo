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
  BrowserActionStartedEventData,
  RealtimeEvent,
} from "../types/browser.js";

/**
 * Check if an object has an optional string property
 * Accepts: missing property, string value, or explicit undefined
 */
export function hasOptionalStringProp(obj: unknown, prop: string): boolean {
  if (typeof obj !== "object" || obj === null) return false;
  const record = obj as Record<string, unknown>;
  // If property doesn't exist in object, that's fine (optional)
  if (!(prop in record)) return true;
  const value = record[prop];
  // If property exists, it must be a string or undefined
  return typeof value === "string" || value === undefined;
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
  return (
    hasOptionalStringProp(data, "plan") &&
    hasOptionalStringProp(data, "taskId") &&
    hasOptionalStringArrayProp(data, "actionItems")
  );
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
  return hasOptionalStringProp(data, "error") && hasOptionalBooleanProp(data, "isToolError");
}

/**
 * Type guard for TaskValidationErrorEventData
 */
export function isTaskValidationErrorData(data: unknown): data is TaskValidationErrorEventData {
  if (typeof data !== "object" || data === null) return false;
  return hasOptionalStringArrayProp(data, "errors") && hasOptionalNumberProp(data, "retryCount");
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

/**
 * Type guard for BrowserActionStartedEventData
 */
export function isBrowserActionStartedData(data: unknown): data is BrowserActionStartedEventData {
  if (typeof data !== "object" || data === null) return false;
  const record = data as Record<string, unknown>;
  return (
    typeof record.action === "string" &&
    hasOptionalStringProp(data, "ref") &&
    hasOptionalStringProp(data, "value")
  );
}

/**
 * Type guard to validate if an event has the structure required for RealtimeEvent
 */
export function isValidRealtimeEvent(event: unknown): event is RealtimeEvent {
  if (!event || typeof event !== "object") {
    return false;
  }

  const candidate = event as Record<string, unknown>;

  // Check type field is a string
  if (typeof candidate.type !== "string") {
    return false;
  }

  // Check timestamp field is a number
  if (typeof candidate.timestamp !== "number") {
    return false;
  }

  // Check data field exists and is a non-null object (not array)
  if (!candidate.data || typeof candidate.data !== "object" || Array.isArray(candidate.data)) {
    return false;
  }

  return true;
}

/**
 * Type guard for agent action event data (from agent:action events)
 */
export function isAgentActionData(data: unknown): data is { action: string; value?: string } {
  if (typeof data !== "object" || data === null) return false;
  const record = data as Record<string, unknown>;
  return typeof record.action === "string";
}

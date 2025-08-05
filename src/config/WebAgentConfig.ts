/**
 * Configuration constants for WebAgent
 */

// Task completion quality constants used for validation
export const COMPLETION_QUALITY = {
  FAILED: "failed",
  PARTIAL: "partial",
  COMPLETE: "complete",
  EXCELLENT: "excellent",
} as const;

// Quality levels that indicate successful task completion
export const SUCCESS_QUALITIES = [
  COMPLETION_QUALITY.COMPLETE,
  COMPLETION_QUALITY.EXCELLENT,
] as const;

// Configuration constants
export const DEFAULT_MAX_VALIDATION_ATTEMPTS = 3;
export const DEFAULT_MAX_ITERATIONS = 50;
export const DEFAULT_GENERATION_MAX_TOKENS = 3000;
export const DEFAULT_EXTRACTION_MAX_TOKENS = 5000;
export const DEFAULT_PLANNING_MAX_TOKENS = 1500;
export const DEFAULT_VALIDATION_MAX_TOKENS = 1000;
export const MAX_RETRY_ATTEMPTS = 2;
export const RETRY_DELAY_MS = 1000;
export const MAX_CONVERSATION_MESSAGES = 100; // Prevent memory bloat

// Page processing constants
export const FILTERED_PREFIXES = ["/url:"];

// Transformations to compress aria tree snapshots for better LLM processing
export const ARIA_TRANSFORMATIONS: Array<[RegExp, string]> = [
  [/^listitem/g, "li"], // Shorten 'listitem' to 'li'
  [/(?<=\[)ref=/g, ""], // Remove 'ref=' prefix from references
  [/^link/g, "a"], // Shorten 'link' to 'a'
  [/^text: (.*?)$/g, '"$1"'], // Convert 'text: content' to '"content"'
  [/^heading "([^"]+)" \[level=(\d+)\]/g, 'h$2 "$1"'], // Convert headings to h1, h2, etc.
];

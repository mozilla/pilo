/**
 * Retry utilities for LLM calls
 *
 * Provides retry logic with exponential backoff for AI SDK functions.
 * Handles transient errors while avoiding retry on non-recoverable errors.
 */

import { generateText } from "ai";

/**
 * Default retry configuration
 */
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_INITIAL_DELAY = 1000; // 1 second
const DEFAULT_MAX_DELAY = 10000; // 10 seconds
const DEFAULT_BACKOFF_FACTOR = 2;

/**
 * Check if an error is retryable
 * Non-retryable: 4xx errors except 429 (rate limit)
 */
function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) return true;

  const errorAny = error as any;
  const statusCode = errorAny.statusCode || errorAny.status || errorAny.response?.status;

  if (statusCode) {
    // 4xx errors are client errors - non-retryable except 429 (rate limit)
    if (statusCode >= 400 && statusCode < 500 && statusCode !== 429) {
      return false;
    }
  }

  // Check for specific error messages that indicate non-retryable errors
  const message = error.message.toLowerCase();
  if (
    message.includes("invalid api key") ||
    message.includes("authentication") ||
    message.includes("unauthorized") ||
    message.includes("forbidden")
  ) {
    return false;
  }

  return true;
}

/**
 * Add jitter to delay to prevent thundering herd
 */
function addJitter(delay: number): number {
  // Add up to 25% jitter
  return delay + Math.random() * delay * 0.25;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface RetryOptions {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  onRetry?: (attempt: number, error: unknown) => void;
}

/**
 * Wrapper for generateText with retry logic
 *
 * @param params - Parameters for generateText call
 * @param retryOptions - Optional retry configuration
 * @returns The generateText result
 * @throws The last error if all retries fail
 */
export async function generateTextWithRetry<TOOLS extends Record<string, any> = any>(
  params: Parameters<typeof generateText<TOOLS>>[0],
  retryOptions?: RetryOptions,
): Promise<Awaited<ReturnType<typeof generateText<TOOLS>>>> {
  const {
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
    initialDelay = DEFAULT_INITIAL_DELAY,
    maxDelay = DEFAULT_MAX_DELAY,
    backoffFactor = DEFAULT_BACKOFF_FACTOR,
    onRetry,
  } = retryOptions || {};

  let lastError: unknown;
  let delay = initialDelay;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Attempt the generateText call
      return await generateText(params);
    } catch (error) {
      lastError = error;

      // Check if error is retryable
      if (!isRetryableError(error)) {
        throw error;
      }

      // Check if we have more attempts
      if (attempt === maxAttempts) {
        break;
      }

      // Call retry callback if provided
      if (onRetry) {
        onRetry(attempt, error);
      }

      // Wait with exponential backoff and jitter
      const waitTime = Math.min(addJitter(delay), maxDelay);
      await sleep(waitTime);

      // Increase delay for next attempt
      delay = Math.min(delay * backoffFactor, maxDelay);
    }
  }

  // All retries exhausted
  throw lastError;
}

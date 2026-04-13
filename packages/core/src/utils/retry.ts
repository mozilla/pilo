/**
 * Retry utilities for LLM calls
 *
 * Provides retry logic with exponential backoff for AI SDK functions.
 * Handles transient errors while avoiding retry on non-recoverable errors.
 */

import { generateText } from "ai";
import {
  DEFAULT_RETRY_MAX_ATTEMPTS,
  DEFAULT_RETRY_INITIAL_DELAY_MS,
  DEFAULT_RETRY_MAX_DELAY_MS,
  DEFAULT_RETRY_BACKOFF_FACTOR,
} from "../constants.js";
import { withSpan, SpanStatusCode, SpanName } from "../telemetry/tracing.js";

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
  return withSpan(SpanName.AI_GENERATE, {}, async (span) => {
    const {
      maxAttempts = DEFAULT_RETRY_MAX_ATTEMPTS,
      initialDelay = DEFAULT_RETRY_INITIAL_DELAY_MS,
      maxDelay = DEFAULT_RETRY_MAX_DELAY_MS,
      backoffFactor = DEFAULT_RETRY_BACKOFF_FACTOR,
      onRetry,
    } = retryOptions || {};

    let lastError: unknown;
    let delay = initialDelay;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await generateText(params);

        if (params.toolChoice === "required" && !result.toolResults?.length) {
          throw new Error("Tool call was required but model did not call any tools");
        }

        // Record success attributes
        span.setAttribute("pilo.ai.attempts", attempt);
        span.setAttribute("pilo.ai.finish_reason", String(result.finishReason));
        return result;
      } catch (error) {
        lastError = error;

        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorAny = error as any;
        const statusCode = errorAny.statusCode || errorAny.status || errorAny.response?.status;

        if (!isRetryableError(error)) {
          console.error(`[Retry] Non-retryable error encountered:`, {
            message: errorMessage,
            statusCode,
            attempt,
          });
          span.setAttribute("pilo.ai.attempts", attempt);
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: errorMessage,
          });
          span.recordException(error instanceof Error ? error : new Error(String(error)));
          throw error;
        }

        if (attempt === maxAttempts) {
          console.error(`[Retry] Max attempts (${maxAttempts}) reached`);
          break;
        }

        console.warn(`⚠️ [Retry] AI call failed (attempt ${attempt}/${maxAttempts}):`, {
          message: errorMessage,
          statusCode,
          retrying: true,
        });

        if (onRetry) {
          onRetry(attempt, error);
        }

        const waitTime = Math.min(addJitter(delay), maxDelay);
        console.log(`[Retry] Waiting ${Math.round(waitTime)}ms before retry...`);
        await sleep(waitTime);

        delay = Math.min(delay * backoffFactor, maxDelay);
        console.log(`[Retry] Retrying (attempt ${attempt + 1}/${maxAttempts})...`);
      }
    }

    // All retries exhausted
    const errorMessage = lastError instanceof Error ? lastError.message : String(lastError);
    const errorAny = lastError as any;
    const statusCode = errorAny.statusCode || errorAny.status || errorAny.response?.status;

    console.error(`❌ [Retry] AI call failed after ${maxAttempts} attempts:`, {
      message: errorMessage,
      statusCode,
      willThrow: true,
    });

    span.setAttribute("pilo.ai.attempts", maxAttempts);
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: errorMessage,
    });
    span.recordException(lastError instanceof Error ? lastError : new Error(String(lastError)));
    throw lastError;
  });
}

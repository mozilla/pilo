/**
 * Retry utilities for LLM calls
 *
 * Provides retry logic with exponential backoff for AI SDK functions.
 * Handles transient errors while avoiding retry on non-recoverable errors.
 */

import { generateText, generateObject, NoObjectGeneratedError } from "ai";
import {
  DEFAULT_RETRY_MAX_ATTEMPTS,
  DEFAULT_RETRY_INITIAL_DELAY_MS,
  DEFAULT_RETRY_MAX_DELAY_MS,
  DEFAULT_RETRY_BACKOFF_FACTOR,
} from "../constants.js";
import {
  withSpan,
  SpanStatusCode,
  SpanName,
  recordSanitizedException,
} from "../telemetry/tracing.js";

/**
 * Check if an error is retryable
 * Non-retryable:
 *  - 4xx errors except 429 (rate limit)
 *  - Auth/permission errors detected by message
 *  - Structured-output failures from `generateObject` (`NoObjectGeneratedError`):
 *    the model produced JSON that failed schema validation or parsing. Retrying
 *    the same prompt against the same schema will not fix this and just burns
 *    tokens, so we surface immediately.
 */
function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) return true;

  // Structured-output failures are non-retryable: the same prompt + schema will
  // produce the same failure mode.
  if (error instanceof NoObjectGeneratedError) {
    return false;
  }

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
 * Internal options for the shared retry driver. Wrapper-specific hooks let the
 * public wrappers (text vs object) plug in their own success validation and
 * telemetry extraction without leaking concerns into the driver.
 */
interface RetryDriverOptions<T> extends RetryOptions {
  /**
   * Optional post-success validation hook. If it throws, the thrown error is
   * treated like any other error from `call`: it goes through retry classification.
   * Used by `generateTextWithRetry` to enforce the `toolChoice: "required"` contract.
   */
  validateResult?: (result: T) => void;
  /**
   * Optional telemetry extractor. Called on success to record finish_reason on
   * the span. Different result shapes have different finish-reason locations.
   */
  getFinishReason?: (result: T) => unknown;
}

/**
 * Shared retry driver. Owns the loop, exponential backoff + jitter,
 * max-attempts handling, non-retryable short-circuit via `isRetryableError`,
 * `onRetry` callback dispatch, and span/telemetry recording.
 *
 * Wrapper functions (`generateTextWithRetry`, `generateObjectWithRetry`) build a
 * call closure and supply wrapper-specific hooks via `options`.
 */
async function retryDriver<T>(call: () => Promise<T>, options: RetryDriverOptions<T>): Promise<T> {
  return withSpan(SpanName.AI_GENERATE, {}, async (span) => {
    const {
      maxAttempts = DEFAULT_RETRY_MAX_ATTEMPTS,
      initialDelay = DEFAULT_RETRY_INITIAL_DELAY_MS,
      maxDelay = DEFAULT_RETRY_MAX_DELAY_MS,
      backoffFactor = DEFAULT_RETRY_BACKOFF_FACTOR,
      onRetry,
      validateResult,
      getFinishReason,
    } = options;

    let lastError: unknown;
    let delay = initialDelay;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await call();

        if (validateResult) {
          validateResult(result);
        }

        // Record success attributes
        span.setAttribute("pilo.ai.attempts", attempt);
        if (getFinishReason) {
          span.setAttribute("pilo.ai.finish_reason", String(getFinishReason(result)));
        }
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
            message: error instanceof Error ? error.constructor.name : "Unknown",
          });
          recordSanitizedException(span, error);
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
      message: lastError instanceof Error ? lastError.constructor.name : "Unknown",
    });
    recordSanitizedException(span, lastError);
    throw lastError;
  });
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
  type Result = Awaited<ReturnType<typeof generateText<TOOLS>>>;

  return retryDriver<Result>(() => generateText(params), {
    ...retryOptions,
    // When the caller required a tool call, treat a tool-less response as an
    // error so the retry loop can re-prompt the model.
    validateResult: (result) => {
      if (params.toolChoice === "required" && !result.toolResults?.length) {
        throw new Error("Tool call was required but model did not call any tools");
      }
    },
    getFinishReason: (result) => result.finishReason,
  });
}

/**
 * Wrapper for generateObject with retry logic
 *
 * Mirrors generateTextWithRetry's retry/backoff/non-retryable behavior, but for
 * structured object generation. No tool-call validation since generateObject
 * does not accept tools. `NoObjectGeneratedError` (schema/parse failures from
 * the model output) is treated as non-retryable by `isRetryableError`.
 *
 * @param params - Parameters for generateObject call
 * @param retryOptions - Optional retry configuration
 * @returns The generateObject result
 * @throws The last error if all retries fail
 */
export async function generateObjectWithRetry(
  params: Parameters<typeof generateObject>[0],
  retryOptions?: RetryOptions,
): Promise<Awaited<ReturnType<typeof generateObject>>> {
  type Result = Awaited<ReturnType<typeof generateObject>>;

  return retryDriver<Result>(() => generateObject(params), {
    ...retryOptions,
    getFinishReason: (result) => result.finishReason,
  });
}

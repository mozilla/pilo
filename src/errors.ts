/**
 * Error types for Spark
 *
 * RecoverableError: Errors the agent can recover from by retrying
 * BrowserException: Base class for browser-specific errors
 * InvalidRefException: When an element reference is invalid
 * ElementNotFoundException: When an element cannot be found
 * BrowserActionException: When a browser action fails
 * NavigationTimeoutException: When navigation times out (triggers retry with longer timeout)
 */

/**
 * Error that the agent can recover from by trying again
 */
export class RecoverableError extends Error {
  public readonly isRecoverable = true;
  public readonly context?: Record<string, any>;

  constructor(message: string, context?: Record<string, any>) {
    super(message);
    this.name = "RecoverableError";
    this.context = context;
  }
}

/**
 * Base class for browser-specific exceptions
 */
export abstract class BrowserException extends RecoverableError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, context);
    this.name = "BrowserException";
  }
}

/**
 * Thrown when an element reference is invalid
 */
export class InvalidRefException extends BrowserException {
  public readonly ref: string;

  constructor(ref: string, message?: string) {
    const defaultMessage = `Invalid element reference '${ref}'. The element does not exist on the current page. Please check the page snapshot for valid element references.`;
    super(message || defaultMessage, { ref });
    this.name = "InvalidRefException";
    this.ref = ref;
  }
}

/**
 * Thrown when an element cannot be found
 */
export class ElementNotFoundException extends BrowserException {
  public readonly selector?: string;

  constructor(selector?: string, message?: string) {
    const defaultMessage = selector
      ? `Element with selector '${selector}' not found on the page.`
      : "Element not found on the page.";
    super(message || defaultMessage, { selector });
    this.name = "ElementNotFoundException";
    this.selector = selector;
  }
}

/**
 * Thrown when a browser action fails
 */
export class BrowserActionException extends BrowserException {
  public readonly action: string;

  constructor(action: string, message: string, context?: Record<string, any>) {
    super(message, { ...context, action });
    this.name = "BrowserActionException";
    this.action = action;
  }
}

/**
 * Special error class for tool execution failures.
 * These errors are already reported in the tool result output,
 * so we don't need to add them as separate user messages.
 * This prevents duplicate error reporting to the LLM.
 */
export class ToolExecutionError extends RecoverableError {
  public readonly isToolError = true;
  public readonly toolName?: string;
  public readonly toolOutput?: any;

  constructor(message: string, context?: Record<string, any>) {
    super(message, context);
    this.name = "ToolExecutionError";
    this.toolName = context?.action;
    this.toolOutput = context?.output;
  }
}

/**
 * Thrown when navigation times out after all retry attempts.
 * This is the only navigation-specific error we handle specially (for retries).
 * Other navigation errors (connection refused, SSL errors, etc.) bubble up as-is.
 *
 * @see browser/navigationRetry.ts for retry configuration (timeouts, attempts, etc.)
 */
export class NavigationTimeoutException extends BrowserException {
  public readonly url: string;
  public readonly timeoutMs: number;
  public readonly attempt: number;
  public readonly maxAttempts: number;

  constructor(
    url: string,
    timeoutMs: number,
    context?: { attempt?: number; maxAttempts?: number },
  ) {
    const attempt = context?.attempt ?? 1;
    const maxAttempts = context?.maxAttempts ?? 1;
    super(
      `Navigation to '${url}' timed out after ${timeoutMs}ms (attempt ${attempt}/${maxAttempts})`,
      {
        url,
        timeoutMs,
        attempt,
        maxAttempts,
      },
    );
    this.name = "NavigationTimeoutException";
    this.url = url;
    this.timeoutMs = timeoutMs;
    this.attempt = attempt;
    this.maxAttempts = maxAttempts;
  }
}

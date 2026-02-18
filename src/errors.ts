/**
 * Error types for Spark
 *
 * RecoverableError: Errors the agent can recover from by retrying
 * BrowserException: Base class for browser-specific errors
 * InvalidRefException: When an element reference is invalid
 * ElementNotFoundException: When an element cannot be found
 * BrowserActionException: When a browser action fails
 * NavigationTimeoutException: When navigation times out (triggers retry with longer timeout)
 * NavigationNetworkException: When navigation fails due to network errors (triggers retry)
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
 *
 * @see browser/navigationRetry.ts for retry configuration
 * @see NavigationNetworkException for network-related failures
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
      `The page at '${url}' is unreachable (timed out after ${timeoutMs}ms on attempt ${attempt}/${maxAttempts}). Try a different URL or approach.`,
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

/**
 * Thrown when the browser connection is lost mid-task (CDP session closed).
 * WebAgent catches this to trigger a browser restart and execution reset rather
 * than treating it as an ordinary agent error.
 */
export class BrowserDisconnectedError extends RecoverableError {
  constructor(message: string) {
    super(`Browser connection lost: ${message}`);
    this.name = "BrowserDisconnectedError";
  }
}

/**
 * Thrown when navigation fails due to network errors after all retry attempts.
 * Covers errors like net::ERR_CONNECTION_REFUSED, net::ERR_NAME_NOT_RESOLVED, etc.
 *
 * @see browser/navigationRetry.ts for retry configuration
 */
export class NavigationNetworkException extends BrowserException {
  public readonly url: string;
  public readonly networkError: string;
  public readonly attempt: number;
  public readonly maxAttempts: number;

  constructor(
    url: string,
    networkError: string,
    context?: { attempt?: number; maxAttempts?: number },
  ) {
    const attempt = context?.attempt ?? 1;
    const maxAttempts = context?.maxAttempts ?? 1;
    super(
      `The page at '${url}' is unreachable (${networkError} on attempt ${attempt}/${maxAttempts}). Try a different URL or approach.`,
      {
        url,
        networkError,
        attempt,
        maxAttempts,
      },
    );
    this.name = "NavigationNetworkException";
    this.url = url;
    this.networkError = networkError;
    this.attempt = attempt;
    this.maxAttempts = maxAttempts;
  }
}

/**
 * Shared task execution logic used by both SSE and WebSocket endpoints.
 */

import {
  WebAgent,
  PlaywrightBrowser,
  createAIProvider,
  getAIProviderInfo,
  createNavigationRetryConfig,
  RecoverableError,
  SEARCH_PROVIDERS,
  PLAYWRIGHT_BROWSERS,
} from "pilo-core";
import type { FileUploadConfig, TaskExecutionResult, UserDataCallback } from "pilo-core";
import { StreamLogger } from "./StreamLogger.js";
import { config } from "./config.js";

export interface PiloTaskRequest {
  // Core task parameters
  task: string;
  url?: string;
  data?: Record<string, any>;
  guardrails?: string;

  // AI configuration overrides
  provider?:
    | "openai"
    | "openrouter"
    | "vertex"
    | "ollama"
    | "openai-compatible"
    | "lmstudio"
    | "google";
  model?: string;
  openaiApiKey?: string;
  openrouterApiKey?: string;
  googleApiKey?: string;
  ollamaBaseUrl?: string;
  openaiCompatibleBaseUrl?: string;
  openaiCompatibleName?: string;

  // Browser configuration overrides
  browser?: "firefox" | "chrome" | "chromium" | "safari" | "webkit" | "edge";
  channel?: string;
  executablePath?: string;
  headless?: boolean;
  vision?: boolean;
  debug?: boolean;
  blockAds?: boolean;
  blockResources?: string[];
  pwEndpoint?: string;
  pwCdpEndpoint?: string;
  pwCdpEndpoints?: string[];
  bypassCSP?: boolean;

  // WebAgent behavior overrides
  maxIterations?: number;
  maxValidationAttempts?: number;
  llmProviderTimeoutMs?: number;

  // Action firewall overrides
  trustedHostnames?: string[];
  unsafeMode?: boolean;
  uploadAllowedPaths?: string[];

  // Proxy configuration overrides
  proxy?: string;
  proxyUsername?: string;
  proxyPassword?: string;

  // Navigation retry configuration overrides
  navigationTimeoutMs?: number;
  navigationMaxTimeoutMs?: number;
  navigationMaxAttempts?: number;
  navigationTimeoutMultiplier?: number;

  // Action timeout configuration
  actionTimeoutMs?: number;

  // Logging configuration
  logger?: "console" | "json";

  // Search configuration overrides
  searchProvider?: "none" | "duckduckgo" | "google" | "bing" | "parallel-api";

  // Tabstack configuration overrides
  tabstackApiKey?: string;

  // Enable full screenshot events (default: false)
  includeScreenshotImages?: boolean;
}

/**
 * Coarse-grained error categories. Bounded cardinality so they're safe to use
 * as metric labels and dashboard filters. Never derived from user input or page
 * content. Refine over time; always extend via enum, never open-ended.
 */
export type ErrorReason =
  | "INVALID_REQUEST"
  | "PROVIDER_UNAUTHORIZED"
  | "NAVIGATION_TIMEOUT"
  | "BROWSER_DISCONNECTED"
  | "MAX_ITERATIONS"
  | "MAX_ERRORS"
  | "TIMEOUT"
  | "INTERNAL_ERROR";

/** Which phase of the request pipeline produced the error. */
export type ErrorPhase = "setup" | "execution";

export interface ErrorResponse {
  success: false;
  error: {
    /**
     * Human-readable description of the error. Definitionally safe: always
     * populated from a server-controlled source (a hardcoded literal at the
     * callsite or the REASON_HINTS map). Never derived from `error.message`
     * of a thrown value, which could embed user input or page content.
     */
    message: string;
    /** Fine-grained semantic code for programmatic handling (e.g. "MISSING_TASK"). */
    code: string;
    /** ISO timestamp when the response was generated. */
    timestamp: string;
    /** Error constructor name (e.g. "TypeError", "NavigationTimeoutException"). */
    class: string;
    /** Coarse-grained category, safe for metric labels. */
    reason: ErrorReason;
    /** True if the underlying error is a RecoverableError; hint for callers. */
    recoverable: boolean;
    /** Which pipeline phase the error occurred in. */
    phase?: ErrorPhase;
    /** Server-generated correlation ID for this task, if available. */
    taskId?: string;
  };
}

export interface CreateErrorResponseParams {
  message: string;
  class?: string;
  code: string;
  reason: ErrorReason;
  recoverable?: boolean;
  phase?: ErrorPhase;
  taskId?: string;
}

export const createErrorResponse = (params: CreateErrorResponseParams): ErrorResponse => ({
  success: false,
  error: {
    message: params.message,
    code: params.code,
    timestamp: new Date().toISOString(),
    class: params.class ?? "Error",
    reason: params.reason,
    recoverable: params.recoverable ?? false,
    ...(params.phase && { phase: params.phase }),
    ...(params.taskId && { taskId: params.taskId }),
  },
});

/**
 * Server-controlled human-readable hint per reason. Used as the `message`
 * for task-execution errors where the callsite has no better hardcoded
 * string. NEVER merges `error.message` of the thrown value.
 */
const REASON_HINTS: Record<ErrorReason, string> = {
  INVALID_REQUEST: "The request is invalid.",
  PROVIDER_UNAUTHORIZED: "The AI provider is not configured or the key is invalid.",
  NAVIGATION_TIMEOUT: "The target page did not finish loading in time.",
  BROWSER_DISCONNECTED: "The browser disconnected during task execution.",
  MAX_ITERATIONS:
    "The agent exceeded the maximum number of iterations without completing the task.",
  MAX_ERRORS: "The agent hit the error threshold and aborted.",
  TIMEOUT: "The task exceeded its time budget.",
  INTERNAL_ERROR: "The task failed due to an internal error.",
};

/**
 * Map an unknown thrown value to a safe (reason, recoverable) pair.
 *
 * Uses `instanceof RecoverableError` for the recoverable flag and
 * `error.constructor.name` string matching for the specific reason. The string
 * matching is intentionally temporary — stack D2 replaces Playwright/AI SDK
 * error wrapping so we can use instanceof checks for specific classes too.
 */
function classifyError(error: unknown): { reason: ErrorReason; recoverable: boolean } {
  const recoverable = error instanceof RecoverableError;
  if (!(error instanceof Error)) {
    return { reason: "INTERNAL_ERROR", recoverable: false };
  }
  switch (error.constructor.name) {
    case "NavigationTimeoutException":
    case "NavigationNetworkException":
      return { reason: "NAVIGATION_TIMEOUT", recoverable: true };
    case "BrowserDisconnectedError":
      return { reason: "BROWSER_DISCONNECTED", recoverable: true };
    default:
      return { reason: "INTERNAL_ERROR", recoverable };
  }
}

/**
 * Build an ErrorResponse from an unknown thrown value. Extracts the error's
 * class name, classifies into a reason + recoverable flag, and picks a
 * human-readable message from REASON_HINTS. Never forwards error.message
 * from the thrown value — agent/browser errors can embed user input or page
 * content.
 */
export const errorResponseFromError = (
  error: unknown,
  opts: { code: string; phase: ErrorPhase; taskId?: string },
): ErrorResponse => {
  const errorClass = error instanceof Error ? error.constructor.name : "Unknown";
  const { reason, recoverable } = classifyError(error);
  return createErrorResponse({
    message: REASON_HINTS[reason],
    class: errorClass,
    code: opts.code,
    reason,
    recoverable,
    phase: opts.phase,
    taskId: opts.taskId,
  });
};

/**
 * Validate a task request and return an error response if invalid, or null if valid.
 */
export function validateTaskRequest(
  body: PiloTaskRequest,
): { status: number; response: ErrorResponse } | null {
  if (!body.task) {
    return {
      status: 400,
      response: createErrorResponse({
        message: "Task is required",
        code: "MISSING_TASK",
        reason: "INVALID_REQUEST",
        phase: "setup",
      }),
    };
  }

  if (
    body.searchProvider &&
    !SEARCH_PROVIDERS.includes(body.searchProvider as (typeof SEARCH_PROVIDERS)[number])
  ) {
    return {
      status: 400,
      response: createErrorResponse({
        message: `Invalid search provider. Must be one of: ${SEARCH_PROVIDERS.join(", ")}`,
        code: "INVALID_SEARCH_PROVIDER",
        reason: "INVALID_REQUEST",
        phase: "setup",
      }),
    };
  }

  const serverConfig = config.getConfig();
  const effectiveSearchProvider = body.searchProvider ?? serverConfig.search_provider;
  if (effectiveSearchProvider === "parallel-api" && !serverConfig.parallel_api_key) {
    return {
      status: 400,
      response: createErrorResponse({
        message:
          "parallel-api search provider requires PARALLEL_API_KEY to be configured on the server",
        code: "MISSING_SEARCH_API_KEY",
        reason: "INVALID_REQUEST",
        phase: "setup",
      }),
    };
  }

  try {
    getAIProviderInfo();
  } catch {
    return {
      status: 500,
      response: createErrorResponse({
        message: "AI provider is not configured.",
        code: "MISSING_API_KEY",
        reason: "PROVIDER_UNAUTHORIZED",
        phase: "setup",
      }),
    };
  }

  return null;
}

export type EventSender = (event: string, data: any) => Promise<void>;

export interface TaskRunnerOptions {
  body: PiloTaskRequest;
  sendEvent: EventSender;
  abortSignal: AbortSignal;
  onUserDataRequired?: UserDataCallback;
  taskId?: string;
}

/**
 * Run a Pilo task with the given options. Shared by SSE and WebSocket endpoints.
 */
export async function runTask(options: TaskRunnerOptions): Promise<TaskExecutionResult> {
  const { body, sendEvent, abortSignal, onUserDataRequired, taskId } = options;
  const serverConfig = config.getConfig();

  const browserName = body.browser ?? serverConfig.browser;
  if (!(PLAYWRIGHT_BROWSERS as readonly string[]).includes(browserName)) {
    throw new Error(
      `Server only supports Playwright browsers (${PLAYWRIGHT_BROWSERS.join(", ")}), got "${browserName}"`,
    );
  }
  const uploadAllowedPaths = body.uploadAllowedPaths ?? serverConfig.upload_allowed_paths;
  const allowFileUpload: false | FileUploadConfig =
    uploadAllowedPaths.length > 0 ? { allowedPaths: uploadAllowedPaths } : false;

  const browserConfig = {
    browser: browserName as (typeof PLAYWRIGHT_BROWSERS)[number],
    channel: body.channel ?? serverConfig.channel,
    executablePath: body.executablePath ?? serverConfig.executable_path,
    headless: body.headless ?? serverConfig.headless,
    blockAds: body.blockAds ?? serverConfig.block_ads,
    blockResources: (body.blockResources ??
      (serverConfig.block_resources ? serverConfig.block_resources.split(",") : undefined)) as
      | Array<"image" | "stylesheet" | "font" | "media" | "manifest">
      | undefined,
    pwEndpoint: body.pwEndpoint ?? serverConfig.pw_endpoint,
    pwCdpEndpoint: body.pwCdpEndpoint ?? serverConfig.pw_cdp_endpoint,
    pwCdpEndpoints:
      body.pwCdpEndpoints ??
      serverConfig.pw_cdp_endpoints ??
      (serverConfig.pw_cdp_endpoint ? [serverConfig.pw_cdp_endpoint] : undefined),
    bypassCSP: body.bypassCSP ?? serverConfig.bypass_csp,
    proxyServer: body.proxy ?? serverConfig.proxy,
    proxyUsername: body.proxyUsername ?? serverConfig.proxy_username,
    proxyPassword: body.proxyPassword ?? serverConfig.proxy_password,
    actionTimeoutMs: body.actionTimeoutMs ?? serverConfig.action_timeout_ms,
    allowFileUpload,
    navigationRetry: createNavigationRetryConfig({
      baseTimeoutMs: body.navigationTimeoutMs ?? serverConfig.navigation_timeout_ms,
      maxTimeoutMs: body.navigationMaxTimeoutMs ?? serverConfig.navigation_max_timeout_ms,
      maxAttempts: body.navigationMaxAttempts ?? serverConfig.navigation_max_attempts,
      timeoutMultiplier:
        body.navigationTimeoutMultiplier ?? serverConfig.navigation_timeout_multiplier,
    }),
  };

  const webAgentConfig = {
    debug: body.debug ?? serverConfig.debug,
    vision: body.vision ?? serverConfig.vision,
    maxIterations: body.maxIterations ?? serverConfig.max_iterations,
    maxValidationAttempts: body.maxValidationAttempts ?? serverConfig.max_validation_attempts,
    trustedHostnames: body.trustedHostnames ?? serverConfig.trusted_hostnames,
    unsafeMode: body.unsafeMode ?? serverConfig.unsafe_mode,
    allowFileUpload,
    llmProviderTimeoutMs: body.llmProviderTimeoutMs ?? serverConfig.llm_provider_timeout_ms,
    guardrails: body.guardrails,
    searchProvider: body.searchProvider ?? serverConfig.search_provider,
    searchApiKey: serverConfig.parallel_api_key,
    tabstackApiKey: body.tabstackApiKey ?? serverConfig.tabstack_api_key,
    tabstackApiUrl: serverConfig.tabstack_api_url,
  };

  const browser = new PlaywrightBrowser(browserConfig);

  const logger = new StreamLogger({
    sendEvent,
    includeScreenshotImages: body.includeScreenshotImages ?? false,
  });

  const providerConfig = createAIProvider({
    provider: body.provider,
    model: body.model,
    openai_api_key: body.openaiApiKey,
    openrouter_api_key: body.openrouterApiKey,
    google_generative_ai_api_key: body.googleApiKey,
    ollama_base_url: body.ollamaBaseUrl,
    openai_compatible_base_url: body.openaiCompatibleBaseUrl,
    openai_compatible_name: body.openaiCompatibleName,
  });

  const agent = new WebAgent(browser, {
    ...webAgentConfig,
    providerConfig,
    logger,
    onUserDataRequired,
    taskId,
  });

  try {
    return await agent.execute(body.task, {
      startingUrl: body.url,
      data: body.data,
      abortSignal,
    });
  } finally {
    try {
      await agent.close();
    } catch (closeError) {
      console.error("[pilo-server] error closing agent", {
        taskId,
        error_class: closeError instanceof Error ? closeError.constructor.name : "Unknown",
      });
    }
  }
}

/**
 * Shared task execution logic used by both SSE and WebSocket endpoints.
 */

import {
  WebAgent,
  PlaywrightBrowser,
  createAIProvider,
  getAIProviderInfo,
  createNavigationRetryConfig,
  SEARCH_PROVIDERS,
} from "pilo-core";
import type { TaskExecutionResult, UserDataCallback } from "pilo-core";
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

export interface ErrorResponse {
  success: false;
  error: {
    message: string;
    code: string;
    timestamp: string;
    taskId?: string;
  };
}

// Use error.name rather than error.message to avoid leaking sensitive data
export const errorToString = (error: unknown): string =>
  error instanceof Error ? error.name : "Unknown error";

export const createErrorResponse = (
  message: string,
  code: string,
  taskId?: string,
): ErrorResponse => ({
  success: false,
  error: {
    message,
    code,
    timestamp: new Date().toISOString(),
    ...(taskId !== undefined && { taskId }),
  },
});

/**
 * Validate a task request and return an error response if invalid, or null if valid.
 */
export function validateTaskRequest(
  body: PiloTaskRequest,
): { status: number; response: ErrorResponse } | null {
  if (!body.task) {
    return { status: 400, response: createErrorResponse("Task is required", "MISSING_TASK") };
  }

  if (
    body.searchProvider &&
    !SEARCH_PROVIDERS.includes(body.searchProvider as (typeof SEARCH_PROVIDERS)[number])
  ) {
    return {
      status: 400,
      response: createErrorResponse(
        `Invalid search provider: ${body.searchProvider}. Must be one of: ${SEARCH_PROVIDERS.join(", ")}`,
        "INVALID_SEARCH_PROVIDER",
      ),
    };
  }

  const serverConfig = config.getConfig();
  const effectiveSearchProvider = body.searchProvider ?? serverConfig.search_provider;
  if (effectiveSearchProvider === "parallel-api" && !serverConfig.parallel_api_key) {
    return {
      status: 400,
      response: createErrorResponse(
        "parallel-api search provider requires PARALLEL_API_KEY to be configured on the server",
        "MISSING_SEARCH_API_KEY",
      ),
    };
  }

  try {
    getAIProviderInfo();
  } catch (error) {
    return {
      status: 500,
      response: createErrorResponse(
        `AI provider not configured: ${errorToString(error)}`,
        "MISSING_API_KEY",
      ),
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

  const browserConfig = {
    browser: body.browser ?? serverConfig.browser,
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
      console.error("Error closing agent:", closeError);
    }
  }
}

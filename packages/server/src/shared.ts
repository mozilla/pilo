// Shared types and utilities used by both SSE and WebSocket route handlers

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

interface ErrorResponse {
  success: false;
  error: {
    message: string;
    code: string;
    timestamp: string;
  };
}

// Use error.name rather than error.message to avoid leaking sensitive data
// (e.g. credentials embedded in proxy URLs that Playwright includes in error messages)
export const errorToString = (error: unknown): string =>
  error instanceof Error ? error.name : "Unknown error";

export const createErrorResponse = (message: string, code: string): ErrorResponse => ({
  success: false,
  error: {
    message,
    code,
    timestamp: new Date().toISOString(),
  },
});

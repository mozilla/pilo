import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import {
  WebAgent,
  PlaywrightBrowser,
  createAIProvider,
  getAIProviderInfo,
  createNavigationRetryConfig,
} from "spark";
import type { TaskExecutionResult } from "spark";
import { StreamLogger } from "../StreamLogger.js";
import { config } from "../config.js";

interface ErrorResponse {
  success: false;
  error: {
    message: string;
    code: string;
    timestamp: string;
  };
}

const createErrorResponse = (message: string, code: string): ErrorResponse => ({
  success: false,
  error: {
    message,
    code,
    timestamp: new Date().toISOString(),
  },
});

const spark = new Hono();

interface SparkTaskRequest {
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
}

// POST /spark/run - Execute a Spark task with real-time streaming
spark.post("/run", async (c) => {
  try {
    const body = (await c.req.json()) as SparkTaskRequest;

    if (!body.task) {
      return c.json(createErrorResponse("Task is required", "MISSING_TASK"), 400);
    }

    // Get server configuration
    const serverConfig = config.getConfig();

    // Validate that we have some AI provider configured

    try {
      // This will throw if no API key is available
      getAIProviderInfo();
    } catch (error) {
      return c.json(
        createErrorResponse(
          `AI provider not configured: ${error instanceof Error ? error.message : String(error)}`,
          "MISSING_API_KEY",
        ),
        500,
      );
    }

    // Use Hono's streamSSE for proper Server-Sent Events handling
    return streamSSE(c, async (stream) => {
      // Create AbortController to handle request termination
      const abortController = new AbortController();

      // Handle client disconnection
      stream.onAbort(() => {
        console.log("🛑 Client disconnected, aborting task execution");
        abortController.abort();
      });

      let agent: WebAgent | null = null;

      try {
        await stream.writeSSE({
          event: "start",
          data: JSON.stringify({ task: body.task, url: body.url }),
        });

        // Merge server config with request overrides
        // serverConfig already has Zod defaults applied, so request body overrides are optional
        const browserConfig = {
          browser: body.browser ?? serverConfig.browser,
          channel: body.channel ?? serverConfig.channel,
          executablePath: body.executablePath ?? serverConfig.executable_path,
          headless: body.headless ?? serverConfig.headless,
          blockAds: body.blockAds ?? serverConfig.block_ads,
          blockResources: (body.blockResources ??
            (serverConfig.block_resources
              ? serverConfig.block_resources.split(",")
              : undefined)) as
            | Array<"image" | "stylesheet" | "font" | "media" | "manifest">
            | undefined,
          pwEndpoint: body.pwEndpoint ?? serverConfig.pw_endpoint,
          pwCdpEndpoint: body.pwCdpEndpoint ?? serverConfig.pw_cdp_endpoint,
          bypassCSP: body.bypassCSP ?? serverConfig.bypass_csp,
          proxyServer: body.proxy ?? serverConfig.proxy,
          proxyUsername: body.proxyUsername ?? serverConfig.proxy_username,
          proxyPassword: body.proxyPassword ?? serverConfig.proxy_password,
          actionTimeoutMs: body.actionTimeoutMs ?? serverConfig.action_timeout_ms,
          // Use createNavigationRetryConfig which safely handles undefined values
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
        };

        // Create browser and agent instances
        const browser = new PlaywrightBrowser(browserConfig);

        // Create StreamLogger that uses Hono's stream
        const logger = new StreamLogger(async (event: string, data: any) => {
          await stream.writeSSE({
            event,
            data: JSON.stringify(data),
          });
        });

        // Create AI provider with potential overrides
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

        agent = new WebAgent(browser, {
          ...webAgentConfig,
          providerConfig,
          logger,
        });

        // Execute the task with AbortSignal
        const result: TaskExecutionResult = await agent.execute(body.task, {
          startingUrl: body.url,
          data: body.data,
          abortSignal: abortController.signal,
        });

        // Send final result
        await stream.writeSSE({
          event: "complete",
          data: JSON.stringify(result),
        });

        // Emit done event only on successful completion
        await stream.writeSSE({
          event: "done",
          data: JSON.stringify({}),
        });
      } catch (error) {
        // Check if the error is due to request termination
        if (abortController.signal.aborted) {
          console.log("🛑 Task execution aborted due to client disconnection");
          // Don't try to write to stream - client is gone
        } else {
          console.error("Spark task execution failed:", error);
          await stream.writeSSE({
            event: "error",
            data: JSON.stringify(
              createErrorResponse(
                error instanceof Error ? error.message : "Unknown error",
                "TASK_EXECUTION_FAILED",
              ),
            ),
          });
        }
      } finally {
        // Always clean up browser resources
        if (agent) {
          try {
            await agent.close();
          } catch (closeError) {
            console.error("Error closing agent:", closeError);
          }
        }
      }
    });
  } catch (error) {
    console.error("Spark task setup failed:", error);
    return c.json(
      createErrorResponse(
        error instanceof Error ? error.message : "Unknown error",
        "TASK_SETUP_FAILED",
      ),
      500,
    );
  }
});

export default spark;

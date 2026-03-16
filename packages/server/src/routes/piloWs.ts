import { Hono } from "hono";
import type { UpgradeWebSocket, WSContext, WSMessageReceive } from "hono/ws";
import {
  WebAgent,
  PlaywrightBrowser,
  createAIProvider,
  getAIProviderInfo,
  createNavigationRetryConfig,
  SEARCH_PROVIDERS,
  DEFAULT_INPUT_TIMEOUT_MS,
} from "pilo-core";
import type {
  OnInputCallback,
  InputRequest,
  InputResponse,
  TaskExecutionResult,
} from "pilo-core";
import { StreamLogger } from "../StreamLogger.js";
import { config } from "../config.js";
import { errorToString } from "../shared.js";
import type { PiloTaskRequest } from "../shared.js";
import { nanoid } from "nanoid";

// === Message Types ===

interface TaskStartMessage {
  event: "task:start";
  taskId?: string;
  data: PiloTaskRequest;
}

interface InputFormResponseMessage {
  event: "input:form_response";
  data: {
    questionId: string;
    response:
      | { type: "form"; fields: Record<string, string> }
      | { type: "declined"; reason?: string };
  };
}

type ClientMessage = TaskStartMessage | InputFormResponseMessage;

// === Message Parsing ===

const VALID_EVENTS = new Set(["task:start", "input:form_response"]);

export function parseClientMessage(raw: string): ClientMessage | null {
  try {
    const parsed = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof parsed.event !== "string" ||
      !VALID_EVENTS.has(parsed.event)
    ) {
      return null;
    }
    return parsed as ClientMessage;
  } catch {
    return null;
  }
}

// === Outbound Message Helpers ===

export interface OutboundMessage {
  event: string;
  taskId: string;
  data: Record<string, any>;
}

export function serializeMessage(msg: OutboundMessage): string {
  return JSON.stringify(msg);
}

// === Input Response Registry ===

export class InputResponseRegistry {
  private pending: Map<
    string,
    { resolve: (response: InputResponse) => void }
  > = new Map();

  waitForResponse(questionId: string): Promise<InputResponse> {
    return new Promise((resolve) => {
      this.pending.set(questionId, { resolve });
    });
  }

  deliver(questionId: string, response: InputResponse): boolean {
    const entry = this.pending.get(questionId);
    if (!entry) return false;
    this.pending.delete(questionId);
    entry.resolve(response);
    return true;
  }

  rejectAll(reason: string): void {
    for (const [questionId, entry] of this.pending) {
      entry.resolve({ type: "declined", reason });
      this.pending.delete(questionId);
    }
  }
}

// === Keepalive ===

const PING_INTERVAL_MS = 30_000;

// === Route Factory ===

export function createPiloWsRoute(upgradeWebSocket: UpgradeWebSocket) {
  const pilo = new Hono();

  pilo.get(
    "/run",
    upgradeWebSocket(() => {
      const registry = new InputResponseRegistry();
      const abortController = new AbortController();
      let taskId = "";
      let taskStarted = false;
      let pingInterval: ReturnType<typeof setInterval> | undefined;

      const sendMessage = (ws: WSContext, event: string, data: Record<string, any>) => {
        if (ws.readyState === 1) {
          ws.send(serializeMessage({ event, taskId, data }));
        }
      };

      return {
        onOpen(_evt: Event, ws: WSContext) {
          pingInterval = setInterval(() => {
            if (ws.readyState === 1) {
              try {
                const raw = ws.raw as any;
                if (raw && typeof raw.ping === "function") {
                  raw.ping();
                }
              } catch {
                // Ignore ping errors
              }
            }
          }, PING_INTERVAL_MS);
        },

        async onMessage(evt: MessageEvent<WSMessageReceive>, ws: WSContext) {
          const raw = typeof evt.data === "string" ? evt.data : String(evt.data);
          const message = parseClientMessage(raw);

          if (!message) {
            sendMessage(ws, "error", { message: "Invalid message format" });
            return;
          }

          if (message.event === "input:form_response") {
            const { questionId, response } = message.data;
            const delivered = registry.deliver(questionId, response as InputResponse);
            if (!delivered) {
              sendMessage(ws, "error", {
                message: `No pending input request for questionId: ${questionId}`,
              });
            }
            return;
          }

          // task:start
          if (taskStarted) {
            sendMessage(ws, "error", {
              message: "Task already started on this connection",
            });
            return;
          }
          taskStarted = true;

          const body = message.data;
          taskId = message.taskId ?? nanoid(12);

          if (!body.task) {
            sendMessage(ws, "error", { message: "task field is required" });
            ws.close(1008, "task field is required");
            return;
          }

          if (
            body.searchProvider &&
            !SEARCH_PROVIDERS.includes(body.searchProvider as (typeof SEARCH_PROVIDERS)[number])
          ) {
            sendMessage(ws, "error", {
              message: `Invalid search provider: ${body.searchProvider}. Must be one of: ${SEARCH_PROVIDERS.join(", ")}`,
            });
            ws.close(1008, "Invalid search provider");
            return;
          }

          const serverConfig = config.getConfig();

          const effectiveSearchProvider = body.searchProvider ?? serverConfig.search_provider;
          if (effectiveSearchProvider === "parallel-api" && !serverConfig.parallel_api_key) {
            sendMessage(ws, "error", {
              message:
                "parallel-api search provider requires PARALLEL_API_KEY to be configured on the server",
            });
            ws.close(1008, "Missing search API key");
            return;
          }

          try {
            getAIProviderInfo();
          } catch (error) {
            sendMessage(ws, "error", {
              message: `AI provider not configured: ${errorToString(error)}`,
            });
            ws.close(1011, "AI provider not configured");
            return;
          }

          let agent: WebAgent | null = null;

          try {
            sendMessage(ws, "start", { task: body.task, url: body.url });

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
                maxTimeoutMs:
                  body.navigationMaxTimeoutMs ?? serverConfig.navigation_max_timeout_ms,
                maxAttempts:
                  body.navigationMaxAttempts ?? serverConfig.navigation_max_attempts,
                timeoutMultiplier:
                  body.navigationTimeoutMultiplier ??
                  serverConfig.navigation_timeout_multiplier,
              }),
            };

            const inputTimeoutMs = DEFAULT_INPUT_TIMEOUT_MS;

            const onInput: OnInputCallback = async (request: InputRequest) => {
              const eventData: Record<string, any> = {
                questionId: request.questionId,
                question: request.question,
                fields: request.fields,
                timeoutMs: inputTimeoutMs,
              };
              if (request.pageUrl) eventData.pageUrl = request.pageUrl;
              if (request.pageTitle) eventData.pageTitle = request.pageTitle;

              sendMessage(ws, "input:form", eventData);

              return registry.waitForResponse(request.questionId);
            };

            const logger = new StreamLogger({
              sendEvent: async (event: string, data: any) => {
                sendMessage(ws, event, data);
              },
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

            const browser = new PlaywrightBrowser(browserConfig);

            agent = new WebAgent(browser, {
              debug: body.debug ?? serverConfig.debug,
              vision: body.vision ?? serverConfig.vision,
              maxIterations: body.maxIterations ?? serverConfig.max_iterations,
              maxValidationAttempts:
                body.maxValidationAttempts ?? serverConfig.max_validation_attempts,
              guardrails: body.guardrails,
              searchProvider: body.searchProvider ?? serverConfig.search_provider,
              searchApiKey: serverConfig.parallel_api_key,
              providerConfig,
              logger,
              onInput,
              inputTimeoutMs,
            });

            const result: TaskExecutionResult = await agent.execute(body.task, {
              startingUrl: body.url,
              data: body.data,
              abortSignal: abortController.signal,
            });

            sendMessage(ws, "complete", result as unknown as Record<string, any>);
            sendMessage(ws, "done", {});

            await new Promise((resolve) => setTimeout(resolve, 50));
            ws.close(1000, "Task complete");
          } catch (error) {
            if (abortController.signal.aborted) {
              console.log("Task execution aborted due to client disconnection");
            } else {
              console.error("Pilo task execution failed:", error);
              sendMessage(ws, "error", {
                message: errorToString(error),
                code: "TASK_EXECUTION_FAILED",
              });
              ws.close(1011, "Task execution failed");
            }
          } finally {
            if (agent) {
              try {
                await agent.close();
              } catch (closeError) {
                console.error("Error closing agent:", closeError);
              }
            }
          }
        },

        onClose() {
          abortController.abort();
          registry.rejectAll("WebSocket connection closed");
          if (pingInterval) {
            clearInterval(pingInterval);
            pingInterval = undefined;
          }
        },

        onError(evt: Event) {
          console.error("WebSocket error:", evt);
          abortController.abort();
          registry.rejectAll("WebSocket error");
          if (pingInterval) {
            clearInterval(pingInterval);
            pingInterval = undefined;
          }
        },
      };
    }),
  );

  return pilo;
}

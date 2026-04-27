/**
 * WebSocket endpoint for interactive Pilo task execution.
 *
 * All messages use flat { event, data } format (mirrors SSE structure).
 *
 * Client -> Server:
 *   { "event": "task:details", "data": PiloTaskRequest }
 *   { "event": "user_data_response", "data": UserDataResponse }
 *
 * Server -> Client:
 *   { "event": "<eventType>", "data": {...} }
 *     All agent events stream through, including:
 *     - "interactive:form_data:request" (client must respond with user_data_response)
 *     - "interactive:form_data:error" (validation failed, client must respond with corrected data)
 *   { "event": "complete", "data": TaskExecutionResult }
 *   { "event": "error", "data": ErrorResponse }
 */

import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import type { UpgradeWebSocket, WSContext } from "hono/ws";
import type { UserDataCallback, UserDataResponse } from "pilo-core";
import { withRemoteContext } from "pilo-core";
import { release, tryAcquire } from "../concurrency.js";
import {
  runTask,
  validateTaskRequest,
  createErrorResponse,
  errorResponseFromError,
} from "../taskRunner.js";
import type { PiloTaskRequest } from "../taskRunner.js";

/** Default timeout for waiting on a user data response (5 minutes). */
const USER_DATA_TIMEOUT_MS = 5 * 60 * 1000;

interface PendingRequest {
  resolve: (response: UserDataResponse) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

function send(ws: WSContext, event: string, data: any): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const raw = ws.raw as { send(data: string, cb?: (err?: Error) => void): void };
    raw.send(JSON.stringify({ event, data }), (err?: Error) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export function createPiloWsRoute(upgradeWebSocket: UpgradeWebSocket): Hono {
  const piloWs = new Hono();

  piloWs.get(
    "/run",
    upgradeWebSocket((c) => {
      // Capture W3C trace context headers from the WebSocket upgrade request
      // so that task execution joins the caller's distributed trace.
      const traceHeaders = {
        traceparent: c.req.header("traceparent"),
        tracestate: c.req.header("tracestate"),
      };

      const abortController = new AbortController();
      const pendingRequests = new Map<string, PendingRequest>();
      let taskRunning = false;

      return {
        onMessage(evt, ws) {
          let msg: any;
          try {
            msg = JSON.parse(typeof evt.data === "string" ? evt.data : String(evt.data));
          } catch {
            send(
              ws,
              "error",
              createErrorResponse({
                message: "Invalid JSON message",
                code: "INVALID_MESSAGE",
                reason: "INVALID_REQUEST",
                phase: "setup",
              }),
            );
            return;
          }

          if (msg.event === "task:details") {
            if (taskRunning) {
              send(
                ws,
                "error",
                createErrorResponse({
                  message: "A task is already running on this connection",
                  code: "TASK_ALREADY_RUNNING",
                  reason: "INVALID_REQUEST",
                  phase: "setup",
                }),
              );
              return;
            }

            const body = msg.data as PiloTaskRequest;
            const taskId = randomUUID();
            if (!body) {
              send(
                ws,
                "error",
                createErrorResponse({
                  message: "Missing data",
                  code: "MISSING_DATA",
                  reason: "INVALID_REQUEST",
                  phase: "setup",
                  taskId,
                }),
              );
              return;
            }

            const validationError = validateTaskRequest(body);
            if (validationError) {
              send(ws, "error", {
                ...validationError.response,
                error: { ...validationError.response.error, taskId },
              });
              return;
            }

            if (!tryAcquire()) {
              send(
                ws,
                "error",
                createErrorResponse({
                  message: "The server is at capacity. Retry after a short delay.",
                  code: "AT_CAPACITY",
                  reason: "AT_CAPACITY",
                  phase: "setup",
                  taskId,
                }),
              );
              return;
            }

            taskRunning = true;
            send(ws, "task:accepted", { taskId });

            // The callback just blocks until the client responds.
            // The event (interactive:form_data:request or interactive:form_data:error)
            // flows to the client through the normal event stream via sendEvent.
            // The client sees the event, collects data, and sends user_data_response.
            const onUserDataRequired: UserDataCallback = (request) => {
              return new Promise<UserDataResponse>((resolve, reject) => {
                const timer = setTimeout(() => {
                  pendingRequests.delete(request.requestId);
                  reject(new Error("User data request timed out"));
                }, USER_DATA_TIMEOUT_MS);

                pendingRequests.set(request.requestId, { resolve, reject, timer });
              });
            };

            // Run task asynchronously within the caller's trace context (if any).
            (async () => {
              try {
                const result = await withRemoteContext(traceHeaders, () =>
                  runTask({
                    body,
                    taskId,
                    sendEvent: async (event, data) => {
                      send(ws, event, data);
                    },
                    abortSignal: abortController.signal,
                    onUserDataRequired,
                  }),
                );

                await send(ws, "complete", result);
              } catch (error) {
                if (!abortController.signal.aborted) {
                  await send(
                    ws,
                    "error",
                    errorResponseFromError(error, {
                      code: "TASK_EXECUTION_FAILED",
                      phase: "execution",
                      taskId,
                    }),
                  );
                }
              } finally {
                taskRunning = false;
                release();
                for (const [id, pending] of pendingRequests) {
                  clearTimeout(pending.timer);
                  pending.reject(new Error("Task ended"));
                  pendingRequests.delete(id);
                }
                ws.close(1000, "Task finished");
              }
            })();
          } else if (msg.event === "user_data_response") {
            const response = msg.data as UserDataResponse;
            if (!response?.requestId) {
              send(
                ws,
                "error",
                createErrorResponse({
                  message: "Missing requestId in response",
                  code: "INVALID_RESPONSE",
                  reason: "INVALID_REQUEST",
                }),
              );
              return;
            }

            const pending = pendingRequests.get(response.requestId);
            if (!pending) {
              send(
                ws,
                "error",
                createErrorResponse({
                  message: "No pending request matches the given requestId",
                  code: "UNKNOWN_REQUEST_ID",
                  reason: "INVALID_REQUEST",
                }),
              );
              return;
            }

            clearTimeout(pending.timer);
            pendingRequests.delete(response.requestId);
            pending.resolve(response);
          } else {
            send(
              ws,
              "error",
              createErrorResponse({
                message: "Unknown event type",
                code: "UNKNOWN_EVENT",
                reason: "INVALID_REQUEST",
              }),
            );
          }
        },

        onClose() {
          abortController.abort();
          for (const [id, pending] of pendingRequests) {
            clearTimeout(pending.timer);
            pending.reject(new Error("WebSocket closed"));
            pendingRequests.delete(id);
          }
        },

        onError() {
          abortController.abort();
        },
      };
    }),
  );

  return piloWs;
}

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

import { Hono } from "hono";
import type { UpgradeWebSocket, WSContext } from "hono/ws";
import type { UserDataCallback, UserDataResponse } from "pilo-core";
import { withRemoteContext } from "pilo-core";
import { runTask, validateTaskRequest, createErrorResponse, errorToString } from "../taskRunner.js";
import type { PiloTaskRequest } from "../taskRunner.js";

/** Default timeout for waiting on a user data response (5 minutes). */
const USER_DATA_TIMEOUT_MS = 5 * 60 * 1000;

/** Minimal interface for the underlying Node.js WebSocket used for graceful shutdown. */
export type ActiveWS = { close(code?: number, reason?: string): void };

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

export function createPiloWsRoute(upgradeWebSocket: UpgradeWebSocket, activeConnections: Set<ActiveWS>): Hono {
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
        onOpen(_, ws) {
          activeConnections.add(ws.raw as ActiveWS);
        },
        onMessage(evt, ws) {
          let msg: any;
          try {
            msg = JSON.parse(typeof evt.data === "string" ? evt.data : String(evt.data));
          } catch {
            send(ws, "error", createErrorResponse("Invalid JSON message", "INVALID_MESSAGE"));
            return;
          }

          if (msg.event === "task:details") {
            if (taskRunning) {
              send(
                ws,
                "error",
                createErrorResponse(
                  "A task is already running on this connection",
                  "TASK_ALREADY_RUNNING",
                ),
              );
              return;
            }

            const body = msg.data as PiloTaskRequest;
            if (!body) {
              send(ws, "error", createErrorResponse("Missing data", "MISSING_DATA"));
              return;
            }

            const validationError = validateTaskRequest(body);
            if (validationError) {
              send(ws, "error", validationError.response);
              return;
            }

            taskRunning = true;

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
                    createErrorResponse(errorToString(error), "TASK_EXECUTION_FAILED"),
                  );
                }
              } finally {
                taskRunning = false;
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
                createErrorResponse("Missing requestId in response", "INVALID_RESPONSE"),
              );
              return;
            }

            const pending = pendingRequests.get(response.requestId);
            if (!pending) {
              send(
                ws,
                "error",
                createErrorResponse(
                  `No pending request for id: ${response.requestId}`,
                  "UNKNOWN_REQUEST_ID",
                ),
              );
              return;
            }

            clearTimeout(pending.timer);
            pendingRequests.delete(response.requestId);
            pending.resolve(response);
          } else {
            send(ws, "error", createErrorResponse(`Unknown event: ${msg.event}`, "UNKNOWN_EVENT"));
          }
        },

        onClose(_, ws) {
          activeConnections.delete(ws.raw as ActiveWS);
          abortController.abort();
          for (const [id, pending] of pendingRequests) {
            clearTimeout(pending.timer);
            pending.reject(new Error("WebSocket closed"));
            pendingRequests.delete(id);
          }
        },

        onError(_, ws) {
          activeConnections.delete(ws.raw as ActiveWS);
          abortController.abort();
        },
      };
    }),
  );

  return piloWs;
}

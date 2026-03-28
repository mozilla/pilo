/**
 * WebSocket endpoint for interactive Pilo task execution.
 *
 * All messages use flat { event, data } format (mirrors SSE structure).
 *
 * Client -> Server:
 *   { "event": "task:start", "data": PiloTaskRequest }
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
import { runTask, validateTaskRequest, createErrorResponse, errorToString } from "../taskRunner.js";
import type { PiloTaskRequest } from "../taskRunner.js";

/** Default timeout for waiting on a user data response (5 minutes). */
const USER_DATA_TIMEOUT_MS = 5 * 60 * 1000;

interface PendingRequest {
  resolve: (response: UserDataResponse) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

function send(ws: WSContext, event: string, data: any): void {
  ws.send(JSON.stringify({ event, data }));
}

export function createPiloWsRoute(upgradeWebSocket: UpgradeWebSocket): Hono {
  const piloWs = new Hono();

  piloWs.get(
    "/run/ws",
    upgradeWebSocket((_c) => {
      const abortController = new AbortController();
      const pendingRequests = new Map<string, PendingRequest>();
      let taskRunning = false;

      return {
        onMessage(evt, ws) {
          let msg: any;
          try {
            msg = JSON.parse(typeof evt.data === "string" ? evt.data : String(evt.data));
          } catch {
            send(ws, "error", createErrorResponse("Invalid JSON message", "INVALID_MESSAGE"));
            return;
          }

          if (msg.event === "task:start") {
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

            // Run task asynchronously
            (async () => {
              try {
                const result = await runTask({
                  body,
                  sendEvent: async (event, data) => {
                    send(ws, event, data);
                  },
                  abortSignal: abortController.signal,
                  onUserDataRequired,
                });

                send(ws, "complete", result);
              } catch (error) {
                if (!abortController.signal.aborted) {
                  send(
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

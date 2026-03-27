import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { runTask, validateTaskRequest, createErrorResponse, errorToString } from "../taskRunner.js";
import type { PiloTaskRequest } from "../taskRunner.js";

const pilo = new Hono();

// POST /pilo/run - Execute a Pilo task with real-time SSE streaming (non-interactive)
pilo.post("/run", async (c) => {
  try {
    const body = (await c.req.json()) as PiloTaskRequest;

    const validationError = validateTaskRequest(body);
    if (validationError) {
      return c.json(validationError.response, validationError.status as any);
    }

    return streamSSE(c, async (stream) => {
      const abortController = new AbortController();

      stream.onAbort(() => {
        console.log("🛑 Client disconnected, aborting task execution");
        abortController.abort();
      });

      try {
        await stream.writeSSE({
          event: "start",
          data: JSON.stringify({ task: body.task, url: body.url }),
        });

        const result = await runTask({
          body,
          sendEvent: async (event, data) => {
            await stream.writeSSE({ event, data: JSON.stringify(data) });
          },
          abortSignal: abortController.signal,
          // No onUserDataRequired: SSE is non-interactive.
          // The agent will abort if it encounters a form it can't fill.
        });

        await stream.writeSSE({
          event: "complete",
          data: JSON.stringify(result),
        });

        await stream.writeSSE({
          event: "done",
          data: JSON.stringify({}),
        });
      } catch (error) {
        if (abortController.signal.aborted) {
          console.log("🛑 Task execution aborted due to client disconnection");
        } else {
          console.error("Pilo task execution failed:", error);
          await stream.writeSSE({
            event: "error",
            data: JSON.stringify(
              createErrorResponse(errorToString(error), "TASK_EXECUTION_FAILED"),
            ),
          });
        }
      }
    });
  } catch (error) {
    console.error("Pilo task setup failed:", error);
    return c.json(createErrorResponse(errorToString(error), "TASK_SETUP_FAILED"), 500);
  }
});

export default pilo;

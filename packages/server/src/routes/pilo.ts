import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import {
  runTask,
  validateTaskRequest,
  createErrorResponse,
  errorResponseFromError,
} from "../taskRunner.js";
import type { PiloTaskRequest } from "../taskRunner.js";
import {
  acquireSlot,
  releaseSlot,
  isAtCapacity,
  getMaxConcurrentTasks,
} from "../concurrencyGuard.js";

export { isAtCapacity };

const pilo = new Hono();

// POST /pilo/run - Execute a Pilo task with real-time SSE streaming (non-interactive)
pilo.post("/run", async (c) => {
  const taskId = randomUUID();
  c.header("x-pilo-task-id", taskId);

  // Guard and reserve slot before any await — keeps the check+increment in
  // the same synchronous turn of the event loop so concurrent requests can't
  // all slip past with activeTasks=0.
  if (!acquireSlot()) {
    return c.json(
      createErrorResponse({
        message: `Server at capacity (${getMaxConcurrentTasks()} concurrent tasks). Retry shortly.`,
        code: "CONCURRENCY_LIMIT",
        reason: "INTERNAL_ERROR",
        phase: "setup",
        taskId,
      }),
      503,
    );
  }

  try {
    const body = (await c.req.json()) as PiloTaskRequest;

    const validationError = validateTaskRequest(body);
    if (validationError) {
      releaseSlot();
      return c.json(
        {
          ...validationError.response,
          error: { ...validationError.response.error, taskId },
        },
        validationError.status as any,
      );
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
          data: JSON.stringify({ taskId, task: body.task, url: body.url }),
        });

        const result = await runTask({
          body,
          taskId,
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
          console.error("[pilo-server] task execution failed", {
            taskId,
            phase: "execution",
            error_class: error instanceof Error ? error.constructor.name : "Unknown",
          });
          await stream.writeSSE({
            event: "error",
            data: JSON.stringify(
              errorResponseFromError(error, {
                code: "TASK_EXECUTION_FAILED",
                phase: "execution",
                taskId,
              }),
            ),
          });
        }
      } finally {
        releaseSlot();
      }
    });
  } catch (error) {
    releaseSlot();
    console.error("[pilo-server] task setup failed", {
      taskId,
      phase: "setup",
      error_class: error instanceof Error ? error.constructor.name : "Unknown",
    });
    return c.json(
      createErrorResponse({
        message: "Failed to parse request body.",
        class: error instanceof Error ? error.constructor.name : "Unknown",
        code: "TASK_SETUP_FAILED",
        reason: "INVALID_REQUEST",
        phase: "setup",
        taskId,
      }),
      500,
    );
  }
});

export default pilo;

import { Hono } from "hono";
import { WebAgent, PlaywrightBrowser } from "spark";
import type { TaskExecutionResult } from "spark";
import { openai } from "@ai-sdk/openai";
import { StreamLogger } from "../StreamLogger.js";

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
  task: string;
  url?: string;
  data?: Record<string, any>;
  guardrails?: string;
}

// POST /spark/run - Execute a Spark task with real-time streaming
spark.post("/run", async (c) => {
  try {
    const body = (await c.req.json()) as SparkTaskRequest;

    if (!body.task) {
      return c.json(createErrorResponse("Task is required", "MISSING_TASK"), 400);
    }

    // Check for OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      return c.json(
        createErrorResponse(
          "OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.",
          "MISSING_API_KEY",
        ),
        500,
      );
    }

    // Set up Server-Sent Events
    c.header("Content-Type", "text/event-stream");
    c.header("Cache-Control", "no-cache");
    c.header("Connection", "keep-alive");

    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    // Helper to send SSE events
    const sendEvent = async (event: string, data: any) => {
      const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
      await writer.write(encoder.encode(message));
    };

    // Start task execution asynchronously
    (async () => {
      try {
        await sendEvent("start", { task: body.task, url: body.url });

        // Create browser and agent instances
        const browser = new PlaywrightBrowser({
          headless: true,
          browser: (process.env.BROWSER as any) || "firefox",
          pwEndpoint: process.env.PW_ENDPOINT,
        });

        const logger = new StreamLogger(sendEvent);
        const provider = openai("gpt-4.1");

        const agent = new WebAgent(browser, {
          provider,
          logger,
          guardrails: body.guardrails,
        });

        // Execute the task
        const result: TaskExecutionResult = await agent.execute(body.task, body.url, body.data);

        // Send final result
        await sendEvent("complete", { success: true, result });

        // Close the browser
        await agent.close();
      } catch (error) {
        console.error("Spark task execution failed:", error);
        await sendEvent("error", {
          error: {
            message: error instanceof Error ? error.message : "Unknown error",
            code: "TASK_EXECUTION_FAILED",
            timestamp: new Date().toISOString(),
          },
        });
      } finally {
        await sendEvent("done", {});
        await writer.close();
      }
    })();

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
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

// GET /spark/status - Get Spark service status
spark.get("/status", (c) => {
  return c.json({
    status: "ready",
    service: "spark-automation",
    timestamp: new Date().toISOString(),
  });
});

export default spark;

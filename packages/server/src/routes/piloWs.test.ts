import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock pilo-core before any imports that use it
vi.mock("pilo-core", () => ({
  WebAgent: vi.fn().mockImplementation(() => ({
    execute: vi.fn().mockResolvedValue({
      success: true,
      finalAnswer: "Done",
      stats: { actions: 1, iterations: 1 },
    }),
    close: vi.fn().mockResolvedValue(undefined),
  })),
  PlaywrightBrowser: vi.fn().mockImplementation(() => ({})),
  config: {
    getConfig: vi.fn(() => ({
      provider: "openai",
      openai_api_key: "sk-test123",
    })),
  },
  createAIProvider: vi.fn(() => ({})),
  getAIProviderInfo: vi.fn(() => ({
    provider: "openai",
    model: "gpt-4.1",
    hasApiKey: true,
    keySource: "env",
  })),
  createNavigationRetryConfig: vi.fn(() => ({})),
  SEARCH_PROVIDERS: ["none", "duckduckgo", "google", "bing", "parallel-api"],
}));

vi.mock("../../StreamLogger.js", () => ({
  StreamLogger: vi.fn().mockImplementation(() => ({})),
}));

// Mock taskRunner to control task execution
const mockRunTask = vi.fn();
const mockValidateTaskRequest = vi.fn().mockReturnValue(null);
vi.mock("../taskRunner.js", () => ({
  runTask: (...args: any[]) => mockRunTask(...args),
  validateTaskRequest: (...args: any[]) => mockValidateTaskRequest(...args),
  createErrorResponse: (message: string, code: string) => ({
    success: false,
    error: { message, code, timestamp: new Date().toISOString() },
  }),
  errorToString: (error: unknown) =>
    error instanceof Error ? error.name : "Unknown error",
}));

import { createPiloWsRoute } from "./piloWs.js";
import type { UpgradeWebSocket, WSContext } from "hono/ws";

/**
 * Helper to extract the WebSocket event handlers from createPiloWsRoute.
 *
 * Since we can't do real WebSocket upgrades in unit tests, we capture the
 * handler factory passed to upgradeWebSocket and invoke onMessage/onClose
 * directly against a mock WSContext.
 */
function createTestHarness() {
  let handlerFactory: (c: any) => any;

  const fakeUpgradeWebSocket: UpgradeWebSocket = (factory) => {
    handlerFactory = factory;
    // Return a no-op Hono handler (the route is registered but we call handlers directly)
    return async (c, next) => next();
  };

  createPiloWsRoute(fakeUpgradeWebSocket);

  // Messages sent by the server to the client
  const sentMessages: Array<{ event: string; data: any }> = [];
  let closeCalled = false;
  let closeCode: number | undefined;
  let closeReason: string | undefined;

  const mockRawSend = vi.fn(
    (data: string, cb?: (err?: Error) => void) => {
      sentMessages.push(JSON.parse(data));
      cb?.();
    },
  );

  const mockWs: WSContext = {
    send: vi.fn(),
    close: vi.fn((code?: number, reason?: string) => {
      closeCalled = true;
      closeCode = code;
      closeReason = reason;
    }),
    raw: { send: mockRawSend },
    readyState: 1,
    url: new URL("ws://localhost/pilo/run"),
    protocol: "",
    binaryType: "arraybuffer",
  } as unknown as WSContext;

  // Get the handlers for a new connection
  const handlers = handlerFactory!(/* context */ {});

  function sendMessage(obj: any) {
    const evt = { data: JSON.stringify(obj) } as MessageEvent;
    handlers.onMessage(evt, mockWs);
  }

  function sendRaw(raw: string) {
    const evt = { data: raw } as MessageEvent;
    handlers.onMessage(evt, mockWs);
  }

  function triggerClose() {
    handlers.onClose(new CloseEvent("close"), mockWs);
  }

  function triggerError() {
    handlers.onError(new Event("error"), mockWs);
  }

  return {
    sendMessage,
    sendRaw,
    triggerClose,
    triggerError,
    sentMessages,
    mockWs,
    mockRawSend,
    get closeCalled() { return closeCalled; },
    get closeCode() { return closeCode; },
    get closeReason() { return closeReason; },
  };
}

describe("piloWs", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockRunTask.mockReset();
    mockValidateTaskRequest.mockReset().mockReturnValue(null);
    mockRunTask.mockResolvedValue({ success: true, stats: { actions: 1 } });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("message parsing", () => {
    it("should reject invalid JSON", () => {
      const h = createTestHarness();
      h.sendRaw("not json{{{");

      expect(h.sentMessages).toHaveLength(1);
      expect(h.sentMessages[0].event).toBe("error");
      expect(h.sentMessages[0].data.error.code).toBe("INVALID_MESSAGE");
    });

    it("should reject unknown event types", () => {
      const h = createTestHarness();
      h.sendMessage({ event: "unknown_event", data: {} });

      expect(h.sentMessages).toHaveLength(1);
      expect(h.sentMessages[0].event).toBe("error");
      expect(h.sentMessages[0].data.error.code).toBe("UNKNOWN_EVENT");
      expect(h.sentMessages[0].data.error.message).toContain("unknown_event");
    });
  });

  describe("task:details", () => {
    it("should reject when data is missing", () => {
      const h = createTestHarness();
      h.sendMessage({ event: "task:details" });

      expect(h.sentMessages).toHaveLength(1);
      expect(h.sentMessages[0].data.error.code).toBe("MISSING_DATA");
    });

    it("should reject when validation fails", () => {
      mockValidateTaskRequest.mockReturnValue({
        status: 400,
        response: {
          success: false,
          error: { message: "Task is required", code: "MISSING_TASK", timestamp: "" },
        },
      });

      const h = createTestHarness();
      h.sendMessage({ event: "task:details", data: { task: "" } });

      expect(h.sentMessages).toHaveLength(1);
      expect(h.sentMessages[0].data.error.code).toBe("MISSING_TASK");
    });

    it("should run task and send complete event", async () => {
      const taskResult = { success: true, stats: { actions: 3 } };
      mockRunTask.mockResolvedValue(taskResult);

      const h = createTestHarness();
      h.sendMessage({ event: "task:details", data: { task: "fill form" } });

      // Let the async task complete
      await vi.runAllTimersAsync();

      const completeMsg = h.sentMessages.find((m) => m.event === "complete");
      expect(completeMsg).toBeDefined();
      expect(completeMsg!.data).toEqual(taskResult);
    });

    it("should close WebSocket after task completes", async () => {
      mockRunTask.mockResolvedValue({ success: true });

      const h = createTestHarness();
      h.sendMessage({ event: "task:details", data: { task: "test" } });
      await vi.runAllTimersAsync();

      expect(h.closeCalled).toBe(true);
      expect(h.closeCode).toBe(1000);
      expect(h.closeReason).toBe("Task finished");
    });

    it("should send error event when task throws", async () => {
      mockRunTask.mockRejectedValue(new TypeError("something broke"));

      const h = createTestHarness();
      h.sendMessage({ event: "task:details", data: { task: "test" } });
      await vi.runAllTimersAsync();

      const errorMsg = h.sentMessages.find((m) => m.event === "error");
      expect(errorMsg).toBeDefined();
      expect(errorMsg!.data.error.code).toBe("TASK_EXECUTION_FAILED");
      expect(errorMsg!.data.error.message).toBe("TypeError");
    });

    it("should close WebSocket after task error", async () => {
      mockRunTask.mockRejectedValue(new Error("fail"));

      const h = createTestHarness();
      h.sendMessage({ event: "task:details", data: { task: "test" } });
      await vi.runAllTimersAsync();

      expect(h.closeCalled).toBe(true);
      expect(h.closeCode).toBe(1000);
    });

    it("should reject a second task while one is running", async () => {
      // Make the first task hang
      mockRunTask.mockReturnValue(new Promise(() => {}));

      const h = createTestHarness();
      h.sendMessage({ event: "task:details", data: { task: "first" } });
      h.sendMessage({ event: "task:details", data: { task: "second" } });

      const errorMsg = h.sentMessages.find(
        (m) => m.data?.error?.code === "TASK_ALREADY_RUNNING",
      );
      expect(errorMsg).toBeDefined();
    });

    it("should not send error when task is aborted", async () => {
      // Simulate abort by having runTask reject after onClose triggers the abort
      let rejectTask: (err: Error) => void;
      mockRunTask.mockImplementation(({ abortSignal }) => {
        return new Promise((_, reject) => {
          rejectTask = reject;
          abortSignal.addEventListener("abort", () => {
            reject(new Error("aborted"));
          });
        });
      });

      const h = createTestHarness();
      h.sendMessage({ event: "task:details", data: { task: "test" } });

      // Close the connection, which aborts the task
      h.triggerClose();
      await vi.runAllTimersAsync();

      // Should NOT have a TASK_EXECUTION_FAILED error (abort is expected)
      const errorMsg = h.sentMessages.find(
        (m) => m.data?.error?.code === "TASK_EXECUTION_FAILED",
      );
      expect(errorMsg).toBeUndefined();
    });

    it("should pass sendEvent callback to runTask", async () => {
      mockRunTask.mockImplementation(async ({ sendEvent }) => {
        await sendEvent("agent:action", { action: "click" });
        return { success: true };
      });

      const h = createTestHarness();
      h.sendMessage({ event: "task:details", data: { task: "test" } });
      await vi.runAllTimersAsync();

      const actionMsg = h.sentMessages.find((m) => m.event === "agent:action");
      expect(actionMsg).toBeDefined();
      expect(actionMsg!.data).toEqual({ action: "click" });
    });
  });

  describe("user_data_response", () => {
    it("should reject when requestId is missing", () => {
      const h = createTestHarness();
      h.sendMessage({ event: "user_data_response", data: {} });

      expect(h.sentMessages).toHaveLength(1);
      expect(h.sentMessages[0].data.error.code).toBe("INVALID_RESPONSE");
    });

    it("should reject when no pending request matches", () => {
      const h = createTestHarness();
      h.sendMessage({
        event: "user_data_response",
        data: { requestId: "nonexistent" },
      });

      expect(h.sentMessages).toHaveLength(1);
      expect(h.sentMessages[0].data.error.code).toBe("UNKNOWN_REQUEST_ID");
      expect(h.sentMessages[0].data.error.message).toContain("nonexistent");
    });

    it("should resolve a pending request when matched", async () => {
      let capturedCallback: any;
      mockRunTask.mockImplementation(async ({ onUserDataRequired }) => {
        capturedCallback = onUserDataRequired;
        // Simulate pilo-core calling the callback
        const response = await onUserDataRequired({
          requestId: "req-123",
          fields: [{ ref: "name", label: "Name", fieldType: "text", required: true }],
        });
        return { success: true, userData: response };
      });

      const h = createTestHarness();
      h.sendMessage({ event: "task:details", data: { task: "fill form" } });

      // Allow the task to start and register the pending request
      await vi.advanceTimersByTimeAsync(10);

      // Send the user data response
      h.sendMessage({
        event: "user_data_response",
        data: {
          requestId: "req-123",
          fields: [{ ref: "name", value: "John" }],
        },
      });

      await vi.runAllTimersAsync();

      const completeMsg = h.sentMessages.find((m) => m.event === "complete");
      expect(completeMsg).toBeDefined();
    });
  });

  describe("timeout", () => {
    it("should reject pending request after timeout", async () => {
      let taskPromise: Promise<any>;
      mockRunTask.mockImplementation(async ({ onUserDataRequired }) => {
        try {
          await onUserDataRequired({
            requestId: "req-timeout",
            fields: [{ ref: "name", label: "Name", fieldType: "text", required: true }],
          });
        } catch (error: any) {
          throw error;
        }
        return { success: true };
      });

      const h = createTestHarness();
      h.sendMessage({ event: "task:details", data: { task: "test" } });

      // Advance past the 5 minute timeout
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000 + 100);
      await vi.runAllTimersAsync();

      const errorMsg = h.sentMessages.find(
        (m) => m.data?.error?.code === "TASK_EXECUTION_FAILED",
      );
      expect(errorMsg).toBeDefined();
    });
  });

  describe("onClose", () => {
    it("should abort running task when WebSocket closes", async () => {
      let receivedSignal: AbortSignal | undefined;
      mockRunTask.mockImplementation(async ({ abortSignal }) => {
        receivedSignal = abortSignal;
        return new Promise(() => {}); // hang forever
      });

      const h = createTestHarness();
      h.sendMessage({ event: "task:details", data: { task: "test" } });
      await vi.advanceTimersByTimeAsync(10);

      expect(receivedSignal?.aborted).toBe(false);
      h.triggerClose();
      expect(receivedSignal?.aborted).toBe(true);
    });

    it("should reject all pending requests when WebSocket closes", async () => {
      let pendingPromise: Promise<any>;
      mockRunTask.mockImplementation(async ({ onUserDataRequired }) => {
        pendingPromise = onUserDataRequired({
          requestId: "req-close",
          fields: [],
        });
        await pendingPromise;
        return { success: true };
      });

      const h = createTestHarness();
      h.sendMessage({ event: "task:details", data: { task: "test" } });
      await vi.advanceTimersByTimeAsync(10);

      h.triggerClose();
      await vi.runAllTimersAsync();

      await expect(pendingPromise!).rejects.toThrow("WebSocket closed");
    });
  });

  describe("onError", () => {
    it("should abort the task on WebSocket error", async () => {
      let receivedSignal: AbortSignal | undefined;
      mockRunTask.mockImplementation(async ({ abortSignal }) => {
        receivedSignal = abortSignal;
        return new Promise(() => {});
      });

      const h = createTestHarness();
      h.sendMessage({ event: "task:details", data: { task: "test" } });
      await vi.advanceTimersByTimeAsync(10);

      h.triggerError();
      expect(receivedSignal?.aborted).toBe(true);
    });
  });
});

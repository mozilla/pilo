import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { WebAgent, WebAgentOptions } from "../src/webAgent.js";
import { AriaBrowser, PageAction } from "../src/browser/ariaBrowser.js";
import { WebAgentEventEmitter, WebAgentEventType } from "../src/events.js";
import { LanguageModel, streamText } from "ai";
import { Logger } from "../src/loggers/types.js";
import { generateTextWithRetry } from "../src/utils/retry.js";

// Mock the AI module
vi.mock("ai", () => ({
  streamText: vi.fn(),
  tool: vi.fn((schema: any) => ({
    description: schema.description,
    parameters: schema.parameters,
  })),
}));

// Mock the retry module
vi.mock("../src/utils/retry.js", () => ({
  generateTextWithRetry: vi.fn(),
}));

const mockStreamText = vi.mocked(streamText);
const mockGenerateTextWithRetry = vi.mocked(generateTextWithRetry);

// Helper to create a mock stream response that mimics AI SDK's streamText
function createMockStreamResponse(response: any): any {
  // Create the fullStream async iterator that emits events in the correct order
  const fullStream = {
    async *[Symbol.asyncIterator]() {
      // Start events
      yield { type: "start" };
      yield { type: "start-step" };

      // Emit reasoning events if reasoning is present
      if (response.reasoning) {
        yield { type: "reasoning-start" };
        for (const r of response.reasoning) {
          yield { type: "reasoning-delta", text: r.text };
        }
        yield { type: "reasoning-end" };
      }

      // Emit tool events if tool results are present
      if (response.toolResults) {
        for (const result of response.toolResults) {
          yield { type: "tool-call", toolName: result.toolName };
          yield { type: "tool-result", toolName: result.toolName };
        }
      }

      // End events
      yield { type: "finish-step" };
      yield { type: "finish" };
    },
  };

  // Create empty async iterators for unused streams
  const emptyAsyncIterator = { [Symbol.asyncIterator]: async function* () {} };

  // Return mock StreamTextResult with only required properties
  return {
    // The main stream we use for capturing reasoning
    fullStream,

    // Required promise properties that webAgent.ts awaits
    text: Promise.resolve(response.text || ""),
    reasoning: Promise.resolve(response.reasoning || []),
    toolResults: Promise.resolve(response.toolResults || []),
    response: Promise.resolve(response.response || { messages: [] }),
    finishReason: Promise.resolve(response.finishReason || "stop"),
    usage: Promise.resolve(response.usage || {}),
    warnings: Promise.resolve(response.warnings || []),
    providerMetadata: Promise.resolve(response.providerMetadata || {}),

    // Additional promises required by StreamTextResult type
    content: Promise.resolve([]),
    reasoningText: Promise.resolve(""),
    files: Promise.resolve([]),
    sources: Promise.resolve([]),
    toolCalls: Promise.resolve([]),
    request: Promise.resolve({}),
    totalUsage: Promise.resolve({}),
    steps: Promise.resolve([]),
    experimental_output: Promise.resolve(undefined),

    // Empty stream iterators (required by type but unused)
    contentStream: emptyAsyncIterator,
    textStream: emptyAsyncIterator,
    reasoningStream: emptyAsyncIterator,
    fileStream: emptyAsyncIterator,
    sourceStream: emptyAsyncIterator,

    // Response transform functions (required by type but unused)
    toDataStreamResponse: () => new Response(),
    toUIMessageStreamResponse: () => new Response(),
    toTextStreamResponse: () => new Response(),
    pipeDataStreamToResponse: () => {},
    pipeUIMessageStreamToResponse: () => {},
    pipeTextStreamToResponse: () => {},
  };
}

// Helper to mock validation response (for generateTextWithRetry)
function mockValidationResponse(
  quality: "failed" | "partial" | "complete" | "excellent" = "complete",
) {
  return {
    text: "Validation",
    toolResults: [
      {
        type: "tool-result",
        toolCallId: "validate_1",
        toolName: "validate_task",
        input: {
          taskAssessment: "Task completed successfully",
          completionQuality: quality,
          feedback:
            quality === "complete" || quality === "excellent" ? undefined : "Needs improvement",
        },
        output: {
          taskAssessment: "Task completed successfully",
          completionQuality: quality,
          feedback:
            quality === "complete" || quality === "excellent" ? undefined : "Needs improvement",
        },
      },
    ],
  } as any;
}

// Mock browser implementation
class MockBrowser implements AriaBrowser {
  browserName = "mock-browser";
  private url = "about:blank";
  private title = "Mock Page";
  private pageSnapshot = `
    <div>
      <button [ref=btn1]>Click me</button>
      <input [ref=input1] type="text" />
      <a [ref=link1] href="/page">Link</a>
    </div>
  `;
  private markdown = "# Mock Page\nContent here";

  async start(): Promise<void> {}
  async shutdown(): Promise<void> {}

  async goto(newUrl: string): Promise<void> {
    this.url = newUrl;
    this.title = `Page at ${newUrl}`;
  }

  async goBack(): Promise<void> {
    this.url = "about:blank";
  }

  async goForward(): Promise<void> {
    this.url = "about:blank";
  }

  async getUrl(): Promise<string> {
    return this.url;
  }

  async getTitle(): Promise<string> {
    return this.title;
  }

  async getTreeWithRefs(): Promise<string> {
    return this.pageSnapshot;
  }

  async getMarkdown(): Promise<string> {
    return this.markdown;
  }

  async getScreenshot(): Promise<Buffer> {
    return Buffer.from("mock-screenshot");
  }

  async performAction(_ref: string, _action: PageAction, _value?: string): Promise<void> {}

  async waitForLoadState(): Promise<void> {}

  async runInIsolatedTab<T>(fn: (tab: any) => Promise<T>): Promise<T> {
    // Mock implementation that creates a simple isolated tab
    const mockTab = {
      goto: async () => {},
      waitForLoadState: async () => {},
      getMarkdown: async () => "# Mock Search Results",
    };
    return fn(mockTab);
  }

  // Test helpers
  setPageSnapshot(snapshot: string): void {
    this.pageSnapshot = snapshot;
  }

  setUrl(url: string): void {
    this.url = url;
  }

  setTitle(title: string): void {
    this.title = title;
  }
}

// Mock logger implementation
class MockLogger implements Logger {
  events: Array<{ type: string; data: any }> = [];

  initialize(emitter: WebAgentEventEmitter): void {
    // Capture all events for testing
    Object.values(WebAgentEventType).forEach((eventType) => {
      emitter.on(eventType, (data) => {
        this.events.push({ type: eventType, data });
      });
    });
  }

  dispose(): void {
    this.events = [];
  }

  getEvents(): Array<{ type: string; data: any }> {
    return this.events;
  }
}

describe("WebAgent", () => {
  let mockBrowser: MockBrowser;
  let mockLogger: MockLogger;
  let eventEmitter: WebAgentEventEmitter;
  let webAgent: WebAgent;
  let mockProvider: LanguageModel;

  beforeEach(() => {
    vi.clearAllMocks();
    // Use fake timers to speed up wait actions
    vi.useFakeTimers();

    mockBrowser = new MockBrowser();
    mockLogger = new MockLogger();
    eventEmitter = new WebAgentEventEmitter();
    mockProvider = { specificationVersion: "v1" } as unknown as LanguageModel;

    const options: WebAgentOptions = {
      providerConfig: { model: mockProvider },
      debug: false,
      vision: false,
      maxIterations: 10,
      maxConsecutiveErrors: 5,
      maxTotalErrors: 15,
      guardrails: null,
      eventEmitter,
      logger: mockLogger,
    };

    webAgent = new WebAgent(mockBrowser, options);
  });

  afterEach(async () => {
    await webAgent.close();
    // Restore real timers
    vi.useRealTimers();
  });

  describe("execute", () => {
    it("should reject empty task", async () => {
      await expect(webAgent.execute("")).rejects.toThrow("Task cannot be empty");
    });

    it("should reject whitespace-only task", async () => {
      await expect(webAgent.execute("   ")).rejects.toThrow("Task cannot be empty");
    });

    it("should reject invalid starting URL", async () => {
      await expect(webAgent.execute("test task", { startingUrl: "not-a-url" })).rejects.toThrow(
        "Invalid starting URL",
      );
    });

    it("should complete a simple task successfully", async () => {
      const task = "Click the button";

      // Mock planning response with proper tool result structure
      mockGenerateTextWithRetry.mockResolvedValueOnce({
        text: "Planning",
        toolResults: [
          {
            type: "tool-result",
            toolCallId: "plan_1",
            toolName: "create_plan",
            input: {
              successCriteria: "Need to click button",
              plan: "1. Find button\n2. Click it",
            },
            output: {
              successCriteria: "Need to click button",
              plan: "1. Find button\n2. Click it",
            },
          },
        ],
      } as any);

      // Mock action generation - click action with proper tool result structure
      mockStreamText.mockReturnValueOnce(
        createMockStreamResponse({
          text: "Clicking button",
          toolResults: [
            {
              type: "tool-result",
              toolCallId: "click_1",
              toolName: "click",
              input: { ref: "btn1" },
              output: {
                action: "click",
                ref: "btn1",
                isTerminal: false,
              },
            },
          ],
          response: {
            messages: [
              {
                role: "assistant",
                content: "Clicking button",
              },
              {
                role: "tool",
                content: [
                  {
                    type: "tool-result",
                    toolCallId: "click_1",
                    toolName: "click",
                    output: { action: "click", ref: "btn1" },
                  },
                ],
              },
            ],
          },
        }) as any,
      );

      // Mock done action with proper tool result structure
      mockStreamText.mockReturnValueOnce(
        createMockStreamResponse({
          text: "Task complete",
          toolResults: [
            {
              type: "tool-result",
              toolCallId: "done_1",
              toolName: "done",
              input: { result: "Button clicked successfully" },
              output: {
                action: "done",
                result: "Button clicked successfully",
                isTerminal: true,
              },
            },
          ],
          response: {
            messages: [
              {
                role: "assistant",
                content: "Task complete",
              },
              {
                role: "tool",
                content: [
                  {
                    type: "tool-result",
                    toolCallId: "done_1",
                    toolName: "done",
                    output: {
                      action: "done",
                      result: "Button clicked successfully",
                      isTerminal: true,
                    },
                  },
                ],
              },
            ],
          },
        }) as any,
      );

      // Mock validation response
      mockGenerateTextWithRetry.mockResolvedValueOnce(mockValidationResponse("complete"));

      const result = await webAgent.execute(task, { startingUrl: "https://example.com" });

      expect(result.success).toBe(true);
      expect(result.finalAnswer).toBe("Button clicked successfully");
      expect(result.stats.iterations).toBeGreaterThan(0);
      expect(result.stats.actions).toBeGreaterThan(0);
    });

    it("should handle task with data parameter", async () => {
      const task = "Fill form with data";
      const data = { name: "John", email: "john@example.com" };

      // Mock planning with proper tool result structure
      mockGenerateTextWithRetry.mockResolvedValueOnce({
        text: "Planning",
        toolResults: [
          {
            type: "tool-result",
            toolCallId: "plan_1",
            toolName: "create_plan",
            input: {
              successCriteria: "Fill form with provided data",
              plan: "1. Use provided data to fill form",
            },
            output: {
              successCriteria: "Fill form with provided data",
              plan: "1. Use provided data to fill form",
            },
          },
        ],
      } as any);

      // Mock done action with proper tool result structure
      mockStreamText.mockReturnValueOnce(
        createMockStreamResponse({
          text: "Complete",
          toolResults: [
            {
              type: "tool-result",
              toolCallId: "done_1",
              toolName: "done",
              input: { result: "Form filled" },
              output: {
                action: "done",
                result: "Form filled",
                isTerminal: true,
              },
            },
          ],
          response: {
            messages: [
              {
                role: "assistant",
                content: "Complete",
              },
              {
                role: "tool",
                content: [
                  {
                    type: "tool-result",
                    toolCallId: "done_1",
                    toolName: "done",
                    output: { action: "done", result: "Form filled", isTerminal: true },
                  },
                ],
              },
            ],
          },
        }) as any,
      );

      // Mock validation response
      mockGenerateTextWithRetry.mockResolvedValueOnce(mockValidationResponse("complete"));

      const result = await webAgent.execute(task, {
        startingUrl: "https://example.com",
        data,
      });

      expect(result.success).toBe(true);
    });

    it("should handle abort signal", async () => {
      const controller = new AbortController();

      // Mock planning that will be aborted
      mockGenerateTextWithRetry.mockImplementationOnce(() => {
        controller.abort();
        throw new Error("Aborted");
      });

      const result = await webAgent.execute("Test task", {
        startingUrl: "https://example.com",
        abortSignal: controller.signal,
      });

      expect(result.success).toBe(false);
      expect(result.finalAnswer).toBe("Task aborted by user");
    });
  });

  describe("planning", () => {
    it("should generate plan with URL when not provided", async () => {
      mockGenerateTextWithRetry.mockResolvedValueOnce({
        text: "Planning",
        toolResults: [
          {
            type: "tool-result",
            toolCallId: "plan_1",
            toolName: "create_plan_with_url",
            input: {
              successCriteria: "Search for flights",
              plan: "1. Go to travel site\n2. Search flights",
              url: "https://travel.example.com",
            },
            output: {
              successCriteria: "Search for flights",
              plan: "1. Go to travel site\n2. Search flights",
              url: "https://travel.example.com",
            },
          },
        ],
      } as any);

      // Mock done for quick completion
      mockStreamText.mockReturnValueOnce(
        createMockStreamResponse({
          text: "Done",
          toolResults: [
            {
              type: "tool-result",
              toolCallId: "done_1",
              toolName: "done",
              input: { result: "Complete" },
              output: {
                action: "done",
                result: "Complete",
                isTerminal: true,
              },
            },
          ],
          response: {
            messages: [
              {
                role: "assistant",
                content: "Done",
              },
              {
                role: "tool",
                content: [
                  {
                    type: "tool-result",
                    toolCallId: "done_1",
                    toolName: "done",
                    output: { action: "done", result: "Complete", isTerminal: true },
                  },
                ],
              },
            ],
          },
        }) as any,
      );

      await webAgent.execute("Book a flight to Paris");

      // Check that TASK_SETUP event was emitted with the generated URL
      const setupEvent = mockLogger.events.find((e) => e.type === WebAgentEventType.TASK_SETUP);
      expect(setupEvent).toBeDefined();
    });

    it("should use provided starting URL in plan", async () => {
      const startingUrl = "https://specific-site.com";

      mockGenerateTextWithRetry.mockResolvedValueOnce({
        text: "Planning",
        toolResults: [
          {
            type: "tool-result",
            toolCallId: "plan_1",
            toolName: "create_plan",
            input: {
              successCriteria: "Navigate and interact",
              plan: "1. Use the page\n2. Complete task",
            },
            output: {
              successCriteria: "Navigate and interact",
              plan: "1. Use the page\n2. Complete task",
            },
          },
        ],
      } as any);

      // Mock done
      mockStreamText.mockReturnValueOnce(
        createMockStreamResponse({
          text: "Done",
          toolResults: [
            {
              type: "tool-result",
              toolCallId: "done_1",
              toolName: "done",
              input: { result: "Complete" },
              output: {
                action: "done",
                result: "Complete",
                isTerminal: true,
              },
            },
          ],
          response: {
            messages: [
              {
                role: "assistant",
                content: "Done",
              },
              {
                role: "tool",
                content: [
                  {
                    type: "tool-result",
                    toolCallId: "done_1",
                    toolName: "done",
                    output: { action: "done", result: "Complete", isTerminal: true },
                  },
                ],
              },
            ],
          },
        }) as any,
      );

      await webAgent.execute("Do something", { startingUrl });

      const navigatedEvent = mockLogger.events.find(
        (e) => e.type === WebAgentEventType.BROWSER_NAVIGATED,
      );
      expect(navigatedEvent?.data.url).toBe(startingUrl);
    });

    it("should fail if planning doesn't generate tool result", async () => {
      mockGenerateTextWithRetry.mockResolvedValueOnce({
        text: "No tool result",
        toolResults: [],
      } as any);

      await expect(
        webAgent.execute("Test task", { startingUrl: "https://example.com" }),
      ).rejects.toThrow(/Failed to generate plan/);
    });
  });

  describe("action generation and execution", () => {
    beforeEach(() => {
      // Setup default planning mock
      mockGenerateTextWithRetry.mockResolvedValueOnce({
        text: "Planning",
        toolResults: [
          {
            type: "tool-result",
            toolCallId: "plan_1",
            toolName: "create_plan",
            input: {
              successCriteria: "Test",
              plan: "1. Test",
            },
            output: {
              successCriteria: "Test",
              plan: "1. Test",
            },
          },
        ],
      } as any);
    });

    it("should execute click action", async () => {
      mockStreamText.mockReturnValueOnce(
        createMockStreamResponse({
          text: "Click",
          toolResults: [
            {
              type: "tool-result",
              toolCallId: "click_1",
              toolName: "click",
              input: { ref: "btn1" },
              output: {
                action: "click",
                ref: "btn1",
                isTerminal: false,
              },
            },
          ],
          response: {
            messages: [
              {
                role: "assistant",
                content: "Click",
              },
              {
                role: "tool",
                content: [
                  {
                    type: "tool-result",
                    toolCallId: "click_1",
                    toolName: "click",
                    output: { action: "click", ref: "btn1" },
                  },
                ],
              },
            ],
          },
        }) as any,
      );

      mockStreamText.mockReturnValueOnce(
        createMockStreamResponse({
          text: "Done",
          toolResults: [
            {
              type: "tool-result",
              toolCallId: "done_1",
              toolName: "done",
              input: { result: "Clicked" },
              output: {
                action: "done",
                result: "Clicked",
                isTerminal: true,
              },
            },
          ],
          response: {
            messages: [
              {
                role: "assistant",
                content: "Done",
              },
              {
                role: "tool",
                content: [
                  {
                    type: "tool-result",
                    toolCallId: "done_1",
                    toolName: "done",
                    output: { action: "done", result: "Clicked", isTerminal: true },
                  },
                ],
              },
            ],
          },
        }) as any,
      );

      // Mock validation response
      mockGenerateTextWithRetry.mockResolvedValueOnce(mockValidationResponse("complete"));

      const result = await webAgent.execute("Click button", { startingUrl: "https://example.com" });

      expect(result.success).toBe(true);
      expect(result.stats.actions).toBe(1); // done is the only action counted
    });

    it("should handle abort action", async () => {
      mockStreamText.mockReturnValueOnce(
        createMockStreamResponse({
          text: "Abort",
          toolResults: [
            {
              type: "tool-result",
              toolCallId: "abort_1",
              toolName: "abort",
              input: { reason: "Cannot complete task" },
              output: {
                action: "abort",
                reason: "Cannot complete task",
                isTerminal: true,
              },
            },
          ],
          response: {
            messages: [
              {
                role: "assistant",
                content: "Abort",
              },
              {
                role: "tool",
                content: [
                  {
                    type: "tool-result",
                    toolCallId: "abort_1",
                    toolName: "abort",
                    output: { action: "abort", reason: "Cannot complete task", isTerminal: true },
                  },
                ],
              },
            ],
          },
        }) as any,
      );

      const result = await webAgent.execute("Impossible task", {
        startingUrl: "https://example.com",
      });

      expect(result.success).toBe(false);
      expect(result.finalAnswer).toBe("Aborted: Cannot complete task");

      // Check that TASK_ABORTED event was emitted
      const abortedEvent = mockLogger.events.find((e) => e.type === WebAgentEventType.TASK_ABORTED);
      expect(abortedEvent).toBeDefined();
      expect(abortedEvent?.data.reason).toBe("Cannot complete task");
      expect(abortedEvent?.data.finalAnswer).toBe("Aborted: Cannot complete task");
    });

    it("should handle extract action", async () => {
      mockStreamText.mockReturnValueOnce(
        createMockStreamResponse({
          text: "Extract",
          toolResults: [
            {
              type: "tool-result",
              toolCallId: "extract_1",
              toolName: "extract",
              input: { description: "Get page title" },
              output: {
                action: "extract",
                description: "Get page title",
                isTerminal: false,
              },
            },
          ],
          response: {
            messages: [
              {
                role: "assistant",
                content: "Extract",
              },
              {
                role: "tool",
                content: [
                  {
                    type: "tool-result",
                    toolCallId: "extract_1",
                    toolName: "extract",
                    output: { action: "extract", description: "Get page title" },
                  },
                ],
              },
            ],
          },
        }) as any,
      );

      mockStreamText.mockReturnValueOnce(
        createMockStreamResponse({
          text: "Done",
          toolResults: [
            {
              type: "tool-result",
              toolCallId: "done_1",
              toolName: "done",
              input: { result: "Extracted" },
              output: {
                action: "done",
                result: "Extracted",
                isTerminal: true,
              },
            },
          ],
          response: {
            messages: [
              {
                role: "assistant",
                content: "Done",
              },
              {
                role: "tool",
                content: [
                  {
                    type: "tool-result",
                    toolCallId: "done_1",
                    toolName: "done",
                    output: { action: "done", result: "Extracted", isTerminal: true },
                  },
                ],
              },
            ],
          },
        }) as any,
      );

      // Mock validation response
      mockGenerateTextWithRetry.mockResolvedValueOnce(mockValidationResponse("complete"));

      const result = await webAgent.execute("Extract title", {
        startingUrl: "https://example.com",
      });

      expect(result.success).toBe(true);
    });
  });

  describe("error handling", () => {
    beforeEach(() => {
      // Setup default planning
      mockGenerateTextWithRetry.mockResolvedValueOnce({
        text: "Planning",
        toolResults: [
          {
            type: "tool-result",
            toolCallId: "plan_1",
            toolName: "create_plan",
            input: {
              successCriteria: "Test",
              plan: "1. Test",
            },
            output: {
              successCriteria: "Test",
              plan: "1. Test",
            },
          },
        ],
      } as any);
    });

    it("should handle AI generation errors and retry", async () => {
      // First call throws error
      mockStreamText.mockImplementationOnce(() => {
        throw new Error("AI error");
      });

      // Second call succeeds with done
      mockStreamText.mockReturnValueOnce(
        createMockStreamResponse({
          text: "Done",
          toolResults: [
            {
              type: "tool-result",
              toolCallId: "done_1",
              toolName: "done",
              input: { result: "Recovered" },
              output: {
                action: "done",
                result: "Recovered",
                isTerminal: true,
              },
            },
          ],
          response: {
            messages: [
              {
                role: "assistant",
                content: "Done",
              },
              {
                role: "tool",
                content: [
                  {
                    type: "tool-result",
                    toolCallId: "done_1",
                    toolName: "done",
                    output: { action: "done", result: "Recovered", isTerminal: true },
                  },
                ],
              },
            ],
          },
        }) as any,
      );

      // Mock validation response
      mockGenerateTextWithRetry.mockResolvedValueOnce(mockValidationResponse("complete"));

      const result = await webAgent.execute("Test error", { startingUrl: "https://example.com" });

      // Should recover from single error
      expect(result.success).toBe(true);
      expect(result.finalAnswer).toBe("Recovered");

      // Check error event was emitted
      const errorEvent = mockLogger.events.find(
        (e) => e.type === WebAgentEventType.AI_GENERATION_ERROR,
      );
      expect(errorEvent).toBeDefined();
      expect(errorEvent?.data.error).toBe("AI error");
    });

    it("should fail after consecutive errors exceed limit", async () => {
      const options: WebAgentOptions = {
        providerConfig: { model: mockProvider },
        maxConsecutiveErrors: 2,
        maxTotalErrors: 10,
        eventEmitter,
        logger: mockLogger,
      };

      const limitedAgent = new WebAgent(mockBrowser, options);

      // Plan
      mockGenerateTextWithRetry.mockResolvedValueOnce({
        text: "Planning",
        toolResults: [
          {
            type: "tool-result",
            toolCallId: "plan_1",
            toolName: "create_plan",
            input: {
              successCriteria: "Test",
              plan: "1. Test",
            },
            output: {
              successCriteria: "Test",
              plan: "1. Test",
            },
          },
        ],
      } as any);

      // Three consecutive errors
      mockStreamText.mockImplementationOnce(() => {
        throw new Error("Error 1");
      });
      mockStreamText.mockImplementationOnce(() => {
        throw new Error("Error 2");
      });

      const result = await limitedAgent.execute("Test consecutive errors", {
        startingUrl: "https://example.com",
      });

      expect(result.success).toBe(false);
      expect(result.finalAnswer).toContain("Task failed after 2 consecutive errors");

      await limitedAgent.close();
    });

    it("should fail after total errors exceed limit", async () => {
      const options: WebAgentOptions = {
        providerConfig: { model: mockProvider },
        maxConsecutiveErrors: 10,
        maxTotalErrors: 3,
        eventEmitter,
        logger: mockLogger,
      };

      const limitedAgent = new WebAgent(mockBrowser, options);

      // Plan
      mockGenerateTextWithRetry.mockResolvedValueOnce({
        text: "Planning",
        toolResults: [
          {
            type: "tool-result",
            toolCallId: "plan_1",
            toolName: "create_plan",
            input: {
              successCriteria: "Test",
              plan: "1. Test",
            },
            output: {
              successCriteria: "Test",
              plan: "1. Test",
            },
          },
        ],
      } as any);

      // Error, success, error, success, error (total 3 errors)
      mockStreamText.mockImplementationOnce(() => {
        throw new Error("Error 1");
      });
      mockStreamText.mockReturnValueOnce(
        createMockStreamResponse({
          text: "Click",
          toolResults: [
            {
              type: "tool-result",
              toolCallId: "click_1",
              toolName: "click",
              input: { ref: "btn1" },
              output: {
                action: "click",
                ref: "btn1",
                isTerminal: false,
              },
            },
          ],
          response: {
            messages: [
              {
                role: "assistant",
                content: "Click",
              },
            ],
          },
        }) as any,
      );
      mockStreamText.mockImplementationOnce(() => {
        throw new Error("Error 2");
      });
      mockStreamText.mockReturnValueOnce(
        createMockStreamResponse({
          text: "Click",
          toolResults: [
            {
              type: "tool-result",
              toolCallId: "click_2",
              toolName: "click",
              input: { ref: "btn2" },
              output: {
                action: "click",
                ref: "btn2",
                isTerminal: false,
              },
            },
          ],
          response: {
            messages: [
              {
                role: "assistant",
                content: "Click",
              },
            ],
          },
        }) as any,
      );
      mockStreamText.mockImplementationOnce(() => {
        throw new Error("Error 3");
      });

      const result = await limitedAgent.execute("Test total errors", {
        startingUrl: "https://example.com",
      });

      expect(result.success).toBe(false);
      expect(result.finalAnswer).toContain("3 total");

      await limitedAgent.close();
    });

    it("should handle maximum iterations", async () => {
      const options: WebAgentOptions = {
        providerConfig: { model: mockProvider },
        maxIterations: 2,
        eventEmitter,
        logger: mockLogger,
      };

      const limitedAgent = new WebAgent(mockBrowser, options);

      // Plan
      mockGenerateTextWithRetry.mockResolvedValueOnce({
        text: "Planning",
        toolResults: [
          {
            type: "tool-result",
            toolCallId: "plan_1",
            toolName: "create_plan",
            input: {
              successCriteria: "Test",
              plan: "1. Test",
            },
            output: {
              successCriteria: "Test",
              plan: "1. Test",
            },
          },
        ],
      } as any);

      // Keep generating non-terminal actions
      for (let i = 0; i < 5; i++) {
        mockStreamText.mockReturnValueOnce(
          createMockStreamResponse({
            text: "Click",
            toolResults: [
              {
                type: "tool-result",
                toolCallId: `click_${i}`,
                toolName: "click",
                input: { ref: "btn1" },
                output: {
                  action: "click",
                  ref: "btn1",
                  isTerminal: false,
                },
              },
            ],
            response: {
              messages: [
                {
                  role: "assistant",
                  content: "Click",
                },
                {
                  role: "tool",
                  content: [
                    {
                      type: "tool-result",
                      toolCallId: `click_${i}`,
                      toolName: "click",
                      output: { action: "click", ref: "btn1" },
                    },
                  ],
                },
              ],
            },
          }) as any,
        );
      }

      const result = await limitedAgent.execute("Long task", {
        startingUrl: "https://example.com",
      });

      expect(result.success).toBe(false);
      expect(result.finalAnswer).toContain("Maximum iterations reached");

      await limitedAgent.close();
    });

    it("should handle missing tool results", async () => {
      // Mock planning
      mockGenerateTextWithRetry.mockResolvedValueOnce({
        text: "Planning",
        toolResults: [
          {
            type: "tool-result",
            toolCallId: "plan_1",
            toolName: "create_plan",
            input: {},
            output: {
              successCriteria: "Test task",
              plan: "1. Complete task",
            },
          },
        ],
      } as any);

      // First call - returns empty tool results (will trigger error)
      mockStreamText.mockReturnValueOnce(
        createMockStreamResponse({
          text: "No tools used",
          toolResults: [],
          response: {
            messages: [
              {
                role: "assistant",
                content: "No tools used",
              },
            ],
          },
        }) as any,
      );

      // The agent will retry after the error - provide a valid response
      // Need to use mockReturnValue (not Once) for subsequent retries
      mockStreamText.mockReturnValue(
        createMockStreamResponse({
          text: "Done",
          toolResults: [
            {
              type: "tool-result",
              toolCallId: "done_1",
              toolName: "done",
              input: { result: "Complete" },
              output: {
                action: "done",
                result: "Complete",
                isTerminal: true,
              },
            },
          ],
          response: {
            messages: [
              {
                role: "assistant",
                content: "Done",
              },
              {
                role: "tool",
                content: [
                  {
                    type: "tool-result",
                    toolCallId: "done_1",
                    toolName: "done",
                    output: { action: "done", result: "Complete", isTerminal: true },
                  },
                ],
              },
            ],
          },
        }) as any,
      );

      // Mock validation response
      mockGenerateTextWithRetry.mockResolvedValueOnce(mockValidationResponse("complete"));

      const result = await webAgent.execute("Test", { startingUrl: "https://example.com" });

      expect(result.success).toBe(true);

      // Check that error event was emitted
      const errorEvent = mockLogger.events.find(
        (e) => e.type === WebAgentEventType.AI_GENERATION_ERROR,
      );
      expect(errorEvent).toBeDefined();
      expect(errorEvent?.data.error).toContain("You must use exactly one tool");
      expect(errorEvent?.data.isToolError).toBe(true); // Should be marked as tool error for UI filtering
    });

    it("should handle tool result without output property", async () => {
      // Mock planning
      mockGenerateTextWithRetry.mockResolvedValueOnce({
        text: "Planning",
        toolResults: [
          {
            type: "tool-result",
            toolCallId: "plan_1",
            toolName: "create_plan",
            input: {},
            output: {
              successCriteria: "Test task",
              plan: "1. Complete task",
            },
          },
        ],
      } as any);

      // First call - tool result without output property (will trigger error)
      mockStreamText.mockReturnValueOnce(
        createMockStreamResponse({
          text: "Click",
          toolResults: [
            {
              type: "tool-result",
              toolCallId: "click_1",
              toolName: "click",
              input: { ref: "btn1" },
              // Missing output property
            },
          ],
          response: {
            messages: [
              {
                role: "assistant",
                content: "Click",
              },
            ],
          },
        }) as any,
      );

      // The agent will retry after the error - provide a valid response
      // Need to use mockReturnValue (not Once) for subsequent retries
      mockStreamText.mockReturnValue(
        createMockStreamResponse({
          text: "Done",
          toolResults: [
            {
              type: "tool-result",
              toolCallId: "done_1",
              toolName: "done",
              input: { result: "Complete" },
              output: {
                action: "done",
                result: "Complete",
                isTerminal: true,
              },
            },
          ],
          response: {
            messages: [
              {
                role: "assistant",
                content: "Done",
              },
              {
                role: "tool",
                content: [
                  {
                    type: "tool-result",
                    toolCallId: "done_1",
                    toolName: "done",
                    output: { action: "done", result: "Complete", isTerminal: true },
                  },
                ],
              },
            ],
          },
        }) as any,
      );

      // Mock validation response
      mockGenerateTextWithRetry.mockResolvedValueOnce(mockValidationResponse("complete"));

      const result = await webAgent.execute("Test", { startingUrl: "https://example.com" });

      expect(result.success).toBe(true);

      // Check that error event was emitted
      const errorEvent = mockLogger.events.find(
        (e) => e.type === WebAgentEventType.AI_GENERATION_ERROR,
      );
      expect(errorEvent).toBeDefined();
      expect(errorEvent?.data.error).toContain("Tool execution failed: missing output property");
    });
  });

  describe("event emission", () => {
    it("should emit all expected events during execution", async () => {
      // Plan
      mockGenerateTextWithRetry.mockResolvedValueOnce({
        text: "Planning",
        toolResults: [
          {
            type: "tool-result",
            toolCallId: "plan_1",
            toolName: "create_plan",
            input: {
              successCriteria: "Test",
              plan: "1. Test",
            },
            output: {
              successCriteria: "Test",
              plan: "1. Test",
            },
          },
        ],
      } as any);

      // Action
      mockStreamText.mockReturnValueOnce(
        createMockStreamResponse({
          text: "Click",
          toolResults: [
            {
              type: "tool-result",
              toolCallId: "click_1",
              toolName: "click",
              input: { ref: "btn1" },
              output: {
                action: "click",
                ref: "btn1",
                isTerminal: false,
              },
            },
          ],
          response: {
            messages: [
              {
                role: "assistant",
                content: "Click",
              },
              {
                role: "tool",
                content: [
                  {
                    type: "tool-result",
                    toolCallId: "click_1",
                    toolName: "click",
                    output: { action: "click", ref: "btn1" },
                  },
                ],
              },
            ],
          },
        }) as any,
      );

      // Done
      mockStreamText.mockReturnValueOnce(
        createMockStreamResponse({
          text: "Done",
          toolResults: [
            {
              type: "tool-result",
              toolCallId: "done_1",
              toolName: "done",
              input: { result: "Complete" },
              output: {
                action: "done",
                result: "Complete",
                isTerminal: true,
              },
            },
          ],
          response: {
            messages: [
              {
                role: "assistant",
                content: "Done",
              },
              {
                role: "tool",
                content: [
                  {
                    type: "tool-result",
                    toolCallId: "done_1",
                    toolName: "done",
                    output: { action: "done", result: "Complete", isTerminal: true },
                  },
                ],
              },
            ],
          },
        }) as any,
      );

      await webAgent.execute("Test events", { startingUrl: "https://example.com" });

      // Check key events were emitted
      const eventTypes = mockLogger.events.map((e) => e.type);

      expect(eventTypes).toContain(WebAgentEventType.TASK_SETUP);
      expect(eventTypes).toContain(WebAgentEventType.AGENT_STATUS); // Plan created
      expect(eventTypes).toContain(WebAgentEventType.TASK_STARTED);
      expect(eventTypes).toContain(WebAgentEventType.TASK_COMPLETED);
      expect(eventTypes).toContain(WebAgentEventType.AI_GENERATION);
    });

    it("should emit AGENT_REASONED event with reasoning text", async () => {
      // Plan
      mockGenerateTextWithRetry.mockResolvedValueOnce({
        text: "Planning",
        toolResults: [
          {
            type: "tool-result",
            toolCallId: "plan_1",
            toolName: "create_plan",
            input: {
              successCriteria: "Test",
              plan: "1. Test",
            },
            output: {
              successCriteria: "Test",
              plan: "1. Test",
            },
          },
        ],
      } as any);

      // Action with reasoning
      mockStreamText.mockReturnValueOnce(
        createMockStreamResponse({
          text: "I'm clicking the button to proceed",
          reasoning: [
            { type: "thinking", text: "I need to click the button" },
            { type: "thinking", text: " to proceed with the task" },
          ],
          toolResults: [
            {
              type: "tool-result",
              toolCallId: "click_1",
              toolName: "click",
              input: { ref: "btn1" },
              output: {
                action: "click",
                ref: "btn1",
                isTerminal: false,
              },
            },
          ],
          response: {
            messages: [
              {
                role: "assistant",
                content: "I'm clicking the button to proceed",
              },
              {
                role: "tool",
                content: [
                  {
                    type: "tool-result",
                    toolCallId: "click_1",
                    toolName: "click",
                    output: { action: "click", ref: "btn1" },
                  },
                ],
              },
            ],
          },
        }) as any,
      );

      // Done
      mockStreamText.mockReturnValueOnce(
        createMockStreamResponse({
          text: "Task is complete",
          toolResults: [
            {
              type: "tool-result",
              toolCallId: "done_1",
              toolName: "done",
              input: { result: "Complete" },
              output: {
                action: "done",
                result: "Complete",
                isTerminal: true,
              },
            },
          ],
          response: {
            messages: [
              {
                role: "assistant",
                content: "Task is complete",
              },
              {
                role: "tool",
                content: [
                  {
                    type: "tool-result",
                    toolCallId: "done_1",
                    toolName: "done",
                    output: { action: "done", result: "Complete", isTerminal: true },
                  },
                ],
              },
            ],
          },
        }) as any,
      );

      await webAgent.execute("Test reasoning", { startingUrl: "https://example.com" });

      // Check AGENT_REASONED events were emitted
      const reasonedEvents = mockLogger.events.filter(
        (e) => e.type === WebAgentEventType.AGENT_REASONED,
      );
      expect(reasonedEvents.length).toBeGreaterThan(0);
      const firstReasoned = reasonedEvents[0];
      expect(firstReasoned?.data.reasoning).toBe(
        "I need to click the button to proceed with the task",
      );
    });

    it("should emit AGENT_PROCESSING events", async () => {
      // Plan
      mockGenerateTextWithRetry.mockResolvedValueOnce({
        text: "Planning",
        toolResults: [
          {
            type: "tool-result",
            toolCallId: "plan_1",
            toolName: "create_plan",
            input: {
              successCriteria: "Test",
              plan: "1. Test",
            },
            output: {
              successCriteria: "Test",
              plan: "1. Test",
            },
          },
        ],
      } as any);

      // Done
      mockStreamText.mockReturnValueOnce(
        createMockStreamResponse({
          text: "Done",
          toolResults: [
            {
              type: "tool-result",
              toolCallId: "done_1",
              toolName: "done",
              input: { result: "Complete" },
              output: {
                action: "done",
                result: "Complete",
                isTerminal: true,
              },
            },
          ],
          response: {
            messages: [
              {
                role: "assistant",
                content: "Done",
              },
              {
                role: "tool",
                content: [
                  {
                    type: "tool-result",
                    toolCallId: "done_1",
                    toolName: "done",
                    output: { action: "done", result: "Complete", isTerminal: true },
                  },
                ],
              },
            ],
          },
        }) as any,
      );

      await webAgent.execute("Test processing events", { startingUrl: "https://example.com" });

      // Check AGENT_PROCESSING events were emitted
      const processingEvents = mockLogger.events.filter(
        (e) => e.type === WebAgentEventType.AGENT_PROCESSING,
      );

      // Should have at least one for planning and one for thinking
      expect(processingEvents.length).toBeGreaterThanOrEqual(2); // planning and at least one thinking

      // Check all events have hasScreenshot field and operation
      processingEvents.forEach((event) => {
        expect(event.data).toHaveProperty("hasScreenshot");
        expect(typeof event.data.hasScreenshot).toBe("boolean");
        expect(event.data.operation).toBeTruthy();
      });

      // Check operations are specified
      const planningEvents = processingEvents.filter(
        (e) => e.data.operation === "Creating task plan",
      );
      expect(planningEvents.length).toBe(1); // only one planning event now

      const thinkingEvents = processingEvents.filter(
        (e) => e.data.operation === "Thinking about next action",
      );
      expect(thinkingEvents.length).toBeGreaterThanOrEqual(1); // at least one thinking event
    });

    it("should emit AGENT_STATUS event when creating task plan", async () => {
      // Plan
      mockGenerateTextWithRetry.mockResolvedValueOnce({
        text: "Planning",
        toolResults: [
          {
            type: "tool-result",
            toolCallId: "plan_1",
            toolName: "create_plan",
            input: {
              successCriteria: "Test",
              plan: "1. Test",
            },
            output: {
              successCriteria: "Test",
              plan: "1. Test",
            },
          },
        ],
      } as any);

      // Done
      mockStreamText.mockReturnValueOnce(
        createMockStreamResponse({
          text: "Done",
          toolResults: [
            {
              type: "tool-result",
              toolCallId: "done_1",
              toolName: "done",
              input: { result: "Complete" },
              output: {
                action: "done",
                result: "Complete",
                isTerminal: true,
              },
            },
          ],
          response: {
            messages: [
              {
                role: "assistant",
                content: "Done",
              },
              {
                role: "tool",
                content: [
                  {
                    type: "tool-result",
                    toolCallId: "done_1",
                    toolName: "done",
                    output: { action: "done", result: "Complete", isTerminal: true },
                  },
                ],
              },
            ],
          },
        }) as any,
      );

      await webAgent.execute("Test status events", { startingUrl: "https://example.com" });

      // Check AGENT_STATUS event was emitted for "Creating task plan"
      const statusEvents = mockLogger.events.filter(
        (e) => e.type === WebAgentEventType.AGENT_STATUS,
      );

      const creatingPlanStatus = statusEvents.find((e) => e.data.message === "Creating task plan");

      expect(creatingPlanStatus).toBeDefined();
      expect(creatingPlanStatus?.data.iterationId).toBe("planning");
    });
  });

  describe("task validation", () => {
    it("should validate task completion when done is called", async () => {
      const webAgent = new WebAgent(mockBrowser, {
        providerConfig: { model: mockProvider },
        eventEmitter,
        logger: mockLogger,
      });

      // Mock planning
      mockGenerateTextWithRetry.mockResolvedValueOnce({
        text: "Planning",
        toolResults: [
          {
            type: "tool-result",
            toolCallId: "plan_1",
            toolName: "create_plan",
            output: {
              successCriteria: "Test task",
              plan: "1. Complete task",
            },
          },
        ],
      } as any);

      // Mock done action
      mockStreamText.mockReturnValueOnce(
        createMockStreamResponse({
          text: "Task complete",
          toolResults: [
            {
              type: "tool-result",
              toolCallId: "done_1",
              toolName: "done",
              output: {
                action: "done",
                result: "Task completed",
                isTerminal: true,
              },
            },
          ],
          response: {
            messages: [
              {
                role: "assistant",
                content: "Task complete",
              },
            ],
          },
        }) as any,
      );

      // Mock validation response as complete
      mockGenerateTextWithRetry.mockResolvedValueOnce(mockValidationResponse("complete"));

      const result = await webAgent.execute("Test task", { startingUrl: "https://example.com" });

      expect(result.success).toBe(true);

      // Check that validation event was emitted
      const validationEvent = mockLogger.events.find(
        (e) => e.type === WebAgentEventType.TASK_VALIDATED,
      );
      expect(validationEvent).toBeDefined();
      expect(validationEvent?.data.completionQuality).toBe("complete");
    });

    it("should retry task when validation fails", async () => {
      const webAgent = new WebAgent(mockBrowser, {
        providerConfig: { model: mockProvider },
        eventEmitter,
        logger: mockLogger,
        maxValidationAttempts: 2,
      });

      // Mock planning
      mockGenerateTextWithRetry.mockResolvedValueOnce({
        text: "Planning",
        toolResults: [
          {
            type: "tool-result",
            toolCallId: "plan_1",
            toolName: "create_plan",
            output: {
              successCriteria: "Test task",
              plan: "1. Complete task properly",
            },
          },
        ],
      } as any);

      // First attempt - done action
      mockStreamText.mockReturnValueOnce(
        createMockStreamResponse({
          text: "Task complete",
          toolResults: [
            {
              type: "tool-result",
              toolCallId: "done_1",
              toolName: "done",
              output: {
                action: "done",
                result: "Incomplete result",
                isTerminal: true,
              },
            },
          ],
          response: {
            messages: [
              {
                role: "assistant",
                content: "Task complete",
              },
            ],
          },
        }) as any,
      );

      // Mock validation response as partial (fail first attempt)
      mockGenerateTextWithRetry.mockResolvedValueOnce(mockValidationResponse("partial"));

      // Second attempt - improved done action
      mockStreamText.mockReturnValueOnce(
        createMockStreamResponse({
          text: "Better completion",
          toolResults: [
            {
              type: "tool-result",
              toolCallId: "done_2",
              toolName: "done",
              output: {
                action: "done",
                result: "Complete result",
                isTerminal: true,
              },
            },
          ],
          response: {
            messages: [
              {
                role: "assistant",
                content: "Better completion",
              },
            ],
          },
        }) as any,
      );

      // Mock validation response as complete (pass second attempt)
      mockGenerateTextWithRetry.mockResolvedValueOnce(mockValidationResponse("complete"));

      const result = await webAgent.execute("Test task", { startingUrl: "https://example.com" });

      expect(result.success).toBe(true);
      expect(result.finalAnswer).toBe("Complete result");

      // Check that validation was attempted twice
      const validationEvents = mockLogger.events.filter(
        (e) => e.type === WebAgentEventType.TASK_VALIDATED,
      );
      expect(validationEvents.length).toBeGreaterThanOrEqual(2);
      // Find the partial and complete events
      const partialEvent = validationEvents.find((e) => e.data.completionQuality === "partial");
      const completeEvent = validationEvents.find((e) => e.data.completionQuality === "complete");
      expect(partialEvent).toBeDefined();
      expect(completeEvent).toBeDefined();
    });

    it("should add validation feedback message to conversation when validation fails", async () => {
      const webAgent = new WebAgent(mockBrowser, {
        providerConfig: { model: mockProvider },
        eventEmitter,
        logger: mockLogger,
        maxValidationAttempts: 2,
      });

      // Mock planning
      mockGenerateTextWithRetry.mockResolvedValueOnce({
        text: "Planning",
        toolResults: [
          {
            type: "tool-result",
            toolCallId: "plan_1",
            toolName: "create_plan",
            input: {},
            output: {
              successCriteria: "Test task",
              plan: "1. Complete task properly",
            },
          },
        ],
      } as any);

      // First attempt - done action
      mockStreamText.mockReturnValueOnce(
        createMockStreamResponse({
          text: "Task complete",
          toolResults: [
            {
              type: "tool-result",
              toolCallId: "done_1",
              toolName: "done",
              input: {},
              output: {
                action: "done",
                result: "Incomplete result",
                isTerminal: true,
              },
            },
          ],
          response: {
            id: "test-id",
            timestamp: new Date(),
            modelId: "test-model",
            messages: [
              {
                role: "assistant",
                content: "Task complete",
              },
            ],
          },
        }) as any,
      );

      // Mock validation response as partial (fail first attempt)
      mockGenerateTextWithRetry.mockResolvedValueOnce({
        text: "Validation",
        toolResults: [
          {
            type: "tool-result",
            toolCallId: "validate_1",
            toolName: "validate_task",
            input: {},
            output: {
              taskAssessment: "Missing key information",
              completionQuality: "partial",
              feedback: "You need to provide more details about X and Y",
            },
          },
        ],
      } as any);

      // Second attempt - should receive feedback message
      mockStreamText.mockReturnValueOnce(
        createMockStreamResponse({
          text: "Better completion",
          toolResults: [
            {
              type: "tool-result",
              toolCallId: "done_2",
              toolName: "done",
              input: {},
              output: {
                action: "done",
                result: "Complete result with X and Y details",
                isTerminal: true,
              },
            },
          ],
          response: {
            id: "test-id",
            timestamp: new Date(),
            modelId: "test-model",
            messages: [
              {
                role: "assistant",
                content: "Better completion",
              },
            ],
          },
        }) as any,
      );

      // Mock validation response as complete (pass second attempt)
      mockGenerateTextWithRetry.mockResolvedValueOnce(mockValidationResponse("complete"));

      const result = await webAgent.execute("Test task", { startingUrl: "https://example.com" });

      expect(result.success).toBe(true);
      expect(result.finalAnswer).toBe("Complete result with X and Y details");

      // Verify that the feedback message was added to the conversation
      // Check the messages passed to the second done attempt
      const secondDoneCall = mockStreamText.mock.calls[1]; // Second done attempt (planning uses mockGenerateTextWithRetry)
      expect(secondDoneCall).toBeDefined();

      const messages = secondDoneCall[0].messages;
      expect(messages).toBeDefined();

      // Find the validation feedback message
      const feedbackMessage = messages?.find(
        (msg: any) =>
          msg.role === "user" &&
          typeof msg.content === "string" &&
          msg.content.includes("Task Incomplete - Attempt 1"),
      );

      expect(feedbackMessage).toBeDefined();
      expect(feedbackMessage?.content).toContain("Missing key information");
      expect(feedbackMessage?.content).toContain("You need to provide more details about X and Y");
      expect(feedbackMessage?.content).toContain("Do not repeat your previous answer");

      // Verify validation error event was emitted with the feedback
      const validationErrorEvent = mockLogger.events.find(
        (e) => e.type === WebAgentEventType.TASK_VALIDATION_ERROR,
      );
      expect(validationErrorEvent).toBeDefined();
      expect(validationErrorEvent?.data.feedback).toContain("Task Incomplete - Attempt 1");
    });

    it("should format validation feedback correctly without emojis", async () => {
      const webAgent = new WebAgent(mockBrowser, {
        providerConfig: { model: mockProvider },
        eventEmitter,
        logger: mockLogger,
        maxValidationAttempts: 2,
      });

      // Mock planning
      mockGenerateTextWithRetry.mockResolvedValueOnce({
        text: "Planning",
        toolResults: [
          {
            type: "tool-result",
            toolCallId: "plan_1",
            toolName: "create_plan",
            output: {
              successCriteria: "Test task",
              plan: "1. Complete task",
            },
          },
        ],
      } as any);

      // First attempt - done action
      mockStreamText.mockReturnValueOnce(
        createMockStreamResponse({
          text: "Task complete",
          toolResults: [
            {
              type: "tool-result",
              toolCallId: "done_1",
              toolName: "done",
              output: {
                action: "done",
                result: "Incomplete",
                isTerminal: true,
              },
            },
          ],
          response: {
            messages: [
              {
                role: "assistant",
                content: "Task complete",
              },
            ],
          },
        }) as any,
      );

      // Mock validation response with specific feedback
      mockGenerateTextWithRetry.mockResolvedValueOnce({
        text: "Validation",
        toolResults: [
          {
            type: "tool-result",
            toolCallId: "validate_1",
            toolName: "validate_task",
            output: {
              taskAssessment: "The answer lacks required details",
              completionQuality: "failed",
              feedback: "Include specific examples and explanations",
            },
          },
        ],
      } as any);

      // Second attempt after feedback
      mockStreamText.mockReturnValueOnce(
        createMockStreamResponse({
          text: "Improved",
          toolResults: [
            {
              type: "tool-result",
              toolCallId: "done_2",
              toolName: "done",
              output: {
                action: "done",
                result: "Complete with examples",
                isTerminal: true,
              },
            },
          ],
          response: {
            messages: [
              {
                role: "assistant",
                content: "Improved",
              },
            ],
          },
        }) as any,
      );

      // Mock validation response as complete
      mockGenerateTextWithRetry.mockResolvedValueOnce(mockValidationResponse("complete"));

      await webAgent.execute("Test task", { startingUrl: "https://example.com" });

      // Check the feedback message format
      const secondDoneCall = mockStreamText.mock.calls[1]; // Second done attempt (planning uses mockGenerateTextWithRetry)
      expect(secondDoneCall).toBeDefined();

      const messages = secondDoneCall[0].messages;
      expect(messages).toBeDefined();

      const feedbackMessage = messages?.find(
        (msg: any) =>
          msg.role === "user" &&
          typeof msg.content === "string" &&
          msg.content.includes("Task Incomplete"),
      );

      expect(feedbackMessage).toBeDefined();

      // Verify the format matches our prompt template
      expect(feedbackMessage?.content).toMatch(/^## Task Incomplete - Attempt 1/);
      expect(feedbackMessage?.content).toContain("The answer lacks required details");
      expect(feedbackMessage?.content).toContain(
        "**Feedback:** Include specific examples and explanations",
      );
      expect(feedbackMessage?.content).toContain("Do not repeat your previous answer");

      // Ensure no emojis are present
      expect(feedbackMessage?.content).not.toMatch(/[\u{1F300}-\u{1F9FF}]/u);
      expect(feedbackMessage?.content).not.toContain("⚠️");
      expect(feedbackMessage?.content).not.toContain("🔄");
    });

    it("should accept result after max validation attempts even if quality is poor", async () => {
      const webAgent = new WebAgent(mockBrowser, {
        providerConfig: { model: mockProvider },
        eventEmitter,
        logger: mockLogger,
        maxValidationAttempts: 1,
      });

      // Mock planning
      mockGenerateTextWithRetry.mockResolvedValueOnce({
        text: "Planning",
        toolResults: [
          {
            type: "tool-result",
            toolCallId: "plan_1",
            toolName: "create_plan",
            output: {
              successCriteria: "Test task",
              plan: "1. Complete task",
            },
          },
        ],
      } as any);

      // Mock done action
      mockStreamText.mockReturnValueOnce(
        createMockStreamResponse({
          text: "Task complete",
          toolResults: [
            {
              type: "tool-result",
              toolCallId: "done_1",
              toolName: "done",
              output: {
                action: "done",
                result: "Poor result",
                isTerminal: true,
              },
            },
          ],
          response: {
            messages: [
              {
                role: "assistant",
                content: "Task complete",
              },
            ],
          },
        }) as any,
      );

      // Mock validation response as failed but should accept due to max attempts
      mockGenerateTextWithRetry.mockResolvedValueOnce(mockValidationResponse("failed"));

      const result = await webAgent.execute("Test task", { startingUrl: "https://example.com" });

      // Should still be marked as successful since we hit max attempts
      expect(result.success).toBe(true);
      expect(result.finalAnswer).toBe("Poor result");

      // Check that validation event shows failed quality
      const validationEvent = mockLogger.events.find(
        (e) => e.type === WebAgentEventType.TASK_VALIDATED,
      );
      expect(validationEvent?.data.completionQuality).toBe("failed");
    });
  });

  describe("guardrails", () => {
    it("should apply guardrails to planning and execution", async () => {
      const guardrails = "Only interact with buttons, do not fill forms";

      const guardedAgent = new WebAgent(mockBrowser, {
        providerConfig: { model: mockProvider },
        guardrails,
        eventEmitter,
        logger: mockLogger,
      });

      // Plan should include guardrails
      mockGenerateTextWithRetry.mockResolvedValueOnce({
        text: "Planning with guardrails",
        toolResults: [
          {
            type: "tool-result",
            toolCallId: "plan_1",
            toolName: "create_plan",
            input: {
              successCriteria: "Click buttons only",
              plan: "1. Only click buttons per guardrails",
            },
            output: {
              successCriteria: "Click buttons only",
              plan: "1. Only click buttons per guardrails",
            },
          },
        ],
      } as any);

      // Click action (allowed)
      mockStreamText.mockReturnValueOnce(
        createMockStreamResponse({
          text: "Click",
          toolResults: [
            {
              type: "tool-result",
              toolCallId: "click_1",
              toolName: "click",
              input: { ref: "btn1" },
              output: {
                action: "click",
                ref: "btn1",
                isTerminal: false,
              },
            },
          ],
          response: {
            messages: [
              {
                role: "assistant",
                content: "Click",
              },
              {
                role: "tool",
                content: [
                  {
                    type: "tool-result",
                    toolCallId: "click_1",
                    toolName: "click",
                    output: { action: "click", ref: "btn1" },
                  },
                ],
              },
            ],
          },
        }) as any,
      );

      // Done
      mockStreamText.mockReturnValueOnce(
        createMockStreamResponse({
          text: "Done",
          toolResults: [
            {
              type: "tool-result",
              toolCallId: "done_1",
              toolName: "done",
              input: { result: "Complete" },
              output: {
                action: "done",
                result: "Complete",
                isTerminal: true,
              },
            },
          ],
          response: {
            messages: [
              {
                role: "assistant",
                content: "Done",
              },
              {
                role: "tool",
                content: [
                  {
                    type: "tool-result",
                    toolCallId: "done_1",
                    toolName: "done",
                    output: { action: "done", result: "Complete", isTerminal: true },
                  },
                ],
              },
            ],
          },
        }) as any,
      );

      // Mock validation response
      mockGenerateTextWithRetry.mockResolvedValueOnce(mockValidationResponse("complete"));

      const result = await guardedAgent.execute("Interact with page", {
        startingUrl: "https://example.com",
      });

      expect(result.success).toBe(true);

      // Check that guardrails were included in setup event
      const setupEvent = mockLogger.events.find((e) => e.type === WebAgentEventType.TASK_SETUP);
      expect(setupEvent?.data.guardrails).toBe(guardrails);

      await guardedAgent.close();
    });
  });

  describe("vision mode", () => {
    it("should handle vision mode configuration", async () => {
      const visionAgent = new WebAgent(mockBrowser, {
        providerConfig: { model: mockProvider },
        vision: true,
        eventEmitter,
        logger: mockLogger,
      });

      // Plan
      mockGenerateTextWithRetry.mockResolvedValueOnce({
        text: "Planning",
        toolResults: [
          {
            type: "tool-result",
            toolCallId: "plan_1",
            toolName: "create_plan",
            input: {
              successCriteria: "Visual task",
              plan: "1. Use vision",
            },
            output: {
              successCriteria: "Visual task",
              plan: "1. Use vision",
            },
          },
        ],
      } as any);

      // Done
      mockStreamText.mockReturnValueOnce(
        createMockStreamResponse({
          text: "Done",
          toolResults: [
            {
              type: "tool-result",
              toolCallId: "done_1",
              toolName: "done",
              input: { result: "Complete" },
              output: {
                action: "done",
                result: "Complete",
                isTerminal: true,
              },
            },
          ],
          response: {
            messages: [
              {
                role: "assistant",
                content: "Done",
              },
              {
                role: "tool",
                content: [
                  {
                    type: "tool-result",
                    toolCallId: "done_1",
                    toolName: "done",
                    output: { action: "done", result: "Complete", isTerminal: true },
                  },
                ],
              },
            ],
          },
        }) as any,
      );

      await visionAgent.execute("Visual task", { startingUrl: "https://example.com" });

      // Check vision was enabled in setup
      const setupEvent = mockLogger.events.find((e) => e.type === WebAgentEventType.TASK_SETUP);
      expect(setupEvent?.data.vision).toBe(true);

      await visionAgent.close();
    });

    it("should capture screenshots and emit events when vision is enabled", async () => {
      const mockScreenshot = Buffer.from("test-screenshot-data");
      const screenshotSpy = vi
        .spyOn(mockBrowser, "getScreenshot")
        .mockResolvedValue(mockScreenshot);

      const visionAgent = new WebAgent(mockBrowser, {
        providerConfig: { model: mockProvider },
        vision: true,
        eventEmitter,
        logger: mockLogger,
      });

      // Plan
      mockGenerateTextWithRetry.mockResolvedValueOnce({
        text: "Planning",
        toolResults: [
          {
            type: "tool-result",
            toolCallId: "plan_1",
            toolName: "create_plan",
            output: {
              successCriteria: "Visual task",
              plan: "1. Analyze visual elements",
            },
          },
        ],
      } as any);

      // Action that requires page snapshot
      mockStreamText.mockReturnValueOnce(
        createMockStreamResponse({
          text: "Analyzing page with vision",
          toolResults: [
            {
              type: "tool-result",
              toolCallId: "click_1",
              toolName: "click",
              input: { ref: "btn1" },
              output: {
                action: "click",
                ref: "btn1",
                isTerminal: false,
              },
            },
          ],
          response: {
            messages: [
              {
                role: "assistant",
                content: "Clicking button",
              },
            ],
          },
        }) as any,
      );

      // Done
      mockStreamText.mockReturnValueOnce(
        createMockStreamResponse({
          text: "Task complete",
          toolResults: [
            {
              type: "tool-result",
              toolCallId: "done_1",
              toolName: "done",
              output: {
                action: "done",
                result: "Visual analysis complete",
                isTerminal: true,
              },
            },
          ],
          response: {
            messages: [
              {
                role: "assistant",
                content: "Done",
              },
            ],
          },
        }) as any,
      );

      // Mock validation
      mockGenerateTextWithRetry.mockResolvedValueOnce(mockValidationResponse("complete"));

      await visionAgent.execute("Analyze visual elements", { startingUrl: "https://example.com" });

      // Verify screenshot was captured
      expect(screenshotSpy).toHaveBeenCalled();

      // Verify BROWSER_SCREENSHOT_CAPTURED event was emitted
      const screenshotEvents = mockLogger.events.filter(
        (e) => e.type === WebAgentEventType.BROWSER_SCREENSHOT_CAPTURED,
      );
      expect(screenshotEvents.length).toBeGreaterThan(0);

      // Verify event data
      const firstScreenshotEvent = screenshotEvents[0];
      expect(firstScreenshotEvent?.data.size).toBe(mockScreenshot.length);
      expect(firstScreenshotEvent?.data.format).toBe("jpeg");

      // Verify messages include multimodal content with screenshots
      const callArgs = mockStreamText.mock.calls;
      const actionCall = callArgs.find(
        (call) =>
          call[0].messages &&
          call[0].messages.some(
            (msg: any) =>
              Array.isArray(msg.content) && msg.content.some((item: any) => item.type === "image"),
          ),
      );
      expect(actionCall).toBeDefined();

      await visionAgent.close();
    });

    it("should fallback to text-only when screenshot capture fails", async () => {
      const screenshotError = new Error("Screenshot capture failed");
      const screenshotSpy = vi
        .spyOn(mockBrowser, "getScreenshot")
        .mockRejectedValue(screenshotError);
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const visionAgent = new WebAgent(mockBrowser, {
        providerConfig: { model: mockProvider },
        vision: true,
        eventEmitter,
        logger: mockLogger,
      });

      // Plan
      mockGenerateTextWithRetry.mockResolvedValueOnce({
        text: "Planning",
        toolResults: [
          {
            type: "tool-result",
            toolCallId: "plan_1",
            toolName: "create_plan",
            output: {
              successCriteria: "Task",
              plan: "1. Do something",
            },
          },
        ],
      } as any);

      // Done immediately
      mockStreamText.mockReturnValueOnce(
        createMockStreamResponse({
          text: "Done",
          toolResults: [
            {
              type: "tool-result",
              toolCallId: "done_1",
              toolName: "done",
              output: {
                action: "done",
                result: "Complete",
                isTerminal: true,
              },
            },
          ],
          response: {
            messages: [
              {
                role: "assistant",
                content: "Done",
              },
            ],
          },
        }) as any,
      );

      // Mock validation
      mockGenerateTextWithRetry.mockResolvedValueOnce(mockValidationResponse("complete"));

      await visionAgent.execute("Test task", { startingUrl: "https://example.com" });

      // Verify screenshot was attempted
      expect(screenshotSpy).toHaveBeenCalled();

      // Verify warning was logged
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "Screenshot capture failed, falling back to text-only:",
        screenshotError,
      );

      // Verify no screenshot events were emitted
      const screenshotEvents = mockLogger.events.filter(
        (e) => e.type === WebAgentEventType.BROWSER_SCREENSHOT_CAPTURED,
      );
      expect(screenshotEvents.length).toBe(0);

      // Verify messages are text-only (no multimodal content)
      const callArgs = mockStreamText.mock.calls;
      const hasMultimodalContent = callArgs.some(
        (call) =>
          call[0].messages &&
          call[0].messages.some(
            (msg: any) =>
              Array.isArray(msg.content) && msg.content.some((item: any) => item.type === "image"),
          ),
      );
      expect(hasMultimodalContent).toBe(false);

      consoleWarnSpy.mockRestore();
      await visionAgent.close();
    });
  });

  describe("snapshot truncation", () => {
    it("should truncate old snapshots to keep context size down", async () => {
      // Plan with URL
      mockGenerateTextWithRetry.mockResolvedValueOnce({
        text: "Planning",
        toolResults: [
          {
            type: "tool-result",
            toolCallId: "plan_1",
            toolName: "create_plan",
            output: {
              successCriteria: "Test task",
              plan: "1. Navigate through pages",
            },
          },
        ],
      } as any);

      // First action - navigate
      mockStreamText.mockReturnValueOnce(
        createMockStreamResponse({
          text: "Navigating",
          toolResults: [
            {
              type: "tool-result",
              toolCallId: "click_1",
              toolName: "click",
              output: {
                action: "click",
                ref: "button-1",
                isTerminal: false,
              },
            },
          ],
          response: {
            messages: [
              {
                role: "assistant",
                content: "Clicking button",
              },
            ],
          },
        }) as any,
      );

      // Second action - another navigation
      mockStreamText.mockReturnValueOnce(
        createMockStreamResponse({
          text: "Navigating further",
          toolResults: [
            {
              type: "tool-result",
              toolCallId: "click_2",
              toolName: "click",
              output: {
                action: "click",
                ref: "link-2",
                isTerminal: false,
              },
            },
          ],
          response: {
            messages: [
              {
                role: "assistant",
                content: "Clicking link",
              },
            ],
          },
        }) as any,
      );

      // Done
      mockStreamText.mockReturnValueOnce(
        createMockStreamResponse({
          text: "Complete",
          toolResults: [
            {
              type: "tool-result",
              toolCallId: "done_1",
              toolName: "done",
              output: {
                action: "done",
                result: "Task complete",
                isTerminal: true,
              },
            },
          ],
          response: {
            messages: [
              {
                role: "assistant",
                content: "Done",
              },
            ],
          },
        }) as any,
      );

      // Mock validation
      mockGenerateTextWithRetry.mockResolvedValueOnce(mockValidationResponse("complete"));

      await webAgent.execute("Navigate through pages", { startingUrl: "https://example.com" });

      // Check the messages passed to generateText in the later calls
      // The first snapshot should be clipped
      const callArgs = mockStreamText.mock.calls;

      // Find the second action call (after first navigation)
      const secondActionCall = callArgs[2]; // Plan, First action, Second action
      if (secondActionCall && secondActionCall[0].messages) {
        const messages = secondActionCall[0].messages;

        // Find user messages with snapshots (they start with Title:)
        const snapshotMessages = messages.filter(
          (msg: any) =>
            msg.role === "user" &&
            typeof msg.content === "string" &&
            msg.content.startsWith("Title:"),
        );

        // If there are multiple snapshot messages, the earlier ones should be clipped
        if (snapshotMessages.length > 1) {
          const firstSnapshot = snapshotMessages[0].content;
          expect(firstSnapshot).toContain("[clipped for brevity]");
          // Should not contain the triple backticks anymore
          expect(firstSnapshot).not.toContain("```");
        }
      }

      // Third action call should have even more clipped snapshots
      const thirdActionCall = callArgs[3]; // Plan, First action, Second action, Third action
      if (thirdActionCall && thirdActionCall[0].messages) {
        const messages = thirdActionCall[0].messages;

        // Count clipped snapshots
        let clippedCount = 0;
        messages.forEach((msg: any) => {
          if (
            msg.role === "user" &&
            typeof msg.content === "string" &&
            msg.content.includes("[clipped for brevity]")
          ) {
            clippedCount++;
          }
        });

        // Should have at least one clipped snapshot by the third action
        expect(clippedCount).toBeGreaterThan(0);
      }
    });

    it("should truncate screenshots in vision mode", async () => {
      const mockScreenshot = Buffer.from("fake-screenshot-data");
      vi.spyOn(mockBrowser, "getScreenshot").mockResolvedValue(mockScreenshot);

      const visionAgent = new WebAgent(mockBrowser, {
        providerConfig: { model: mockProvider },
        vision: true,
        eventEmitter,
        logger: mockLogger,
      });

      // Plan
      mockGenerateTextWithRetry.mockResolvedValueOnce({
        text: "Planning",
        toolResults: [
          {
            type: "tool-result",
            toolCallId: "plan_1",
            toolName: "create_plan",
            output: {
              successCriteria: "Visual task",
              plan: "1. Analyze images",
            },
          },
        ],
      } as any);

      // First action
      mockStreamText.mockReturnValueOnce(
        createMockStreamResponse({
          text: "Analyzing",
          toolResults: [
            {
              type: "tool-result",
              toolCallId: "click_1",
              toolName: "click",
              output: {
                action: "click",
                ref: "image-1",
                isTerminal: false,
              },
            },
          ],
          response: {
            messages: [
              {
                role: "assistant",
                content: "Clicking image",
              },
            ],
          },
        }) as any,
      );

      // Second action
      mockStreamText.mockReturnValueOnce(
        createMockStreamResponse({
          text: "Continuing",
          toolResults: [
            {
              type: "tool-result",
              toolCallId: "click_2",
              toolName: "click",
              output: {
                action: "click",
                ref: "image-2",
                isTerminal: false,
              },
            },
          ],
          response: {
            messages: [
              {
                role: "assistant",
                content: "Clicking another image",
              },
            ],
          },
        }) as any,
      );

      // Done
      mockStreamText.mockReturnValueOnce(
        createMockStreamResponse({
          text: "Complete",
          toolResults: [
            {
              type: "tool-result",
              toolCallId: "done_1",
              toolName: "done",
              output: {
                action: "done",
                result: "Visual analysis complete",
                isTerminal: true,
              },
            },
          ],
          response: {
            messages: [
              {
                role: "assistant",
                content: "Done",
              },
            ],
          },
        }) as any,
      );

      // Mock validation
      mockGenerateTextWithRetry.mockResolvedValueOnce(mockValidationResponse("complete"));

      await visionAgent.execute("Analyze visual elements", { startingUrl: "https://example.com" });

      // Check that old screenshots are clipped
      const callArgs = mockStreamText.mock.calls;

      // By the third action call, earlier screenshots should be clipped
      const thirdActionCall = callArgs[3];
      if (thirdActionCall && thirdActionCall[0].messages) {
        const messages = thirdActionCall[0].messages;

        // Count clipped screenshots
        let clippedScreenshotCount = 0;
        messages.forEach((msg: any) => {
          if (msg.role === "user" && Array.isArray(msg.content)) {
            msg.content.forEach((item: any) => {
              if (item.type === "text" && item.text === "[screenshot clipped for brevity]") {
                clippedScreenshotCount++;
              }
            });
          }
        });

        // Should have at least one clipped screenshot
        expect(clippedScreenshotCount).toBeGreaterThan(0);
      }

      await visionAgent.close();
    });
  });

  describe("cleanup", () => {
    it("should properly close and dispose resources", async () => {
      const disposeSpy = vi.spyOn(mockLogger, "dispose");
      const shutdownSpy = vi.spyOn(mockBrowser, "shutdown");

      await webAgent.close();

      expect(disposeSpy).toHaveBeenCalled();
      expect(shutdownSpy).toHaveBeenCalled();
    });
  });

  describe("enhanced error handling", () => {
    it("should extract detailed error messages from provider errors", async () => {
      // Mock planning
      mockGenerateTextWithRetry.mockResolvedValueOnce({
        text: "Plan",
        toolResults: [
          {
            type: "tool-result",
            toolCallId: "plan_1",
            toolName: "create_plan",
            output: {
              successCriteria: "Test task",
              plan: "1. Complete task",
            },
          },
        ],
      } as any);

      // Create an error with AI SDK properties
      const providerError = new Error("Provider returned error") as any;
      providerError.statusCode = 422;

      mockStreamText.mockImplementationOnce(() => {
        throw providerError;
      });

      const result = await webAgent.execute("Test task", { startingUrl: "https://example.com" });

      expect(result.success).toBe(false);
      expect(result.finalAnswer).toContain("[422]");
      expect(result.finalAnswer).toContain("Provider returned error");
    });

    it("should fail immediately on 4xx provider errors", async () => {
      // Mock planning
      mockGenerateTextWithRetry.mockResolvedValueOnce({
        text: "Plan",
        toolResults: [
          {
            type: "tool-result",
            toolCallId: "plan_1",
            toolName: "create_plan",
            output: {
              successCriteria: "Test task",
              plan: "1. Complete task",
            },
          },
        ],
      } as any);

      // Create a 401 error (non-recoverable)
      const authError = new Error("Unauthorized") as any;
      authError.statusCode = 401;

      mockStreamText.mockImplementationOnce(() => {
        throw authError;
      });

      const result = await webAgent.execute("Test task", { startingUrl: "https://example.com" });

      expect(result.success).toBe(false);
      expect(result.finalAnswer).toContain("Task failed:");
      // Should fail immediately, not after retries
      expect(mockStreamText).toHaveBeenCalledTimes(1); // 1 for first action attempt (planning uses generateTextWithRetry)
    });

    it("should retry on 429 rate limit errors", async () => {
      // Mock planning
      mockGenerateTextWithRetry.mockResolvedValueOnce({
        text: "Plan",
        toolResults: [
          {
            type: "tool-result",
            toolCallId: "plan_1",
            toolName: "create_plan",
            output: {
              successCriteria: "Test task",
              plan: "1. Complete task",
            },
          },
        ],
      } as any);

      // Create a 429 error (recoverable)
      const rateLimitError = new Error("Rate limit exceeded") as any;
      rateLimitError.statusCode = 429;

      // First attempt fails with 429
      mockStreamText.mockImplementationOnce(() => {
        throw rateLimitError;
      });

      // Second attempt succeeds
      mockStreamText.mockReturnValueOnce(
        createMockStreamResponse({
          text: "Done",
          toolResults: [
            {
              type: "tool-result",
              toolCallId: "done_1",
              toolName: "done",
              output: {
                action: "done",
                result: "Task completed",
                isTerminal: true,
              },
            },
          ],
          response: {
            messages: [
              {
                role: "assistant",
                content: "Done",
              },
            ],
          },
        }) as any,
      );

      // Mock validation
      mockGenerateTextWithRetry.mockResolvedValueOnce(mockValidationResponse("complete"));

      const result = await webAgent.execute("Test task", { startingUrl: "https://example.com" });

      expect(result.success).toBe(true);
      expect(result.finalAnswer).toBe("Task completed");
      expect(mockStreamText).toHaveBeenCalledTimes(2); // failed attempt + successful attempt (planning/validation use generateTextWithRetry)
    });

    it("should retry on 5xx server errors", async () => {
      // Mock planning
      mockGenerateTextWithRetry.mockResolvedValueOnce({
        text: "Plan",
        toolResults: [
          {
            type: "tool-result",
            toolCallId: "plan_1",
            toolName: "create_plan",
            output: {
              successCriteria: "Test task",
              plan: "1. Complete task",
            },
          },
        ],
      } as any);

      // Create a 500 error (recoverable)
      const serverError = new Error("Internal server error") as any;
      serverError.statusCode = 500;

      // First attempt fails with 500
      mockStreamText.mockImplementationOnce(() => {
        throw serverError;
      });

      // Second attempt succeeds
      mockStreamText.mockReturnValueOnce(
        createMockStreamResponse({
          text: "Done",
          toolResults: [
            {
              type: "tool-result",
              toolCallId: "done_1",
              toolName: "done",
              output: {
                action: "done",
                result: "Task completed",
                isTerminal: true,
              },
            },
          ],
          response: {
            messages: [
              {
                role: "assistant",
                content: "Done",
              },
            ],
          },
        }) as any,
      );

      // Mock validation
      mockGenerateTextWithRetry.mockResolvedValueOnce(mockValidationResponse("complete"));

      const result = await webAgent.execute("Test task", { startingUrl: "https://example.com" });

      expect(result.success).toBe(true);
      expect(result.finalAnswer).toBe("Task completed");
    });

    it("should handle errors without status codes", async () => {
      // Mock planning
      mockGenerateTextWithRetry.mockResolvedValueOnce({
        text: "Plan",
        toolResults: [
          {
            type: "tool-result",
            toolCallId: "plan_1",
            toolName: "create_plan",
            output: {
              successCriteria: "Test task",
              plan: "1. Complete task",
            },
          },
        ],
      } as any);

      // Create a regular error without status
      const regularError = new Error("Network timeout");

      // First 5 attempts fail with the error
      for (let i = 0; i < 5; i++) {
        mockStreamText.mockImplementationOnce(() => {
          throw regularError;
        });
      }

      const result = await webAgent.execute("Test task", { startingUrl: "https://example.com" });

      expect(result.success).toBe(false);
      expect(result.finalAnswer).toContain("Network timeout");
      expect(result.finalAnswer).not.toContain("[");
    });

    it("should detect and handle repeated actions", async () => {
      // Define test constant for default max repeated actions
      const DEFAULT_MAX_REPEATED_ACTIONS = 2;

      // Mock planning
      mockGenerateTextWithRetry.mockResolvedValueOnce({
        text: "Plan",
        toolResults: [
          {
            type: "tool-result",
            toolCallId: "plan_1",
            toolName: "create_plan",
            output: {
              successCriteria: "Test task",
              plan: "1. Click button repeatedly",
            },
          },
        ],
      } as any);

      // Mock the same click action being repeated 5 times
      const repeatedClickResponse = createMockStreamResponse({
        text: "Click",
        toolResults: [
          {
            type: "tool-result",
            toolCallId: "click_1",
            toolName: "click",
            input: { ref: "btn1" },
            output: {
              success: true,
              action: "click",
              ref: "btn1",
            },
          },
        ],
        response: {
          messages: [
            {
              role: "assistant",
              content: "Click button",
            },
          ],
        },
      });

      // First 3 clicks are allowed (initial + DEFAULT_MAX_REPEATED_ACTIONS repeats)
      for (let i = 0; i < DEFAULT_MAX_REPEATED_ACTIONS + 1; i++) {
        mockStreamText.mockReturnValueOnce(repeatedClickResponse as any);
      }

      // 4th click triggers warning (adds user message, forces new snapshot)
      mockStreamText.mockReturnValueOnce(repeatedClickResponse as any);

      // After warning, agent tries again (5th click) - this should abort
      mockStreamText.mockReturnValueOnce(repeatedClickResponse as any);

      const result = await webAgent.execute("Test task", {
        startingUrl: "https://example.com",
      });

      expect(result.success).toBe(false);
      expect(result.finalAnswer).toContain("Aborted: Excessive repetition");
      expect(result.finalAnswer).toContain("click");
      expect(result.finalAnswer).toContain("stuck in a loop");

      // Check that warning was added to messages before abort
      const messages = mockStreamText.mock.calls
        .flatMap((call) => call[0]?.messages || [])
        .filter((msg: any) => msg.role === "user");

      const warningMessage = messages.find(
        (msg: any) =>
          msg.content?.includes("repeated the same action") &&
          msg.content?.includes("different approach"),
      );
      expect(warningMessage).toBeDefined();
    });

    it("should reset repeat counter for different actions", async () => {
      // Mock planning
      mockGenerateTextWithRetry.mockResolvedValueOnce({
        text: "Plan",
        toolResults: [
          {
            type: "tool-result",
            toolCallId: "plan_1",
            toolName: "create_plan",
            output: {
              successCriteria: "Test task",
              plan: "1. Click and fill alternately",
            },
          },
        ],
      } as any);

      // Alternate between click and fill actions
      mockStreamText.mockReturnValueOnce(
        createMockStreamResponse({
          text: "Click",
          toolResults: [
            {
              type: "tool-result",
              toolCallId: "click_1",
              toolName: "click",
              input: { ref: "btn1" },
              output: {
                success: true,
                action: "click",
                ref: "btn1",
              },
            },
          ],
          response: {
            messages: [{ role: "assistant", content: "Click" }],
          },
        }) as any,
      );

      // Same click again
      mockStreamText.mockReturnValueOnce(
        createMockStreamResponse({
          text: "Click",
          toolResults: [
            {
              type: "tool-result",
              toolCallId: "click_2",
              toolName: "click",
              input: { ref: "btn1" },
              output: {
                success: true,
                action: "click",
                ref: "btn1",
              },
            },
          ],
          response: {
            messages: [{ role: "assistant", content: "Click" }],
          },
        }) as any,
      );

      // Different action (fill) - should reset counter
      mockStreamText.mockReturnValueOnce(
        createMockStreamResponse({
          text: "Fill",
          toolResults: [
            {
              type: "tool-result",
              toolCallId: "fill_1",
              toolName: "fill",
              input: { ref: "input1", value: "test" },
              output: {
                success: true,
                action: "fill",
                ref: "input1",
                value: "test",
              },
            },
          ],
          response: {
            messages: [{ role: "assistant", content: "Fill" }],
          },
        }) as any,
      );

      // Click again - counter should be reset, so this is fine
      mockStreamText.mockReturnValueOnce(
        createMockStreamResponse({
          text: "Click",
          toolResults: [
            {
              type: "tool-result",
              toolCallId: "click_3",
              toolName: "click",
              input: { ref: "btn1" },
              output: {
                success: true,
                action: "click",
                ref: "btn1",
              },
            },
          ],
          response: {
            messages: [{ role: "assistant", content: "Click" }],
          },
        }) as any,
      );

      // Finally done
      mockStreamText.mockReturnValueOnce(
        createMockStreamResponse({
          text: "Done",
          toolResults: [
            {
              type: "tool-result",
              toolCallId: "done_1",
              toolName: "done",
              input: { result: "Completed" },
              output: {
                action: "done",
                result: "Completed",
                isTerminal: true,
              },
            },
          ],
          response: {
            messages: [{ role: "assistant", content: "Done" }],
          },
        }) as any,
      );

      // Mock validation
      mockGenerateTextWithRetry.mockResolvedValueOnce(mockValidationResponse("complete"));

      const result = await webAgent.execute("Test task", {
        startingUrl: "https://example.com",
      });

      expect(result.success).toBe(true);
      expect(result.finalAnswer).toBe("Completed");
      expect(result.stats.actions).toBe(4); // 2 clicks + 1 fill + 1 done
    });
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { WebAgent, WebAgentOptions } from "../src/webAgent.js";
import { AriaBrowser, PageAction } from "../src/browser/ariaBrowser.js";
import { WebAgentEventEmitter, WebAgentEventType } from "../src/events.js";
import { LanguageModel, generateText } from "ai";
import { Logger } from "../src/loggers/types.js";

// Mock the AI module
vi.mock("ai", () => ({
  generateText: vi.fn(),
  tool: vi.fn((schema: any) => ({
    description: schema.description,
    parameters: schema.parameters,
  })),
}));

const mockGenerateText = vi.mocked(generateText);

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
      provider: mockProvider,
      debug: false,
      vision: false,
      maxIterations: 10,
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
      mockGenerateText.mockResolvedValueOnce({
        text: "Planning",
        toolResults: [
          {
            type: "tool-result",
            toolCallId: "plan_1",
            toolName: "create_plan",
            input: {
              explanation: "Need to click button",
              plan: "1. Find button\n2. Click it",
            },
            output: {
              explanation: "Need to click button",
              plan: "1. Find button\n2. Click it",
            },
          },
        ],
      } as any);

      // Mock action generation - click action with proper tool result structure
      mockGenerateText.mockResolvedValueOnce({
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
      } as any);

      // Mock done action with proper tool result structure
      mockGenerateText.mockResolvedValueOnce({
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
      } as any);

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
      mockGenerateText.mockResolvedValueOnce({
        text: "Planning",
        toolResults: [
          {
            type: "tool-result",
            toolCallId: "plan_1",
            toolName: "create_plan",
            input: {
              explanation: "Fill form with provided data",
              plan: "1. Use provided data to fill form",
            },
            output: {
              explanation: "Fill form with provided data",
              plan: "1. Use provided data to fill form",
            },
          },
        ],
      } as any);

      // Mock done action with proper tool result structure
      mockGenerateText.mockResolvedValueOnce({
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
      } as any);

      const result = await webAgent.execute(task, {
        startingUrl: "https://example.com",
        data,
      });

      expect(result.success).toBe(true);
    });

    it("should handle abort signal", async () => {
      const controller = new AbortController();

      // Mock planning that will be aborted
      mockGenerateText.mockImplementationOnce(async () => {
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
      mockGenerateText.mockResolvedValueOnce({
        text: "Planning",
        toolResults: [
          {
            type: "tool-result",
            toolCallId: "plan_1",
            toolName: "create_plan_with_url",
            input: {
              explanation: "Search for flights",
              plan: "1. Go to travel site\n2. Search flights",
              url: "https://travel.example.com",
            },
            output: {
              explanation: "Search for flights",
              plan: "1. Go to travel site\n2. Search flights",
              url: "https://travel.example.com",
            },
          },
        ],
      } as any);

      // Mock done for quick completion
      mockGenerateText.mockResolvedValueOnce({
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
      } as any);

      await webAgent.execute("Book a flight to Paris");

      // Check that TASK_SETUP event was emitted with the generated URL
      const setupEvent = mockLogger.events.find((e) => e.type === WebAgentEventType.TASK_SETUP);
      expect(setupEvent).toBeDefined();
    });

    it("should use provided starting URL in plan", async () => {
      const startingUrl = "https://specific-site.com";

      mockGenerateText.mockResolvedValueOnce({
        text: "Planning",
        toolResults: [
          {
            type: "tool-result",
            toolCallId: "plan_1",
            toolName: "create_plan",
            input: {
              explanation: "Navigate and interact",
              plan: "1. Use the page\n2. Complete task",
            },
            output: {
              explanation: "Navigate and interact",
              plan: "1. Use the page\n2. Complete task",
            },
          },
        ],
      } as any);

      // Mock done
      mockGenerateText.mockResolvedValueOnce({
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
      } as any);

      await webAgent.execute("Do something", { startingUrl });

      const navigatedEvent = mockLogger.events.find(
        (e) => e.type === WebAgentEventType.BROWSER_NAVIGATED,
      );
      expect(navigatedEvent?.data.url).toBe(startingUrl);
    });

    it("should fail if planning doesn't generate tool result", async () => {
      mockGenerateText.mockResolvedValueOnce({
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
      mockGenerateText.mockResolvedValueOnce({
        text: "Planning",
        toolResults: [
          {
            type: "tool-result",
            toolCallId: "plan_1",
            toolName: "create_plan",
            input: {
              explanation: "Test",
              plan: "1. Test",
            },
            output: {
              explanation: "Test",
              plan: "1. Test",
            },
          },
        ],
      } as any);
    });

    it("should execute click action", async () => {
      mockGenerateText.mockResolvedValueOnce({
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
      } as any);

      mockGenerateText.mockResolvedValueOnce({
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
      } as any);

      const result = await webAgent.execute("Click button", { startingUrl: "https://example.com" });

      expect(result.success).toBe(true);
      expect(result.stats.actions).toBe(2); // click + done
    });

    it("should execute fill action", async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: "Fill",
        toolResults: [
          {
            type: "tool-result",
            toolCallId: "fill_1",
            toolName: "fill",
            input: { ref: "input1", value: "test text" },
            output: {
              action: "fill",
              ref: "input1",
              value: "test text",
              isTerminal: false,
            },
          },
        ],
        response: {
          messages: [
            {
              role: "assistant",
              content: "Fill",
            },
            {
              role: "tool",
              content: [
                {
                  type: "tool-result",
                  toolCallId: "fill_1",
                  toolName: "fill",
                  output: { action: "fill", ref: "input1", value: "test text" },
                },
              ],
            },
          ],
        },
      } as any);

      mockGenerateText.mockResolvedValueOnce({
        text: "Done",
        toolResults: [
          {
            type: "tool-result",
            toolCallId: "done_1",
            toolName: "done",
            input: { result: "Filled" },
            output: {
              action: "done",
              result: "Filled",
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
                  output: { action: "done", result: "Filled", isTerminal: true },
                },
              ],
            },
          ],
        },
      } as any);

      const result = await webAgent.execute("Fill input", { startingUrl: "https://example.com" });

      expect(result.success).toBe(true);
    });

    it("should execute wait action", async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: "Wait",
        toolResults: [
          {
            type: "tool-result",
            toolCallId: "wait_1",
            toolName: "wait",
            input: { seconds: 1 },
            output: {
              action: "wait",
              seconds: 1,
              isTerminal: false,
            },
          },
        ],
        response: {
          messages: [
            {
              role: "assistant",
              content: "Wait",
            },
            {
              role: "tool",
              content: [
                {
                  type: "tool-result",
                  toolCallId: "wait_1",
                  toolName: "wait",
                  output: { action: "wait", seconds: 1 },
                },
              ],
            },
          ],
        },
      } as any);

      mockGenerateText.mockResolvedValueOnce({
        text: "Done",
        toolResults: [
          {
            type: "tool-result",
            toolCallId: "done_1",
            toolName: "done",
            input: { result: "Waited" },
            output: {
              action: "done",
              result: "Waited",
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
                  output: { action: "done", result: "Waited", isTerminal: true },
                },
              ],
            },
          ],
        },
      } as any);

      const executePromise = webAgent.execute("Wait a bit", { startingUrl: "https://example.com" });

      // Advance timers to handle the wait action
      await vi.runAllTimersAsync();

      const result = await executePromise;

      expect(result.success).toBe(true);
    });

    it("should handle abort action", async () => {
      mockGenerateText.mockResolvedValueOnce({
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
      } as any);

      const result = await webAgent.execute("Impossible task", {
        startingUrl: "https://example.com",
      });

      expect(result.success).toBe(false);
      expect(result.finalAnswer).toBe("Aborted: Cannot complete task");

      // AGENT_ACTION events are now emitted from within the tools themselves
      // which are mocked in tests, so we don't check for them here
    });

    it("should handle extract action", async () => {
      mockGenerateText.mockResolvedValueOnce({
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
      } as any);

      mockGenerateText.mockResolvedValueOnce({
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
      } as any);

      const result = await webAgent.execute("Extract title", {
        startingUrl: "https://example.com",
      });

      expect(result.success).toBe(true);

      // AGENT_ACTION events are now emitted from within the tools themselves
      // which are mocked in tests, so we don't check for them here
    });
  });

  describe("error handling", () => {
    beforeEach(() => {
      // Setup default planning
      mockGenerateText.mockResolvedValueOnce({
        text: "Planning",
        toolResults: [
          {
            type: "tool-result",
            toolCallId: "plan_1",
            toolName: "create_plan",
            input: {
              explanation: "Test",
              plan: "1. Test",
            },
            output: {
              explanation: "Test",
              plan: "1. Test",
            },
          },
        ],
      } as any);
    });

    it("should handle AI generation errors", async () => {
      // First call throws error
      mockGenerateText.mockRejectedValueOnce(new Error("AI error"));

      const result = await webAgent.execute("Test error", { startingUrl: "https://example.com" });

      // Since we hit an error during the main loop, it should return failure
      expect(result.success).toBe(false);
      expect(result.finalAnswer).toContain("Task failed");

      // Check error event was emitted
      const errorEvent = mockLogger.events.find(
        (e) => e.type === WebAgentEventType.AI_GENERATION_ERROR,
      );
      expect(errorEvent).toBeDefined();
      expect(errorEvent?.data.error).toBe("AI error");
    });

    it("should handle maximum iterations", async () => {
      const options: WebAgentOptions = {
        provider: mockProvider,
        maxIterations: 2,
        eventEmitter,
        logger: mockLogger,
      };

      const limitedAgent = new WebAgent(mockBrowser, options);

      // Plan
      mockGenerateText.mockResolvedValueOnce({
        text: "Planning",
        toolResults: [
          {
            type: "tool-result",
            toolCallId: "plan_1",
            toolName: "create_plan",
            input: {
              explanation: "Test",
              plan: "1. Test",
            },
            output: {
              explanation: "Test",
              plan: "1. Test",
            },
          },
        ],
      } as any);

      // Keep generating non-terminal actions
      for (let i = 0; i < 5; i++) {
        mockGenerateText.mockResolvedValueOnce({
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
        } as any);
      }

      const result = await limitedAgent.execute("Long task", {
        startingUrl: "https://example.com",
      });

      expect(result.success).toBe(false);
      expect(result.finalAnswer).toContain("Maximum iterations reached");

      await limitedAgent.close();
    });

    it("should handle tool result without output property", async () => {
      mockGenerateText.mockResolvedValueOnce({
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
      } as any);

      // Provide valid action after error
      mockGenerateText.mockResolvedValueOnce({
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
      } as any);

      const result = await webAgent.execute("Test", { startingUrl: "https://example.com" });

      expect(result.success).toBe(true);

      // Check that error event was emitted
      const errorEvent = mockLogger.events.find(
        (e) => e.type === WebAgentEventType.AI_GENERATION_ERROR,
      );
      expect(errorEvent).toBeDefined();
      expect(errorEvent?.data.error).toContain("Tool result missing 'output' property");
    });
  });

  describe("state management", () => {
    it("should track execution statistics", async () => {
      // Plan
      mockGenerateText.mockResolvedValueOnce({
        text: "Planning",
        toolResults: [
          {
            type: "tool-result",
            toolCallId: "plan_1",
            toolName: "create_plan",
            input: {
              explanation: "Test",
              plan: "1. Test",
            },
            output: {
              explanation: "Test",
              plan: "1. Test",
            },
          },
        ],
      } as any);

      // Two actions
      mockGenerateText.mockResolvedValueOnce({
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
      } as any);

      mockGenerateText.mockResolvedValueOnce({
        text: "Fill",
        toolResults: [
          {
            type: "tool-result",
            toolCallId: "fill_1",
            toolName: "fill",
            input: { ref: "input1", value: "test" },
            output: {
              action: "fill",
              ref: "input1",
              value: "test",
              isTerminal: false,
            },
          },
        ],
        response: {
          messages: [
            {
              role: "assistant",
              content: "Fill",
            },
            {
              role: "tool",
              content: [
                {
                  type: "tool-result",
                  toolCallId: "fill_1",
                  toolName: "fill",
                  output: { action: "fill", ref: "input1", value: "test" },
                },
              ],
            },
          ],
        },
      } as any);

      // Done
      mockGenerateText.mockResolvedValueOnce({
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
      } as any);

      const result = await webAgent.execute("Multi-action task", {
        startingUrl: "https://example.com",
      });

      expect(result.success).toBe(true);
      expect(result.stats.actions).toBe(3); // click + fill + done
      expect(result.stats.iterations).toBe(2); // 2 iterations since done happens on third action
      expect(result.stats.durationMs).toBeGreaterThanOrEqual(0);
      expect(result.stats.endTime).toBeGreaterThanOrEqual(result.stats.startTime);
    });
  });

  describe("event emission", () => {
    it("should emit all expected events during execution", async () => {
      // Plan
      mockGenerateText.mockResolvedValueOnce({
        text: "Planning",
        toolResults: [
          {
            type: "tool-result",
            toolCallId: "plan_1",
            toolName: "create_plan",
            input: {
              explanation: "Test",
              plan: "1. Test",
            },
            output: {
              explanation: "Test",
              plan: "1. Test",
            },
          },
        ],
      } as any);

      // Action
      mockGenerateText.mockResolvedValueOnce({
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
      } as any);

      // Done
      mockGenerateText.mockResolvedValueOnce({
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
      } as any);

      await webAgent.execute("Test events", { startingUrl: "https://example.com" });

      // Check key events were emitted
      const eventTypes = mockLogger.events.map((e) => e.type);

      expect(eventTypes).toContain(WebAgentEventType.TASK_SETUP);
      expect(eventTypes).toContain(WebAgentEventType.AGENT_STATUS); // Plan created
      expect(eventTypes).toContain(WebAgentEventType.TASK_STARTED);
      // AGENT_ACTION events are now emitted from within the tools themselves
      // which are mocked in tests, so we don't expect them here
      expect(eventTypes).toContain(WebAgentEventType.TASK_COMPLETED);
    });

    it("should emit AGENT_OBSERVED event with reasoning text", async () => {
      // Plan
      mockGenerateText.mockResolvedValueOnce({
        text: "Planning",
        toolResults: [
          {
            type: "tool-result",
            toolCallId: "plan_1",
            toolName: "create_plan",
            input: {
              explanation: "Test",
              plan: "1. Test",
            },
            output: {
              explanation: "Test",
              plan: "1. Test",
            },
          },
        ],
      } as any);

      // Action with reasoning
      mockGenerateText.mockResolvedValueOnce({
        text: "I'm clicking the button to proceed",
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
      } as any);

      // Done
      mockGenerateText.mockResolvedValueOnce({
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
      } as any);

      await webAgent.execute("Test reasoning", { startingUrl: "https://example.com" });

      // Check AGENT_OBSERVED events were emitted
      const observedEvents = mockLogger.events.filter(
        (e) => e.type === WebAgentEventType.AGENT_OBSERVED,
      );
      expect(observedEvents.length).toBeGreaterThan(0);
      const firstObserved = observedEvents[0];
      expect(firstObserved?.data.observation).toBe("I'm clicking the button to proceed");
    });

    it("should emit debug events when debug mode is enabled", async () => {
      const debugAgent = new WebAgent(mockBrowser, {
        provider: mockProvider,
        debug: true,
        eventEmitter,
        logger: mockLogger,
      });

      // Plan
      mockGenerateText.mockResolvedValueOnce({
        text: "Planning",
        toolResults: [
          {
            type: "tool-result",
            toolCallId: "plan_1",
            toolName: "create_plan",
            input: {
              explanation: "Test",
              plan: "1. Test",
            },
            output: {
              explanation: "Test",
              plan: "1. Test",
            },
          },
        ],
      } as any);

      // Action
      mockGenerateText.mockResolvedValueOnce({
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
      } as any);

      // Done
      mockGenerateText.mockResolvedValueOnce({
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
      } as any);

      await debugAgent.execute("Debug test", { startingUrl: "https://example.com" });

      // Check debug events were emitted
      const compressionEvent = mockLogger.events.find(
        (e) => e.type === WebAgentEventType.SYSTEM_DEBUG_COMPRESSION,
      );
      expect(compressionEvent).toBeDefined();
      expect(compressionEvent?.data.originalSize).toBeDefined();
      expect(compressionEvent?.data.compressedSize).toBeDefined();
      expect(compressionEvent?.data.compressionPercent).toBeDefined();

      await debugAgent.close();
    });

    it("should emit AGENT_PROCESSING events", async () => {
      // Plan
      mockGenerateText.mockResolvedValueOnce({
        text: "Planning",
        toolResults: [
          {
            type: "tool-result",
            toolCallId: "plan_1",
            toolName: "create_plan",
            input: {
              explanation: "Test",
              plan: "1. Test",
            },
            output: {
              explanation: "Test",
              plan: "1. Test",
            },
          },
        ],
      } as any);

      // Done
      mockGenerateText.mockResolvedValueOnce({
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
      } as any);

      await webAgent.execute("Test processing events", { startingUrl: "https://example.com" });

      // Check AGENT_PROCESSING events were emitted
      const processingEvents = mockLogger.events.filter(
        (e) => e.type === WebAgentEventType.AGENT_PROCESSING,
      );

      // Should have start/end pairs for planning and at least one iteration
      expect(processingEvents.length).toBeGreaterThanOrEqual(4);

      // Check we have start and end events
      const startEvents = processingEvents.filter((e) => e.data.status === "start");
      const endEvents = processingEvents.filter((e) => e.data.status === "end");

      expect(startEvents.length).toBeGreaterThan(0);
      expect(endEvents.length).toBeGreaterThan(0);

      // Check operations are specified
      const planningEvents = processingEvents.filter(
        (e) => e.data.operation === "Creating task plan",
      );
      expect(planningEvents.length).toBe(2); // start and end

      const thinkingEvents = processingEvents.filter(
        (e) => e.data.operation === "Thinking about next action",
      );
      expect(thinkingEvents.length).toBeGreaterThanOrEqual(2); // at least one start/end pair
    });
  });

  describe("guardrails", () => {
    it("should apply guardrails to planning and execution", async () => {
      const guardrails = "Only interact with buttons, do not fill forms";

      const guardedAgent = new WebAgent(mockBrowser, {
        provider: mockProvider,
        guardrails,
        eventEmitter,
        logger: mockLogger,
      });

      // Plan should include guardrails
      mockGenerateText.mockResolvedValueOnce({
        text: "Planning with guardrails",
        toolResults: [
          {
            type: "tool-result",
            toolCallId: "plan_1",
            toolName: "create_plan",
            input: {
              explanation: "Click buttons only",
              plan: "1. Only click buttons per guardrails",
            },
            output: {
              explanation: "Click buttons only",
              plan: "1. Only click buttons per guardrails",
            },
          },
        ],
      } as any);

      // Click action (allowed)
      mockGenerateText.mockResolvedValueOnce({
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
      } as any);

      // Done
      mockGenerateText.mockResolvedValueOnce({
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
      } as any);

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
        provider: mockProvider,
        vision: true,
        eventEmitter,
        logger: mockLogger,
      });

      // Plan
      mockGenerateText.mockResolvedValueOnce({
        text: "Planning",
        toolResults: [
          {
            type: "tool-result",
            toolCallId: "plan_1",
            toolName: "create_plan",
            input: {
              explanation: "Visual task",
              plan: "1. Use vision",
            },
            output: {
              explanation: "Visual task",
              plan: "1. Use vision",
            },
          },
        ],
      } as any);

      // Done
      mockGenerateText.mockResolvedValueOnce({
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
      } as any);

      await visionAgent.execute("Visual task", { startingUrl: "https://example.com" });

      // Check vision was enabled in setup
      const setupEvent = mockLogger.events.find((e) => e.type === WebAgentEventType.TASK_SETUP);
      expect(setupEvent?.data.vision).toBe(true);

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
});

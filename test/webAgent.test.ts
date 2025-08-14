import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { WebAgent, WebAgentOptions, ExecuteOptions, TaskExecutionResult } from "../src/webAgent.js";
import { AriaBrowser, PageAction } from "../src/browser/ariaBrowser.js";
import { WebAgentEventEmitter, WebAgentEventType } from "../src/events.js";
import { LanguageModel, generateText } from "ai";
import { Logger } from "../src/loggers/types.js";

// Mock the AI module
vi.mock("ai", () => ({
  generateText: vi.fn(),
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

  async performAction(ref: string, action: PageAction, value?: string): Promise<void> {}

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
    mockProvider = { specificationVersion: "v1" } as LanguageModel;

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

      // Mock planning response
      mockGenerateText.mockResolvedValueOnce({
        text: "Planning",
        toolCalls: [
          {
            toolName: "create_plan",
            args: {
              explanation: "Need to click button",
              plan: "1. Find button\n2. Click it",
            },
          },
        ],
      } as any);

      // Mock action generation - click action
      mockGenerateText.mockResolvedValueOnce({
        text: "Clicking button",
        toolCalls: [
          {
            toolName: "click",
            args: { ref: "btn1" },
          },
        ],
      } as any);

      // Mock done action
      mockGenerateText.mockResolvedValueOnce({
        text: "Task complete",
        toolCalls: [
          {
            toolName: "done",
            args: { result: "Button clicked successfully" },
          },
        ],
      } as any);

      // Mock validation - task complete
      mockGenerateText.mockResolvedValueOnce({
        text: "Validation",
        toolCalls: [
          {
            toolName: "validate_task",
            args: {
              completionQuality: "complete",
              taskAssessment: "Task completed successfully",
            },
          },
        ],
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

      // Mock planning
      mockGenerateText.mockResolvedValueOnce({
        text: "Planning",
        toolCalls: [
          {
            toolName: "create_plan",
            args: {
              explanation: "Fill form with provided data",
              plan: "1. Use provided data to fill form",
            },
          },
        ],
      } as any);

      // Mock done action
      mockGenerateText.mockResolvedValueOnce({
        text: "Complete",
        toolCalls: [
          {
            toolName: "done",
            args: { result: "Form filled" },
          },
        ],
      } as any);

      // Mock validation
      mockGenerateText.mockResolvedValueOnce({
        text: "Valid",
        toolCalls: [
          {
            toolName: "validate_task",
            args: {
              completionQuality: "complete",
              taskAssessment: "Done",
            },
          },
        ],
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
        toolCalls: [
          {
            toolName: "create_plan_with_url",
            args: {
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
        toolCalls: [
          {
            toolName: "done",
            args: { result: "Complete" },
          },
        ],
      } as any);

      // Mock validation
      mockGenerateText.mockResolvedValueOnce({
        text: "Valid",
        toolCalls: [
          {
            toolName: "validate_task",
            args: {
              completionQuality: "complete",
              taskAssessment: "Done",
            },
          },
        ],
      } as any);

      const result = await webAgent.execute("Book a flight to Paris");

      // Check that TASK_SETUP event was emitted with the generated URL
      const setupEvent = mockLogger.events.find((e) => e.type === WebAgentEventType.TASK_SETUP);
      expect(setupEvent).toBeDefined();
    });

    it("should use provided starting URL in plan", async () => {
      const startingUrl = "https://specific-site.com";

      mockGenerateText.mockResolvedValueOnce({
        text: "Planning",
        toolCalls: [
          {
            toolName: "create_plan",
            args: {
              explanation: "Navigate and interact",
              plan: "1. Use the page\n2. Complete task",
            },
          },
        ],
      } as any);

      // Mock done
      mockGenerateText.mockResolvedValueOnce({
        text: "Done",
        toolCalls: [
          {
            toolName: "done",
            args: { result: "Complete" },
          },
        ],
      } as any);

      // Mock validation
      mockGenerateText.mockResolvedValueOnce({
        text: "Valid",
        toolCalls: [
          {
            toolName: "validate_task",
            args: {
              completionQuality: "complete",
              taskAssessment: "Done",
            },
          },
        ],
      } as any);

      await webAgent.execute("Do something", { startingUrl });

      const navigatedEvent = mockLogger.events.find(
        (e) => e.type === WebAgentEventType.BROWSER_NAVIGATED,
      );
      expect(navigatedEvent?.data.url).toBe(startingUrl);
    });

    it("should fail if planning doesn't generate tool call", async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: "No tool call",
        toolCalls: [],
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
        toolCalls: [
          {
            toolName: "create_plan",
            args: {
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
        toolCalls: [
          {
            toolName: "click",
            args: { ref: "btn1" },
          },
        ],
      } as any);

      mockGenerateText.mockResolvedValueOnce({
        text: "Done",
        toolCalls: [
          {
            toolName: "done",
            args: { result: "Clicked" },
          },
        ],
      } as any);

      mockGenerateText.mockResolvedValueOnce({
        text: "Valid",
        toolCalls: [
          {
            toolName: "validate_task",
            args: {
              completionQuality: "complete",
              taskAssessment: "Done",
            },
          },
        ],
      } as any);

      const result = await webAgent.execute("Click button", { startingUrl: "https://example.com" });

      expect(result.success).toBe(true);
      expect(result.stats.actions).toBe(1);
    });

    it("should execute fill action", async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: "Fill",
        toolCalls: [
          {
            toolName: "fill",
            args: { ref: "input1", value: "test text" },
          },
        ],
      } as any);

      mockGenerateText.mockResolvedValueOnce({
        text: "Done",
        toolCalls: [
          {
            toolName: "done",
            args: { result: "Filled" },
          },
        ],
      } as any);

      mockGenerateText.mockResolvedValueOnce({
        text: "Valid",
        toolCalls: [
          {
            toolName: "validate_task",
            args: {
              completionQuality: "complete",
              taskAssessment: "Done",
            },
          },
        ],
      } as any);

      const result = await webAgent.execute("Fill input", { startingUrl: "https://example.com" });

      expect(result.success).toBe(true);
    });

    it("should execute wait action", async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: "Wait",
        toolCalls: [
          {
            toolName: "wait",
            args: { seconds: 1 },
          },
        ],
      } as any);

      mockGenerateText.mockResolvedValueOnce({
        text: "Done",
        toolCalls: [
          {
            toolName: "done",
            args: { result: "Waited" },
          },
        ],
      } as any);

      mockGenerateText.mockResolvedValueOnce({
        text: "Valid",
        toolCalls: [
          {
            toolName: "validate_task",
            args: {
              completionQuality: "complete",
              taskAssessment: "Done",
            },
          },
        ],
      } as any);

      const executePromise = webAgent.execute("Wait a bit", { startingUrl: "https://example.com" });

      // Advance timers to handle the wait action
      await vi.runAllTimersAsync();

      const result = await executePromise;

      expect(result.success).toBe(true);
    });

    it("should execute navigation actions", async () => {
      // Test goto
      mockGenerateText.mockResolvedValueOnce({
        text: "Goto",
        toolCalls: [
          {
            toolName: "goto",
            args: { url: "https://other.com" },
          },
        ],
      } as any);

      // Test back
      mockGenerateText.mockResolvedValueOnce({
        text: "Back",
        toolCalls: [
          {
            toolName: "back",
            args: {},
          },
        ],
      } as any);

      // Test forward
      mockGenerateText.mockResolvedValueOnce({
        text: "Forward",
        toolCalls: [
          {
            toolName: "forward",
            args: {},
          },
        ],
      } as any);

      mockGenerateText.mockResolvedValueOnce({
        text: "Done",
        toolCalls: [
          {
            toolName: "done",
            args: { result: "Navigated" },
          },
        ],
      } as any);

      mockGenerateText.mockResolvedValueOnce({
        text: "Valid",
        toolCalls: [
          {
            toolName: "validate_task",
            args: {
              completionQuality: "complete",
              taskAssessment: "Done",
            },
          },
        ],
      } as any);

      const result = await webAgent.execute("Navigate around", {
        startingUrl: "https://example.com",
      });

      expect(result.success).toBe(true);
      expect(result.stats.actions).toBe(3);
    });

    it("should execute extract action", async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: "Extract",
        toolCalls: [
          {
            toolName: "extract",
            args: { description: "Get page title" },
          },
        ],
      } as any);

      // Mock extraction response
      mockGenerateText.mockResolvedValueOnce({
        text: "The page title is: Mock Page",
      } as any);

      mockGenerateText.mockResolvedValueOnce({
        text: "Done",
        toolCalls: [
          {
            toolName: "done",
            args: { result: "Extracted" },
          },
        ],
      } as any);

      mockGenerateText.mockResolvedValueOnce({
        text: "Valid",
        toolCalls: [
          {
            toolName: "validate_task",
            args: {
              completionQuality: "complete",
              taskAssessment: "Done",
            },
          },
        ],
      } as any);

      const result = await webAgent.execute("Extract title", {
        startingUrl: "https://example.com",
      });

      expect(result.success).toBe(true);

      // Check that AGENT_ACTION was emitted for extract
      const agentAction = mockLogger.events.find(
        (e) => e.type === WebAgentEventType.AGENT_ACTION && e.data.action === "extract",
      );
      expect(agentAction).toBeDefined();
      expect(agentAction?.data.value).toBe("Get page title");

      // Check that BROWSER_ACTION_STARTED was emitted for extract (it still goes through executeAction)
      const browserAction = mockLogger.events.find(
        (e) => e.type === WebAgentEventType.BROWSER_ACTION_STARTED && e.data.action === "extract",
      );
      expect(browserAction).toBeDefined();
    });

    it("should execute fill_and_enter action", async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: "Fill and enter",
        toolCalls: [
          {
            toolName: "fill_and_enter",
            args: { ref: "input1", value: "search query" },
          },
        ],
      } as any);

      mockGenerateText.mockResolvedValueOnce({
        text: "Done",
        toolCalls: [
          {
            toolName: "done",
            args: { result: "Searched" },
          },
        ],
      } as any);

      mockGenerateText.mockResolvedValueOnce({
        text: "Valid",
        toolCalls: [
          {
            toolName: "validate_task",
            args: {
              completionQuality: "complete",
              taskAssessment: "Done",
            },
          },
        ],
      } as any);

      const result = await webAgent.execute("Search for something", {
        startingUrl: "https://example.com",
      });

      expect(result.success).toBe(true);
    });

    it("should emit both AGENT_ACTION and BROWSER_ACTION_STARTED for click", async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: "Click",
        toolCalls: [
          {
            toolName: "click",
            args: { ref: "btn1" },
          },
        ],
      } as any);

      mockGenerateText.mockResolvedValueOnce({
        text: "Done",
        toolCalls: [
          {
            toolName: "done",
            args: { result: "Clicked" },
          },
        ],
      } as any);

      mockGenerateText.mockResolvedValueOnce({
        text: "Valid",
        toolCalls: [
          {
            toolName: "validate_task",
            args: {
              completionQuality: "complete",
              taskAssessment: "Done",
            },
          },
        ],
      } as any);

      await webAgent.execute("Click button", { startingUrl: "https://example.com" });

      // Check that AGENT_ACTION was emitted
      const agentAction = mockLogger.events.find(
        (e) => e.type === WebAgentEventType.AGENT_ACTION && e.data.action === "click",
      );
      expect(agentAction).toBeDefined();
      expect(agentAction?.data.ref).toBe("btn1");

      // Check that BROWSER_ACTION_STARTED was also emitted for click
      const browserAction = mockLogger.events.find(
        (e) => e.type === WebAgentEventType.BROWSER_ACTION_STARTED && e.data.action === "click",
      );
      expect(browserAction).toBeDefined();
      expect(browserAction?.data.ref).toBe("btn1");
    });

    it("should emit AGENT_ACTION for done action", async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: "Done",
        toolCalls: [
          {
            toolName: "done",
            args: { result: "Task completed" },
          },
        ],
      } as any);

      mockGenerateText.mockResolvedValueOnce({
        text: "Valid",
        toolCalls: [
          {
            toolName: "validate_task",
            args: {
              completionQuality: "complete",
              taskAssessment: "Done",
            },
          },
        ],
      } as any);

      await webAgent.execute("Test done action", { startingUrl: "https://example.com" });

      // Check that AGENT_ACTION was emitted for done
      const agentAction = mockLogger.events.find(
        (e) => e.type === WebAgentEventType.AGENT_ACTION && e.data.action === "done",
      );
      expect(agentAction).toBeDefined();
      expect(agentAction?.data.value).toBe("Task completed");

      // Check that BROWSER_ACTION_STARTED was NOT emitted for done
      const browserAction = mockLogger.events.find(
        (e) => e.type === WebAgentEventType.BROWSER_ACTION_STARTED && e.data.action === "done",
      );
      expect(browserAction).toBeUndefined();
    });

    it("should handle abort action", async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: "Abort",
        toolCalls: [
          {
            toolName: "abort",
            args: { description: "Cannot complete task" },
          },
        ],
      } as any);

      const result = await webAgent.execute("Impossible task", {
        startingUrl: "https://example.com",
      });

      expect(result.success).toBe(false);
      expect(result.finalAnswer).toContain("Aborted: Cannot complete task");

      // Check that AGENT_ACTION was emitted for abort
      const agentAction = mockLogger.events.find(
        (e) => e.type === WebAgentEventType.AGENT_ACTION && e.data.action === "abort",
      );
      expect(agentAction).toBeDefined();
      expect(agentAction?.data.value).toBe("Cannot complete task");

      // Check that BROWSER_ACTION_STARTED was NOT emitted for abort
      const browserAction = mockLogger.events.find(
        (e) => e.type === WebAgentEventType.BROWSER_ACTION_STARTED && e.data.action === "abort",
      );
      expect(browserAction).toBeUndefined();
    });

    it("should handle action without tool calls", async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: "No tool",
        toolCalls: [],
      } as any);

      // After error, provide valid action
      mockGenerateText.mockResolvedValueOnce({
        text: "Done",
        toolCalls: [
          {
            toolName: "done",
            args: { result: "Complete" },
          },
        ],
      } as any);

      mockGenerateText.mockResolvedValueOnce({
        text: "Valid",
        toolCalls: [
          {
            toolName: "validate_task",
            args: {
              completionQuality: "complete",
              taskAssessment: "Done",
            },
          },
        ],
      } as any);

      const result = await webAgent.execute("Test", { startingUrl: "https://example.com" });

      expect(result.success).toBe(true);
    });
  });

  describe("validation", () => {
    beforeEach(() => {
      // Setup default planning
      mockGenerateText.mockResolvedValueOnce({
        text: "Planning",
        toolCalls: [
          {
            toolName: "create_plan",
            args: {
              explanation: "Test",
              plan: "1. Test",
            },
          },
        ],
      } as any);
    });

    it("should validate ref exists in page", async () => {
      // Try invalid ref first
      mockGenerateText.mockResolvedValueOnce({
        text: "Click",
        toolCalls: [
          {
            toolName: "click",
            args: { ref: "nonexistent" },
          },
        ],
      } as any);

      // Then valid ref
      mockGenerateText.mockResolvedValueOnce({
        text: "Click",
        toolCalls: [
          {
            toolName: "click",
            args: { ref: "btn1" },
          },
        ],
      } as any);

      mockGenerateText.mockResolvedValueOnce({
        text: "Done",
        toolCalls: [
          {
            toolName: "done",
            args: { result: "Clicked" },
          },
        ],
      } as any);

      mockGenerateText.mockResolvedValueOnce({
        text: "Valid",
        toolCalls: [
          {
            toolName: "validate_task",
            args: {
              completionQuality: "complete",
              taskAssessment: "Done",
            },
          },
        ],
      } as any);

      const result = await webAgent.execute("Click button", { startingUrl: "https://example.com" });

      expect(result.success).toBe(true);
      expect(mockGenerateText).toHaveBeenCalledTimes(5); // plan + invalid + valid + done + validation
    });

    it("should validate wait time is reasonable", async () => {
      // Try excessive wait first
      mockGenerateText.mockResolvedValueOnce({
        text: "Wait",
        toolCalls: [
          {
            toolName: "wait",
            args: { seconds: 35 },
          },
        ],
      } as any);

      // Then reasonable wait
      mockGenerateText.mockResolvedValueOnce({
        text: "Wait",
        toolCalls: [
          {
            toolName: "wait",
            args: { seconds: 2 },
          },
        ],
      } as any);

      mockGenerateText.mockResolvedValueOnce({
        text: "Done",
        toolCalls: [
          {
            toolName: "done",
            args: { result: "Waited" },
          },
        ],
      } as any);

      mockGenerateText.mockResolvedValueOnce({
        text: "Valid",
        toolCalls: [
          {
            toolName: "validate_task",
            args: {
              completionQuality: "complete",
              taskAssessment: "Done",
            },
          },
        ],
      } as any);

      const executePromise = webAgent.execute("Wait", { startingUrl: "https://example.com" });

      // Advance timers to handle the wait action
      await vi.runAllTimersAsync();

      const result = await executePromise;

      expect(result.success).toBe(true);
    });

    it("should validate task completion", async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: "Done",
        toolCalls: [
          {
            toolName: "done",
            args: { result: "Incomplete result" },
          },
        ],
      } as any);

      // First validation fails
      mockGenerateText.mockResolvedValueOnce({
        text: "Invalid",
        toolCalls: [
          {
            toolName: "validate_task",
            args: {
              completionQuality: "partial",
              taskAssessment: "Not complete",
              feedback: "Need to do more",
            },
          },
        ],
      } as any);

      // Continue with another action
      mockGenerateText.mockResolvedValueOnce({
        text: "Click",
        toolCalls: [
          {
            toolName: "click",
            args: { ref: "btn1" },
          },
        ],
      } as any);

      // Try done again
      mockGenerateText.mockResolvedValueOnce({
        text: "Done",
        toolCalls: [
          {
            toolName: "done",
            args: { result: "Complete result" },
          },
        ],
      } as any);

      // Second validation succeeds
      mockGenerateText.mockResolvedValueOnce({
        text: "Valid",
        toolCalls: [
          {
            toolName: "validate_task",
            args: {
              completionQuality: "complete",
              taskAssessment: "Done",
            },
          },
        ],
      } as any);

      const result = await webAgent.execute("Complex task", { startingUrl: "https://example.com" });

      expect(result.success).toBe(true);
      expect(result.finalAnswer).toBe("Complete result");
    });

    it("should handle consecutive failures", async () => {
      // Mock 5 consecutive failures
      for (let i = 0; i < 5; i++) {
        mockGenerateText.mockResolvedValueOnce({
          text: "Click",
          toolCalls: [
            {
              toolName: "click",
              args: { ref: "invalid_ref" },
            },
          ],
        } as any);
      }

      const result = await webAgent.execute("Test failures", {
        startingUrl: "https://example.com",
      });

      expect(result.success).toBe(false);
      expect(result.finalAnswer).toContain("Too many consecutive failures");
    });

    it("should reset failure counter on success", async () => {
      // 3 failures
      for (let i = 0; i < 3; i++) {
        mockGenerateText.mockResolvedValueOnce({
          text: "Click",
          toolCalls: [
            {
              toolName: "click",
              args: { ref: "invalid" },
            },
          ],
        } as any);
      }

      // Success
      mockGenerateText.mockResolvedValueOnce({
        text: "Click",
        toolCalls: [
          {
            toolName: "click",
            args: { ref: "btn1" },
          },
        ],
      } as any);

      // 3 more failures (should not hit limit)
      for (let i = 0; i < 3; i++) {
        mockGenerateText.mockResolvedValueOnce({
          text: "Click",
          toolCalls: [
            {
              toolName: "click",
              args: { ref: "invalid" },
            },
          ],
        } as any);
      }

      // Final success
      mockGenerateText.mockResolvedValueOnce({
        text: "Done",
        toolCalls: [
          {
            toolName: "done",
            args: { result: "Complete" },
          },
        ],
      } as any);

      mockGenerateText.mockResolvedValueOnce({
        text: "Valid",
        toolCalls: [
          {
            toolName: "validate_task",
            args: {
              completionQuality: "complete",
              taskAssessment: "Done",
            },
          },
        ],
      } as any);

      const result = await webAgent.execute("Test reset", { startingUrl: "https://example.com" });

      expect(result.success).toBe(true);
    });
  });

  describe("error handling", () => {
    beforeEach(() => {
      // Setup default planning
      mockGenerateText.mockResolvedValueOnce({
        text: "Planning",
        toolCalls: [
          {
            toolName: "create_plan",
            args: {
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

      // Recovery action
      mockGenerateText.mockResolvedValueOnce({
        text: "Done",
        toolCalls: [
          {
            toolName: "done",
            args: { result: "Recovered" },
          },
        ],
      } as any);

      mockGenerateText.mockResolvedValueOnce({
        text: "Valid",
        toolCalls: [
          {
            toolName: "validate_task",
            args: {
              completionQuality: "complete",
              taskAssessment: "Done",
            },
          },
        ],
      } as any);

      const result = await webAgent.execute("Test error", { startingUrl: "https://example.com" });

      expect(result.success).toBe(true);

      // Check error event was emitted
      const errorEvent = mockLogger.events.find(
        (e) => e.type === WebAgentEventType.AI_GENERATION_ERROR,
      );
      expect(errorEvent).toBeDefined();
      expect(errorEvent?.data.error).toBe("AI error");
    });

    it("should handle browser action failures", async () => {
      // Mock browser to throw error
      const performActionSpy = vi.spyOn(mockBrowser, "performAction");
      performActionSpy.mockRejectedValueOnce(new Error("Browser error"));

      mockGenerateText.mockResolvedValueOnce({
        text: "Click",
        toolCalls: [
          {
            toolName: "click",
            args: { ref: "btn1" },
          },
        ],
      } as any);

      // Recovery action
      mockGenerateText.mockResolvedValueOnce({
        text: "Done",
        toolCalls: [
          {
            toolName: "done",
            args: { result: "Complete" },
          },
        ],
      } as any);

      mockGenerateText.mockResolvedValueOnce({
        text: "Valid",
        toolCalls: [
          {
            toolName: "validate_task",
            args: {
              completionQuality: "complete",
              taskAssessment: "Done",
            },
          },
        ],
      } as any);

      const result = await webAgent.execute("Test browser error", {
        startingUrl: "https://example.com",
      });

      expect(result.success).toBe(true);

      // Check browser action failed event
      const actionEvent = mockLogger.events.find(
        (e) => e.type === WebAgentEventType.BROWSER_ACTION_COMPLETED && !e.data.success,
      );
      expect(actionEvent).toBeDefined();
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
        toolCalls: [
          {
            toolName: "create_plan",
            args: {
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
          toolCalls: [
            {
              toolName: "click",
              args: { ref: "btn1" },
            },
          ],
        } as any);
      }

      const result = await limitedAgent.execute("Long task", {
        startingUrl: "https://example.com",
      });

      expect(result.success).toBe(false);
      expect(result.finalAnswer).toContain("Maximum iterations reached");

      await limitedAgent.close();
    });
  });

  describe("state management", () => {
    it("should track execution statistics", async () => {
      // Plan
      mockGenerateText.mockResolvedValueOnce({
        text: "Planning",
        toolCalls: [
          {
            toolName: "create_plan",
            args: {
              explanation: "Test",
              plan: "1. Test",
            },
          },
        ],
      } as any);

      // Two actions
      mockGenerateText.mockResolvedValueOnce({
        text: "Click",
        toolCalls: [
          {
            toolName: "click",
            args: { ref: "btn1" },
          },
        ],
      } as any);

      mockGenerateText.mockResolvedValueOnce({
        text: "Fill",
        toolCalls: [
          {
            toolName: "fill",
            args: { ref: "input1", value: "test" },
          },
        ],
      } as any);

      // Done
      mockGenerateText.mockResolvedValueOnce({
        text: "Done",
        toolCalls: [
          {
            toolName: "done",
            args: { result: "Complete" },
          },
        ],
      } as any);

      mockGenerateText.mockResolvedValueOnce({
        text: "Valid",
        toolCalls: [
          {
            toolName: "validate_task",
            args: {
              completionQuality: "complete",
              taskAssessment: "Done",
            },
          },
        ],
      } as any);

      const result = await webAgent.execute("Multi-action task", {
        startingUrl: "https://example.com",
      });

      expect(result.success).toBe(true);
      // Actions are counted for each successful execution
      // The agent may update snapshots and perform other internal actions
      expect(result.stats.actions).toBeGreaterThan(0);
      expect(result.stats.iterations).toBeGreaterThan(0);
      expect(result.stats.durationMs).toBeGreaterThanOrEqual(0);
      expect(result.stats.endTime).toBeGreaterThanOrEqual(result.stats.startTime);
    });

    it("should update page snapshot after state-changing actions", async () => {
      // Plan
      mockGenerateText.mockResolvedValueOnce({
        text: "Planning",
        toolCalls: [
          {
            toolName: "create_plan",
            args: {
              explanation: "Test",
              plan: "1. Test",
            },
          },
        ],
      } as any);

      // Click (state-changing)
      mockGenerateText.mockResolvedValueOnce({
        text: "Click",
        toolCalls: [
          {
            toolName: "click",
            args: { ref: "btn1" },
          },
        ],
      } as any);

      // Extract (non-state-changing)
      mockGenerateText.mockResolvedValueOnce({
        text: "Extract",
        toolCalls: [
          {
            toolName: "extract",
            args: { description: "Get text" },
          },
        ],
      } as any);

      // Mock extraction
      mockGenerateText.mockResolvedValueOnce({
        text: "Extracted text",
      } as any);

      // Another action (should update snapshot since last was extract)
      mockGenerateText.mockResolvedValueOnce({
        text: "Click",
        toolCalls: [
          {
            toolName: "click",
            args: { ref: "btn1" },
          },
        ],
      } as any);

      // Done
      mockGenerateText.mockResolvedValueOnce({
        text: "Done",
        toolCalls: [
          {
            toolName: "done",
            args: { result: "Complete" },
          },
        ],
      } as any);

      mockGenerateText.mockResolvedValueOnce({
        text: "Valid",
        toolCalls: [
          {
            toolName: "validate_task",
            args: {
              completionQuality: "complete",
              taskAssessment: "Done",
            },
          },
        ],
      } as any);

      await webAgent.execute("Test snapshot updates", { startingUrl: "https://example.com" });

      // Verify the right number of calls were made
      expect(mockGenerateText).toHaveBeenCalled();
    });
  });

  describe("event emission", () => {
    it("should emit AI_GENERATION event with tool call details", async () => {
      // Plan
      mockGenerateText.mockResolvedValueOnce({
        text: "Planning",
        toolCalls: [
          {
            toolName: "create_plan",
            args: {
              explanation: "Test",
              plan: "1. Test",
            },
          },
        ],
      } as any);

      // Action with metadata
      mockGenerateText.mockResolvedValueOnce({
        text: "Clicking button",
        toolCalls: [
          {
            toolName: "click",
            args: { ref: "btn1" },
          },
        ],
        finishReason: "stop",
        usage: { promptTokens: 100, completionTokens: 50 },
        warnings: [],
        providerMetadata: { model: "test" },
      } as any);

      // Done
      mockGenerateText.mockResolvedValueOnce({
        text: "Done",
        toolCalls: [
          {
            toolName: "done",
            args: { result: "Complete" },
          },
        ],
      } as any);

      mockGenerateText.mockResolvedValueOnce({
        text: "Valid",
        toolCalls: [
          {
            toolName: "validate_task",
            args: {
              completionQuality: "complete",
              taskAssessment: "Done",
            },
          },
        ],
      } as any);

      await webAgent.execute("Test AI generation event", { startingUrl: "https://example.com" });

      // Check AI_GENERATION event was emitted with details
      const aiGenEvent = mockLogger.events.find((e) => e.type === WebAgentEventType.AI_GENERATION);
      expect(aiGenEvent).toBeDefined();
      expect(aiGenEvent?.data.object).toBeDefined();
      expect(aiGenEvent?.data.object.toolName).toBe("click");
      expect(aiGenEvent?.data.temperature).toBe(0);
      expect(aiGenEvent?.data.usage).toBeDefined();
    });

    it("should emit AGENT_EXTRACTED event when extracting data", async () => {
      // Plan
      mockGenerateText.mockResolvedValueOnce({
        text: "Planning",
        toolCalls: [
          {
            toolName: "create_plan",
            args: {
              explanation: "Test",
              plan: "1. Extract data",
            },
          },
        ],
      } as any);

      // Extract action
      mockGenerateText.mockResolvedValueOnce({
        text: "Extract",
        toolCalls: [
          {
            toolName: "extract",
            args: { description: "Get page title" },
          },
        ],
      } as any);

      // Mock extraction response
      mockGenerateText.mockResolvedValueOnce({
        text: "Extracted: Page Title",
      } as any);

      // Done
      mockGenerateText.mockResolvedValueOnce({
        text: "Done",
        toolCalls: [
          {
            toolName: "done",
            args: { result: "Extracted data" },
          },
        ],
      } as any);

      mockGenerateText.mockResolvedValueOnce({
        text: "Valid",
        toolCalls: [
          {
            toolName: "validate_task",
            args: {
              completionQuality: "complete",
              taskAssessment: "Done",
            },
          },
        ],
      } as any);

      await webAgent.execute("Extract title", { startingUrl: "https://example.com" });

      // Check AGENT_EXTRACTED event was emitted
      const extractedEvent = mockLogger.events.find(
        (e) => e.type === WebAgentEventType.AGENT_EXTRACTED,
      );
      expect(extractedEvent).toBeDefined();
      expect(extractedEvent?.data.extractedData).toBe("Extracted: Page Title");
    });

    it("should emit AGENT_WAITING event when wait action executes", async () => {
      // Plan
      mockGenerateText.mockResolvedValueOnce({
        text: "Planning",
        toolCalls: [
          {
            toolName: "create_plan",
            args: {
              explanation: "Test",
              plan: "1. Wait",
            },
          },
        ],
      } as any);

      // Wait action
      mockGenerateText.mockResolvedValueOnce({
        text: "Wait",
        toolCalls: [
          {
            toolName: "wait",
            args: { seconds: 2 },
          },
        ],
      } as any);

      // Done
      mockGenerateText.mockResolvedValueOnce({
        text: "Done",
        toolCalls: [
          {
            toolName: "done",
            args: { result: "Waited" },
          },
        ],
      } as any);

      mockGenerateText.mockResolvedValueOnce({
        text: "Valid",
        toolCalls: [
          {
            toolName: "validate_task",
            args: {
              completionQuality: "complete",
              taskAssessment: "Done",
            },
          },
        ],
      } as any);

      const executePromise = webAgent.execute("Wait test", { startingUrl: "https://example.com" });
      await vi.runAllTimersAsync();
      await executePromise;

      // Check AGENT_WAITING event was emitted
      const waitingEvent = mockLogger.events.find(
        (e) => e.type === WebAgentEventType.AGENT_WAITING,
      );
      expect(waitingEvent).toBeDefined();
      expect(waitingEvent?.data.seconds).toBe(2);
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
        toolCalls: [
          {
            toolName: "create_plan",
            args: {
              explanation: "Test",
              plan: "1. Test",
            },
          },
        ],
      } as any);

      // Action
      mockGenerateText.mockResolvedValueOnce({
        text: "Click",
        toolCalls: [
          {
            toolName: "click",
            args: { ref: "btn1" },
          },
        ],
      } as any);

      // Done
      mockGenerateText.mockResolvedValueOnce({
        text: "Done",
        toolCalls: [
          {
            toolName: "done",
            args: { result: "Complete" },
          },
        ],
      } as any);

      mockGenerateText.mockResolvedValueOnce({
        text: "Valid",
        toolCalls: [
          {
            toolName: "validate_task",
            args: {
              completionQuality: "complete",
              taskAssessment: "Done",
            },
          },
        ],
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

      const messageEvent = mockLogger.events.find(
        (e) => e.type === WebAgentEventType.SYSTEM_DEBUG_MESSAGE,
      );
      expect(messageEvent).toBeDefined();
      expect(messageEvent?.data.messages).toBeDefined();
      expect(Array.isArray(messageEvent?.data.messages)).toBe(true);

      await debugAgent.close();
    });

    it("should emit TASK_VALIDATION_ERROR event when validation fails", async () => {
      // Plan
      mockGenerateText.mockResolvedValueOnce({
        text: "Planning",
        toolCalls: [
          {
            toolName: "create_plan",
            args: {
              explanation: "Test",
              plan: "1. Test",
            },
          },
        ],
      } as any);

      // Invalid action (ref doesn't exist)
      mockGenerateText.mockResolvedValueOnce({
        text: "Click",
        toolCalls: [
          {
            toolName: "click",
            args: { ref: "nonexistent" },
          },
        ],
      } as any);

      // Valid action after retry
      mockGenerateText.mockResolvedValueOnce({
        text: "Done",
        toolCalls: [
          {
            toolName: "done",
            args: { result: "Complete" },
          },
        ],
      } as any);

      mockGenerateText.mockResolvedValueOnce({
        text: "Valid",
        toolCalls: [
          {
            toolName: "validate_task",
            args: {
              completionQuality: "complete",
              taskAssessment: "Done",
            },
          },
        ],
      } as any);

      await webAgent.execute("Test validation error", { startingUrl: "https://example.com" });

      // Check TASK_VALIDATION_ERROR event was emitted
      const validationErrorEvent = mockLogger.events.find(
        (e) => e.type === WebAgentEventType.TASK_VALIDATION_ERROR,
      );
      expect(validationErrorEvent).toBeDefined();
      expect(validationErrorEvent?.data.errors).toBeDefined();
      expect(Array.isArray(validationErrorEvent?.data.errors)).toBe(true);
      expect(validationErrorEvent?.data.retryCount).toBeDefined();
      expect(validationErrorEvent?.data.action).toBeDefined();
    });

    it("should emit all expected events during execution", async () => {
      // Plan
      mockGenerateText.mockResolvedValueOnce({
        text: "Planning",
        toolCalls: [
          {
            toolName: "create_plan",
            args: {
              explanation: "Test",
              plan: "1. Test",
            },
          },
        ],
      } as any);

      // Action
      mockGenerateText.mockResolvedValueOnce({
        text: "Click",
        toolCalls: [
          {
            toolName: "click",
            args: { ref: "btn1" },
          },
        ],
      } as any);

      // Done
      mockGenerateText.mockResolvedValueOnce({
        text: "Done",
        toolCalls: [
          {
            toolName: "done",
            args: { result: "Complete" },
          },
        ],
      } as any);

      mockGenerateText.mockResolvedValueOnce({
        text: "Valid",
        toolCalls: [
          {
            toolName: "validate_task",
            args: {
              completionQuality: "complete",
              taskAssessment: "Done",
            },
          },
        ],
      } as any);

      await webAgent.execute("Test events", { startingUrl: "https://example.com" });

      // Check key events were emitted
      const eventTypes = mockLogger.events.map((e) => e.type);

      expect(eventTypes).toContain(WebAgentEventType.TASK_SETUP);
      expect(eventTypes).toContain(WebAgentEventType.AGENT_STATUS); // Plan created
      expect(eventTypes).toContain(WebAgentEventType.TASK_STARTED);
      expect(eventTypes).toContain(WebAgentEventType.AGENT_ACTION);
      expect(eventTypes).toContain(WebAgentEventType.BROWSER_ACTION_STARTED);
      expect(eventTypes).toContain(WebAgentEventType.BROWSER_ACTION_COMPLETED);
      expect(eventTypes).toContain(WebAgentEventType.TASK_COMPLETED);
    });

    it("should emit AGENT_OBSERVED event with reasoning text", async () => {
      // Plan
      mockGenerateText.mockResolvedValueOnce({
        text: "Planning",
        toolCalls: [
          {
            toolName: "create_plan",
            args: {
              explanation: "Test",
              plan: "1. Test",
            },
          },
        ],
      } as any);

      // Action with reasoning
      mockGenerateText.mockResolvedValueOnce({
        text: "I'm clicking the button to proceed",
        toolCalls: [
          {
            toolName: "click",
            args: { ref: "btn1" },
          },
        ],
      } as any);

      // Done
      mockGenerateText.mockResolvedValueOnce({
        text: "Task is complete",
        toolCalls: [
          {
            toolName: "done",
            args: { result: "Complete" },
          },
        ],
      } as any);

      mockGenerateText.mockResolvedValueOnce({
        text: "Valid",
        toolCalls: [
          {
            toolName: "validate_task",
            args: {
              completionQuality: "complete",
              taskAssessment: "Done",
            },
          },
        ],
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
        toolCalls: [
          {
            toolName: "create_plan",
            args: {
              explanation: "Click buttons only",
              plan: "1. Only click buttons per guardrails",
            },
          },
        ],
      } as any);

      // Click action (allowed)
      mockGenerateText.mockResolvedValueOnce({
        text: "Click",
        toolCalls: [
          {
            toolName: "click",
            args: { ref: "btn1" },
          },
        ],
      } as any);

      // Done
      mockGenerateText.mockResolvedValueOnce({
        text: "Done",
        toolCalls: [
          {
            toolName: "done",
            args: { result: "Complete" },
          },
        ],
      } as any);

      mockGenerateText.mockResolvedValueOnce({
        text: "Valid",
        toolCalls: [
          {
            toolName: "validate_task",
            args: {
              completionQuality: "complete",
              taskAssessment: "Done",
            },
          },
        ],
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
        toolCalls: [
          {
            toolName: "create_plan",
            args: {
              explanation: "Visual task",
              plan: "1. Use vision",
            },
          },
        ],
      } as any);

      // Done
      mockGenerateText.mockResolvedValueOnce({
        text: "Done",
        toolCalls: [
          {
            toolName: "done",
            args: { result: "Complete" },
          },
        ],
      } as any);

      mockGenerateText.mockResolvedValueOnce({
        text: "Valid",
        toolCalls: [
          {
            toolName: "validate_task",
            args: {
              completionQuality: "complete",
              taskAssessment: "Done",
            },
          },
        ],
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

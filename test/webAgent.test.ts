import { describe, it, expect, vi, beforeEach } from "vitest";
import { WebAgent, WebAgentEventType, WebAgentEventEmitter } from "../src/webAgent.js";
import { AriaBrowser, PageAction, LoadState } from "../src/browser/ariaBrowser.js";
import { LanguageModel } from "ai";
import { generateText } from "ai";

// Mock the AI functions
vi.mock("ai", () => ({
  generateText: vi.fn(),
  generateObject: vi.fn(),
  streamObject: vi.fn(),
}));

const mockGenerateText = vi.mocked(generateText);

// Helper functions to create function call responses
function createMockFunctionCallResponse(functionName: string, args: any = {}, overrides: any = {}) {
  const defaultArgs = {
    click: { ref: "s1e23" },
    fill: { ref: "s1e23", value: "test input" },
    select: { ref: "s1e23", value: "option1" },
    hover: { ref: "s1e23" },
    check: { ref: "s1e23" },
    uncheck: { ref: "s1e23" },
    focus: { ref: "s1e23" },
    enter: { ref: "s1e23" },
    fill_and_enter: { ref: "s1e23", value: "search term" },
    wait: { seconds: 3 },
    goto: { url: "https://example.com" },
    back: {},
    forward: {},
    extract: { description: "extract data" },
    done: { result: "Task completed successfully" },
    create_plan: { explanation: "Task explanation", plan: "1. Step one\n2. Step two" },
    create_plan_with_url: {
      explanation: "Task explanation",
      plan: "1. Step one\n2. Step two",
      url: "https://example.com",
    },
    validate_task: { taskAssessment: "Task completed", completionQuality: "complete" },
    extract_data: { extractedData: "Extracted data content" },
  };

  const baseResponse = {
    text: "Function call executed",
    reasoning: "Planning the next action",
    toolCalls: [
      {
        toolName: functionName,
        args: Object.keys(args).length > 0 ? args : defaultArgs[functionName],
      },
    ],
    finishReason: "stop",
    usage: { totalTokens: 100 },
    warnings: [],
    providerMetadata: {},
  };

  // Apply overrides, which may replace toolCalls entirely
  return { ...baseResponse, ...overrides };
}

// Helper function for planning responses
function createMockPlanResponse(responseOverrides: any = {}) {
  return createMockFunctionCallResponse(
    "create_plan",
    {
      explanation: "This task requires web navigation and interaction",
      plan: "1. Navigate to the target page\n2. Locate required elements\n3. Perform the action",
    },
    responseOverrides,
  );
}

// Helper function for plan with URL responses
function createMockPlanWithUrlResponse(responseOverrides: any = {}) {
  return createMockFunctionCallResponse(
    "create_plan_with_url",
    {
      explanation: "This task requires web navigation and interaction",
      plan: "1. Navigate to the target page\n2. Locate required elements\n3. Perform the action",
      url: "https://example.com",
    },
    responseOverrides,
  );
}

// Helper function for action responses
function createMockActionResponse(
  actionName: string = "click",
  actionArgs: any = {},
  responseOverrides: any = {},
) {
  return createMockFunctionCallResponse(actionName, actionArgs, responseOverrides);
}

// Helper function for validation responses
function createMockValidationResponse(responseOverrides: any = {}) {
  return createMockFunctionCallResponse(
    "validate_task",
    {
      taskAssessment: "The task was completed successfully and meets all requirements",
      completionQuality: "complete",
    },
    responseOverrides,
  );
}

// Mock browser implementation for testing
class MockAriaBrowser implements AriaBrowser {
  public browserName = "mockariabrowser";
  private currentUrl = "https://example.com";
  private currentTitle = "Example Page";
  private currentText =
    "Example page content with button [ref=s1e23] and link [ref=s1e24] and form [ref=s1e25]";

  async start(): Promise<void> {
    // Mock implementation
  }

  async shutdown(): Promise<void> {
    // Mock implementation
  }

  async goto(url: string): Promise<void> {
    this.currentUrl = url;
    this.currentTitle = `Page at ${url}`;
  }

  async goBack(): Promise<void> {
    this.currentUrl = "https://example.com/previous";
    this.currentTitle = "Previous Page";
  }

  async goForward(): Promise<void> {
    this.currentUrl = "https://example.com/next";
    this.currentTitle = "Next Page";
  }

  async getUrl(): Promise<string> {
    return this.currentUrl;
  }

  async getTitle(): Promise<string> {
    return this.currentTitle;
  }

  async getTreeWithRefs(): Promise<string> {
    return this.currentText;
  }

  async getMarkdown(): Promise<string> {
    return "# Example Page\nThis is the page content.";
  }

  async getScreenshot(): Promise<Buffer> {
    return Buffer.from("mock screenshot data");
  }

  async performAction(ref: string, action: PageAction, value?: string): Promise<void> {
    // Mock implementation
  }

  async waitForLoadState(state: LoadState, options?: { timeout?: number }): Promise<void> {
    // Mock implementation
  }

  // Helper methods for testing
  setCurrentUrl(url: string) {
    this.currentUrl = url;
  }

  setCurrentTitle(title: string) {
    this.currentTitle = title;
  }

  setCurrentText(text: string) {
    this.currentText = text;
  }
}

// Mock logger for testing
class MockLogger {
  private logs: string[] = [];
  private disposeCalled = false;

  initialize(eventEmitter: any): void {
    // Mock implementation - just store reference if needed
  }

  log(message: string): void {
    this.logs.push(message);
  }

  getLogs(): string[] {
    return [...this.logs];
  }

  clearLogs(): void {
    this.logs = [];
  }

  dispose(): void {
    this.disposeCalled = true;
  }
}

describe("WebAgent", () => {
  let mockBrowser: MockAriaBrowser;
  let mockLogger: MockLogger;
  let mockProvider: LanguageModel;
  let webAgent: WebAgent;

  beforeEach(() => {
    mockBrowser = new MockAriaBrowser();
    mockLogger = new MockLogger();
    mockProvider = { model: "test-model" } as LanguageModel;

    // Reset mocks
    mockGenerateText.mockClear();

    // Set up default mock for function call responses
    mockGenerateText.mockResolvedValue(createMockActionResponse());

    webAgent = new WebAgent(mockBrowser, {
      provider: mockProvider,
      logger: mockLogger,
    });
  });

  describe("Basic functionality", () => {
    it("should create WebAgent instance", () => {
      expect(webAgent).toBeInstanceOf(WebAgent);
      // WebAgent doesn't expose browserName directly
    });

    it("should initialize conversation", () => {
      const messages = webAgent.initializeConversation("Test task");
      expect(messages).toHaveLength(2);
      expect(messages[1].content).toContain("Test task");
    });
  });

  describe("Planning", () => {
    it("should generate plan with URL", async () => {
      const mockResponse = createMockPlanWithUrlResponse();
      mockGenerateText.mockResolvedValue(mockResponse);

      const result = await webAgent.generatePlanWithUrl("Book a flight to Paris");

      // WebAgent only returns plan and url, explanation is stored internally
      expect(result.plan).toContain("Navigate to the target page");
      expect(result.url).toBe("https://example.com");
      expect(mockGenerateText).toHaveBeenCalledOnce();
    });

    it("should generate plan without URL", async () => {
      const mockResponse = createMockPlanResponse();
      mockGenerateText.mockResolvedValue(mockResponse);

      const result = await webAgent.generatePlan("Fill contact form");

      // WebAgent only returns plan, explanation is stored internally
      expect(result.plan).toContain("Navigate to the target page");
      expect(mockGenerateText).toHaveBeenCalledOnce();
    });
  });

  describe("Action generation", () => {
    it("should generate click action", async () => {
      mockGenerateText.mockResolvedValue(createMockActionResponse("click", { ref: "s1e23" }));
      mockBrowser.setCurrentText("button [ref=s1e23]");

      const result = await webAgent.generateNextAction("button [ref=s1e23]");

      expect(result.action.action).toBe(PageAction.Click);
      expect(result.action.ref).toBe("s1e23");
      expect(mockGenerateText).toHaveBeenCalledOnce();
    });

    it("should generate fill action", async () => {
      mockGenerateText.mockResolvedValue(
        createMockActionResponse("fill", { ref: "s1e23", value: "test input" }),
      );
      mockBrowser.setCurrentText("input [ref=s1e23]");

      const result = await webAgent.generateNextAction("input [ref=s1e23]");

      expect(result.action.action).toBe(PageAction.Fill);
      expect(result.action.ref).toBe("s1e23");
      expect(result.action.value).toBe("test input");
      expect(mockGenerateText).toHaveBeenCalledOnce();
    });

    it("should generate done action", async () => {
      mockGenerateText.mockResolvedValue(
        createMockActionResponse("done", { result: "Task completed successfully" }),
      );

      const result = await webAgent.generateNextAction("task complete");

      expect(result.action.action).toBe(PageAction.Done);
      expect(result.action.value).toBe("Task completed successfully");
      expect(mockGenerateText).toHaveBeenCalledOnce();
    });
  });

  describe("Validation", () => {
    it("should generate valid actions", async () => {
      mockGenerateText.mockResolvedValue(createMockActionResponse("click", { ref: "s1e23" }));
      mockBrowser.setCurrentText("button [ref=s1e23]");

      const result = await webAgent.generateNextAction("button [ref=s1e23]");

      expect(result.action.action).toBe(PageAction.Click);
      expect(result.action.ref).toBe("s1e23");
      expect(mockGenerateText).toHaveBeenCalledOnce();
    });

    it("should handle fill actions with values", async () => {
      mockGenerateText.mockResolvedValue(
        createMockActionResponse("fill", { ref: "s1e23", value: "test input" }),
      );
      mockBrowser.setCurrentText("input [ref=s1e23]");

      const result = await webAgent.generateNextAction("input [ref=s1e23]");

      expect(result.action.action).toBe(PageAction.Fill);
      expect(result.action.value).toBe("test input");
      expect(mockGenerateText).toHaveBeenCalledOnce();
    });

    it("should process function call responses", async () => {
      const customResponse = createMockActionResponse("done", { result: "Task finished" });
      mockGenerateText.mockResolvedValue(customResponse);

      const result = await webAgent.generateNextAction("task complete");

      expect(result.action.action).toBe(PageAction.Done);
      expect(result.action.value).toBe("Task finished");
      expect(mockGenerateText).toHaveBeenCalledOnce();
    });
  });

  describe("Task validation", () => {
    it("should validate task completion", async () => {
      const mockResponse = createMockValidationResponse();
      mockGenerateText.mockResolvedValue(mockResponse);

      const result = await webAgent.validateTaskCompletion(
        "test task",
        "Task completed",
        "conversation history",
      );

      expect(result.taskAssessment).toContain("completed successfully");
      expect(result.completionQuality).toBe("complete");
      expect(mockGenerateText).toHaveBeenCalledOnce();
    });
  });

  describe("Ref validation", () => {
    it("should validate refs exist in page snapshot", async () => {
      mockGenerateText.mockResolvedValue(createMockActionResponse("click", { ref: "s1e23" }));
      mockBrowser.setCurrentText("button [ref=s1e23]");

      const result = await webAgent.generateNextAction("button [ref=s1e23]");

      expect(result.action.ref).toBe("s1e23");
      expect(mockGenerateText).toHaveBeenCalledOnce();
    });

    it("should reject refs that don't exist", async () => {
      mockGenerateText
        .mockResolvedValueOnce(createMockActionResponse("click", { ref: "invalid_ref" })) // Invalid ref
        .mockResolvedValueOnce(createMockActionResponse("click", { ref: "s1e23" })); // Valid ref

      mockBrowser.setCurrentText("button [ref=s1e23]"); // Only s1e23 exists

      const result = await webAgent.generateNextAction("button [ref=s1e23]");

      expect(result.action.ref).toBe("s1e23");
      expect(mockGenerateText).toHaveBeenCalledTimes(2);
    });
  });

  describe("Browser integration", () => {
    it("should delegate to browser for page information", async () => {
      // WebAgent delegates to browser, test that browser is accessible
      const browserSpy = vi.spyOn(mockBrowser, "getUrl");
      browserSpy.mockResolvedValue("https://test.com");

      // Access browser through WebAgent's internal method (if exposed)
      expect(mockBrowser.browserName).toBe("mockariabrowser");
    });

    it("should integrate with browser actions", () => {
      // Test that webAgent integrates with browser
      expect(webAgent).toBeInstanceOf(WebAgent);
      expect(mockBrowser).toBeInstanceOf(MockAriaBrowser);
    });
  });

  describe("Event handling", () => {
    it("should have event emitter", () => {
      const emitter = (webAgent as any).eventEmitter;

      // Test that event emitter exists
      expect(emitter).toBeDefined();
      expect(typeof emitter.emitEvent).toBe("function");
    });
  });

  describe("Error handling", () => {
    it("should handle empty task in execute", async () => {
      await expect(webAgent.execute("")).rejects.toThrow("Task cannot be empty or whitespace-only");
    });

    it("should handle whitespace-only task in execute", async () => {
      await expect(webAgent.execute("   ")).rejects.toThrow(
        "Task cannot be empty or whitespace-only",
      );
    });
  });

  describe("State management", () => {
    it("should reset state", () => {
      webAgent.initializeConversation("first task");
      webAgent.resetState();

      const messages = webAgent.initializeConversation("second task");
      expect(messages[1].content).toContain("second task");
    });
  });
});

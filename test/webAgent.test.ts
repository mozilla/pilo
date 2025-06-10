import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { WebAgent, WebAgentOptions } from "../src/webAgent.js";
import { AriaBrowser, PageAction, LoadState } from "../src/browser/ariaBrowser.js";
import { WebAgentEventEmitter, WebAgentEventType } from "../src/events.js";
import { Logger } from "../src/loggers.js";
import { LanguageModel } from "ai";

// Mock AI SDK
vi.mock("ai", () => ({
  generateObject: vi.fn(),
}));

vi.mock("@ai-sdk/openai", () => ({
  openai: vi.fn(() => ({ model: "gpt-4.1" })),
}));

// Import the mocked generateObject
import { generateObject } from "ai";
const mockGenerateObject = vi.mocked(generateObject);

// Mock browser implementation for testing
class MockAriaBrowser implements AriaBrowser {
  private currentUrl = "https://example.com";
  private currentTitle = "Example Page";
  private currentText = "Example page content";

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

  async getText(): Promise<string> {
    return this.currentText;
  }

  async getScreenshot(): Promise<Buffer> {
    return Buffer.from("mock screenshot");
  }

  async performAction(ref: string, action: PageAction, value?: string): Promise<void> {
    // Mock implementation - could throw for testing error cases
    if (ref === "invalid") {
      throw new Error("Element not found");
    }
  }

  async waitForLoadState(state: LoadState, options?: { timeout?: number }): Promise<void> {
    // Mock implementation
  }

  // Test helper methods
  setCurrentText(text: string): void {
    this.currentText = text;
  }

  setCurrentUrl(url: string): void {
    this.currentUrl = url;
  }

  setCurrentTitle(title: string): void {
    this.currentTitle = title;
  }
}

// Mock logger for testing
class MockLogger implements Logger {
  public initializeCalled = false;
  public disposeCalled = false;

  initialize(emitter: WebAgentEventEmitter): void {
    this.initializeCalled = true;
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
    mockGenerateObject.mockClear();

    webAgent = new WebAgent(mockBrowser, {
      logger: mockLogger,
      debug: true,
      provider: mockProvider,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Constructor and initialization", () => {
    it("should create WebAgent with default options", () => {
      const agent = new WebAgent(mockBrowser);
      expect(agent).toBeInstanceOf(WebAgent);
    });

    it("should create WebAgent with custom options", () => {
      const options: WebAgentOptions = {
        debug: true,
        logger: mockLogger,
        provider: mockProvider,
      };

      const agent = new WebAgent(mockBrowser, options);
      expect(agent).toBeInstanceOf(WebAgent);
      expect(mockLogger.initializeCalled).toBe(true);
    });

    it("should use default logger when none provided", () => {
      const agent = new WebAgent(mockBrowser, { debug: false });
      expect(agent).toBeInstanceOf(WebAgent);
    });
  });

  describe("createPlanAndUrl", () => {
    it("should create plan with URL", async () => {
      const mockResponse = {
        object: {
          explanation: "Book a flight from NYC to Paris",
          plan: "1. Search flights\n2. Select dates\n3. Book ticket",
          url: "https://airline.com",
        },
      };

      mockGenerateObject.mockResolvedValue(mockResponse);

      const result = await webAgent.createPlanAndUrl("Book a flight to Paris");

      expect(result.plan).toBe("1. Search flights\n2. Select dates\n3. Book ticket");
      expect(result.url).toBe("https://airline.com");
      expect(mockGenerateObject).toHaveBeenCalledWith({
        model: mockProvider,
        schema: expect.any(Object),
        prompt: expect.stringContaining("Book a flight to Paris"),
        temperature: 0,
      });
    });

    it("should handle LLM errors", async () => {
      mockGenerateObject.mockRejectedValue(new Error("LLM error"));

      await expect(webAgent.createPlanAndUrl("test task")).rejects.toThrow("LLM error");
    });
  });

  describe("createPlan", () => {
    it("should create plan without URL", async () => {
      const mockResponse = {
        object: {
          explanation: "Fill out contact form",
          plan: "1. Navigate to form\n2. Fill fields\n3. Submit",
        },
      };

      mockGenerateObject.mockResolvedValue(mockResponse);

      const result = await webAgent.createPlan("Fill contact form");

      expect(result.plan).toBe("1. Navigate to form\n2. Fill fields\n3. Submit");
      expect(mockGenerateObject).toHaveBeenCalledWith({
        model: mockProvider,
        schema: expect.any(Object),
        prompt: expect.stringContaining("Fill contact form"),
        temperature: 0,
      });
    });

    it("should create plan with starting URL", async () => {
      const mockResponse = {
        object: {
          explanation: "Fill out contact form",
          plan: "1. Fill fields\n2. Submit",
        },
      };

      mockGenerateObject.mockResolvedValue(mockResponse);

      const result = await webAgent.createPlan("Fill contact form", "https://example.com/contact");

      expect(result.plan).toBe("1. Fill fields\n2. Submit");
      expect(mockGenerateObject).toHaveBeenCalledWith({
        model: mockProvider,
        schema: expect.any(Object),
        prompt: expect.stringContaining("https://example.com/contact"),
        temperature: 0,
      });
    });
  });

  describe("setupMessages", () => {
    it("should setup initial messages", () => {
      const messages = webAgent.setupMessages("Test task");

      expect(messages).toHaveLength(2);
      expect(messages[0].role).toBe("system");
      expect(messages[1].role).toBe("user");
      expect(messages[1].content).toContain("Test task");
    });
  });

  describe("Action validation", () => {
    it("should validate correct aria refs", async () => {
      const mockResponse = {
        object: {
          currentStep: "Working on Step 1",
          observation: "Found element",
          extractedData: "Button element located",
          thought: "Click the button",
          action: {
            action: PageAction.Click,
            ref: "s1e23",
          },
        },
      };

      mockGenerateObject.mockResolvedValue(mockResponse);
      mockBrowser.setCurrentText("button 'Click me' [ref=s1e23]");

      const result = await webAgent.getNextActions("button 'Click me' [ref=s1e23]");

      expect(result.action.action).toBe(PageAction.Click);
      expect(result.action.ref).toBe("s1e23");
    });

    it("should correct malformed aria refs", async () => {
      const mockResponse = {
        object: {
          currentStep: "Working on Step 1",
          observation: "Found element",
          extractedData: "Button element located",
          thought: "Click the button",
          action: {
            action: PageAction.Click,
            ref: "click s1e23 button",
          },
        },
      };

      mockGenerateObject.mockResolvedValue(mockResponse);
      mockBrowser.setCurrentText("button 'Click me' [ref=s1e23]");

      const result = await webAgent.getNextActions("button 'Click me' [ref=s1e23]");

      expect(result.action.ref).toBe("s1e23");
    });

    it("should validate fill action requires value", async () => {
      const invalidResponse = {
        object: {
          currentStep: "Working on Step 1",
          observation: "Found input",
          extractedData: "Input field located",
          thought: "Fill the input",
          action: {
            action: PageAction.Fill,
            ref: "s1e23",
            // Missing value
          },
        },
      };

      const validResponse = {
        object: {
          currentStep: "Working on Step 1",
          observation: "Found input",
          extractedData: "Input field located",
          thought: "Fill the input",
          action: {
            action: PageAction.Fill,
            ref: "s1e23",
            value: "test@example.com",
          },
        },
      };

      mockGenerateObject
        .mockResolvedValueOnce(invalidResponse)
        .mockResolvedValueOnce(validResponse);

      mockBrowser.setCurrentText("input 'Email' [ref=s1e23]");

      const result = await webAgent.getNextActions("input 'Email' [ref=s1e23]");

      expect(result.action.value).toBe("test@example.com");
      expect(mockGenerateObject).toHaveBeenCalledTimes(2);
    });

    it("should validate done action requires value", async () => {
      const invalidResponse = {
        object: {
          currentStep: "Completing task",
          observation: "Task finished",
          extractedData: "Final data collected",
          thought: "Task is done",
          action: {
            action: PageAction.Done,
            // Missing value
          },
        },
      };

      const validResponse = {
        object: {
          currentStep: "Completing task",
          observation: "Task finished",
          extractedData: "Final data collected",
          thought: "Task is done",
          action: {
            action: PageAction.Done,
            value: "Task completed successfully",
          },
        },
      };

      mockGenerateObject
        .mockResolvedValueOnce(invalidResponse)
        .mockResolvedValueOnce(validResponse);

      mockBrowser.setCurrentText("Success message displayed");

      const result = await webAgent.getNextActions("Success message displayed");

      expect(result.action.value).toBe("Task completed successfully");
      expect(mockGenerateObject).toHaveBeenCalledTimes(2);
    });

    it("should fail after maximum retry attempts", async () => {
      const invalidResponse = {
        object: {
          currentStep: "Working on Step 1",
          observation: "Found element",
          extractedData: "",
          thought: "Click the button",
          action: {
            action: PageAction.Click,
            // Missing ref
          },
        },
      };

      mockGenerateObject.mockResolvedValue(invalidResponse);
      mockBrowser.setCurrentText("button 'Click me' [ref=s1e23]");

      await expect(webAgent.getNextActions("button 'Click me' [ref=s1e23]")).rejects.toThrow(
        "Failed to get valid response after 3 attempts",
      );

      expect(mockGenerateObject).toHaveBeenCalledTimes(3);
    });
  });

  describe("wait", () => {
    it("should wait for specified seconds", async () => {
      vi.useFakeTimers();

      const waitPromise = webAgent.wait(2);

      // Fast-forward time
      vi.advanceTimersByTime(2000);

      await waitPromise;

      vi.useRealTimers();
    });
  });

  describe("resetState", () => {
    it("should reset internal state", () => {
      // First create some state
      webAgent.setupMessages("test task");

      // Reset state
      webAgent.resetState();

      // State should be cleared (we can't directly test private properties,
      // but we can test that setupMessages works correctly after reset)
      const messages = webAgent.setupMessages("new task");
      expect(messages[1].content).toContain("new task");
    });
  });

  describe("close", () => {
    it("should dispose logger and close browser", async () => {
      const shutdownSpy = vi.spyOn(mockBrowser, "shutdown");

      await webAgent.close();

      expect(mockLogger.disposeCalled).toBe(true);
      expect(shutdownSpy).toHaveBeenCalled();
    });
  });

  describe("Event emission", () => {
    it("should emit task start event", () => {
      const eventSpy = vi.fn();

      // Access the private event emitter for testing
      const emitter = (webAgent as any).eventEmitter as WebAgentEventEmitter;
      emitter.onEvent(WebAgentEventType.TASK_START, eventSpy);

      webAgent.emitTaskStartEvent("test task");

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          task: "test task",
          timestamp: expect.any(Number),
        }),
      );
    });
  });

  describe("Snapshot compression", () => {
    it("should compress aria tree snapshots", async () => {
      const mockResponse = {
        object: {
          currentStep: "Working on Step 1",
          observation: "Found element",
          extractedData: "Page content analyzed",
          thought: "Click the button",
          action: {
            action: PageAction.Click,
            ref: "s1e23",
          },
        },
      };

      mockGenerateObject.mockResolvedValue(mockResponse);

      const longSnapshot = `
- listitem "First item"
- listitem "Second item"
- text: "Repeated text"
- text: "Repeated text"
- link "Click here" [ref=s1e23]
/url: https://example.com/ignore
      `.trim();

      mockBrowser.setCurrentText(longSnapshot);

      await webAgent.getNextActions(longSnapshot);

      // Check that compression occurred (private method, so we test indirectly)
      expect(mockGenerateObject).toHaveBeenCalled();
    });
  });

  describe("Error handling", () => {
    it("should handle missing task", async () => {
      await expect(webAgent.execute("")).rejects.toThrow("No task provided");
    });

    it("should handle browser errors during actions", async () => {
      const mockResponse = {
        object: {
          currentStep: "Working on Step 1",
          observation: "Found element",
          extractedData: "",
          thought: "Click the button",
          action: {
            action: PageAction.Click,
            ref: "invalid",
          },
        },
      };

      const doneResponse = {
        object: {
          currentStep: "Completing task",
          observation: "Task finished",
          extractedData: "Final data",
          thought: "Task is done",
          action: {
            action: PageAction.Done,
            value: "Task completed with errors",
          },
        },
      };

      const validationResponse = {
        object: {
          isValid: true,
        },
      };

      mockGenerateObject
        .mockResolvedValueOnce({
          object: { explanation: "test", plan: "test" },
        })
        .mockResolvedValueOnce(mockResponse)
        .mockResolvedValueOnce(doneResponse)
        .mockResolvedValueOnce(validationResponse);

      // This should not throw, even though the action fails
      const result = await webAgent.execute("test task", "https://example.com");
      expect(result).toBe("Task completed with errors");
    });
  });

  describe("Navigation tracking", () => {
    it("should track navigation events during execute", async () => {
      const eventSpy = vi.fn();
      const emitter = (webAgent as any).eventEmitter as WebAgentEventEmitter;
      emitter.onEvent(WebAgentEventType.PAGE_NAVIGATION, eventSpy);

      const planResponse = {
        object: {
          explanation: "test explanation",
          plan: "test plan",
        },
      };

      const actionResponse = {
        object: {
          currentStep: "Working on Step 1",
          observation: "Found element",
          extractedData: "Page content found",
          thought: "Navigate to another page",
          action: {
            action: PageAction.Goto,
            value: "https://example.com/page2",
          },
        },
      };

      const doneResponse = {
        object: {
          currentStep: "Completing task",
          observation: "Task finished",
          extractedData: "Final data",
          thought: "Task is done",
          action: {
            action: PageAction.Done,
            value: "Navigation completed",
          },
        },
      };

      const validationResponse = {
        object: {
          isValid: true,
        },
      };

      mockGenerateObject
        .mockResolvedValueOnce(planResponse)
        .mockResolvedValueOnce(actionResponse)
        .mockResolvedValueOnce(doneResponse)
        .mockResolvedValueOnce(validationResponse);

      await webAgent.execute("test task", "https://example.com");

      // Should have initial navigation and goto navigation
      expect(eventSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe("Data handling", () => {
    it("should handle data parameter in execute method", async () => {
      const planResponse = {
        object: {
          explanation: "test explanation",
          plan: "test plan",
        },
      };

      const doneResponse = {
        object: {
          currentStep: "Completing task",
          observation: "Task finished",
          extractedData: "Final data",
          thought: "Task is done",
          action: {
            action: PageAction.Done,
            value: "Task completed with data",
          },
        },
      };

      const validationResponse = {
        object: {
          isValid: true,
        },
      };

      mockGenerateObject
        .mockResolvedValueOnce(planResponse)
        .mockResolvedValueOnce(doneResponse)
        .mockResolvedValueOnce(validationResponse);

      const testData = {
        departure: "NYC",
        destination: "LAX",
        date: "2024-12-25",
      };

      const result = await webAgent.execute("test task", "https://example.com", testData);
      expect(result).toBe("Task completed with data");
    });

    it("should include data in setupMessages when provided", async () => {
      const testData = {
        departure: "NYC",
        destination: "LAX",
      };

      // Mock all required responses for a complete execution
      const planResponse = {
        object: {
          explanation: "test explanation",
          plan: "test plan",
        },
      };

      const doneResponse = {
        object: {
          currentStep: "Completing task",
          observation: "Task finished",
          extractedData: "Final data",
          thought: "Task is done",
          action: {
            action: PageAction.Done,
            value: "Task completed with data included",
          },
        },
      };

      const validationResponse = {
        object: {
          isValid: true,
        },
      };

      mockGenerateObject
        .mockResolvedValueOnce(planResponse)
        .mockResolvedValueOnce(doneResponse)
        .mockResolvedValueOnce(validationResponse);

      const result = await webAgent.execute("test task", "https://example.com", testData);

      expect(result).toBe("Task completed with data included");
      expect(mockGenerateObject).toHaveBeenCalledTimes(3);
    });

    it("should reset data on resetState", () => {
      // Set up some state including data
      const testData = { test: "value" };

      // We can't directly test private properties, but we can test the behavior
      webAgent.resetState();

      // After reset, setupMessages should work without data
      const messages = webAgent.setupMessages("test task");
      expect(messages).toHaveLength(2);
      expect(messages[1].content).not.toContain("Input Data:");
    });

    it("should handle null data parameter", async () => {
      const planResponse = {
        object: {
          explanation: "test explanation",
          plan: "test plan",
        },
      };

      const doneResponse = {
        object: {
          currentStep: "Completing task",
          observation: "Task finished",
          extractedData: "Final data",
          thought: "Task is done",
          action: {
            action: PageAction.Done,
            value: "Task completed without data",
          },
        },
      };

      const validationResponse = {
        object: {
          isValid: true,
        },
      };

      mockGenerateObject
        .mockResolvedValueOnce(planResponse)
        .mockResolvedValueOnce(doneResponse)
        .mockResolvedValueOnce(validationResponse);

      const result = await webAgent.execute("test task", "https://example.com", null);
      expect(result).toBe("Task completed without data");
    });

    it("should handle undefined data parameter", async () => {
      const planResponse = {
        object: {
          explanation: "test explanation",
          plan: "test plan",
        },
      };

      const doneResponse = {
        object: {
          currentStep: "Completing task",
          observation: "Task finished",
          extractedData: "Final data",
          thought: "Task is done",
          action: {
            action: PageAction.Done,
            value: "Task completed without data",
          },
        },
      };

      const validationResponse = {
        object: {
          isValid: true,
        },
      };

      mockGenerateObject
        .mockResolvedValueOnce(planResponse)
        .mockResolvedValueOnce(doneResponse)
        .mockResolvedValueOnce(validationResponse);

      const result = await webAgent.execute("test task", "https://example.com");
      expect(result).toBe("Task completed without data");
    });

    it("should handle complex data objects", async () => {
      const planResponse = {
        object: {
          explanation: "test explanation",
          plan: "test plan",
        },
      };

      const doneResponse = {
        object: {
          currentStep: "Completing task",
          observation: "Task finished",
          extractedData: "Final data",
          thought: "Task is done",
          action: {
            action: PageAction.Done,
            value: "Complex data task completed",
          },
        },
      };

      const validationResponse = {
        object: {
          isValid: true,
        },
      };

      mockGenerateObject
        .mockResolvedValueOnce(planResponse)
        .mockResolvedValueOnce(doneResponse)
        .mockResolvedValueOnce(validationResponse);

      const complexData = {
        booking: {
          flight: {
            departure: { city: "NYC", time: "9:00 AM" },
            arrival: { city: "LAX", time: "12:00 PM" },
          },
        },
        travelers: [
          { name: "John Doe", age: 30 },
          { name: "Jane Doe", age: 28 },
        ],
      };

      const result = await webAgent.execute("test task", "https://example.com", complexData);
      expect(result).toBe("Complex data task completed");
    });
  });

  describe("Task validation", () => {
    it("should validate successful task completion", async () => {
      const planResponse = {
        object: {
          explanation: "test explanation",
          plan: "test plan",
        },
      };

      const doneResponse = {
        object: {
          currentStep: "Completing task",
          observation: "Task finished",
          extractedData: "Final data",
          thought: "Task is done",
          action: {
            action: PageAction.Done,
            value: "Task completed successfully",
          },
        },
      };

      const validationResponse = {
        object: {
          isValid: true,
          feedback: "Task completed correctly",
        },
      };

      mockGenerateObject
        .mockResolvedValueOnce(planResponse)
        .mockResolvedValueOnce(doneResponse)
        .mockResolvedValueOnce(validationResponse);

      const result = await webAgent.execute("test task", "https://example.com");
      expect(result).toBe("Task completed successfully");
    });

    it("should retry on failed task validation", async () => {
      const planResponse = {
        object: {
          explanation: "test explanation",
          plan: "test plan",
        },
      };

      const firstDoneResponse = {
        object: {
          currentStep: "Completing task",
          observation: "Task finished",
          extractedData: "Incomplete data",
          thought: "Task is done",
          action: {
            action: PageAction.Done,
            value: "Incomplete task result",
          },
        },
      };

      const secondDoneResponse = {
        object: {
          currentStep: "Completing task",
          observation: "Task finished properly",
          extractedData: "Complete data",
          thought: "Task is done correctly",
          action: {
            action: PageAction.Done,
            value: "Complete task result",
          },
        },
      };

      const failedValidationResponse = {
        object: {
          isValid: false,
          feedback: "Task not completed properly",
        },
      };

      const successValidationResponse = {
        object: {
          isValid: true,
          feedback: "Task completed correctly",
        },
      };

      mockGenerateObject
        .mockResolvedValueOnce(planResponse)
        .mockResolvedValueOnce(firstDoneResponse)
        .mockResolvedValueOnce(failedValidationResponse)
        .mockResolvedValueOnce(secondDoneResponse)
        .mockResolvedValueOnce(successValidationResponse);

      const result = await webAgent.execute("test task", "https://example.com");
      expect(result).toBe("Complete task result");
    });

    it("should fail after maximum validation attempts", async () => {
      const planResponse = {
        object: {
          explanation: "test explanation",
          plan: "test plan",
        },
      };

      const doneResponse = {
        object: {
          currentStep: "Completing task",
          observation: "Task finished",
          extractedData: "Incomplete data",
          thought: "Task is done",
          action: {
            action: PageAction.Done,
            value: "Incomplete task result",
          },
        },
      };

      const failedValidationResponse = {
        object: {
          isValid: false,
          feedback: "Task not completed properly",
        },
      };

      mockGenerateObject
        .mockResolvedValueOnce(planResponse)
        .mockResolvedValueOnce(doneResponse)
        .mockResolvedValueOnce(failedValidationResponse)
        .mockResolvedValueOnce(doneResponse)
        .mockResolvedValueOnce(failedValidationResponse)
        .mockResolvedValueOnce(doneResponse)
        .mockResolvedValueOnce(failedValidationResponse);

      await expect(webAgent.execute("test task", "https://example.com")).rejects.toThrow(
        "Failed to complete task after 3 attempts",
      );
    });
  });
});

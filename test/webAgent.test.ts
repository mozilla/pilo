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

// Helper function to create valid action responses with all required fields
function createMockActionResponse(overrides: any = {}) {
  return {
    object: {
      currentStep: "Working on step",
      observation: "Page analyzed",
      observationStatusMessage: "Page analyzed",
      extractedData: "",
      thought: "Deciding next action",
      action: {
        action: PageAction.Click,
        ref: "s1e23",
      },
      actionStatusMessage: "Performing action",
      ...overrides,
    },
  };
}

// Mock browser implementation for testing
class MockAriaBrowser implements AriaBrowser {
  public browserName = "mockariabrowser";
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
      maxValidationAttempts: 1, // Reduce validation attempts for faster tests
      maxIterations: 10, // Reduce max iterations for faster test failures
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Constructor and initialization", () => {
    it("should create WebAgent with default options", () => {
      const agent = new WebAgent(mockBrowser, { provider: mockProvider });
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
      const agent = new WebAgent(mockBrowser, { debug: false, provider: mockProvider });
      expect(agent).toBeInstanceOf(WebAgent);
    });
  });

  describe("generatePlanWithUrl", () => {
    it("should create plan with URL", async () => {
      const mockResponse = {
        object: {
          explanation: "Book a flight from NYC to Paris",
          plan: "1. Search flights\n2. Select dates\n3. Book ticket",
          url: "https://airline.com",
        },
      };

      mockGenerateObject.mockResolvedValue(mockResponse);

      const result = await webAgent.generatePlanWithUrl("Book a flight to Paris");

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

      await expect(webAgent.generatePlanWithUrl("test task")).rejects.toThrow("LLM error");
    });
  });

  describe("generatePlan", () => {
    it("should create plan without URL", async () => {
      const mockResponse = {
        object: {
          explanation: "Fill out contact form",
          plan: "1. Navigate to form\n2. Fill fields\n3. Submit",
        },
      };

      mockGenerateObject.mockResolvedValue(mockResponse);

      const result = await webAgent.generatePlan("Fill contact form");

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

      const result = await webAgent.generatePlan(
        "Fill contact form",
        "https://example.com/contact",
      );

      expect(result.plan).toBe("1. Fill fields\n2. Submit");
      expect(mockGenerateObject).toHaveBeenCalledWith({
        model: mockProvider,
        schema: expect.any(Object),
        prompt: expect.stringContaining("https://example.com/contact"),
        temperature: 0,
      });
    });
  });

  describe("initializeConversation", () => {
    it("should setup initial messages", () => {
      const messages = webAgent.initializeConversation("Test task");

      expect(messages).toHaveLength(2);
      expect(messages[0].role).toBe("system");
      expect(messages[1].role).toBe("user");
      expect(messages[1].content).toContain("Test task");
    });
  });

  describe("Action validation", () => {
    describe("Enhanced validation logic", () => {
      it("should validate wait action with zero value", async () => {
        const validResponse = createMockActionResponse({
          currentStep: "Waiting",
          observation: "Pausing briefly",
          observationStatusMessage: "Pausing briefly",
          thought: "Need to wait 0 seconds",
          action: {
            action: PageAction.Wait,
            value: "0",
          },
          actionStatusMessage: "Waiting",
        });

        mockGenerateObject.mockResolvedValue(validResponse);
        mockBrowser.setCurrentText("page content");

        const result = await webAgent.generateNextAction("page content");
        expect(result.action.value).toBe("0");
      });

      it("should reject wait action with non-numeric value", async () => {
        const invalidResponse = createMockActionResponse({
          currentStep: "Waiting",
          observation: "Pausing",
          observationStatusMessage: "Pausing",
          thought: "Need to wait",
          action: {
            action: PageAction.Wait,
            value: "not a number",
          },
          actionStatusMessage: "Waiting",
        });

        const validResponse = createMockActionResponse({
          currentStep: "Waiting",
          observation: "Pausing",
          observationStatusMessage: "Pausing",
          thought: "Need to wait",
          action: {
            action: PageAction.Wait,
            value: "5",
          },
          actionStatusMessage: "Waiting",
        });

        mockGenerateObject
          .mockResolvedValueOnce(invalidResponse)
          .mockResolvedValueOnce(validResponse);

        mockBrowser.setCurrentText("page content");

        const result = await webAgent.generateNextAction("page content");
        expect(result.action.value).toBe("5");
        expect(mockGenerateObject).toHaveBeenCalledTimes(2);
      });

      it("should validate all actions requiring refs", async () => {
        const actionsWithRefs = [
          PageAction.Click,
          PageAction.Hover,
          PageAction.Fill,
          PageAction.Focus,
          PageAction.Check,
          PageAction.Uncheck,
          PageAction.Select,
        ];

        for (const action of actionsWithRefs) {
          const invalidResponse = createMockActionResponse({
            currentStep: "Working",
            observation: "Found element",
            observationStatusMessage: "Found element",
            thought: "Perform action",
            action: {
              action,
              // Missing ref
              ...(action === PageAction.Fill || action === PageAction.Select
                ? { value: "test" }
                : {}),
            },
            actionStatusMessage: "Performing action",
          });

          const validResponse = createMockActionResponse({
            currentStep: "Working",
            observation: "Found element",
            observationStatusMessage: "Found element",
            thought: "Perform action",
            action: {
              action,
              ref: "s1e23",
              ...(action === PageAction.Fill || action === PageAction.Select
                ? { value: "test" }
                : {}),
            },
            actionStatusMessage: "Performing action",
          });

          mockGenerateObject
            .mockResolvedValueOnce(invalidResponse)
            .mockResolvedValueOnce(validResponse);

          mockBrowser.setCurrentText("element [ref=s1e23]");

          const result = await webAgent.generateNextAction("element [ref=s1e23]");
          expect(result.action.ref).toBe("s1e23");

          mockGenerateObject.mockClear();
        }
      });

      it("should validate actions prohibiting ref and value", async () => {
        const actionsProhibiting = [PageAction.Back, PageAction.Forward];

        for (const action of actionsProhibiting) {
          const invalidResponse = createMockActionResponse({
            currentStep: "Navigating",
            observation: "Going back",
            observationStatusMessage: "Going back",
            thought: "Navigate",
            action: {
              action,
              ref: "s1e23", // Should not have ref
              value: "test", // Should not have value
            },
            actionStatusMessage: "Navigating",
          });

          const validResponse = createMockActionResponse({
            currentStep: "Navigating",
            observation: "Going back",
            observationStatusMessage: "Going back",
            thought: "Navigate",
            action: {
              action,
            },
            actionStatusMessage: "Navigating",
          });

          mockGenerateObject
            .mockResolvedValueOnce(invalidResponse)
            .mockResolvedValueOnce(validResponse);

          mockBrowser.setCurrentText("page content");

          const result = await webAgent.generateNextAction("page content");
          expect(result.action.ref).toBeUndefined();
          expect(result.action.value).toBeUndefined();

          mockGenerateObject.mockClear();
        }
      });

      it("should validate string field types", async () => {
        const invalidResponse = createMockActionResponse({
          currentStep: 123, // Should be string
          observation: null, // Should be string
          observationStatusMessage: "Invalid observation",
          thought: "", // Empty string
          action: {
            action: PageAction.Done,
            value: "Complete",
          },
          actionStatusMessage: "Completing",
        });

        const validResponse = createMockActionResponse({
          currentStep: "Step 1",
          observation: "Valid observation",
          observationStatusMessage: "Valid observation",
          thought: "Valid thought",
          action: {
            action: PageAction.Done,
            value: "Complete",
          },
          actionStatusMessage: "Completing",
        });

        mockGenerateObject
          .mockResolvedValueOnce(invalidResponse)
          .mockResolvedValueOnce(validResponse);

        mockBrowser.setCurrentText("page content");

        const result = await webAgent.generateNextAction("page content");
        expect(result.currentStep).toBe("Step 1");
        expect(mockGenerateObject).toHaveBeenCalledTimes(2);
      });

      it("should handle invalid action type", async () => {
        const invalidResponse = createMockActionResponse({
          currentStep: "Working",
          observation: "Found element",
          observationStatusMessage: "Found element",
          thought: "Perform action",
          action: {
            action: "invalid_action",
            ref: "s1e23",
          },
          actionStatusMessage: "Performing action",
        });

        const validResponse = createMockActionResponse({
          currentStep: "Working",
          observation: "Found element",
          observationStatusMessage: "Found element",
          thought: "Perform action",
          action: {
            action: PageAction.Click,
            ref: "s1e23",
          },
          actionStatusMessage: "Performing action",
        });

        mockGenerateObject
          .mockResolvedValueOnce(invalidResponse)
          .mockResolvedValueOnce(validResponse);

        mockBrowser.setCurrentText("button [ref=s1e23]");

        const result = await webAgent.generateNextAction("button [ref=s1e23]");
        expect(result.action.action).toBe(PageAction.Click);
        expect(mockGenerateObject).toHaveBeenCalledTimes(2);
      });

      it("should emit validation error events", async () => {
        const eventSpy = vi.fn();
        const emitter = (webAgent as any).eventEmitter as WebAgentEventEmitter;
        emitter.onEvent(WebAgentEventType.TASK_VALIDATION_ERROR, eventSpy);

        const invalidResponse = createMockActionResponse({
          currentStep: "",
          observation: "Found element",
          observationStatusMessage: "Found element",
          thought: "Click button",
          action: {
            action: PageAction.Click,
            // Missing ref
          },
          actionStatusMessage: "Clicking button",
        });

        const validResponse = createMockActionResponse({
          currentStep: "Step 1",
          observation: "Found element",
          observationStatusMessage: "Found element",
          thought: "Click button",
          action: {
            action: PageAction.Click,
            ref: "s1e23",
          },
          actionStatusMessage: "Clicking button",
        });

        mockGenerateObject
          .mockResolvedValueOnce(invalidResponse)
          .mockResolvedValueOnce(validResponse);

        mockBrowser.setCurrentText("button [ref=s1e23]");

        await webAgent.generateNextAction("button [ref=s1e23]");

        expect(eventSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            errors: expect.arrayContaining([
              expect.stringContaining('Missing or empty required field "currentStep"'),
              expect.stringContaining('Action "click" requires a "ref" field'),
            ]),
            retryCount: 0,
            rawResponse: invalidResponse.object,
          }),
        );
      });
    });

    describe("Aria ref validation improvements", () => {
      it("should handle whitespace in aria refs", async () => {
        const mockResponse = createMockActionResponse({
          currentStep: "Step 1",
          observation: "Found element",
          observationStatusMessage: "Found element",
          thought: "Click button",
          action: {
            action: PageAction.Click,
            ref: "  s1e23  ", // Has whitespace
          },
          actionStatusMessage: "Clicking button",
        });

        mockGenerateObject.mockResolvedValue(mockResponse);
        mockBrowser.setCurrentText("button [ref=s1e23]");

        const result = await webAgent.generateNextAction("button [ref=s1e23]");
        expect(result.action.ref).toBe("  s1e23  "); // Should pass as trimmed ref is valid
      });

      it("should handle empty string aria refs", async () => {
        const invalidResponse = createMockActionResponse({
          currentStep: "Step 1",
          observation: "Found element",
          observationStatusMessage: "Found element",
          thought: "Click button",
          action: {
            action: PageAction.Click,
            ref: "", // Empty string
          },
          actionStatusMessage: "Clicking button",
        });

        const validResponse = createMockActionResponse({
          currentStep: "Step 1",
          observation: "Found element",
          observationStatusMessage: "Found element",
          thought: "Click button",
          action: {
            action: PageAction.Click,
            ref: "s1e23",
          },
          actionStatusMessage: "Clicking button",
        });

        mockGenerateObject
          .mockResolvedValueOnce(invalidResponse)
          .mockResolvedValueOnce(validResponse);

        mockBrowser.setCurrentText("button [ref=s1e23]");

        const result = await webAgent.generateNextAction("button [ref=s1e23]");
        expect(result.action.ref).toBe("s1e23");
        expect(mockGenerateObject).toHaveBeenCalledTimes(2);
      });
    });

    describe("New ref validation logic", () => {
      it("should validate refs that exist in page snapshot (new format)", async () => {
        const mockResponse = createMockActionResponse({
          currentStep: "Step 1",
          observation: "Found element",
          observationStatusMessage: "Found element",
          thought: "Click button",
          action: {
            action: PageAction.Click,
            ref: "e123", // New format
          },
          actionStatusMessage: "Clicking button",
        });

        mockGenerateObject.mockResolvedValue(mockResponse);
        mockBrowser.setCurrentText("button [ref=e123]"); // New format in snapshot

        const result = await webAgent.generateNextAction("button [ref=e123]");
        expect(result.action.ref).toBe("e123");
      });

      it("should reject refs that don't exist in page snapshot", async () => {
        const mockResponse = createMockActionResponse({
          currentStep: "Step 1",
          observation: "Found element",
          observationStatusMessage: "Found element",
          thought: "Click button",
          action: {
            action: PageAction.Click,
            ref: "e999", // Doesn't exist
          },
          actionStatusMessage: "Clicking button",
        });

        mockGenerateObject.mockResolvedValue(mockResponse);
        mockBrowser.setCurrentText("button [ref=e123]"); // Only e123 exists

        await expect(webAgent.generateNextAction("button [ref=e123]")).rejects.toThrow(
          'Reference "e999" not found on current page',
        );
      });

      it("should reject refs when no page snapshot available", async () => {
        const mockResponse = createMockActionResponse({
          currentStep: "Step 1",
          observation: "Found element",
          observationStatusMessage: "Found element",
          thought: "Click button",
          action: {
            action: PageAction.Click,
            ref: "e123",
          },
          actionStatusMessage: "Clicking button",
        });

        mockGenerateObject.mockResolvedValue(mockResponse);
        mockBrowser.setCurrentText(""); // Empty snapshot

        await expect(webAgent.generateNextAction("")).rejects.toThrow(
          "Cannot validate ref: no page snapshot available",
        );
      });
    });

    it("should validate correct aria refs", async () => {
      const mockResponse = createMockActionResponse({
        currentStep: "Working on Step 1",
        observation: "Found element",
        observationStatusMessage: "Found element",
        extractedData: "Button element located",
        extractedDataStatusMessage: "Button element located",
        thought: "Click the button",
        action: {
          action: PageAction.Click,
          ref: "s1e23",
        },
        actionStatusMessage: "Clicking button",
      });

      mockGenerateObject.mockResolvedValue(mockResponse);
      mockBrowser.setCurrentText("button 'Click me' [ref=s1e23]");

      const result = await webAgent.generateNextAction("button 'Click me' [ref=s1e23]");

      expect(result.action.action).toBe(PageAction.Click);
      expect(result.action.ref).toBe("s1e23");
    });

    it("should reject malformed aria refs", async () => {
      const mockResponse = createMockActionResponse({
        currentStep: "Working on Step 1",
        observation: "Found element",
        observationStatusMessage: "Found element",
        extractedData: "Button element located",
        extractedDataStatusMessage: "Button element located",
        thought: "Click the button",
        action: {
          action: PageAction.Click,
          ref: "click s1e23 button",
        },
        actionStatusMessage: "Clicking button",
      });

      mockGenerateObject.mockResolvedValue(mockResponse);
      mockBrowser.setCurrentText("button 'Click me' [ref=s1e23]");

      await expect(webAgent.generateNextAction("button 'Click me' [ref=s1e23]")).rejects.toThrow(
        'Reference "click s1e23 button" not found on current page',
      );
    });

    it("should validate fill action requires value", async () => {
      const invalidResponse = createMockActionResponse({
        currentStep: "Working on Step 1",
        observation: "Found input",
        observationStatusMessage: "Found input",
        extractedData: "Input field located",
        extractedDataStatusMessage: "Input field located",
        thought: "Fill the input",
        action: {
          action: PageAction.Fill,
          ref: "s1e23",
          // Missing value
        },
        actionStatusMessage: "Filling input",
      });

      const validResponse = createMockActionResponse({
        currentStep: "Working on Step 1",
        observation: "Found input",
        observationStatusMessage: "Found input",
        extractedData: "Input field located",
        extractedDataStatusMessage: "Input field located",
        thought: "Fill the input",
        action: {
          action: PageAction.Fill,
          ref: "s1e23",
          value: "test@example.com",
        },
        actionStatusMessage: "Filling input",
      });

      mockGenerateObject
        .mockResolvedValueOnce(invalidResponse)
        .mockResolvedValueOnce(validResponse);

      mockBrowser.setCurrentText("input 'Email' [ref=s1e23]");

      const result = await webAgent.generateNextAction("input 'Email' [ref=s1e23]");

      expect(result.action.value).toBe("test@example.com");
      expect(mockGenerateObject).toHaveBeenCalledTimes(2);
    });

    it("should validate done action requires value", async () => {
      const invalidResponse = createMockActionResponse({
        currentStep: "Completing task",
        observation: "Task finished",
        observationStatusMessage: "Task finished",
        extractedData: "Final data collected",
        extractedDataStatusMessage: "Final data collected",
        thought: "Task is done",
        action: {
          action: PageAction.Done,
          // Missing value
        },
        actionStatusMessage: "Task completing",
      });

      const validResponse = createMockActionResponse({
        currentStep: "Completing task",
        observation: "Task finished",
        observationStatusMessage: "Task finished",
        extractedData: "Final data collected",
        extractedDataStatusMessage: "Final data collected",
        thought: "Task is done",
        action: {
          action: PageAction.Done,
          value: "Task completed successfully",
        },
        actionStatusMessage: "Task completing",
      });

      mockGenerateObject
        .mockResolvedValueOnce(invalidResponse)
        .mockResolvedValueOnce(validResponse);

      mockBrowser.setCurrentText("Success message displayed");

      const result = await webAgent.generateNextAction("Success message displayed");

      expect(result.action.value).toBe("Task completed successfully");
      expect(mockGenerateObject).toHaveBeenCalledTimes(2);
    });

    it("should fail after maximum retry attempts", async () => {
      const invalidResponse = createMockActionResponse({
        currentStep: "Working on Step 1",
        observation: "Found element",
        observationStatusMessage: "Found element",
        extractedData: "",
        thought: "Click the button",
        action: {
          action: PageAction.Click,
          // Missing ref
        },
        actionStatusMessage: "Clicking button",
      });

      mockGenerateObject.mockResolvedValue(invalidResponse);
      mockBrowser.setCurrentText("button 'Click me' [ref=s1e23]");

      await expect(webAgent.generateNextAction("button 'Click me' [ref=s1e23]")).rejects.toThrow(
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
      webAgent.initializeConversation("test task");

      // Reset state
      webAgent.resetState();

      // State should be cleared (we can't directly test private properties,
      // but we can test that setupMessages works correctly after reset)
      const messages = webAgent.initializeConversation("new task");
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
      emitter.onEvent(WebAgentEventType.TASK_STARTED, eventSpy);

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
      const mockResponse = createMockActionResponse({
        currentStep: "Working on Step 1",
        observation: "Found element",
        observationStatusMessage: "Found element",
        extractedData: "Page content analyzed",
        extractedDataStatusMessage: "Page content analyzed",
        thought: "Click the button",
        action: {
          action: PageAction.Click,
          ref: "s1e23",
        },
        actionStatusMessage: "Clicking button",
      });

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

      await webAgent.generateNextAction(longSnapshot);

      // Check that compression occurred (private method, so we test indirectly)
      expect(mockGenerateObject).toHaveBeenCalled();
    });
  });

  describe("Error handling", () => {
    it("should handle missing task", async () => {
      await expect(webAgent.execute("")).rejects.toThrow("No task provided");
    });

    it("should handle browser errors during actions", async () => {
      const mockResponse = createMockActionResponse({
        currentStep: "Working on Step 1",
        observation: "Found element",
        observationStatusMessage: "Found element",
        extractedData: "",
        thought: "Click the button",
        action: {
          action: PageAction.Click,
          ref: "invalid",
        },
        actionStatusMessage: "Clicking button",
      });

      const doneResponse = createMockActionResponse({
        currentStep: "Completing task",
        observation: "Task finished",
        observationStatusMessage: "Task finished",
        extractedData: "Final data",
        extractedDataStatusMessage: "Final data",
        thought: "Task is done",
        action: {
          action: PageAction.Done,
          value: "Task completed with errors",
        },
        actionStatusMessage: "Task completing",
      });

      const validationResponse = {
        object: {
          observation: "Task completed successfully without errors",
          completionQuality: "complete" as const,
          feedback: "All actions executed correctly",
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
      expect(result.success).toBe(true);
      expect(result.finalAnswer).toBe("Task completed with errors");
    });
  });

  describe("Navigation tracking", () => {
    it("should track navigation events during execute", async () => {
      const eventSpy = vi.fn();
      const emitter = (webAgent as any).eventEmitter as WebAgentEventEmitter;
      emitter.onEvent(WebAgentEventType.BROWSER_NAVIGATED, eventSpy);

      const planResponse = {
        object: {
          explanation: "test explanation",
          plan: "test plan",
        },
      };

      const actionResponse = createMockActionResponse({
        currentStep: "Working on Step 1",
        observation: "Found element",
        observationStatusMessage: "Found element",
        extractedData: "Page content found",
        extractedDataStatusMessage: "Page content found",
        thought: "Navigate to another page",
        action: {
          action: PageAction.Goto,
          value: "https://example.com/page2",
        },
        actionStatusMessage: "Navigating to page",
      });

      const doneResponse = createMockActionResponse({
        currentStep: "Completing task",
        observation: "Task finished",
        observationStatusMessage: "Task finished",
        extractedData: "Final data",
        extractedDataStatusMessage: "Final data",
        thought: "Task is done",
        action: {
          action: PageAction.Done,
          value: "Navigation completed",
        },
        actionStatusMessage: "Task completing",
      });

      const validationResponse = {
        object: {
          observation: "Navigation completed successfully",
          completionQuality: "complete" as const,
          feedback: "Page navigation was executed correctly",
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

      const doneResponse = createMockActionResponse({
        currentStep: "Completing task",
        observation: "Task finished",
        observationStatusMessage: "Task finished",
        extractedData: "Final data",
        extractedDataStatusMessage: "Final data",
        thought: "Task is done",
        action: {
          action: PageAction.Done,
          value: "Task completed with data",
        },
        actionStatusMessage: "Task completing",
      });

      const validationResponse = {
        object: {
          observation: "Task completed with data successfully",
          completionQuality: "complete" as const,
          feedback: "Data was processed correctly during task execution",
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
      expect(result.success).toBe(true);
      expect(result.finalAnswer).toBe("Task completed with data");
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

      const doneResponse = createMockActionResponse({
        currentStep: "Completing task",
        observation: "Task finished",
        observationStatusMessage: "Task finished",
        extractedData: "Final data",
        extractedDataStatusMessage: "Final data",
        thought: "Task is done",
        action: {
          action: PageAction.Done,
          value: "Task completed with data included",
        },
        actionStatusMessage: "Task completing",
      });

      const validationResponse = {
        object: {
          observation: "Task completed with data included successfully",
          completionQuality: "complete" as const,
          feedback: "Data was properly included in task execution",
        },
      };

      mockGenerateObject
        .mockResolvedValueOnce(planResponse)
        .mockResolvedValueOnce(doneResponse)
        .mockResolvedValueOnce(validationResponse);

      const result = await webAgent.execute("test task", "https://example.com", testData);

      expect(result.success).toBe(true);
      expect(result.finalAnswer).toBe("Task completed with data included");
      expect(mockGenerateObject).toHaveBeenCalledTimes(3);
    });

    it("should reset data on resetState", () => {
      // Set up some state including data
      const testData = { test: "value" };

      // We can't directly test private properties, but we can test the behavior
      webAgent.resetState();

      // After reset, setupMessages should work without data
      const messages = webAgent.initializeConversation("test task");
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

      const doneResponse = createMockActionResponse({
        currentStep: "Completing task",
        observation: "Task finished",
        observationStatusMessage: "Task finished",
        extractedData: "Final data",
        extractedDataStatusMessage: "Final data",
        thought: "Task is done",
        action: {
          action: PageAction.Done,
          value: "Task completed without data",
        },
        actionStatusMessage: "Task completing",
      });

      const validationResponse = {
        object: {
          observation: "Task completed without data successfully",
          completionQuality: "complete" as const,
          feedback: "Task executed correctly without data dependency",
        },
      };

      mockGenerateObject
        .mockResolvedValueOnce(planResponse)
        .mockResolvedValueOnce(doneResponse)
        .mockResolvedValueOnce(validationResponse);

      const result = await webAgent.execute("test task", "https://example.com", null);
      expect(result.success).toBe(true);
      expect(result.finalAnswer).toBe("Task completed without data");
    });

    it("should handle undefined data parameter", async () => {
      const planResponse = {
        object: {
          explanation: "test explanation",
          plan: "test plan",
        },
      };

      const doneResponse = createMockActionResponse({
        currentStep: "Completing task",
        observation: "Task finished",
        observationStatusMessage: "Task finished",
        extractedData: "Final data",
        extractedDataStatusMessage: "Final data",
        thought: "Task is done",
        action: {
          action: PageAction.Done,
          value: "Task completed without data",
        },
        actionStatusMessage: "Task completing",
      });

      const validationResponse = {
        object: {
          observation: "Task completed without data parameter successfully",
          completionQuality: "complete" as const,
          feedback: "Task handled undefined data correctly",
        },
      };

      mockGenerateObject
        .mockResolvedValueOnce(planResponse)
        .mockResolvedValueOnce(doneResponse)
        .mockResolvedValueOnce(validationResponse);

      const result = await webAgent.execute("test task", "https://example.com");
      expect(result.success).toBe(true);
      expect(result.finalAnswer).toBe("Task completed without data");
    });

    it("should handle complex data objects", async () => {
      const planResponse = {
        object: {
          explanation: "test explanation",
          plan: "test plan",
        },
      };

      const doneResponse = createMockActionResponse({
        currentStep: "Completing task",
        observation: "Task finished",
        observationStatusMessage: "Task finished",
        extractedData: "Final data",
        extractedDataStatusMessage: "Final data",
        thought: "Task is done",
        action: {
          action: PageAction.Done,
          value: "Complex data task completed",
        },
        actionStatusMessage: "Task completing",
      });

      const validationResponse = {
        object: {
          observation: "Complex data task completed successfully",
          completionQuality: "complete" as const,
          feedback: "Complex nested data structure was handled correctly",
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
      expect(result.success).toBe(true);
      expect(result.finalAnswer).toBe("Complex data task completed");
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

      const doneResponse = createMockActionResponse({
        currentStep: "Completing task",
        observation: "Task finished",
        observationStatusMessage: "Task finished",
        extractedData: "Final data",
        extractedDataStatusMessage: "Final data",
        thought: "Task is done",
        action: {
          action: PageAction.Done,
          value: "Task completed successfully",
        },
        actionStatusMessage: "Task completing",
      });

      const validationResponse = {
        object: {
          observation: "Agent completed task successfully",
          completionQuality: "complete",
          feedback: "Task completed correctly",
        },
      };

      mockGenerateObject
        .mockResolvedValueOnce(planResponse)
        .mockResolvedValueOnce(doneResponse)
        .mockResolvedValueOnce(validationResponse);

      const result = await webAgent.execute("test task", "https://example.com");
      expect(result.success).toBe(true);
      expect(result.finalAnswer).toBe("Task completed successfully");
    });

    it("should retry on failed task validation", async () => {
      // Create a separate WebAgent instance with higher maxValidationAttempts for this test
      const retryWebAgent = new WebAgent(mockBrowser, {
        logger: mockLogger,
        debug: true,
        provider: mockProvider,
        maxValidationAttempts: 3,
        maxIterations: 10,
      });
      const planResponse = {
        object: {
          explanation: "test explanation",
          plan: "test plan",
        },
      };

      const firstDoneResponse = createMockActionResponse({
        currentStep: "Completing task",
        observation: "Task finished",
        observationStatusMessage: "Task finished",
        extractedData: "Incomplete data",
        extractedDataStatusMessage: "Incomplete data",
        thought: "Task is done",
        action: {
          action: PageAction.Done,
          value: "Incomplete task result",
        },
        actionStatusMessage: "Task completing",
      });

      const secondDoneResponse = createMockActionResponse({
        currentStep: "Completing task",
        observation: "Task finished properly",
        observationStatusMessage: "Task finished properly",
        extractedData: "Complete data",
        extractedDataStatusMessage: "Complete data",
        thought: "Task is done correctly",
        action: {
          action: PageAction.Done,
          value: "Complete task result",
        },
        actionStatusMessage: "Task completing",
      });

      const failedValidationResponse = {
        object: {
          observation: "Task not completed properly",
          completionQuality: "partial",
          feedback: "Task not completed properly",
        },
      };

      const successValidationResponse = {
        object: {
          observation: "Task completed correctly",
          completionQuality: "complete",
          feedback: "Task completed correctly",
        },
      };

      mockGenerateObject
        .mockResolvedValueOnce(planResponse)
        .mockResolvedValueOnce(firstDoneResponse)
        .mockResolvedValueOnce(failedValidationResponse)
        .mockResolvedValueOnce(secondDoneResponse)
        .mockResolvedValueOnce(successValidationResponse);

      const result = await retryWebAgent.execute("test task", "https://example.com");
      expect(result.success).toBe(true);
      expect(result.finalAnswer).toBe("Complete task result");
    });

    it("should fail after maximum validation attempts", async () => {
      // Create a separate WebAgent instance with higher maxValidationAttempts for this test
      const failWebAgent = new WebAgent(mockBrowser, {
        logger: mockLogger,
        debug: true,
        provider: mockProvider,
        maxValidationAttempts: 3,
        maxIterations: 10,
      });
      const planResponse = {
        object: {
          explanation: "test explanation",
          plan: "test plan",
        },
      };

      const doneResponse = createMockActionResponse({
        currentStep: "Completing task",
        observation: "Task finished",
        observationStatusMessage: "Task finished",
        extractedData: "Incomplete data",
        extractedDataStatusMessage: "Incomplete data",
        thought: "Task is done",
        action: {
          action: PageAction.Done,
          value: "Incomplete task result",
        },
        actionStatusMessage: "Task completing",
      });

      const failedValidationResponse = {
        object: {
          observation: "Task not completed properly",
          completionQuality: "failed",
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

      const result = await failWebAgent.execute("test task", "https://example.com");
      expect(result.success).toBe(false);
      expect(result.validationAttempts).toBe(3);
      expect(result.finalAnswer).toBe("Incomplete task result");
    });
  });

  describe("Snapshot clipping", () => {
    it("should clip snapshots from messages", () => {
      const messages = [
        {
          role: "system",
          content: "You are a helpful assistant",
        },
        {
          role: "user",
          content: "Please complete this task",
        },
        {
          role: "user",
          content:
            "Here is the current page snapshot:\n```\nbutton 'Submit' [click>123]\ninput 'email' [fill>input@example.com]\nThis is a very long page snapshot that should be clipped\n```",
        },
        {
          role: "assistant",
          content: JSON.stringify({ action: "click", ref: "s1e23" }),
        },
      ];

      const clippedMessages = webAgent["truncateSnapshotsInMessages"](messages);

      expect(clippedMessages).toHaveLength(4);
      expect(clippedMessages[0].content).toBe("You are a helpful assistant");
      expect(clippedMessages[1].content).toBe("Please complete this task");
      expect(clippedMessages[2].content).toContain("[snapshot clipped for length]");
      expect(clippedMessages[2].content).not.toContain("This is a very long page snapshot");
      expect(clippedMessages[3].content).toContain("s1e23");
    });

    it("should preserve non-snapshot messages unchanged", () => {
      const messages = [
        {
          role: "user",
          content: "Regular user message",
        },
        {
          role: "assistant",
          content: "Regular assistant response",
        },
        {
          role: "user",
          content: "Another message with code but no backticks",
        },
      ];

      const clippedMessages = webAgent["truncateSnapshotsInMessages"](messages);

      expect(clippedMessages).toEqual(messages);
    });

    it("should only clip messages that contain both 'snapshot' and code blocks", () => {
      const messages = [
        {
          role: "user",
          content: "This has ```code``` but no page content",
        },
        {
          role: "user",
          content: "This mentions snapshot but has no code blocks",
        },
        {
          role: "user",
          content: "Page snapshot: ```\nlong content\n```",
        },
      ];

      const clippedMessages = webAgent["truncateSnapshotsInMessages"](messages);

      // Should not clip - has ``` but no "snapshot"
      expect(clippedMessages[0].content).toBe("This has ```code``` but no page content");
      // Should not clip - has "snapshot" but no ```
      expect(clippedMessages[1].content).toBe("This mentions snapshot but has no code blocks");
      // Should clip - has both "snapshot" and ```
      expect(clippedMessages[2].content).toBe("Page snapshot: ```[snapshot clipped for length]```");
    });
  });

  describe("Page state management", () => {
    it("should update page state without side effects", () => {
      // Initial state should be empty
      expect(webAgent["currentPage"]).toEqual({ url: "", title: "" });

      // Update page state
      webAgent["updatePageState"]("Test Page", "https://test.com");

      // Should update internal state
      expect(webAgent["currentPage"]).toEqual({
        url: "https://test.com",
        title: "Test Page",
      });
    });

    it("should refresh page state from browser", async () => {
      mockBrowser.setCurrentTitle("Browser Page");
      mockBrowser.setCurrentUrl("https://browser.com");

      const result = await webAgent["refreshPageState"]();

      expect(result).toEqual({
        title: "Browser Page",
        url: "https://browser.com",
      });
      expect(webAgent["currentPage"]).toEqual({
        url: "https://browser.com",
        title: "Browser Page",
      });
    });
  });

  describe("Processing events wrapper", () => {
    it("should emit processing start and end events around task execution", async () => {
      const eventSpy = vi.fn();
      webAgent["eventEmitter"].on(WebAgentEventType.AGENT_PROCESSING, eventSpy);

      const mockTask = vi.fn().mockResolvedValue("test result");

      const result = await webAgent["withProcessingEvents"]("Test Operation", mockTask);

      expect(result).toBe("test result");
      expect(mockTask).toHaveBeenCalledOnce();
      expect(eventSpy).toHaveBeenCalledTimes(2);

      // Check start event
      expect(eventSpy).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          status: "start",
          operation: "Test Operation",
          timestamp: expect.any(Number),
        }),
      );

      // Check end event
      expect(eventSpy).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          status: "end",
          operation: "Test Operation",
          timestamp: expect.any(Number),
        }),
      );
    });

    it("should emit end event even when task throws error", async () => {
      const eventSpy = vi.fn();
      webAgent["eventEmitter"].on(WebAgentEventType.AGENT_PROCESSING, eventSpy);

      const mockTask = vi.fn().mockRejectedValue(new Error("Test error"));

      await expect(webAgent["withProcessingEvents"]("Failed Operation", mockTask)).rejects.toThrow(
        "Test error",
      );

      expect(eventSpy).toHaveBeenCalledTimes(2);

      // Should still emit end event after error
      expect(eventSpy).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          status: "end",
          operation: "Failed Operation",
          timestamp: expect.any(Number),
        }),
      );
    });
  });
});

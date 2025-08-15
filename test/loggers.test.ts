import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ConsoleLogger } from "../src/loggers/console.js";
import { JSONConsoleLogger } from "../src/loggers/json.js";
import { WebAgentEventEmitter, WebAgentEventType } from "../src/events.js";
import type {
  TaskStartEventData,
  TaskSetupEventData,
  TaskCompleteEventData,
  TaskValidationEventData,
  AIGenerationEventData,
  AIGenerationErrorEventData,
  PageNavigationEventData,
  CurrentStepEventData,
  ObservationEventData,
  ThoughtEventData,
  ExtractedDataEventData,
  ActionExecutionEventData,
  ActionResultEventData,
  CompressionDebugEventData,
  MessagesDebugEventData,
  WaitingEventData,
  NetworkWaitingEventData,
  NetworkTimeoutEventData,
  ProcessingEventData,
  ScreenshotCapturedEventData,
} from "../src/events.js";

// Mock console methods
const mockConsole = {
  log: vi.fn(),
  error: vi.fn(),
};

// Store original console methods
const originalConsole = {
  log: console.log,
  error: console.error,
};

describe("ConsoleLogger", () => {
  let logger: ConsoleLogger;
  let emitter: WebAgentEventEmitter;

  beforeEach(() => {
    // Replace console methods with mocks
    console.log = mockConsole.log;
    console.error = mockConsole.error;

    // Clear mock call history
    mockConsole.log.mockClear();
    mockConsole.error.mockClear();

    logger = new ConsoleLogger();
    emitter = new WebAgentEventEmitter();
    logger.initialize(emitter);
  });

  afterEach(() => {
    // Restore original console methods
    console.log = originalConsole.log;
    console.error = originalConsole.error;

    // Clean up logger
    logger.dispose();
  });

  describe("Logger interface", () => {
    it("should implement Logger interface", () => {
      expect(logger).toBeInstanceOf(ConsoleLogger);
      expect(typeof logger.initialize).toBe("function");
      expect(typeof logger.dispose).toBe("function");
    });

    it("should initialize with event emitter", () => {
      const newLogger = new ConsoleLogger();
      const newEmitter = new WebAgentEventEmitter();

      expect(() => {
        newLogger.initialize(newEmitter);
      }).not.toThrow();

      newLogger.dispose();
    });

    it("should dispose properly", () => {
      const newLogger = new ConsoleLogger();
      const newEmitter = new WebAgentEventEmitter();
      newLogger.initialize(newEmitter);

      expect(() => {
        newLogger.dispose();
      }).not.toThrow();

      // Should be safe to call dispose multiple times
      expect(() => {
        newLogger.dispose();
      }).not.toThrow();
    });
  });

  describe("Task events", () => {
    it("should handle TASK_STARTED events", () => {
      const eventData: TaskStartEventData = {
        timestamp: Date.now(),
        iterationId: "test-1",
        task: "Complete a web form",
        explanation: "Fill out and submit a contact form on the website",
        plan: "1. Navigate to contact page\n2. Fill required fields\n3. Submit form",
        url: "https://example.com/contact",
      };

      emitter.emitEvent({
        type: WebAgentEventType.TASK_STARTED,
        data: eventData,
      });

      expect(mockConsole.log).toHaveBeenCalled();
      const calls = mockConsole.log.mock.calls;

      // Check that task, explanation, plan, and URL are logged
      const allOutput = calls.flat().join(" ");
      expect(allOutput).toContain("Complete a web form");
      expect(allOutput).toContain("Fill out and submit a contact form");
      expect(allOutput).toContain("1. Navigate to contact page");
      expect(allOutput).toContain("https://example.com/contact");
    });

    it("should handle TASK_COMPLETED events", () => {
      const eventData: TaskCompleteEventData = {
        timestamp: Date.now(),
        iterationId: "test-1",
        finalAnswer: "Form submitted successfully with confirmation ID: 12345",
      };

      emitter.emitEvent({
        type: WebAgentEventType.TASK_COMPLETED,
        data: eventData,
      });

      expect(mockConsole.log).toHaveBeenCalled();
      const allOutput = mockConsole.log.mock.calls.flat().join(" ");
      expect(allOutput).toContain("Form submitted successfully");
      expect(allOutput).toContain("12345");
    });

    it("should handle TASK_COMPLETE events with null finalAnswer", () => {
      const eventData: TaskCompleteEventData = {
        timestamp: Date.now(),
        iterationId: "test-1",
        finalAnswer: null,
      };

      emitter.emitEvent({
        type: WebAgentEventType.TASK_COMPLETED,
        data: eventData,
      });

      // Should not log anything for null final answer
      expect(mockConsole.log).not.toHaveBeenCalled();
    });

    it("should handle TASK_VALIDATION events (valid)", () => {
      const eventData: TaskValidationEventData = {
        timestamp: Date.now(),
        iterationId: "test-1",
        observation: "Task completed successfully",
        completionQuality: "complete",
        finalAnswer: "Task completed successfully",
      };

      emitter.emitEvent({
        type: WebAgentEventType.TASK_VALIDATED,
        data: eventData,
      });

      expect(mockConsole.log).toHaveBeenCalled();
      const allOutput = mockConsole.log.mock.calls.flat().join(" ");
      expect(allOutput).toContain("Task completed");
    });

    it("should handle TASK_VALIDATION events (invalid with feedback)", () => {
      const eventData: TaskValidationEventData = {
        timestamp: Date.now(),
        iterationId: "test-1",
        observation: "Task not completed properly",
        completionQuality: "partial",
        feedback: "Missing confirmation step in the process",
        finalAnswer: "Form submitted",
      };

      emitter.emitEvent({
        type: WebAgentEventType.TASK_VALIDATED,
        data: eventData,
      });

      expect(mockConsole.log).toHaveBeenCalled();
      const allOutput = mockConsole.log.mock.calls.flat().join(" ");
      expect(allOutput).toContain("Partial completion");
      expect(allOutput).toContain("Missing confirmation step");
    });
  });

  describe("Page events", () => {
    it("should handle PAGE_NAVIGATION events", () => {
      const eventData: PageNavigationEventData = {
        timestamp: Date.now(),
        iterationId: "test-1",
        title: "Contact Us - Example Company",
        url: "https://example.com/contact",
      };

      emitter.emitEvent({
        type: WebAgentEventType.BROWSER_NAVIGATED,
        data: eventData,
      });

      expect(mockConsole.log).toHaveBeenCalled();
      const allOutput = mockConsole.log.mock.calls.flat().join(" ");
      expect(allOutput).toContain("Contact Us - Example Company");
    });

    it("should handle PAGE_NAVIGATION events with long titles", () => {
      const longTitle =
        "This is a very long page title that exceeds fifty characters and should be truncated for display purposes";
      const eventData: PageNavigationEventData = {
        timestamp: Date.now(),
        iterationId: "test-1",
        title: longTitle,
        url: "https://example.com/page",
      };

      emitter.emitEvent({
        type: WebAgentEventType.BROWSER_NAVIGATED,
        data: eventData,
      });

      expect(mockConsole.log).toHaveBeenCalled();
      const allOutput = mockConsole.log.mock.calls.flat().join(" ");
      expect(allOutput).toContain("...");
      expect(allOutput).not.toContain(longTitle);
    });
  });

  describe("Agent reasoning events", () => {
    it("should handle CURRENT_STEP events", () => {
      const eventData: CurrentStepEventData = {
        timestamp: Date.now(),
        iterationId: "test-1",
        currentStep: "Working on Step 1: Navigate to contact form",
      };

      emitter.emitEvent({
        type: WebAgentEventType.AGENT_STEP,
        data: eventData,
      });

      expect(mockConsole.log).toHaveBeenCalled();
      const allOutput = mockConsole.log.mock.calls.flat().join(" ");
      expect(allOutput).toContain("Working on Step 1");
    });

    it("should handle OBSERVATION events", () => {
      const eventData: ObservationEventData = {
        timestamp: Date.now(),
        iterationId: "test-1",
        observation: "Found contact form with name, email, and message fields",
      };

      emitter.emitEvent({
        type: WebAgentEventType.AGENT_OBSERVED,
        data: eventData,
      });

      expect(mockConsole.log).toHaveBeenCalled();
      const allOutput = mockConsole.log.mock.calls.flat().join(" ");
      expect(allOutput).toContain("Found contact form");
    });

    it("should handle THOUGHT events", () => {
      const eventData: ThoughtEventData = {
        timestamp: Date.now(),
        iterationId: "test-1",
        thought: "I need to fill in all required fields before submitting",
      };

      emitter.emitEvent({
        type: WebAgentEventType.AGENT_REASONED,
        data: eventData,
      });

      expect(mockConsole.log).toHaveBeenCalled();
      const allOutput = mockConsole.log.mock.calls.flat().join(" ");
      expect(allOutput).toContain("required fields");
    });

    it("should handle EXTRACTED_DATA events", () => {
      const eventData: ExtractedDataEventData = {
        timestamp: Date.now(),
        iterationId: "test-1",
        extractedData: "Confirmation ID: 12345, Status: Submitted",
      };

      emitter.emitEvent({
        type: WebAgentEventType.AGENT_EXTRACTED,
        data: eventData,
      });

      expect(mockConsole.log).toHaveBeenCalled();
      const allOutput = mockConsole.log.mock.calls.flat().join(" ");
      expect(allOutput).toContain("Confirmation ID: 12345");
    });
  });

  describe("Action events", () => {
    it("should handle ACTION_EXECUTION events", () => {
      const eventData: ActionExecutionEventData = {
        timestamp: Date.now(),
        iterationId: "test-1",
        action: "fill",
        ref: "s1e23",
        value: "john@example.com",
      };

      emitter.emitEvent({
        type: WebAgentEventType.BROWSER_ACTION_STARTED,
        data: eventData,
      });

      expect(mockConsole.log).toHaveBeenCalled();
      const allOutput = mockConsole.log.mock.calls.flat().join(" ");
      expect(allOutput).toContain("FILL");
      expect(allOutput).toContain("s1e23");
      expect(allOutput).toContain("john@example.com");
    });

    it("should handle ACTION_EXECUTION events without ref and value", () => {
      const eventData: ActionExecutionEventData = {
        timestamp: Date.now(),
        iterationId: "test-1",
        action: "back",
      };

      emitter.emitEvent({
        type: WebAgentEventType.BROWSER_ACTION_STARTED,
        data: eventData,
      });

      expect(mockConsole.log).toHaveBeenCalled();
      const allOutput = mockConsole.log.mock.calls.flat().join(" ");
      expect(allOutput).toContain("BACK");
    });

    it("should handle ACTION_RESULT events (success)", () => {
      const eventData: ActionResultEventData = {
        timestamp: Date.now(),
        iterationId: "test-1",
        success: true,
      };

      emitter.emitEvent({
        type: WebAgentEventType.BROWSER_ACTION_COMPLETED,
        data: eventData,
      });

      // Success events don't log anything
      expect(mockConsole.log).not.toHaveBeenCalled();
      expect(mockConsole.error).not.toHaveBeenCalled();
    });

    it("should handle ACTION_RESULT events (failure)", () => {
      const eventData: ActionResultEventData = {
        timestamp: Date.now(),
        iterationId: "test-1",
        success: false,
        error: "Element not found: s1e23",
      };

      emitter.emitEvent({
        type: WebAgentEventType.BROWSER_ACTION_COMPLETED,
        data: eventData,
      });

      expect(mockConsole.error).toHaveBeenCalled();
      const allOutput = mockConsole.error.mock.calls.flat().join(" ");
      expect(allOutput).toContain("Element not found");
    });

    it("should handle ACTION_RESULT events (failure without error message)", () => {
      const eventData: ActionResultEventData = {
        timestamp: Date.now(),
        iterationId: "test-1",
        success: false,
      };

      emitter.emitEvent({
        type: WebAgentEventType.BROWSER_ACTION_COMPLETED,
        data: eventData,
      });

      expect(mockConsole.error).toHaveBeenCalled();
      const allOutput = mockConsole.error.mock.calls.flat().join(" ");
      expect(allOutput).toContain("Unknown error");
    });
  });

  describe("Debug events", () => {
    it("should handle DEBUG_COMPRESSION events", () => {
      const eventData: CompressionDebugEventData = {
        timestamp: Date.now(),
        iterationId: "test-1",
        originalSize: 10000,
        compressedSize: 3000,
        compressionPercent: 70,
      };

      emitter.emitEvent({
        type: WebAgentEventType.SYSTEM_DEBUG_COMPRESSION,
        data: eventData,
      });

      expect(mockConsole.log).toHaveBeenCalled();
      const allOutput = mockConsole.log.mock.calls.flat().join(" ");
      expect(allOutput).toContain("70%");
      expect(allOutput).toContain("10000");
      expect(allOutput).toContain("3000");
    });

    it("should handle DEBUG_MESSAGES events", () => {
      const eventData: MessagesDebugEventData = {
        timestamp: Date.now(),
        iterationId: "test-1",
        messages: [
          { role: "system", content: "You are a helpful assistant" },
          { role: "user", content: "Help me with this task" },
        ],
      };

      emitter.emitEvent({
        type: WebAgentEventType.SYSTEM_DEBUG_MESSAGE,
        data: eventData,
      });

      expect(mockConsole.log).toHaveBeenCalled();
      const allOutput = mockConsole.log.mock.calls.flat().join(" ");
      expect(allOutput).toContain("system");
      expect(allOutput).toContain("helpful assistant");
    });
  });

  describe("Waiting events", () => {
    it("should handle WAITING events (single second)", () => {
      const eventData: WaitingEventData = {
        timestamp: Date.now(),
        iterationId: "test-1",
        seconds: 1,
      };

      emitter.emitEvent({
        type: WebAgentEventType.AGENT_WAITING,
        data: eventData,
      });

      expect(mockConsole.log).toHaveBeenCalled();
      const allOutput = mockConsole.log.mock.calls.flat().join(" ");
      expect(allOutput).toContain("1 second");
      expect(allOutput).not.toContain("seconds");
    });

    it("should handle WAITING events (multiple seconds)", () => {
      const eventData: WaitingEventData = {
        timestamp: Date.now(),
        iterationId: "test-1",
        seconds: 5,
      };

      emitter.emitEvent({
        type: WebAgentEventType.AGENT_WAITING,
        data: eventData,
      });

      expect(mockConsole.log).toHaveBeenCalled();
      const allOutput = mockConsole.log.mock.calls.flat().join(" ");
      expect(allOutput).toContain("5 seconds");
    });

    it("should handle NETWORK_WAITING events", () => {
      const eventData: NetworkWaitingEventData = {
        timestamp: Date.now(),
        iterationId: "test-1",
        action: "click",
      };

      emitter.emitEvent({
        type: WebAgentEventType.BROWSER_NETWORK_WAITING,
        data: eventData,
      });

      expect(mockConsole.log).toHaveBeenCalled();
      const allOutput = mockConsole.log.mock.calls.flat().join(" ");
      expect(allOutput).toContain("Network Waiting");
    });

    it("should handle NETWORK_TIMEOUT events", () => {
      const eventData: NetworkTimeoutEventData = {
        timestamp: Date.now(),
        iterationId: "test-1",
        action: "submit",
      };

      emitter.emitEvent({
        type: WebAgentEventType.BROWSER_NETWORK_TIMEOUT,
        data: eventData,
      });

      expect(mockConsole.log).toHaveBeenCalled();
      const allOutput = mockConsole.log.mock.calls.flat().join(" ");
      expect(allOutput).toContain("Network Timeout");
    });

    it("should handle SCREENSHOT_CAPTURED events", () => {
      const eventData: ScreenshotCapturedEventData = {
        timestamp: Date.now(),
        iterationId: "test-1",
        size: 51200, // 50KB in bytes
        format: "jpeg",
      };

      emitter.emitEvent({
        type: WebAgentEventType.BROWSER_SCREENSHOT_CAPTURED,
        data: eventData,
      });

      expect(mockConsole.log).toHaveBeenCalled();
      const allOutput = mockConsole.log.mock.calls.flat().join(" ");
      expect(allOutput).toContain("Screenshot captured");
      expect(allOutput).toContain("50KB");
      expect(allOutput).toContain("JPEG");
    });
  });

  describe("Processing events", () => {
    it("should handle PROCESSING start events", () => {
      const eventData: ProcessingEventData = {
        timestamp: Date.now(),
        iterationId: "test-1",
        status: "start",
        operation: "Planning next action",
      };

      emitter.emitEvent({
        type: WebAgentEventType.AGENT_PROCESSING,
        data: eventData,
      });

      expect(mockConsole.log).toHaveBeenCalled();
      const allOutput = mockConsole.log.mock.calls.flat().join(" ");
      expect(allOutput).toContain("Planning next action");
      expect(allOutput).toContain("🧮");
      expect(allOutput).not.toContain("👁️");
    });

    it("should handle PROCESSING start events with vision", () => {
      const eventData: ProcessingEventData = {
        timestamp: Date.now(),
        iterationId: "test-1",
        status: "start",
        operation: "Planning next action",
        hasScreenshot: true,
      };

      emitter.emitEvent({
        type: WebAgentEventType.AGENT_PROCESSING,
        data: eventData,
      });

      expect(mockConsole.log).toHaveBeenCalled();
      const allOutput = mockConsole.log.mock.calls.flat().join(" ");
      expect(allOutput).toContain("Planning next action");
      expect(allOutput).toContain("🧮");
      expect(allOutput).toContain("👁️");
    });

    it("should not log PROCESSING end events", () => {
      const eventData: ProcessingEventData = {
        timestamp: Date.now(),
        iterationId: "test-1",
        status: "end",
        operation: "Planning next action",
      };

      emitter.emitEvent({
        type: WebAgentEventType.AGENT_PROCESSING,
        data: eventData,
      });

      // End events should not trigger console output
      expect(mockConsole.log).not.toHaveBeenCalled();
    });
  });

  describe("Event listener management", () => {
    it("should remove all listeners on dispose", () => {
      const eventCounts = [
        WebAgentEventType.TASK_STARTED,
        WebAgentEventType.TASK_COMPLETED,
        WebAgentEventType.BROWSER_NAVIGATED,
        WebAgentEventType.AGENT_STEP,
        WebAgentEventType.AGENT_OBSERVED,
        WebAgentEventType.AGENT_REASONED,
        WebAgentEventType.AGENT_EXTRACTED,
        WebAgentEventType.BROWSER_ACTION_STARTED,
        WebAgentEventType.BROWSER_ACTION_COMPLETED,
        WebAgentEventType.SYSTEM_DEBUG_COMPRESSION,
        WebAgentEventType.SYSTEM_DEBUG_MESSAGE,
        WebAgentEventType.AGENT_WAITING,
        WebAgentEventType.BROWSER_NETWORK_WAITING,
        WebAgentEventType.BROWSER_NETWORK_TIMEOUT,
        WebAgentEventType.TASK_VALIDATED,
      ].map((eventType) => ({
        eventType,
        count: emitter.listenerCount(eventType),
      }));

      // All events should have listeners
      eventCounts.forEach(({ count }) => {
        expect(count).toBeGreaterThan(0);
      });

      logger.dispose();

      // After dispose, all events should have no listeners from this logger
      eventCounts.forEach(({ eventType }) => {
        const newCount = emitter.listenerCount(eventType);
        expect(newCount).toBe(0);
      });
    });

    it("should handle dispose when emitter is null", () => {
      const newLogger = new ConsoleLogger();

      // Dispose without initializing should not throw
      expect(() => {
        newLogger.dispose();
      }).not.toThrow();
    });
  });

  describe("Multiple logger instances", () => {
    it("should support multiple logger instances", () => {
      const logger2 = new ConsoleLogger();
      logger2.initialize(emitter);

      const eventData: TaskStartEventData = {
        timestamp: Date.now(),
        iterationId: "test-1",
        task: "Test task",
        explanation: "Test explanation",
        plan: "Test plan",
        url: "https://example.com",
      };

      emitter.emitEvent({
        type: WebAgentEventType.TASK_STARTED,
        data: eventData,
      });

      // Both loggers should handle the event
      expect(mockConsole.log).toHaveBeenCalled();

      logger2.dispose();
    });
  });

  describe("New event types", () => {
    it("should handle TASK_SETUP events", () => {
      const eventData: TaskSetupEventData = {
        timestamp: Date.now(),
        iterationId: "test-1",
        task: "Complete a web form",
        browserName: "playwright:firefox",
        guardrails: undefined,
        data: { key: "value" },
        pwEndpoint: undefined,
        proxy: "http://proxy.example.com:8080",
        vision: true,
      };

      emitter.emitEvent({
        type: WebAgentEventType.TASK_SETUP,
        data: eventData,
      });

      expect(mockConsole.log).toHaveBeenCalled();
      const calls = mockConsole.log.mock.calls;
      const allOutput = calls.flat().join(" ");

      expect(allOutput).toContain("🚀 Spark Automation Starting");
      expect(allOutput).toContain("Complete a web form");
      expect(allOutput).toContain("playwright:firefox");
      expect(allOutput).toContain("proxy.example.com");
      expect(allOutput).toContain("Vision: enabled");
    });

    it("should handle AI_GENERATION_ERROR events", () => {
      const eventData: AIGenerationErrorEventData = {
        timestamp: Date.now(),
        iterationId: "test-1",
        prompt: "Generate a response",
        error: "API rate limit exceeded",
        schema: { type: "object" },
        messages: [{ role: "user", content: "test" }],
      };

      emitter.emitEvent({
        type: WebAgentEventType.AI_GENERATION_ERROR,
        data: eventData,
      });

      expect(mockConsole.error).toHaveBeenCalled();
      const allOutput = mockConsole.error.mock.calls.flat().join(" ");
      expect(allOutput).toContain("❌ AI generation error:");
      expect(allOutput).toContain("API rate limit exceeded");
    });
  });
});

describe("JSONConsoleLogger", () => {
  let logger: JSONConsoleLogger;
  let emitter: WebAgentEventEmitter;
  let originalConsoleLog: typeof console.log;

  beforeEach(() => {
    // Capture console.log output
    originalConsoleLog = console.log;
    console.log = mockConsole.log;
    mockConsole.log.mockClear();

    logger = new JSONConsoleLogger();
    emitter = new WebAgentEventEmitter();
    logger.initialize(emitter);
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    logger.dispose();
  });

  describe("Logger interface", () => {
    it("should implement Logger interface", () => {
      expect(logger).toBeInstanceOf(JSONConsoleLogger);
      expect(typeof logger.initialize).toBe("function");
      expect(typeof logger.dispose).toBe("function");
    });

    it("should initialize with event emitter", () => {
      const newLogger = new JSONConsoleLogger();
      const newEmitter = new WebAgentEventEmitter();

      expect(() => {
        newLogger.initialize(newEmitter);
      }).not.toThrow();

      newLogger.dispose();
    });

    it("should dispose properly", () => {
      const newLogger = new JSONConsoleLogger();
      const newEmitter = new WebAgentEventEmitter();
      newLogger.initialize(newEmitter);

      expect(() => {
        newLogger.dispose();
      }).not.toThrow();

      // Should be safe to call dispose multiple times
      expect(() => {
        newLogger.dispose();
      }).not.toThrow();
    });
  });

  describe("JSON output", () => {
    it("should output valid JSON for all events", () => {
      const eventData: TaskStartEventData = {
        timestamp: Date.now(),
        iterationId: "test-1",
        task: "Test task",
        explanation: "Test explanation",
        plan: "Test plan",
        url: "https://example.com",
      };

      emitter.emitEvent({
        type: WebAgentEventType.TASK_STARTED,
        data: eventData,
      });

      expect(mockConsole.log).toHaveBeenCalledTimes(1);
      const output = mockConsole.log.mock.calls[0][0];

      // Should be valid JSON
      expect(() => JSON.parse(output)).not.toThrow();

      const parsed = JSON.parse(output);
      expect(parsed.event).toBe(WebAgentEventType.TASK_STARTED);
      expect(parsed.data.task).toBe("Test task");
      expect(parsed.data.explanation).toBe("Test explanation");
      expect(parsed.data.plan).toBe("Test plan");
      expect(parsed.data.url).toBe("https://example.com");
    });

    it("should output JSON for TASK_SETUP events", () => {
      const eventData: TaskSetupEventData = {
        timestamp: Date.now(),
        iterationId: "test-1",
        task: "Complete a web form",
        browserName: "playwright:firefox",
        guardrails: "test-guardrails",
        data: { key: "value" },
        pwEndpoint: "ws://localhost:9222",
        proxy: "http://proxy.example.com:8080",
        vision: true,
      };

      emitter.emitEvent({
        type: WebAgentEventType.TASK_SETUP,
        data: eventData,
      });

      expect(mockConsole.log).toHaveBeenCalledTimes(1);
      const output = mockConsole.log.mock.calls[0][0];

      const parsed = JSON.parse(output);
      expect(parsed.event).toBe(WebAgentEventType.TASK_SETUP);
      expect(parsed.data.task).toBe("Complete a web form");
      expect(parsed.data.browserName).toBe("playwright:firefox");
      expect(parsed.data.guardrails).toBe("test-guardrails");
      expect(parsed.data.data).toEqual({ key: "value" });
      expect(parsed.data.pwEndpoint).toBe("ws://localhost:9222");
      expect(parsed.data.proxy).toBe("http://proxy.example.com:8080");
      expect(parsed.data.vision).toBe(true);
    });

    it("should output JSON for AI_GENERATION events", () => {
      const eventData: AIGenerationEventData = {
        timestamp: Date.now(),
        iterationId: "test-1",
        prompt: "Generate a response",
        schema: { type: "object", properties: { action: { type: "string" } } },
        messages: [{ role: "user", content: "test message" }],
        object: { action: "click", ref: "button1" },
        finishReason: "stop",
        usage: {
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
        },
        temperature: 0.7,
        warnings: [],
      };

      emitter.emitEvent({
        type: WebAgentEventType.AI_GENERATION,
        data: eventData,
      });

      expect(mockConsole.log).toHaveBeenCalledTimes(1);
      const output = mockConsole.log.mock.calls[0][0];

      const parsed = JSON.parse(output);
      expect(parsed.event).toBe(WebAgentEventType.AI_GENERATION);
      expect(parsed.data.prompt).toBe("Generate a response");
      expect(parsed.data.object).toEqual({ action: "click", ref: "button1" });
      expect(parsed.data.usage.promptTokens).toBe(100);
      expect(parsed.data.usage.completionTokens).toBe(50);
      expect(parsed.data.temperature).toBe(0.7);
    });

    it("should output JSON for AI_GENERATION_ERROR events", () => {
      const eventData: AIGenerationErrorEventData = {
        timestamp: Date.now(),
        iterationId: "test-1",
        prompt: "Generate a response",
        error: "API rate limit exceeded",
        schema: { type: "object" },
        messages: [{ role: "user", content: "test" }],
      };

      emitter.emitEvent({
        type: WebAgentEventType.AI_GENERATION_ERROR,
        data: eventData,
      });

      expect(mockConsole.log).toHaveBeenCalledTimes(1);
      const output = mockConsole.log.mock.calls[0][0];

      const parsed = JSON.parse(output);
      expect(parsed.event).toBe(WebAgentEventType.AI_GENERATION_ERROR);
      expect(parsed.data.prompt).toBe("Generate a response");
      expect(parsed.data.error).toBe("API rate limit exceeded");
      expect(parsed.data.schema).toEqual({ type: "object" });
    });

    it("should handle all event types without errors", () => {
      // Test a few different event types to ensure universal handling
      const events = [
        {
          type: WebAgentEventType.BROWSER_NAVIGATED,
          data: {
            timestamp: Date.now(),
            iterationId: "test-1",
            title: "Test Page",
            url: "https://example.com",
          },
        },
        {
          type: WebAgentEventType.AGENT_OBSERVED,
          data: { timestamp: Date.now(), iterationId: "test-1", observation: "Found form element" },
        },
        {
          type: WebAgentEventType.BROWSER_ACTION_STARTED,
          data: { timestamp: Date.now(), iterationId: "test-1", action: "click", ref: "button1" },
        },
      ];

      events.forEach((event) => {
        emitter.emitEvent(event as any);
      });

      expect(mockConsole.log).toHaveBeenCalledTimes(3);

      // All outputs should be valid JSON
      mockConsole.log.mock.calls.forEach((call) => {
        const output = call[0];
        expect(() => JSON.parse(output)).not.toThrow();
        const parsed = JSON.parse(output);
        expect(parsed).toHaveProperty("event");
        expect(parsed).toHaveProperty("data");
      });
    });
  });

  describe("Event listener management", () => {
    it("should register listeners for all event types", () => {
      // Check that listeners are registered for various event types
      const eventTypes = [
        WebAgentEventType.TASK_SETUP,
        WebAgentEventType.TASK_STARTED,
        WebAgentEventType.AI_GENERATION,
        WebAgentEventType.AI_GENERATION_ERROR,
        WebAgentEventType.BROWSER_NAVIGATED,
        WebAgentEventType.AGENT_OBSERVED,
      ];

      eventTypes.forEach((eventType) => {
        expect(emitter.listenerCount(eventType)).toBeGreaterThan(0);
      });
    });

    it("should remove all listeners on dispose", () => {
      const eventTypes = [
        WebAgentEventType.TASK_SETUP,
        WebAgentEventType.TASK_STARTED,
        WebAgentEventType.AI_GENERATION,
        WebAgentEventType.AI_GENERATION_ERROR,
      ];

      // Verify listeners are present
      eventTypes.forEach((eventType) => {
        expect(emitter.listenerCount(eventType)).toBeGreaterThan(0);
      });

      logger.dispose();

      // Verify all listeners are removed
      eventTypes.forEach((eventType) => {
        expect(emitter.listenerCount(eventType)).toBe(0);
      });
    });
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ConsoleLogger, Logger } from "../src/loggers.js";
import { WebAgentEventEmitter, WebAgentEventType } from "../src/events.js";
import type {
  TaskStartEventData,
  TaskCompleteEventData,
  TaskValidationEventData,
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
    it("should handle TASK_START events", () => {
      const eventData: TaskStartEventData = {
        timestamp: Date.now(),
        task: "Complete a web form",
        explanation: "Fill out and submit a contact form on the website",
        plan: "1. Navigate to contact page\n2. Fill required fields\n3. Submit form",
        url: "https://example.com/contact",
      };

      emitter.emitEvent({
        type: WebAgentEventType.TASK_START,
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

    it("should handle TASK_COMPLETE events", () => {
      const eventData: TaskCompleteEventData = {
        timestamp: Date.now(),
        finalAnswer: "Form submitted successfully with confirmation ID: 12345",
      };

      emitter.emitEvent({
        type: WebAgentEventType.TASK_COMPLETE,
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
        finalAnswer: null,
      };

      emitter.emitEvent({
        type: WebAgentEventType.TASK_COMPLETE,
        data: eventData,
      });

      // Should not log anything for null final answer
      expect(mockConsole.log).not.toHaveBeenCalled();
    });

    it("should handle TASK_VALIDATION events (valid)", () => {
      const eventData: TaskValidationEventData = {
        timestamp: Date.now(),
        isValid: true,
        finalAnswer: "Task completed successfully",
      };

      emitter.emitEvent({
        type: WebAgentEventType.TASK_VALIDATION,
        data: eventData,
      });

      expect(mockConsole.log).toHaveBeenCalled();
      const allOutput = mockConsole.log.mock.calls.flat().join(" ");
      expect(allOutput).toContain("valid");
    });

    it("should handle TASK_VALIDATION events (invalid with feedback)", () => {
      const eventData: TaskValidationEventData = {
        timestamp: Date.now(),
        isValid: false,
        feedback: "Missing confirmation step in the process",
        finalAnswer: "Form submitted",
      };

      emitter.emitEvent({
        type: WebAgentEventType.TASK_VALIDATION,
        data: eventData,
      });

      expect(mockConsole.log).toHaveBeenCalled();
      const allOutput = mockConsole.log.mock.calls.flat().join(" ");
      expect(allOutput).toContain("improvement");
      expect(allOutput).toContain("Missing confirmation step");
    });
  });

  describe("Page events", () => {
    it("should handle PAGE_NAVIGATION events", () => {
      const eventData: PageNavigationEventData = {
        timestamp: Date.now(),
        title: "Contact Us - Example Company",
        url: "https://example.com/contact",
      };

      emitter.emitEvent({
        type: WebAgentEventType.PAGE_NAVIGATION,
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
        title: longTitle,
        url: "https://example.com/page",
      };

      emitter.emitEvent({
        type: WebAgentEventType.PAGE_NAVIGATION,
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
        currentStep: "Working on Step 1: Navigate to contact form",
      };

      emitter.emitEvent({
        type: WebAgentEventType.CURRENT_STEP,
        data: eventData,
      });

      expect(mockConsole.log).toHaveBeenCalled();
      const allOutput = mockConsole.log.mock.calls.flat().join(" ");
      expect(allOutput).toContain("Working on Step 1");
    });

    it("should handle OBSERVATION events", () => {
      const eventData: ObservationEventData = {
        timestamp: Date.now(),
        observation: "Found contact form with name, email, and message fields",
      };

      emitter.emitEvent({
        type: WebAgentEventType.OBSERVATION,
        data: eventData,
      });

      expect(mockConsole.log).toHaveBeenCalled();
      const allOutput = mockConsole.log.mock.calls.flat().join(" ");
      expect(allOutput).toContain("Found contact form");
    });

    it("should handle THOUGHT events", () => {
      const eventData: ThoughtEventData = {
        timestamp: Date.now(),
        thought: "I need to fill in all required fields before submitting",
      };

      emitter.emitEvent({
        type: WebAgentEventType.THOUGHT,
        data: eventData,
      });

      expect(mockConsole.log).toHaveBeenCalled();
      const allOutput = mockConsole.log.mock.calls.flat().join(" ");
      expect(allOutput).toContain("required fields");
    });

    it("should handle EXTRACTED_DATA events", () => {
      const eventData: ExtractedDataEventData = {
        timestamp: Date.now(),
        extractedData: "Confirmation ID: 12345, Status: Submitted",
      };

      emitter.emitEvent({
        type: WebAgentEventType.EXTRACTED_DATA,
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
        action: "fill",
        ref: "s1e23",
        value: "john@example.com",
      };

      emitter.emitEvent({
        type: WebAgentEventType.ACTION_EXECUTION,
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
        action: "back",
      };

      emitter.emitEvent({
        type: WebAgentEventType.ACTION_EXECUTION,
        data: eventData,
      });

      expect(mockConsole.log).toHaveBeenCalled();
      const allOutput = mockConsole.log.mock.calls.flat().join(" ");
      expect(allOutput).toContain("BACK");
    });

    it("should handle ACTION_RESULT events (success)", () => {
      const eventData: ActionResultEventData = {
        timestamp: Date.now(),
        success: true,
      };

      emitter.emitEvent({
        type: WebAgentEventType.ACTION_RESULT,
        data: eventData,
      });

      // Success events don't log anything
      expect(mockConsole.log).not.toHaveBeenCalled();
      expect(mockConsole.error).not.toHaveBeenCalled();
    });

    it("should handle ACTION_RESULT events (failure)", () => {
      const eventData: ActionResultEventData = {
        timestamp: Date.now(),
        success: false,
        error: "Element not found: s1e23",
      };

      emitter.emitEvent({
        type: WebAgentEventType.ACTION_RESULT,
        data: eventData,
      });

      expect(mockConsole.error).toHaveBeenCalled();
      const allOutput = mockConsole.error.mock.calls.flat().join(" ");
      expect(allOutput).toContain("Element not found");
    });

    it("should handle ACTION_RESULT events (failure without error message)", () => {
      const eventData: ActionResultEventData = {
        timestamp: Date.now(),
        success: false,
      };

      emitter.emitEvent({
        type: WebAgentEventType.ACTION_RESULT,
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
        originalSize: 10000,
        compressedSize: 3000,
        compressionPercent: 70,
      };

      emitter.emitEvent({
        type: WebAgentEventType.DEBUG_COMPRESSION,
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
        messages: [
          { role: "system", content: "You are a helpful assistant" },
          { role: "user", content: "Help me with this task" },
        ],
      };

      emitter.emitEvent({
        type: WebAgentEventType.DEBUG_MESSAGES,
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
        seconds: 1,
      };

      emitter.emitEvent({
        type: WebAgentEventType.WAITING,
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
        seconds: 5,
      };

      emitter.emitEvent({
        type: WebAgentEventType.WAITING,
        data: eventData,
      });

      expect(mockConsole.log).toHaveBeenCalled();
      const allOutput = mockConsole.log.mock.calls.flat().join(" ");
      expect(allOutput).toContain("5 seconds");
    });

    it("should handle NETWORK_WAITING events", () => {
      const eventData: NetworkWaitingEventData = {
        timestamp: Date.now(),
        action: "click",
      };

      emitter.emitEvent({
        type: WebAgentEventType.NETWORK_WAITING,
        data: eventData,
      });

      expect(mockConsole.log).toHaveBeenCalled();
      const allOutput = mockConsole.log.mock.calls.flat().join(" ");
      expect(allOutput).toContain("network activity");
    });

    it("should handle NETWORK_TIMEOUT events", () => {
      const eventData: NetworkTimeoutEventData = {
        timestamp: Date.now(),
        action: "submit",
      };

      emitter.emitEvent({
        type: WebAgentEventType.NETWORK_TIMEOUT,
        data: eventData,
      });

      expect(mockConsole.log).toHaveBeenCalled();
      const allOutput = mockConsole.log.mock.calls.flat().join(" ");
      expect(allOutput).toContain("timed out");
    });
  });

  describe("Event listener management", () => {
    it("should remove all listeners on dispose", () => {
      const eventCounts = [
        WebAgentEventType.TASK_START,
        WebAgentEventType.TASK_COMPLETE,
        WebAgentEventType.PAGE_NAVIGATION,
        WebAgentEventType.CURRENT_STEP,
        WebAgentEventType.OBSERVATION,
        WebAgentEventType.THOUGHT,
        WebAgentEventType.EXTRACTED_DATA,
        WebAgentEventType.ACTION_EXECUTION,
        WebAgentEventType.ACTION_RESULT,
        WebAgentEventType.DEBUG_COMPRESSION,
        WebAgentEventType.DEBUG_MESSAGES,
        WebAgentEventType.WAITING,
        WebAgentEventType.NETWORK_WAITING,
        WebAgentEventType.NETWORK_TIMEOUT,
        WebAgentEventType.TASK_VALIDATION,
      ].map((eventType) => ({
        eventType,
        count: emitter.listenerCount(eventType),
      }));

      // All events should have listeners
      eventCounts.forEach(({ eventType, count }) => {
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
        task: "Test task",
        explanation: "Test explanation",
        plan: "Test plan",
        url: "https://example.com",
      };

      emitter.emitEvent({
        type: WebAgentEventType.TASK_START,
        data: eventData,
      });

      // Both loggers should handle the event
      expect(mockConsole.log).toHaveBeenCalled();

      logger2.dispose();
    });
  });
});

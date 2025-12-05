import { beforeEach, describe, it, expect, vi, type MockedFunction } from "vitest";
import { render, screen } from "@testing-library/react";
import ChatView, {
  shouldDisplayError,
  formatBrowserAction,
} from "../../../src/components/sidepanel/ChatView";
import { theme } from "../../../src/theme";
import browser from "webextension-polyfill";
import type { RealtimeEventMessage } from "../../../src/types/browser";

// Mock the browser API
vi.mock("webextension-polyfill", () => ({
  default: {
    runtime: {
      onMessage: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
      sendMessage: vi.fn(),
    },
    tabs: {
      query: vi.fn(),
    },
  },
}));

// Mock the stores
vi.mock("../../../src/stores/eventStore", () => ({
  useEvents: () => ({
    addEvent: vi.fn(),
    clearEvents: vi.fn(),
  }),
}));

vi.mock("../../../src/stores/settingsStore", () => ({
  useSettings: () => ({
    settings: {
      apiKey: "test-api-key",
      apiEndpoint: "https://api.test.com",
      model: "test-model",
    },
  }),
}));

// Mock the useSystemTheme hook
vi.mock("../../../src/useSystemTheme", () => ({
  useSystemTheme: () => ({
    theme: theme.light,
  }),
}));

// Mock useChat hook
const mockMessages: any[] = [];
const mockAddMessage = vi.fn();
const mockStartTask = vi.fn();
const mockEndTask = vi.fn();
let mockCurrentTaskId: string | null = null;

vi.mock("../../../src/useChat", () => ({
  useChat: () => ({
    messages: mockMessages,
    addMessage: mockAddMessage,
    startTask: mockStartTask,
    endTask: mockEndTask,
    messagesEndRef: { current: null },
    scrollContainerRef: { current: null },
    handleScroll: vi.fn(),
    get currentTaskId() {
      return mockCurrentTaskId;
    },
    isExecuting: false,
    setExecutionState: vi.fn(),
    clearMessages: vi.fn(),
  }),
}));

// Helper to create typed realtime event messages for tests
function createRealtimeMessage(
  eventType: string,
  data: Record<string, unknown>,
): RealtimeEventMessage {
  return {
    type: "realtimeEvent",
    event: {
      type: eventType,
      data: data,
      timestamp: Date.now(),
    },
  };
}

describe("ChatView", () => {
  const defaultProps = {
    currentTab: {
      id: 1,
      url: "https://example.com",
      index: 0,
      pinned: false,
      active: true,
      highlighted: false,
      incognito: false,
    },
    onOpenSettings: vi.fn(),
  };

  beforeEach(() => {
    // Clear mock messages before each test
    mockMessages.length = 0;
    mockCurrentTaskId = null;
    vi.clearAllMocks();
  });

  it("renders initial welcome message", () => {
    render(<ChatView {...defaultProps} />);

    expect(screen.getByText("Welcome to Spark!")).toBeInTheDocument();
    expect(screen.getByText(/I can help you automate tasks/)).toBeInTheDocument();
  });

  describe("Message Ordering", () => {
    it("renders messages in chronological order based on timestamps", () => {
      // Arrange: Create messages with different timestamps
      const now = new Date();
      const messages = [
        {
          id: "msg1",
          type: "user",
          content: "First user message",
          timestamp: new Date(now.getTime() - 4000), // 4 seconds ago
        },
        {
          id: "msg2",
          type: "plan",
          content: "Plan for first request",
          taskId: "task1",
          timestamp: new Date(now.getTime() - 3000), // 3 seconds ago
        },
        {
          id: "msg3",
          type: "result",
          content: "Result for first request",
          taskId: "task1",
          timestamp: new Date(now.getTime() - 2000), // 2 seconds ago
        },
        {
          id: "msg4",
          type: "user",
          content: "Second user message",
          timestamp: new Date(now.getTime() - 1000), // 1 second ago
        },
        {
          id: "msg5",
          type: "result",
          content: "Result for second request",
          taskId: "task2",
          timestamp: now, // now
        },
      ];

      // Update the mock to return our messages
      mockMessages.push(...messages);

      // Act: Render the component
      render(<ChatView {...defaultProps} />);

      // Assert: Check that messages appear in the correct order in the DOM
      const allMessages = screen.getAllByRole("listitem");

      // We expect to see messages in this order in the DOM:
      // 1. First user message
      // 2. Task bubble containing plan and result for first request
      // 3. Second user message
      // 4. Task bubble containing result for second request

      // Get the text content of all message elements
      const messageTexts: string[] = [];
      allMessages.forEach((el) => {
        const text = el.textContent || "";
        if (text && !text.includes("Welcome to Spark")) {
          messageTexts.push(text);
        }
      });

      // Check that "Second user message" appears AFTER "First user message" and its response
      const firstUserIndex = messageTexts.findIndex((text) => text.includes("First user message"));
      const firstResultIndex = messageTexts.findIndex((text) =>
        text.includes("Result for first request"),
      );
      const secondUserIndex = messageTexts.findIndex((text) =>
        text.includes("Second user message"),
      );
      const secondResultIndex = messageTexts.findIndex((text) =>
        text.includes("Result for second request"),
      );

      expect(firstUserIndex).toBeGreaterThanOrEqual(0);
      expect(firstResultIndex).toBeGreaterThan(firstUserIndex);
      expect(secondUserIndex).toBeGreaterThan(firstResultIndex);
      expect(secondResultIndex).toBeGreaterThan(secondUserIndex);
    });

    it("renders task response immediately after its corresponding user message", () => {
      // Arrange: Create a user message followed by task messages
      const now = new Date();
      const messages = [
        {
          id: "user1",
          type: "user",
          content: "Please help me with this task",
          timestamp: new Date(now.getTime() - 3000),
        },
        {
          id: "plan1",
          type: "plan",
          content: "I'll help you with that task",
          taskId: "task1",
          timestamp: new Date(now.getTime() - 2500),
        },
        {
          id: "result1",
          type: "result",
          content: "Task completed successfully",
          taskId: "task1",
          timestamp: new Date(now.getTime() - 1000),
        },
      ];

      mockMessages.push(...messages);

      // Act: Render the component
      render(<ChatView {...defaultProps} />);

      // Assert: Check that task bubble appears right after user message
      const allElements = screen.getAllByRole("listitem");

      let userMessageFound = false;
      let taskBubbleFound = false;
      let elementsBetween = 0;

      allElements.forEach((el) => {
        const text = el.textContent || "";

        if (text.includes("Please help me with this task")) {
          userMessageFound = true;
          elementsBetween = 0;
        } else if (userMessageFound && !taskBubbleFound) {
          if (
            text.includes("Task completed successfully") ||
            text.includes("I'll help you with that task")
          ) {
            taskBubbleFound = true;
          } else if (text && !text.includes("Welcome to Spark")) {
            elementsBetween++;
          }
        }
      });

      // The task bubble should appear immediately after the user message (no elements between)
      expect(userMessageFound).toBe(true);
      expect(taskBubbleFound).toBe(true);
      expect(elementsBetween).toBe(0);
    });

    it("maintains correct order with multiple user requests and responses", () => {
      // Arrange: This reproduces the actual bug scenario
      const now = new Date();
      const messages = [
        // First user request
        {
          id: "user1",
          type: "user",
          content: "First request from user",
          timestamp: new Date(now.getTime() - 5000),
        },
        // First task messages
        {
          id: "plan1",
          type: "plan",
          content: "Planning first task",
          taskId: "task1",
          timestamp: new Date(now.getTime() - 4500),
        },
        {
          id: "result1",
          type: "result",
          content: "First task completed",
          taskId: "task1",
          timestamp: new Date(now.getTime() - 3000),
        },
        // Second user request (this is where the bug would occur)
        {
          id: "user2",
          type: "user",
          content: "Second request from user",
          timestamp: new Date(now.getTime() - 2000),
        },
        // Second task messages
        {
          id: "plan2",
          type: "plan",
          content: "Planning second task",
          taskId: "task2",
          timestamp: new Date(now.getTime() - 1500),
        },
        {
          id: "result2",
          type: "result",
          content: "Second task completed",
          taskId: "task2",
          timestamp: new Date(now.getTime() - 500),
        },
      ];

      mockMessages.push(...messages);

      // Act: Render the component
      render(<ChatView {...defaultProps} />);

      // Assert: Check exact order of all messages
      const allElements = screen.getAllByRole("listitem");

      const renderedTexts: string[] = [];
      allElements.forEach((el) => {
        const text = el.textContent || "";
        if (text && !text.includes("Welcome to Spark")) {
          renderedTexts.push(text);
        }
      });

      // Find indices of key messages
      const firstUserIdx = renderedTexts.findIndex((t) => t.includes("First request from user"));
      const firstTaskIdx = renderedTexts.findIndex((t) => t.includes("First task completed"));
      const secondUserIdx = renderedTexts.findIndex((t) => t.includes("Second request from user"));
      const secondTaskIdx = renderedTexts.findIndex((t) => t.includes("Second task completed"));

      // This is the critical assertion - the second user message must come AFTER the first task
      expect(firstUserIdx).toBeGreaterThanOrEqual(0);
      expect(firstTaskIdx).toBeGreaterThan(firstUserIdx);
      expect(secondUserIdx).toBeGreaterThan(firstTaskIdx); // This would fail with the original bug
      expect(secondTaskIdx).toBeGreaterThan(secondUserIdx);

      // Also verify the exact order
      expect(firstUserIdx).toBeLessThan(firstTaskIdx);
      expect(firstTaskIdx).toBeLessThan(secondUserIdx);
      expect(secondUserIdx).toBeLessThan(secondTaskIdx);
    });
  });

  describe("Edge Cases - System Messages and Orphaned Tasks", () => {
    it("should handle system messages without taskIds", () => {
      // Arrange: Mix of user, system, and task messages
      const now = new Date();
      const messages = [
        {
          id: "user1",
          type: "user",
          content: "User request",
          timestamp: new Date(now.getTime() - 4000),
        },
        {
          id: "sys1",
          type: "system",
          content: "System notification",
          timestamp: new Date(now.getTime() - 3000),
        },
        {
          id: "result1",
          type: "result",
          content: "Task result",
          taskId: "task1",
          timestamp: new Date(now.getTime() - 2000),
        },
      ];

      mockMessages.push(...messages);

      // Act: Render the component
      render(<ChatView {...defaultProps} />);

      // Assert: System message should appear in chronological position
      const allElements = screen.getAllByRole("listitem");
      const renderedTexts: string[] = [];
      allElements.forEach((el) => {
        const text = el.textContent || "";
        if (text && !text.includes("Welcome to Spark")) {
          renderedTexts.push(text);
        }
      });

      const userIdx = renderedTexts.findIndex((t) => t.includes("User request"));
      const sysIdx = renderedTexts.findIndex((t) => t.includes("System notification"));
      const taskIdx = renderedTexts.findIndex((t) => t.includes("Task result"));

      expect(userIdx).toBeGreaterThanOrEqual(0);
      expect(sysIdx).toBeGreaterThan(userIdx);
      expect(taskIdx).toBeGreaterThan(sysIdx);
    });

    it("should handle orphaned task messages (task without user message)", () => {
      // Arrange: Task messages without a preceding user message
      const now = new Date();
      const messages = [
        {
          id: "plan1",
          type: "plan",
          content: "Orphaned plan",
          taskId: "orphan-task",
          timestamp: new Date(now.getTime() - 2000),
        },
        {
          id: "result1",
          type: "result",
          content: "Orphaned result",
          taskId: "orphan-task",
          timestamp: new Date(now.getTime() - 1000),
        },
        {
          id: "user1",
          type: "user",
          content: "User message after orphaned task",
          timestamp: now,
        },
      ];

      mockMessages.push(...messages);

      // Act: Render the component
      render(<ChatView {...defaultProps} />);

      // Assert: Orphaned task should still render and user message should come after
      const allElements = screen.getAllByRole("listitem");
      const renderedTexts: string[] = [];
      allElements.forEach((el) => {
        const text = el.textContent || "";
        if (text && !text.includes("Welcome to Spark")) {
          renderedTexts.push(text);
        }
      });

      const orphanIdx = renderedTexts.findIndex((t) => t.includes("Orphaned"));
      const userIdx = renderedTexts.findIndex((t) => t.includes("User message after"));

      expect(orphanIdx).toBeGreaterThanOrEqual(0);
      expect(userIdx).toBeGreaterThan(orphanIdx);
    });

    it("should handle mixed message types in correct chronological order", () => {
      // Arrange: Complex mix of all message types
      const now = new Date();
      const messages = [
        {
          id: "sys1",
          type: "system",
          content: "Welcome message",
          timestamp: new Date(now.getTime() - 6000),
        },
        {
          id: "user1",
          type: "user",
          content: "First user request",
          timestamp: new Date(now.getTime() - 5000),
        },
        {
          id: "plan1",
          type: "plan",
          content: "Planning task",
          taskId: "task1",
          timestamp: new Date(now.getTime() - 4500),
        },
        {
          id: "sys2",
          type: "system",
          content: "API key required",
          timestamp: new Date(now.getTime() - 3000),
        },
        {
          id: "user2",
          type: "user",
          content: "Second user request",
          timestamp: new Date(now.getTime() - 2000),
        },
        {
          id: "error1",
          type: "error",
          content: "Task failed",
          taskId: "task2",
          timestamp: new Date(now.getTime() - 1000),
        },
      ];

      mockMessages.push(...messages);

      // Act: Render the component
      render(<ChatView {...defaultProps} />);

      // Assert: All messages should appear in chronological order
      const allElements = screen.getAllByRole("listitem");
      const renderedTexts: string[] = [];
      allElements.forEach((el) => {
        const text = el.textContent || "";
        if (text && !text.includes("Welcome to Spark!")) {
          // Exclude the static welcome
          renderedTexts.push(text);
        }
      });

      // Check key messages are in correct order
      const welcomeIdx = renderedTexts.findIndex((t) => t.includes("Welcome message"));
      const firstUserIdx = renderedTexts.findIndex((t) => t.includes("First user request"));
      const apiKeyIdx = renderedTexts.findIndex((t) => t.includes("API key required"));
      const secondUserIdx = renderedTexts.findIndex((t) => t.includes("Second user request"));

      // All messages should be present and in chronological order
      expect(welcomeIdx).toBeGreaterThanOrEqual(0);
      expect(firstUserIdx).toBeGreaterThan(welcomeIdx);
      expect(apiKeyIdx).toBeGreaterThan(firstUserIdx);
      expect(secondUserIdx).toBeGreaterThan(apiKeyIdx);
    });
  });

  describe("Error Filtering", () => {
    describe("shouldDisplayError", () => {
      it("should hide validation errors during retries (retryCount < 3)", () => {
        // Arrange: Test validation error with low retry count
        const event = {
          type: "task:validation_error" as const,
          data: {
            errors: ["Validation failed"],
            retryCount: 1,
          },
          timestamp: Date.now(),
        };

        // Act
        const result = shouldDisplayError(event);

        // Assert: Should return false (hide from user)
        expect(result).toBe(false);
      });

      it("should show validation errors when max retries exceeded", () => {
        // Arrange: Test validation error with high retry count
        const event = {
          type: "task:validation_error" as const,
          data: {
            errors: ["Validation failed"],
            retryCount: 3,
          },
          timestamp: Date.now(),
        };

        // Act
        const result = shouldDisplayError(event);

        // Assert: Should return true (show to user)
        expect(result).toBe(true);
      });

      it("should hide recoverable browser action errors", () => {
        // Arrange: Test browser action error marked as recoverable
        const event = {
          type: "browser:action:completed" as const,
          data: {
            success: false,
            error: "Element not found",
            isRecoverable: true,
          },
          timestamp: Date.now(),
        };

        // Act
        const result = shouldDisplayError(event);

        // Assert: Should return false (hide from user)
        expect(result).toBe(false);
      });

      it("should show non-recoverable browser action errors", () => {
        // Arrange: Test browser action error not marked as recoverable
        const event = {
          type: "browser:action:completed" as const,
          data: {
            success: false,
            error: "Fatal browser error",
            isRecoverable: false,
          },
          timestamp: Date.now(),
        };

        // Act
        const result = shouldDisplayError(event);

        // Assert: Should return true (show to user)
        expect(result).toBe(true);
      });

      it("should show all other event types by default", () => {
        // Arrange: Test unknown event type
        const event = {
          type: "unknown:event",
          data: {
            error: "Some error",
          },
          timestamp: Date.now(),
        };

        // Act
        const result = shouldDisplayError(event);

        // Assert: Should return true (show to user by default)
        expect(result).toBe(true);
      });

      it("should hide AI generation errors marked as tool errors", () => {
        // Arrange: Test AI error that is a tool error (agent will handle)
        const event = {
          type: "ai:generation:error" as const,
          data: {
            error: "You must use exactly one tool",
            isToolError: true,
          },
          timestamp: Date.now(),
        };

        // Act
        const result = shouldDisplayError(event);

        // Assert: Should return false (hide from user)
        expect(result).toBe(false);
      });

      it("should show AI generation errors that are not tool errors", () => {
        // Arrange: Test AI error that is not a tool error (fatal)
        const event = {
          type: "ai:generation:error" as const,
          data: {
            error: "API key invalid",
            isToolError: false,
          },
          timestamp: Date.now(),
        };

        // Act
        const result = shouldDisplayError(event);

        // Assert: Should return true (show to user)
        expect(result).toBe(true);
      });

      it("should show AI generation errors without isToolError field", () => {
        // Arrange: Test AI error without isToolError field (assume fatal)
        const event = {
          type: "ai:generation:error" as const,
          data: {
            error: "Unknown error",
          },
          timestamp: Date.now(),
        };

        // Act
        const result = shouldDisplayError(event);

        // Assert: Should return true (show to user by default)
        expect(result).toBe(true);
      });
    });

    describe("Integration: Error filtering in event handlers", () => {
      beforeEach(() => {
        vi.clearAllMocks();
      });

      it("should not add error message for validation errors during retries", () => {
        // Arrange: Render component to register the handler
        render(<ChatView {...defaultProps} />);

        // Get the registered handler from the mock
        const mockAddListener = browser.runtime.onMessage.addListener as MockedFunction<
          typeof browser.runtime.onMessage.addListener
        >;
        expect(mockAddListener).toHaveBeenCalled();
        const registeredHandler = mockAddListener.mock.calls[
          mockAddListener.mock.calls.length - 1
        ][0] as (message: unknown) => void;

        // Act: Simulate validation error event with retryCount < 3
        const message = createRealtimeMessage("task:validation_error", {
          errors: ["Validation failed"],
          retryCount: 1,
        });
        registeredHandler(message);

        // Assert: addMessage should NOT have been called for error
        expect(mockAddMessage).not.toHaveBeenCalledWith(
          "error",
          expect.stringContaining("Validation Error"),
          expect.anything(),
        );
      });

      it("should add error message for validation errors when max retries exceeded", () => {
        // Arrange: Set currentTaskId before rendering
        mockCurrentTaskId = "task-123";
        render(<ChatView {...defaultProps} />);

        // Get the registered handler
        const mockAddListener = browser.runtime.onMessage.addListener as MockedFunction<
          typeof browser.runtime.onMessage.addListener
        >;
        const registeredHandler = mockAddListener.mock.calls[
          mockAddListener.mock.calls.length - 1
        ][0] as (message: unknown) => void;

        // Act: Simulate validation error with retryCount >= 3
        const message = createRealtimeMessage("task:validation_error", {
          errors: ["Max retries exceeded"],
          retryCount: 3,
        });
        registeredHandler(message);

        // Assert: addMessage SHOULD have been called
        expect(mockAddMessage).toHaveBeenCalledWith(
          "error",
          "Validation Error: Max retries exceeded",
          "task-123",
        );
      });

      it("should not add error message for recoverable browser action errors", () => {
        // Arrange
        render(<ChatView {...defaultProps} />);

        // Get the registered handler
        const mockAddListener = browser.runtime.onMessage.addListener as MockedFunction<
          typeof browser.runtime.onMessage.addListener
        >;
        const registeredHandler = mockAddListener.mock.calls[
          mockAddListener.mock.calls.length - 1
        ][0] as (message: unknown) => void;

        // Act: Simulate recoverable browser error
        const message = createRealtimeMessage("browser:action:completed", {
          success: false,
          error: "Element not found",
          isRecoverable: true,
        });
        registeredHandler(message);

        // Assert: addMessage should NOT have been called
        expect(mockAddMessage).not.toHaveBeenCalledWith(
          "error",
          expect.stringContaining("Action Failed"),
          expect.anything(),
        );
      });

      it("should add error message for non-recoverable browser action errors", () => {
        // Arrange: Set currentTaskId before rendering
        mockCurrentTaskId = "task-456";
        render(<ChatView {...defaultProps} />);

        // Get the registered handler
        const mockAddListener = browser.runtime.onMessage.addListener as MockedFunction<
          typeof browser.runtime.onMessage.addListener
        >;
        const registeredHandler = mockAddListener.mock.calls[
          mockAddListener.mock.calls.length - 1
        ][0] as (message: unknown) => void;

        // Act: Simulate non-recoverable browser error
        const message = createRealtimeMessage("browser:action:completed", {
          success: false,
          error: "Fatal browser crash",
          isRecoverable: false,
        });
        registeredHandler(message);

        // Assert: addMessage SHOULD have been called
        expect(mockAddMessage).toHaveBeenCalledWith(
          "error",
          "Action Failed: Fatal browser crash",
          "task-456",
        );
      });

      it("should not add error message for AI tool errors", () => {
        // Arrange: Set currentTaskId before rendering
        mockCurrentTaskId = "task-789";
        render(<ChatView {...defaultProps} />);

        // Get the registered handler
        const mockAddListener = browser.runtime.onMessage.addListener as MockedFunction<
          typeof browser.runtime.onMessage.addListener
        >;
        const registeredHandler = mockAddListener.mock.calls[
          mockAddListener.mock.calls.length - 1
        ][0] as (message: unknown) => void;

        // Act: Simulate AI generation error marked as tool error
        const message = createRealtimeMessage("ai:generation:error", {
          error: "You must use exactly one tool",
          isToolError: true,
        });
        registeredHandler(message);

        // Assert: addMessage should NOT have been called
        expect(mockAddMessage).not.toHaveBeenCalledWith(
          "error",
          expect.stringContaining("AI Error"),
          expect.anything(),
        );
      });

      it("should add error message for AI errors that are not tool errors", () => {
        // Arrange: Set currentTaskId before rendering
        mockCurrentTaskId = "task-999";
        render(<ChatView {...defaultProps} />);

        // Get the registered handler
        const mockAddListener = browser.runtime.onMessage.addListener as MockedFunction<
          typeof browser.runtime.onMessage.addListener
        >;
        const registeredHandler = mockAddListener.mock.calls[
          mockAddListener.mock.calls.length - 1
        ][0] as (message: unknown) => void;

        // Act: Simulate AI generation error not marked as tool error
        const message = createRealtimeMessage("ai:generation:error", {
          error: "API key invalid",
          isToolError: false,
        });
        registeredHandler(message);

        // Assert: addMessage SHOULD have been called
        expect(mockAddMessage).toHaveBeenCalledWith(
          "error",
          "AI Error: API key invalid",
          "task-999",
        );
      });
    });
  });

  describe("formatBrowserAction", () => {
    it("formats click action without exposing ref", () => {
      const result = formatBrowserAction({ action: "click", ref: "Submit button" });
      expect(result).toBe("Clicking");
    });

    it("formats click action without ref", () => {
      const result = formatBrowserAction({ action: "click" });
      expect(result).toBe("Clicking");
    });

    it("formats fill action without exposing ref", () => {
      const result = formatBrowserAction({ action: "fill", ref: "Email input" });
      expect(result).toBe("Filling");
    });

    it("formats goto action with hostname", () => {
      const result = formatBrowserAction({ action: "goto", value: "https://example.com" });
      expect(result).toBe("Navigating to example.com");
    });

    it("formats select action with value only", () => {
      const result = formatBrowserAction({ action: "select", ref: "Country", value: "USA" });
      expect(result).toBe("Selecting 'USA'");
    });

    it("formats select action without value", () => {
      const result = formatBrowserAction({ action: "select", ref: "Country" });
      expect(result).toBe("Selecting");
    });

    it("returns empty string for unknown actions", () => {
      const result = formatBrowserAction({ action: "someNewAction" });
      expect(result).toBe("");
    });
  });

  describe("browser:action_started event handling", () => {
    it("should add status message when browser:action_started event received", () => {
      // Arrange: Set currentTaskId before rendering
      mockCurrentTaskId = "task-browser-action";
      render(<ChatView {...defaultProps} />);

      // Get the registered handler
      const mockAddListener = browser.runtime.onMessage.addListener as MockedFunction<
        typeof browser.runtime.onMessage.addListener
      >;
      const registeredHandler = mockAddListener.mock.calls[
        mockAddListener.mock.calls.length - 1
      ][0] as (message: unknown) => void;

      // Act: Simulate browser:action_started event
      const message = createRealtimeMessage("browser:action_started", {
        action: "click",
        ref: "Submit button",
      });
      registeredHandler(message);

      // Assert: addMessage should have been called with formatted status (ref not exposed)
      expect(mockAddMessage).toHaveBeenCalledWith("status", "Clicking", "task-browser-action");
    });

    it("should not add status message for unknown actions", () => {
      // Arrange: Set currentTaskId before rendering
      mockCurrentTaskId = "task-unknown-action";
      render(<ChatView {...defaultProps} />);

      // Get the registered handler
      const mockAddListener = browser.runtime.onMessage.addListener as MockedFunction<
        typeof browser.runtime.onMessage.addListener
      >;
      const registeredHandler = mockAddListener.mock.calls[
        mockAddListener.mock.calls.length - 1
      ][0] as (message: unknown) => void;

      // Act: Simulate browser:action_started event with unknown action
      const message = createRealtimeMessage("browser:action_started", {
        action: "someUnknownAction",
      });
      registeredHandler(message);

      // Assert: addMessage should NOT have been called (empty string is not displayed)
      expect(mockAddMessage).not.toHaveBeenCalledWith(
        "status",
        expect.anything(),
        "task-unknown-action",
      );
    });
  });

  describe("Markdown Rendering", () => {
    it("renders double newlines as separate paragraphs with spacing", () => {
      // Arrange: Create a message with double newlines
      const now = new Date();
      const messages = [
        {
          id: "msg1",
          type: "result",
          content: "Line 1\n\nLine 2",
          taskId: "task1",
          timestamp: now,
        },
      ];

      mockMessages.push(...messages);

      // Act: Render the component
      render(<ChatView {...defaultProps} />);

      // Assert: Should have two separate <p> elements
      const paragraphs = screen.getAllByText(/Line \d/);
      expect(paragraphs).toHaveLength(2);

      // Find the parent container of the paragraphs
      const firstP = paragraphs[0].closest("p");
      const secondP = paragraphs[1].closest("p");

      expect(firstP).toBeInTheDocument();
      expect(secondP).toBeInTheDocument();
      expect(firstP).not.toBe(secondP); // They should be different elements

      // Verify the markdown-content class is present (which provides spacing via CSS)
      const markdownContainer = firstP?.closest(".markdown-content");
      expect(markdownContainer).toBeInTheDocument();
    });

    it("renders markdown lists correctly", () => {
      // Arrange: Create messages with both bullet and numbered lists
      const now = new Date();
      const messages = [
        {
          id: "msg1",
          type: "result",
          content: "Items:\n- Item 1\n- Item 2\n- Item 3",
          taskId: "task1",
          timestamp: new Date(now.getTime() - 1000),
        },
        {
          id: "msg2",
          type: "result",
          content: "Steps:\n1. First\n2. Second\n3. Third",
          taskId: "task2",
          timestamp: now,
        },
      ];

      mockMessages.push(...messages);

      // Act: Render the component
      render(<ChatView {...defaultProps} />);

      // Assert: Should have bullet list (ul) with list items
      const bulletLists = document.querySelectorAll("ul");
      expect(bulletLists.length).toBeGreaterThan(0);

      const bulletItems = document.querySelectorAll("ul li");
      expect(bulletItems.length).toBeGreaterThanOrEqual(3);

      // Assert: Should have numbered list (ol) with list items
      const numberedLists = document.querySelectorAll("ol");
      expect(numberedLists.length).toBeGreaterThan(0);

      const numberedItems = document.querySelectorAll("ol li");
      expect(numberedItems.length).toBeGreaterThanOrEqual(3);

      // Verify list items contain expected text
      expect(document.body.textContent).toContain("Item 1");
      expect(document.body.textContent).toContain("First");
    });

    it("applies theme classes to markdown content", () => {
      // Arrange: Create a message with markdown content
      const now = new Date();
      const messages = [
        {
          id: "msg1",
          type: "result",
          content: "Test content",
          taskId: "task1",
          timestamp: now,
        },
      ];

      mockMessages.push(...messages);

      // Act: Render the component
      render(<ChatView {...defaultProps} />);

      // Assert: markdown-content class should be present
      const markdownContainer = document.querySelector(".markdown-content");
      expect(markdownContainer).toBeInTheDocument();

      // Verify the content is rendered
      expect(markdownContainer?.textContent).toContain("Test content");
    });
  });
});

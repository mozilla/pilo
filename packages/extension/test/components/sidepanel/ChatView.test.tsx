import { beforeEach, describe, it, expect, vi, type MockedFunction } from "vitest";
import { render, screen } from "@testing-library/react";
import ChatView, {
  shouldDisplayError,
  formatBrowserAction,
} from "../../../src/ui/components/sidepanel/ChatView";
import browser from "webextension-polyfill";
import type { RealtimeEventMessage } from "../../../src/shared/types/browser";

type MessageListenerCallback = (message: RealtimeEventMessage) => void;

function getMockMessageListener(): MessageListenerCallback {
  return (
    browser.runtime.onMessage.addListener as MockedFunction<
      (callback: MessageListenerCallback) => void
    >
  ).mock.calls[0][0];
}

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
vi.mock("../../../src/ui/stores/eventStore", () => ({
  useEvents: () => ({
    addEvent: vi.fn(),
    clearEvents: vi.fn(),
  }),
}));

vi.mock("../../../src/ui/stores/settingsStore", () => ({
  useSettings: () => ({
    settings: {
      apiKey: "test-api-key",
      apiEndpoint: "https://api.test.com",
      model: "test-model",
      provider: "openai",
    },
  }),
}));

// Mock useConversation hook (replaces old useChat mock)
const mockMessages: any[] = [];
const mockAddMessage = vi.fn();
const mockStartTask = vi.fn();
const mockEndTask = vi.fn();
const mockClearMessages = vi.fn();
const mockSetExecutionState = vi.fn();
let mockCurrentTaskId: string | null = null;
// Separate store state to simulate race condition where store is updated but React hasn't re-rendered
let mockStoreCurrentTaskId: string | null = null;

vi.mock("../../../src/ui/hooks/useConversation", () => ({
  useConversation: () => ({
    messages: mockMessages,
    addMessage: mockAddMessage,
    startTask: mockStartTask,
    endTask: mockEndTask,
    clearMessages: mockClearMessages,
    messagesEndRef: { current: null },
    scrollContainerRef: { current: null },
    handleScroll: vi.fn(),
    get currentTaskId() {
      return mockCurrentTaskId;
    },
    isExecuting: false,
    setExecutionState: mockSetExecutionState,
    currentTabId: 1,
    conversation: null,
  }),
}));

// Mock useAutoScroll hook
vi.mock("../../../src/ui/hooks/useAutoScroll", () => ({
  useAutoScroll: () => ({
    messagesEndRef: { current: null },
    scrollContainerRef: { current: null },
    handleScroll: vi.fn(),
    scrollToBottom: vi.fn(),
    scrollToBottomOnNewMessage: vi.fn(),
    isAtBottom: true,
  }),
}));

// Mock conversationStore with getState() for synchronous access
vi.mock("../../../src/shared/conversationStore", () => ({
  useConversationStore: Object.assign(
    // The hook itself (for React components)
    () => ({}),
    // Static getState() method for synchronous access outside React
    {
      getState: () => ({
        getConversation: (tabId: number) => ({
          currentTaskId: mockStoreCurrentTaskId,
          tabId,
          messages: [],
          isExecuting: false,
        }),
      }),
    },
  ),
  useTabConversation: () => null,
}));

// Helper to create typed realtime event messages for tests
function createRealtimeMessage(
  eventType: string,
  data: Record<string, unknown>,
  tabId: number = 1,
): RealtimeEventMessage {
  return {
    type: "realtimeEvent",
    tabId,
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
    mockStoreCurrentTaskId = null;
    vi.clearAllMocks();
  });

  it("renders initial welcome state with logo and description", () => {
    render(<ChatView {...defaultProps} />);

    // New empty state: "What can I help with?" heading
    expect(screen.getByText("What can I help with?")).toBeInTheDocument();
    // Description text
    expect(screen.getByText(/Enter an instruction/)).toBeInTheDocument();
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

      // Assert: Verify messages appear in the correct order in the DOM.
      // New design uses divs instead of <li> elements, so query by text content order.
      const firstUserEl = screen.getByText("First user message");
      const firstResultEl = screen.getByText(/Result for first request/);
      const secondUserEl = screen.getByText("Second user message");
      const secondResultEl = screen.getByText(/Result for second request/);

      // Use DOM position comparison
      const pos = (el: HTMLElement) =>
        document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT).nextNode()
          ? Array.from(document.body.querySelectorAll("*")).indexOf(el)
          : 0;

      expect(pos(firstUserEl)).toBeLessThan(pos(firstResultEl));
      expect(pos(firstResultEl)).toBeLessThan(pos(secondUserEl));
      expect(pos(secondUserEl)).toBeLessThan(pos(secondResultEl));
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

      // Assert: Both user message and task content should be present
      expect(screen.getByText("Please help me with this task")).toBeInTheDocument();
      // Task result and plan are in the TaskBubble
      expect(screen.getByText(/Task completed successfully/)).toBeInTheDocument();
      expect(screen.getByText(/I'll help you with that task/)).toBeInTheDocument();
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

      // Assert: All content is present in the document
      expect(screen.getByText("First request from user")).toBeInTheDocument();
      expect(screen.getByText(/First task completed/)).toBeInTheDocument();
      expect(screen.getByText("Second request from user")).toBeInTheDocument();
      expect(screen.getByText(/Second task completed/)).toBeInTheDocument();

      // Check DOM ordering via compareDocumentPosition
      const firstUserEl = screen.getByText("First request from user");
      const firstTaskEl = screen.getByText(/First task completed/);
      const secondUserEl = screen.getByText("Second request from user");
      const secondTaskEl = screen.getByText(/Second task completed/);

      // DOCUMENT_POSITION_FOLLOWING = 4
      expect(
        firstUserEl.compareDocumentPosition(firstTaskEl) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(
        firstTaskEl.compareDocumentPosition(secondUserEl) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(
        secondUserEl.compareDocumentPosition(secondTaskEl) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
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

      // Assert: All messages should be present
      expect(screen.getByText("User request")).toBeInTheDocument();
      expect(screen.getByText("System notification")).toBeInTheDocument();
      expect(screen.getByText(/Task result/)).toBeInTheDocument();

      // Check DOM ordering
      const userEl = screen.getByText("User request");
      const sysEl = screen.getByText("System notification");
      const taskEl = screen.getByText(/Task result/);

      expect(userEl.compareDocumentPosition(sysEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(sysEl.compareDocumentPosition(taskEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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

      // Assert: Orphaned task should still render and user message should come after.
      // Both "Orphaned plan" and "Orphaned result" match /Orphaned/, so use getAllByText.
      const orphanEls = screen.getAllByText(/Orphaned/);
      expect(orphanEls.length).toBeGreaterThan(0);
      expect(screen.getByText("User message after orphaned task")).toBeInTheDocument();

      const orphanEl = orphanEls[0];
      const userEl = screen.getByText("User message after orphaned task");
      expect(
        orphanEl.compareDocumentPosition(userEl) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
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

      // Assert: All messages should be present
      expect(screen.getByText("Welcome message")).toBeInTheDocument();
      expect(screen.getByText("First user request")).toBeInTheDocument();
      expect(screen.getByText("API key required")).toBeInTheDocument();
      expect(screen.getByText("Second user request")).toBeInTheDocument();

      // Check ordering
      const welcomeEl = screen.getByText("Welcome message");
      const firstUserEl = screen.getByText("First user request");
      const apiKeyEl = screen.getByText("API key required");
      const secondUserEl = screen.getByText("Second user request");

      expect(
        welcomeEl.compareDocumentPosition(firstUserEl) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(
        firstUserEl.compareDocumentPosition(apiKeyEl) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(
        apiKeyEl.compareDocumentPosition(secondUserEl) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
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
        mockStoreCurrentTaskId = "task-123";
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
        mockStoreCurrentTaskId = "task-456";
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
        mockStoreCurrentTaskId = "task-999";
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
      mockStoreCurrentTaskId = "task-browser-action";
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

  describe("agent:action event handling", () => {
    it("should add status message when agent:action event with extract action is received", () => {
      // Arrange: Set currentTaskId before rendering
      mockCurrentTaskId = "task-agent-action";
      mockStoreCurrentTaskId = "task-agent-action";
      render(<ChatView {...defaultProps} />);

      // Get the registered handler
      const mockAddListener = browser.runtime.onMessage.addListener as MockedFunction<
        typeof browser.runtime.onMessage.addListener
      >;
      const registeredHandler = mockAddListener.mock.calls[
        mockAddListener.mock.calls.length - 1
      ][0] as (message: unknown) => void;

      // Act: Simulate agent:action event with extract action
      const message = createRealtimeMessage("agent:action", {
        action: "extract",
      });
      registeredHandler(message);

      // Assert: addMessage should have been called with status message
      expect(mockAddMessage).toHaveBeenCalledWith("status", "Extracting data", "task-agent-action");
    });

    it("should not add status message when agent:action event with done action is received", () => {
      // Arrange: Set currentTaskId before rendering
      mockCurrentTaskId = "task-agent-done";
      render(<ChatView {...defaultProps} />);

      // Get the registered handler
      const mockAddListener = browser.runtime.onMessage.addListener as MockedFunction<
        typeof browser.runtime.onMessage.addListener
      >;
      const registeredHandler = mockAddListener.mock.calls[
        mockAddListener.mock.calls.length - 1
      ][0] as (message: unknown) => void;

      // Act: Simulate agent:action event with done action
      const message = createRealtimeMessage("agent:action", {
        action: "done",
      });
      registeredHandler(message);

      // Assert: addMessage should NOT have been called
      expect(mockAddMessage).not.toHaveBeenCalled();
    });

    it("should not add status message when agent:action event with abort action is received", () => {
      // Arrange: Set currentTaskId before rendering
      mockCurrentTaskId = "task-agent-abort";
      render(<ChatView {...defaultProps} />);

      // Get the registered handler
      const mockAddListener = browser.runtime.onMessage.addListener as MockedFunction<
        typeof browser.runtime.onMessage.addListener
      >;
      const registeredHandler = mockAddListener.mock.calls[
        mockAddListener.mock.calls.length - 1
      ][0] as (message: unknown) => void;

      // Act: Simulate agent:action event with abort action
      const message = createRealtimeMessage("agent:action", {
        action: "abort",
      });
      registeredHandler(message);

      // Assert: addMessage should NOT have been called
      expect(mockAddMessage).not.toHaveBeenCalled();
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

  describe("Status Events During Planning", () => {
    it("should display agent:status events when currentTaskId is set", () => {
      // Arrange: Set up a task ID before rendering
      mockCurrentTaskId = "task-123";
      mockStoreCurrentTaskId = "task-123";

      // Act: Render and simulate receiving an agent:status event
      render(<ChatView {...defaultProps} />);

      const message = createRealtimeMessage("agent:status", {
        message: "Creating task plan",
        iterationId: "planning",
      });

      // Trigger the message listener
      getMockMessageListener()(message);

      // Assert: status message should be passed to addMessage
      expect(mockAddMessage).toHaveBeenCalledWith("status", "Creating task plan", "task-123");
    });

    it("should show spinner with status message in early phase (status-only task bubble)", () => {
      // Arrange: A task bubble exists with only status messages (no plan/result yet).
      // This tests that the UI correctly renders status messages even when
      // currentTaskId hasn't been updated yet - the UI should display task bubbles
      // based on the taskId in messages, not just currentTaskId.
      const now = new Date();
      mockMessages.push({
        id: "status1",
        type: "status",
        content: "Creating task plan",
        taskId: "task-123",
        timestamp: now,
      });

      // currentTaskId is null but message has taskId - UI should still render
      mockCurrentTaskId = null;

      // Act: Render the component
      render(<ChatView {...defaultProps} />);

      // Assert: The spinner should show with the status message
      expect(screen.getByText("Creating task plan")).toBeInTheDocument();
    });

    describe("Race Condition: Events arriving before React state updates", () => {
      // These tests verify that events are NOT dropped when they arrive before
      // React has re-rendered with the new currentTaskId. The race condition
      // window exists between:
      // 1. User clicks send -> startTask() updates Zustand store
      // 2. React re-renders with new currentTaskId from store
      //
      // The fix: Read currentTaskId directly from the store via getState()
      // instead of relying on React state from the useConversation hook.

      it("should not drop status events when currentTaskId is null but event has taskId", () => {
        // Arrange: React state is null but store has the taskId (race condition)
        mockCurrentTaskId = null;
        mockStoreCurrentTaskId = "task-123"; // Store updated, React hasn't re-rendered
        render(<ChatView {...defaultProps} />);

        // Act: An agent:status event arrives before React updates
        // This simulates the race condition: startTask() was called, the store
        // was updated, but React hasn't re-rendered yet
        const message = createRealtimeMessage("agent:status", {
          message: "Creating task plan",
          iterationId: "planning",
        });
        getMockMessageListener()(message);

        // Assert: Message should be processed using taskId from store (via getState())
        expect(mockAddMessage).toHaveBeenCalledWith("status", "Creating task plan", "task-123");
      });

      it("should not drop plan events when currentTaskId is null but event has taskId", () => {
        // Arrange: React state is null but store has the taskId (race condition)
        mockCurrentTaskId = null;
        mockStoreCurrentTaskId = "task-123"; // Store updated, React hasn't re-rendered
        render(<ChatView {...defaultProps} />);

        // Act: A task:started event arrives with a plan
        const message = createRealtimeMessage("task:started", {
          plan: "Step 1: Navigate to page\nStep 2: Click button",
        });
        getMockMessageListener()(message);

        // Assert: Plan message should be processed using taskId from store (via getState())
        expect(mockAddMessage).toHaveBeenCalledWith(
          "plan",
          "Step 1: Navigate to page\nStep 2: Click button",
          "task-123",
        );
      });

      it("should not drop browser action events when currentTaskId is null but event has taskId", () => {
        // Arrange: React state is null but store has the taskId (race condition)
        mockCurrentTaskId = null;
        mockStoreCurrentTaskId = "task-123"; // Store updated, React hasn't re-rendered
        render(<ChatView {...defaultProps} />);

        // Act: A browser:action_started event arrives
        const message = createRealtimeMessage("browser:action_started", {
          action: "click",
          ref: "Submit button",
        });
        getMockMessageListener()(message);

        // Assert: Status message should be processed using taskId from store (via getState())
        expect(mockAddMessage).toHaveBeenCalledWith("status", "Clicking", "task-123");
      });

      it("should process events correctly when currentTaskId is set before render", () => {
        // Arrange: Both React state and store have taskId (no race condition)
        mockCurrentTaskId = "task-123";
        mockStoreCurrentTaskId = "task-123";
        render(<ChatView {...defaultProps} />);

        // Act: Events arrive after currentTaskId is properly set
        const message = createRealtimeMessage("agent:status", {
          message: "Executing step 1",
          iterationId: "step-1",
        });
        getMockMessageListener()(message);

        // Assert: Message is processed correctly
        expect(mockAddMessage).toHaveBeenCalledWith("status", "Executing step 1", "task-123");
      });
    });
  });

  describe("Action Items Display", () => {
    it("should display actionItems as bulleted list when present", () => {
      // Arrange: Set up a task ID
      mockCurrentTaskId = "task-123";
      mockStoreCurrentTaskId = "task-123";

      // Act: Render and simulate receiving a task:started event with actionItems
      render(<ChatView {...defaultProps} />);

      const message = createRealtimeMessage("task:started", {
        plan: "## Full plan\n\n1. Step one with details\n2. Step two with more details",
        actionItems: ["Search for recipes", "Filter results", "Select recipe"],
      });

      // Trigger the message listener
      getMockMessageListener()(message);

      // Assert: actionItems should be passed to addMessage as numbered markdown list
      expect(mockAddMessage).toHaveBeenCalledWith(
        "plan",
        "1. Search for recipes\n2. Filter results\n3. Select recipe",
        "task-123",
      );
    });

    it("should fall back to plan when actionItems is missing", () => {
      // Arrange
      mockCurrentTaskId = "task-123";
      mockStoreCurrentTaskId = "task-123";

      // Act: Render and simulate receiving a task:started event without actionItems
      render(<ChatView {...defaultProps} />);

      const message = createRealtimeMessage("task:started", {
        plan: "## Full plan\n\n1. Step one\n2. Step two",
      });

      getMockMessageListener()(message);

      // Assert: plan should be used directly
      expect(mockAddMessage).toHaveBeenCalledWith(
        "plan",
        "## Full plan\n\n1. Step one\n2. Step two",
        "task-123",
      );
    });

    it("should fall back to plan when actionItems is empty array", () => {
      // Arrange
      mockCurrentTaskId = "task-123";
      mockStoreCurrentTaskId = "task-123";

      // Act
      render(<ChatView {...defaultProps} />);

      const message = createRealtimeMessage("task:started", {
        plan: "## Full plan\n\n1. Step one",
        actionItems: [],
      });

      getMockMessageListener()(message);

      // Assert: plan should be used when actionItems is empty
      expect(mockAddMessage).toHaveBeenCalledWith(
        "plan",
        "## Full plan\n\n1. Step one",
        "task-123",
      );
    });

    it("should not add message when task:started has neither actionItems nor plan", () => {
      // Arrange
      mockCurrentTaskId = "task-123";
      mockStoreCurrentTaskId = "task-123";

      render(<ChatView {...defaultProps} />);
      mockAddMessage.mockClear(); // Clear any setup calls

      // Act: task:started with no actionItems and no plan
      const message = createRealtimeMessage("task:started", {});
      getMockMessageListener()(message);

      // Assert: addMessage should NOT be called
      expect(mockAddMessage).not.toHaveBeenCalled();
    });
  });
});

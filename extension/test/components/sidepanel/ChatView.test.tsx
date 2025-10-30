import { beforeEach, describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ChatView from "../../../src/components/sidepanel/ChatView";
import { theme } from "../../../src/theme";

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

// Mock marked library
vi.mock("marked", () => ({
  marked: (content: string) => content,
}));

// Mock useChat hook
const mockMessages: any[] = [];
const mockAddMessage = vi.fn();
const mockStartTask = vi.fn();
const mockEndTask = vi.fn();

vi.mock("../../../src/useChat", () => ({
  useChat: () => ({
    messages: mockMessages,
    addMessage: mockAddMessage,
    startTask: mockStartTask,
    endTask: mockEndTask,
    messagesEndRef: { current: null },
    scrollContainerRef: { current: null },
    handleScroll: vi.fn(),
    currentTaskId: null,
    isExecuting: false,
    setExecutionState: vi.fn(),
    clearMessages: vi.fn(),
  }),
}));

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
});

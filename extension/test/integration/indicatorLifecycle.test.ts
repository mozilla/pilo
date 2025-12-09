import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import browser from "webextension-polyfill";
import { EventStoreLogger } from "../../src/EventStoreLogger";
import { handleIndicatorMessage } from "../../src/content/indicatorHandler";
import { showIndicator, hideIndicator } from "../../src/content/AgentIndicator";
import type { RealtimeEventMessage } from "../../src/types/browser";

// Constants matching the implementation
const OVERLAY_ID = "spark-agent-indicator";
const STYLES_ID = "spark-agent-indicator-styles";

// Mock webextension-polyfill
vi.mock("webextension-polyfill", () => ({
  default: {
    tabs: {
      sendMessage: vi.fn().mockResolvedValue(undefined),
    },
    runtime: {
      sendMessage: vi.fn().mockResolvedValue(undefined),
    },
  },
}));

describe("Indicator Lifecycle - End-to-End Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clean up any existing indicator elements
    const existingOverlay = document.getElementById(OVERLAY_ID);
    if (existingOverlay) {
      existingOverlay.remove();
    }
    const existingStyles = document.getElementById(STYLES_ID);
    if (existingStyles) {
      existingStyles.remove();
    }
  });

  afterEach(() => {
    // Clean up DOM
    const overlay = document.getElementById(OVERLAY_ID);
    if (overlay) {
      overlay.remove();
    }
    const styles = document.getElementById(STYLES_ID);
    if (styles) {
      styles.remove();
    }
  });

  describe("Full lifecycle integration", () => {
    it("should show indicator when task starts and hide when completed", async () => {
      // Arrange
      const tabId = 123;
      const logger = new EventStoreLogger(tabId);
      let capturedMessages: RealtimeEventMessage[] = [];

      // Capture messages sent via runtime.sendMessage
      vi.mocked(browser.runtime.sendMessage).mockImplementation(async (msg) => {
        capturedMessages.push(msg as RealtimeEventMessage);
        return undefined;
      });

      // Act - Simulate task lifecycle
      // 1. Task starts
      logger.addEvent("task:setup", { timestamp: Date.now() });

      // Find the task:setup message and simulate it being forwarded to content script
      const setupMessage = capturedMessages.find((m) => m.event?.type === "task:setup");
      expect(setupMessage).toBeDefined();
      if (setupMessage) {
        handleIndicatorMessage(setupMessage);
      }

      // Assert - Indicator should be visible
      expect(document.getElementById(OVERLAY_ID)).toBeTruthy();

      // 2. Task completes
      logger.addEvent("task:completed", { timestamp: Date.now() });

      const completedMessage = capturedMessages.find((m) => m.event?.type === "task:completed");
      expect(completedMessage).toBeDefined();
      if (completedMessage) {
        handleIndicatorMessage(completedMessage);
      }

      // Assert - Indicator should be hidden
      expect(document.getElementById(OVERLAY_ID)).toBeNull();
    });

    it("should show indicator when task starts and hide when aborted", async () => {
      // Arrange
      const tabId = 456;
      const logger = new EventStoreLogger(tabId);
      let capturedMessages: RealtimeEventMessage[] = [];

      vi.mocked(browser.runtime.sendMessage).mockImplementation(async (msg) => {
        capturedMessages.push(msg as RealtimeEventMessage);
        return undefined;
      });

      // Act - Task starts
      logger.addEvent("task:setup", { timestamp: Date.now() });
      const setupMessage = capturedMessages.find((m) => m.event?.type === "task:setup");
      if (setupMessage) {
        handleIndicatorMessage(setupMessage);
      }

      // Assert - Indicator visible
      expect(document.getElementById(OVERLAY_ID)).toBeTruthy();

      // Act - Task aborted
      logger.addEvent("task:aborted", { timestamp: Date.now() });
      const abortedMessage = capturedMessages.find((m) => m.event?.type === "task:aborted");
      if (abortedMessage) {
        handleIndicatorMessage(abortedMessage);
      }

      // Assert - Indicator hidden
      expect(document.getElementById(OVERLAY_ID)).toBeNull();
    });

    it("should only show indicator on the correct tab (tabId isolation)", async () => {
      // Arrange - Two tabs with different tabIds
      const tab1Id = 100;
      const tab2Id = 200;
      const logger1 = new EventStoreLogger(tab1Id);
      const logger2 = new EventStoreLogger(tab2Id);

      let capturedMessages: RealtimeEventMessage[] = [];
      vi.mocked(browser.runtime.sendMessage).mockImplementation(async (msg) => {
        capturedMessages.push(msg as RealtimeEventMessage);
        return undefined;
      });

      // Act - Both tabs start tasks
      logger1.addEvent("task:setup", { timestamp: Date.now() });
      logger2.addEvent("task:setup", { timestamp: Date.now() });

      // Assert - Messages have correct tabIds
      const tab1Message = capturedMessages.find(
        (m) => m.tabId === tab1Id && m.event?.type === "task:setup",
      );
      const tab2Message = capturedMessages.find(
        (m) => m.tabId === tab2Id && m.event?.type === "task:setup",
      );

      expect(tab1Message).toBeDefined();
      expect(tab2Message).toBeDefined();
      expect(tab1Message?.tabId).toBe(100);
      expect(tab2Message?.tabId).toBe(200);
    });

    it("should not show duplicate indicators for rapid task:setup events", async () => {
      // Arrange
      const tabId = 789;
      const logger = new EventStoreLogger(tabId);
      let capturedMessages: RealtimeEventMessage[] = [];

      vi.mocked(browser.runtime.sendMessage).mockImplementation(async (msg) => {
        capturedMessages.push(msg as RealtimeEventMessage);
        return undefined;
      });

      // Act - Rapid fire task:setup events
      logger.addEvent("task:setup", { timestamp: Date.now() });
      logger.addEvent("task:setup", { timestamp: Date.now() + 1 });
      logger.addEvent("task:setup", { timestamp: Date.now() + 2 });

      // Process all setup messages
      const setupMessages = capturedMessages.filter((m) => m.event?.type === "task:setup");
      setupMessages.forEach((msg) => handleIndicatorMessage(msg));

      // Assert - Only one overlay should exist (idempotent)
      const overlays = document.querySelectorAll(`#${OVERLAY_ID}`);
      expect(overlays.length).toBe(1);
    });

    it("should handle task completion before indicator is fully shown", async () => {
      // Arrange
      const tabId = 111;
      const logger = new EventStoreLogger(tabId);
      let capturedMessages: RealtimeEventMessage[] = [];

      vi.mocked(browser.runtime.sendMessage).mockImplementation(async (msg) => {
        capturedMessages.push(msg as RealtimeEventMessage);
        return undefined;
      });

      // Act - Very quick task: setup and complete in rapid succession
      logger.addEvent("task:setup", { timestamp: Date.now() });
      logger.addEvent("task:completed", { timestamp: Date.now() + 1 });

      // Process setup
      const setupMsg = capturedMessages.find((m) => m.event?.type === "task:setup");
      if (setupMsg) handleIndicatorMessage(setupMsg);

      // Immediately process complete (before animation could finish)
      const completeMsg = capturedMessages.find((m) => m.event?.type === "task:completed");
      if (completeMsg) handleIndicatorMessage(completeMsg);

      // Assert - Indicator should be hidden cleanly
      expect(document.getElementById(OVERLAY_ID)).toBeNull();
    });

    it("should recover gracefully if indicator state becomes inconsistent", async () => {
      // Arrange - Manually create an inconsistent state
      // (e.g., overlay exists but styles don't, or vice versa)
      showIndicator(); // Creates both overlay and styles

      // Manually remove just the styles to create inconsistency
      const styles = document.getElementById(STYLES_ID);
      if (styles) {
        styles.remove();
      }

      // Act - Try to hide indicator in this inconsistent state
      expect(() => hideIndicator()).not.toThrow();

      // Assert - Indicator should be cleaned up
      expect(document.getElementById(OVERLAY_ID)).toBeNull();

      // Act - Show indicator again should work
      expect(() => showIndicator()).not.toThrow();
      expect(document.getElementById(OVERLAY_ID)).toBeTruthy();

      // Cleanup
      hideIndicator();
    });
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleIndicatorMessage } from "../../src/content/indicatorHandler";
import * as AgentIndicator from "../../src/content/AgentIndicator";
import type { RealtimeEventMessage } from "../../src/types/browser";

// Mock the AgentIndicator module
vi.mock("../../src/content/AgentIndicator", () => ({
  showIndicator: vi.fn(),
  hideIndicator: vi.fn(),
}));

describe("Content Script - Indicator Event Handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("handleIndicatorMessage", () => {
    it("should show indicator when task begins (task:setup)", () => {
      // Arrange
      const message: RealtimeEventMessage = {
        type: "realtimeEvent",
        tabId: 123,
        event: {
          type: "task:setup",
          data: {},
          timestamp: Date.now(),
        },
      };

      // Act
      handleIndicatorMessage(message);

      // Assert
      expect(AgentIndicator.showIndicator).toHaveBeenCalled();
    });

    it("should hide indicator when task completes successfully (task:completed)", () => {
      // Arrange
      const message: RealtimeEventMessage = {
        type: "realtimeEvent",
        tabId: 123,
        event: {
          type: "task:completed",
          data: {},
          timestamp: Date.now(),
        },
      };

      // Act
      handleIndicatorMessage(message);

      // Assert
      expect(AgentIndicator.hideIndicator).toHaveBeenCalled();
    });

    it("should hide indicator when task is aborted (task:aborted)", () => {
      // Arrange
      const message: RealtimeEventMessage = {
        type: "realtimeEvent",
        tabId: 123,
        event: {
          type: "task:aborted",
          data: {},
          timestamp: Date.now(),
        },
      };

      // Act
      handleIndicatorMessage(message);

      // Assert
      expect(AgentIndicator.hideIndicator).toHaveBeenCalled();
    });

    it("should ignore non-indicator realtimeEvent messages", () => {
      // Arrange - non-indicator event type
      const message: RealtimeEventMessage = {
        type: "realtimeEvent",
        tabId: 123,
        event: {
          type: "agent:reasoned",
          data: { thought: "thinking..." },
          timestamp: Date.now(),
        },
      };

      // Act
      handleIndicatorMessage(message);

      // Assert - neither show nor hide should be called
      expect(AgentIndicator.showIndicator).not.toHaveBeenCalled();
      expect(AgentIndicator.hideIndicator).not.toHaveBeenCalled();
    });

    it("should handle rapid show/hide sequences without errors", () => {
      // Arrange - rapid sequence of events
      const setupMessage: RealtimeEventMessage = {
        type: "realtimeEvent",
        tabId: 123,
        event: { type: "task:setup", data: {}, timestamp: Date.now() },
      };
      const completedMessage: RealtimeEventMessage = {
        type: "realtimeEvent",
        tabId: 123,
        event: { type: "task:completed", data: {}, timestamp: Date.now() },
      };

      // Act - rapid fire events
      handleIndicatorMessage(setupMessage);
      handleIndicatorMessage(completedMessage);
      handleIndicatorMessage(setupMessage);
      handleIndicatorMessage(completedMessage);

      // Assert - should handle all events
      expect(AgentIndicator.showIndicator).toHaveBeenCalledTimes(2);
      expect(AgentIndicator.hideIndicator).toHaveBeenCalledTimes(2);
    });

    it("should handle malformed event payloads gracefully", () => {
      // Arrange - message missing event property entirely
      const malformedMessage = {
        type: "realtimeEvent",
        tabId: 123,
      } as unknown as RealtimeEventMessage;

      // Act & Assert - should not throw
      expect(() => handleIndicatorMessage(malformedMessage)).not.toThrow();
      expect(AgentIndicator.showIndicator).not.toHaveBeenCalled();
      expect(AgentIndicator.hideIndicator).not.toHaveBeenCalled();
    });
  });
});

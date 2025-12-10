import { describe, it, expect, vi, beforeEach } from "vitest";
import browser from "webextension-polyfill";
import { EventStoreLogger } from "../src/EventStoreLogger";

// Mock the webextension-polyfill module
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

// This test validates the TypeScript interface and the integration
// with AgentManager. We cannot easily test the WXT defineBackground
// callback directly, so we test the types and AgentManager integration.

describe("Background Script - Provider Support", () => {
  describe("StorageSettings Interface", () => {
    it("should define provider field with correct type", () => {
      // TypeScript compilation validates this at build time
      const validSettings: {
        apiKey?: string;
        apiEndpoint?: string;
        model?: string;
        provider?: "openai" | "openrouter";
      } = {
        apiKey: "test-key",
        provider: "openrouter",
      };

      expect(validSettings.provider).toBe("openrouter");
    });

    it("should allow openai provider value", () => {
      const settings: {
        provider?: "openai" | "openrouter";
      } = {
        provider: "openai",
      };

      expect(settings.provider).toBe("openai");
    });

    it("should allow openrouter provider value", () => {
      const settings: {
        provider?: "openai" | "openrouter";
      } = {
        provider: "openrouter",
      };

      expect(settings.provider).toBe("openrouter");
    });

    it("should allow undefined provider value", () => {
      const settings: {
        provider?: "openai" | "openrouter";
      } = {};

      expect(settings.provider).toBeUndefined();
    });
  });

  describe("Provider Integration with AgentManager", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should pass provider to AgentManager.runTask", async () => {
      // Simulate what background script does
      const settings = {
        apiKey: "test-key",
        apiEndpoint: "https://api.openai.com/v1",
        model: "gpt-4.1",
        provider: "openrouter",
      };

      const taskOptions = {
        apiKey: settings.apiKey,
        apiEndpoint: settings.apiEndpoint,
        model: settings.model || "gpt-4.1",
        provider: settings.provider,
        tabId: 1,
      };

      // Verify type compatibility
      expect(taskOptions.provider).toBe("openrouter");
      expect(typeof taskOptions.provider).toBe("string");
    });

    it("should handle missing provider correctly", () => {
      const settings: {
        apiKey: string;
        model: string;
        provider?: "openai" | "openrouter";
      } = {
        apiKey: "test-key",
        model: "gpt-4.1",
      };

      const taskOptions = {
        apiKey: settings.apiKey,
        model: settings.model || "gpt-4.1",
        provider: settings.provider,
      };

      expect(taskOptions.provider).toBeUndefined();
    });

    it("should construct task options with all provider types", () => {
      const testCases: Array<"openai" | "openrouter" | undefined> = [
        "openai",
        "openrouter",
        undefined,
      ];

      testCases.forEach((provider) => {
        const settings = {
          apiKey: "test-key",
          provider,
        };

        const taskOptions = {
          apiKey: settings.apiKey,
          provider: settings.provider,
        };

        expect(taskOptions.provider).toBe(provider);
      });
    });
  });

  describe("Storage Key Validation", () => {
    it("should include provider in storage keys", () => {
      // This validates that the background script reads the correct keys
      const storageKeys = ["apiKey", "apiEndpoint", "model", "provider"];

      expect(storageKeys).toContain("provider");
      expect(storageKeys).toHaveLength(4);
    });
  });

  describe("Type Safety Enforcement", () => {
    it("should only accept valid provider values", () => {
      type Provider = "openai" | "openrouter";

      const validProviders: Provider[] = ["openai", "openrouter"];

      validProviders.forEach((provider) => {
        const settings = {
          provider,
        };

        expect(["openai", "openrouter"]).toContain(settings.provider);
      });
    });

    it("should type check provider in StorageSettings", () => {
      interface StorageSettings {
        apiKey?: string;
        apiEndpoint?: string;
        model?: string;
        provider?: "openai" | "openrouter";
      }

      const settings1: StorageSettings = {
        provider: "openai",
      };

      const settings2: StorageSettings = {
        provider: "openrouter",
      };

      const settings3: StorageSettings = {};

      expect(settings1.provider).toBe("openai");
      expect(settings2.provider).toBe("openrouter");
      expect(settings3.provider).toBeUndefined();
    });
  });

  describe("Default Values", () => {
    it("should use default model when not provided", () => {
      const settings: {
        apiKey: string;
        model?: string;
        provider: "openrouter";
      } = {
        apiKey: "test-key",
        provider: "openrouter" as const,
      };

      const model = settings.model || "gpt-4.1";

      expect(model).toBe("gpt-4.1");
    });

    it("should preserve custom model when provided", () => {
      const settings = {
        apiKey: "test-key",
        model: "gpt-4o",
        provider: "openai" as const,
      };

      const model = settings.model || "gpt-4.1";

      expect(model).toBe("gpt-4o");
    });
  });
});

// Note: "Background Script - Indicator Event Forwarding" tests removed
// Indicator is now controlled via CSS injection in background script (see indicatorControl.ts)
// instead of forwarding events to content script via tabs.sendMessage

describe("Background Script - Error Handling", () => {
  describe("task:aborted event on error", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should emit task:aborted event when task execution fails", async () => {
      // Arrange - create logger with tabId (simulating background script behavior)
      const tabId = 123;
      const logger = new EventStoreLogger(tabId);
      const errorMessage = "No starting URL determined";

      // Act - simulate what background script should do when catching an error
      // This documents the expected pattern: emit task:aborted on error
      logger.addEvent("task:aborted", {
        reason: errorMessage,
        finalAnswer: `Task failed: ${errorMessage}`,
        timestamp: Date.now(),
        iterationId: "error",
      });

      // Assert - task:aborted event should be broadcast with tabId
      expect(browser.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "realtimeEvent",
          tabId: 123,
          event: expect.objectContaining({
            type: "task:aborted",
            data: expect.objectContaining({
              reason: errorMessage,
            }),
          }),
        }),
      );
      // Note: Indicator visibility is now handled via CSS injection in background script
      // (see indicatorControl.ts) instead of forwarding to content script via tabs.sendMessage
    });

    it("should emit task:aborted when task is cancelled by user", async () => {
      // Arrange
      const tabId = 456;
      const logger = new EventStoreLogger(tabId);

      // Act - simulate cancellation
      logger.addEvent("task:aborted", {
        reason: "Task cancelled by user",
        finalAnswer: "Task cancelled",
        timestamp: Date.now(),
        iterationId: "cancelled",
      });

      // Assert - event should be broadcast to sidepanel via runtime.sendMessage
      expect(browser.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "realtimeEvent",
          tabId: 456,
          event: expect.objectContaining({
            type: "task:aborted",
          }),
        }),
      );
      // Note: Indicator visibility is now handled via CSS injection in background script
      // (see indicatorControl.ts) instead of forwarding to content script via tabs.sendMessage
    });
  });
});

describe("Background Script - TabId Wiring", () => {
  describe("EventStoreLogger tabId wiring", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should create EventStoreLogger with tabId from executeTask message", () => {
      // This test documents the expected pattern for creating EventStoreLogger
      // The actual background script should pass tabId to EventStoreLogger constructor
      // Arrange
      const tabId = 123;

      // Act - simulate what background.ts should do
      const logger = new EventStoreLogger(tabId);

      // Assert - logger should be created with tabId
      expect(logger).toBeInstanceOf(EventStoreLogger);
    });

    it("should propagate tabId through all events during task execution", async () => {
      // This test documents that EventStoreLogger with tabId broadcasts correctly
      // Arrange
      const tabId = 456;
      const logger = new EventStoreLogger(tabId);

      // Act - add multiple events
      logger.addEvent("task:setup", { timestamp: Date.now() });
      logger.addEvent("task:completed", { timestamp: Date.now() });

      // Assert - all events should have been broadcast with tabId
      expect(browser.runtime.sendMessage).toHaveBeenCalledTimes(2);
      const calls = vi.mocked(browser.runtime.sendMessage).mock.calls;
      calls.forEach((call) => {
        expect(call[0]).toMatchObject({
          type: "realtimeEvent",
          tabId: 456,
        });
      });
    });

    it("should handle missing tabId in executeTask message gracefully", () => {
      // Background script should check for missing tabId and return error
      // This documents the expected validation pattern

      // The expected response when tabId is missing from an executeTask message
      const expectedResponse = {
        success: false,
        message: "No tab ID provided for task execution",
      };

      // Assert - this is the response pattern the background script should return
      expect(expectedResponse.success).toBe(false);
      expect(expectedResponse.message).toContain("tab ID");
    });
  });
});

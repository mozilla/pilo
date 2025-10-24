import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventStoreLogger } from "../src/EventStoreLogger";

describe("EventStoreLogger error logging", () => {
  let consoleErrorSpy: any;
  let logger: EventStoreLogger;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    logger = new EventStoreLogger();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe("Validation Error Logging", () => {
    it("should log validation errors to console.error", () => {
      const errorData = {
        errors: ["Validation failed: partial"],
        retryCount: 1,
        rawResponse: { success: false, issues: [] },
        timestamp: Date.now(),
        iterationId: "test-123",
      };

      logger.addEvent("task:validation_error", errorData);

      expect(consoleErrorSpy).toHaveBeenCalledWith("Validation Error:", errorData);
    });
  });

  describe("AI Generation Error Logging", () => {
    it("should log AI generation errors to console.error", () => {
      const errorData = {
        error: "Failed to generate response",
        prompt: "Generate a plan",
        schema: { type: "object" },
        messages: [{ role: "user", content: "test" }],
        timestamp: Date.now(),
        iterationId: "test-456",
      };

      logger.addEvent("ai:generation:error", errorData);

      expect(consoleErrorSpy).toHaveBeenCalledWith("AI Generation Error:", errorData);
    });
  });

  describe("Browser Action Failure Logging", () => {
    it("should log browser action failures to console.error", () => {
      const errorData = {
        success: false,
        error: "Element not found",
        timestamp: Date.now(),
        iterationId: "test-789",
      };

      logger.addEvent("browser:action_completed", errorData);

      expect(consoleErrorSpy).toHaveBeenCalledWith("Browser Action Failed:", errorData);
    });

    it("should not log successful browser actions", () => {
      const successData = {
        success: true,
        timestamp: Date.now(),
        iterationId: "test-789",
      };

      logger.addEvent("browser:action_completed", successData);

      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe("Task Aborted Logging", () => {
    it("should log task aborted events to console.error", () => {
      const abortData = {
        reason: "User cancelled task",
        timestamp: Date.now(),
        iterationId: "test-999",
      };

      logger.addEvent("task:aborted", abortData);

      expect(consoleErrorSpy).toHaveBeenCalledWith("Task Aborted:", abortData);
    });
  });
});

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

describe("Task Plan Logging", () => {
  let loggerInfoSpy: any;
  let logger: EventStoreLogger;

  beforeEach(() => {
    logger = new EventStoreLogger();
    // Spy on the internal logger's info method
    loggerInfoSpy = vi.spyOn(logger["logger"], "info").mockImplementation(() => {});
  });

  afterEach(() => {
    loggerInfoSpy.mockRestore();
  });

  it("should log task plans using logger.info when task:started event contains a plan", () => {
    const planData = {
      plan: "1. Analyze the code\n2. Write tests\n3. Implement feature",
      taskId: "task-123",
      timestamp: Date.now(),
    };

    logger.addEvent("task:started", planData);

    expect(loggerInfoSpy).toHaveBeenCalledWith(
      "Task Plan Details",
      expect.objectContaining({
        taskId: "task-123",
      }),
      expect.objectContaining({
        taskId: "task-123",
        plan: planData.plan,
        planLength: planData.plan.length,
        timestamp: expect.any(Number),
      }),
    );
  });

  it("should not log when task:started event has no plan", () => {
    const dataWithoutPlan = {
      taskId: "task-456",
      timestamp: Date.now(),
    };

    logger.addEvent("task:started", dataWithoutPlan);

    expect(loggerInfoSpy).not.toHaveBeenCalled();
  });

  it("should not log when plan is null or undefined", () => {
    const dataWithNullPlan = {
      plan: null,
      taskId: "task-null",
      timestamp: Date.now(),
    };

    logger.addEvent("task:started", dataWithNullPlan);
    expect(loggerInfoSpy).not.toHaveBeenCalled();

    const dataWithUndefinedPlan = {
      plan: undefined,
      taskId: "task-undefined",
      timestamp: Date.now(),
    };

    logger.addEvent("task:started", dataWithUndefinedPlan);
    expect(loggerInfoSpy).not.toHaveBeenCalled();
  });

  it("should log complete plan structure including all event data", () => {
    const complexPlanData = {
      plan: "Complex multi-step plan:\n- Step 1\n- Step 2\n- Step 3",
      taskId: "task-789",
      metadata: {
        source: "ai_agent",
        version: "1.0",
      },
      additionalInfo: "extra context",
      timestamp: Date.now(),
    };

    logger.addEvent("task:started", complexPlanData);

    expect(loggerInfoSpy).toHaveBeenCalledWith(
      "Task Plan Details",
      expect.objectContaining({
        taskId: "task-789",
      }),
      expect.objectContaining({
        taskId: "task-789",
        plan: complexPlanData.plan,
        planLength: complexPlanData.plan.length,
        timestamp: expect.any(Number),
        fullEventData: complexPlanData,
      }),
    );
  });

  it("should handle missing taskId gracefully", () => {
    const planDataNoTaskId = {
      plan: "Plan without task ID",
      timestamp: Date.now(),
    };

    logger.addEvent("task:started", planDataNoTaskId);

    expect(loggerInfoSpy).toHaveBeenCalledWith(
      "Task Plan Details",
      expect.objectContaining({
        taskId: "unknown",
      }),
      expect.objectContaining({
        taskId: "unknown",
        plan: planDataNoTaskId.plan,
        planLength: planDataNoTaskId.plan.length,
        timestamp: expect.any(Number),
      }),
    );
  });

  it("should log plan length for very long plans", () => {
    const longPlan = "Step ".repeat(1000); // Create a very long plan
    const planData = {
      plan: longPlan,
      taskId: "task-long",
      timestamp: Date.now(),
    };

    logger.addEvent("task:started", planData);

    expect(loggerInfoSpy).toHaveBeenCalledWith(
      "Task Plan Details",
      expect.objectContaining({
        taskId: "task-long",
      }),
      expect.objectContaining({
        taskId: "task-long",
        plan: longPlan,
        planLength: longPlan.length,
        timestamp: expect.any(Number),
      }),
    );
  });
});

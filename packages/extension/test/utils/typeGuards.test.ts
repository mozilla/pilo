import { describe, it, expect } from "vitest";
import {
  hasOptionalStringProp,
  hasOptionalBooleanProp,
  hasOptionalNumberProp,
  hasOptionalStringArrayProp,
  hasRequiredBooleanProp,
  isTaskStartedData,
  isAgentReasonedData,
  isAgentStatusData,
  isAIGenerationErrorData,
  isTaskValidationErrorData,
  isBrowserActionCompletedData,
  isBrowserActionStartedData,
  isValidRealtimeEvent,
  isAgentActionData,
} from "../../src/shared/utils/typeGuards";
import type {
  TaskStartedEventData,
  AgentReasonedEventData,
  AgentStatusEventData,
  AIGenerationErrorEventData,
  TaskValidationErrorEventData,
  BrowserActionCompletedEventData,
  BrowserActionStartedEventData,
} from "../../src/shared/types/browser";

describe("Type Guard Helpers", () => {
  describe("hasOptionalStringProp", () => {
    it("should return true when property is a string", () => {
      const obj = { name: "test" };
      expect(hasOptionalStringProp(obj, "name")).toBe(true);
    });

    it("should return true when property is missing (optional)", () => {
      const obj = {};
      expect(hasOptionalStringProp(obj, "name")).toBe(true);
    });

    it("should return false when property is not a string", () => {
      const obj = { name: 123 };
      expect(hasOptionalStringProp(obj, "name")).toBe(false);
    });

    it("should return false when property is null", () => {
      const obj = { name: null };
      expect(hasOptionalStringProp(obj, "name")).toBe(false);
    });

    it("should return true when property is undefined but exists", () => {
      // undefined is allowed for optional string props (common in real event data)
      const obj = { name: undefined };
      expect(hasOptionalStringProp(obj, "name")).toBe(true);
    });
  });

  describe("hasOptionalBooleanProp", () => {
    it("should return true when property is a boolean", () => {
      const obj = { flag: true };
      expect(hasOptionalBooleanProp(obj, "flag")).toBe(true);
    });

    it("should return true when property is missing (optional)", () => {
      const obj = {};
      expect(hasOptionalBooleanProp(obj, "flag")).toBe(true);
    });

    it("should return false when property is not a boolean", () => {
      const obj = { flag: "true" };
      expect(hasOptionalBooleanProp(obj, "flag")).toBe(false);
    });
  });

  describe("hasOptionalNumberProp", () => {
    it("should return true when property is a number", () => {
      const obj = { count: 42 };
      expect(hasOptionalNumberProp(obj, "count")).toBe(true);
    });

    it("should return true when property is missing (optional)", () => {
      const obj = {};
      expect(hasOptionalNumberProp(obj, "count")).toBe(true);
    });

    it("should return false when property is not a number", () => {
      const obj = { count: "42" };
      expect(hasOptionalNumberProp(obj, "count")).toBe(false);
    });
  });

  describe("hasOptionalStringArrayProp", () => {
    it("should return true when property is a string array", () => {
      const obj = { items: ["a", "b", "c"] };
      expect(hasOptionalStringArrayProp(obj, "items")).toBe(true);
    });

    it("should return true when property is an empty array", () => {
      const obj = { items: [] };
      expect(hasOptionalStringArrayProp(obj, "items")).toBe(true);
    });

    it("should return true when property is missing (optional)", () => {
      const obj = {};
      expect(hasOptionalStringArrayProp(obj, "items")).toBe(true);
    });

    it("should return false when property is not an array", () => {
      const obj = { items: "not an array" };
      expect(hasOptionalStringArrayProp(obj, "items")).toBe(false);
    });

    it("should return false when array contains non-strings", () => {
      const obj = { items: ["a", 123, "c"] };
      expect(hasOptionalStringArrayProp(obj, "items")).toBe(false);
    });
  });

  describe("hasRequiredBooleanProp", () => {
    it("should return true when property is true", () => {
      const obj = { required: true };
      expect(hasRequiredBooleanProp(obj, "required")).toBe(true);
    });

    it("should return true when property is false", () => {
      const obj = { required: false };
      expect(hasRequiredBooleanProp(obj, "required")).toBe(true);
    });

    it("should return false when property is missing", () => {
      const obj = {};
      expect(hasRequiredBooleanProp(obj, "required")).toBe(false);
    });

    it("should return false when property is not a boolean", () => {
      const obj = { required: "true" };
      expect(hasRequiredBooleanProp(obj, "required")).toBe(false);
    });
  });
});

describe("Event Data Type Guards", () => {
  describe("isTaskStartedData", () => {
    it("should return true for valid TaskStartedEventData with all properties", () => {
      const data: TaskStartedEventData = {
        plan: "test plan",
        taskId: "task-123",
      };
      expect(isTaskStartedData(data)).toBe(true);
    });

    it("should return true for valid TaskStartedEventData with only plan", () => {
      const data: TaskStartedEventData = {
        plan: "test plan",
      };
      expect(isTaskStartedData(data)).toBe(true);
    });

    it("should return true for valid TaskStartedEventData with only taskId", () => {
      const data: TaskStartedEventData = {
        taskId: "task-123",
      };
      expect(isTaskStartedData(data)).toBe(true);
    });

    it("should return true for empty object (all properties optional)", () => {
      const data = {};
      expect(isTaskStartedData(data)).toBe(true);
    });

    it("should return false when plan is not a string", () => {
      const data = { plan: 123 };
      expect(isTaskStartedData(data)).toBe(false);
    });

    it("should return false when taskId is not a string", () => {
      const data = { taskId: 123 };
      expect(isTaskStartedData(data)).toBe(false);
    });

    it("should return false for null", () => {
      expect(isTaskStartedData(null)).toBe(false);
    });

    it("should return false for non-object", () => {
      expect(isTaskStartedData("not an object")).toBe(false);
    });

    it("should return true for valid actionItems (string array)", () => {
      const data: TaskStartedEventData = {
        plan: "test plan",
        taskId: "task-123",
        actionItems: ["Action 1", "Action 2", "Action 3"],
      };
      expect(isTaskStartedData(data)).toBe(true);
    });

    it("should return true when actionItems is missing (optional)", () => {
      const data: TaskStartedEventData = {
        plan: "test plan",
        taskId: "task-123",
      };
      expect(isTaskStartedData(data)).toBe(true);
    });

    it("should return false when actionItems is not an array", () => {
      const data = {
        plan: "test plan",
        taskId: "task-123",
        actionItems: "not an array",
      };
      expect(isTaskStartedData(data)).toBe(false);
    });

    it("should return false when actionItems contains non-string elements", () => {
      const data = {
        plan: "test plan",
        taskId: "task-123",
        actionItems: ["Action 1", 123, true],
      };
      expect(isTaskStartedData(data)).toBe(false);
    });
  });

  describe("isAgentReasonedData", () => {
    it("should return true for valid AgentReasonedEventData", () => {
      const data: AgentReasonedEventData = { thought: "thinking..." };
      expect(isAgentReasonedData(data)).toBe(true);
    });

    it("should return true for empty object", () => {
      expect(isAgentReasonedData({})).toBe(true);
    });

    it("should return false when thought is not a string", () => {
      const data = { thought: 123 };
      expect(isAgentReasonedData(data)).toBe(false);
    });
  });

  describe("isAgentStatusData", () => {
    it("should return true for valid AgentStatusEventData", () => {
      const data: AgentStatusEventData = { message: "status message" };
      expect(isAgentStatusData(data)).toBe(true);
    });

    it("should return true for empty object", () => {
      expect(isAgentStatusData({})).toBe(true);
    });

    it("should return false when message is not a string", () => {
      const data = { message: 123 };
      expect(isAgentStatusData(data)).toBe(false);
    });
  });

  describe("isAIGenerationErrorData", () => {
    it("should return true for valid AIGenerationErrorEventData", () => {
      const data: AIGenerationErrorEventData = {
        error: "error message",
        isToolError: true,
      };
      expect(isAIGenerationErrorData(data)).toBe(true);
    });

    it("should return true with only error", () => {
      const data: AIGenerationErrorEventData = { error: "error message" };
      expect(isAIGenerationErrorData(data)).toBe(true);
    });

    it("should return true for empty object", () => {
      expect(isAIGenerationErrorData({})).toBe(true);
    });

    it("should return false when error is not a string", () => {
      const data = { error: 123 };
      expect(isAIGenerationErrorData(data)).toBe(false);
    });

    it("should return false when isToolError is not a boolean", () => {
      const data = { error: "test", isToolError: "true" };
      expect(isAIGenerationErrorData(data)).toBe(false);
    });
  });

  describe("isTaskValidationErrorData", () => {
    it("should return true for valid TaskValidationErrorEventData", () => {
      const data: TaskValidationErrorEventData = {
        errors: ["error 1", "error 2"],
        retryCount: 2,
      };
      expect(isTaskValidationErrorData(data)).toBe(true);
    });

    it("should return true with only errors", () => {
      const data: TaskValidationErrorEventData = { errors: ["error 1"] };
      expect(isTaskValidationErrorData(data)).toBe(true);
    });

    it("should return true for empty object", () => {
      expect(isTaskValidationErrorData({})).toBe(true);
    });

    it("should return false when errors is not an array", () => {
      const data = { errors: "not an array" };
      expect(isTaskValidationErrorData(data)).toBe(false);
    });

    it("should return false when errors contains non-strings", () => {
      const data = { errors: ["error", 123] };
      expect(isTaskValidationErrorData(data)).toBe(false);
    });

    it("should return false when retryCount is not a number", () => {
      const data = { retryCount: "2" };
      expect(isTaskValidationErrorData(data)).toBe(false);
    });
  });

  describe("isBrowserActionCompletedData", () => {
    it("should return true for valid BrowserActionCompletedEventData with success true", () => {
      const data: BrowserActionCompletedEventData = {
        success: true,
      };
      expect(isBrowserActionCompletedData(data)).toBe(true);
    });

    it("should return true for valid BrowserActionCompletedEventData with all properties", () => {
      const data: BrowserActionCompletedEventData = {
        success: false,
        error: "error message",
        isRecoverable: true,
      };
      expect(isBrowserActionCompletedData(data)).toBe(true);
    });

    it("should return false when success is missing", () => {
      const data = { error: "error" };
      expect(isBrowserActionCompletedData(data)).toBe(false);
    });

    it("should return false when success is not a boolean", () => {
      const data = { success: "true" };
      expect(isBrowserActionCompletedData(data)).toBe(false);
    });

    it("should return false when error is not a string", () => {
      const data = { success: true, error: 123 };
      expect(isBrowserActionCompletedData(data)).toBe(false);
    });

    it("should return false when isRecoverable is not a boolean", () => {
      const data = { success: true, isRecoverable: "true" };
      expect(isBrowserActionCompletedData(data)).toBe(false);
    });
  });
});

describe("isValidRealtimeEvent type guard", () => {
  it("should return true for valid event with string type, object data, and number timestamp", () => {
    const validEvent = {
      type: "task:started",
      data: { plan: "test plan", taskId: "123" },
      timestamp: 1234567890,
    };

    expect(isValidRealtimeEvent(validEvent)).toBe(true);
  });

  it("should return true for event with empty object data", () => {
    const validEvent = {
      type: "agent:status",
      data: {},
      timestamp: Date.now(),
    };

    expect(isValidRealtimeEvent(validEvent)).toBe(true);
  });

  it("should return false when type is not a string", () => {
    const invalidEvent = {
      type: 123,
      data: { test: "data" },
      timestamp: Date.now(),
    };

    expect(isValidRealtimeEvent(invalidEvent)).toBe(false);
  });

  it("should return false when data is null", () => {
    const invalidEvent = {
      type: "test:event",
      data: null,
      timestamp: Date.now(),
    };

    expect(isValidRealtimeEvent(invalidEvent)).toBe(false);
  });

  it("should return false when data is not an object", () => {
    const invalidEvent = {
      type: "test:event",
      data: "not an object",
      timestamp: Date.now(),
    };

    expect(isValidRealtimeEvent(invalidEvent)).toBe(false);
  });

  it("should return false when timestamp is not a number", () => {
    const invalidEvent = {
      type: "test:event",
      data: { test: "data" },
      timestamp: "not a number",
    };

    expect(isValidRealtimeEvent(invalidEvent)).toBe(false);
  });

  it("should return false when timestamp is missing", () => {
    const invalidEvent = {
      type: "test:event",
      data: { test: "data" },
    };

    expect(isValidRealtimeEvent(invalidEvent)).toBe(false);
  });

  it("should return false when type is missing", () => {
    const invalidEvent = {
      data: { test: "data" },
      timestamp: Date.now(),
    };

    expect(isValidRealtimeEvent(invalidEvent)).toBe(false);
  });

  it("should return false when data is missing", () => {
    const invalidEvent = {
      type: "test:event",
      timestamp: Date.now(),
    };

    expect(isValidRealtimeEvent(invalidEvent)).toBe(false);
  });

  it("should return true for event with nested object data", () => {
    const validEvent = {
      type: "ai:generation:error",
      data: {
        error: "Failed",
        details: {
          code: 500,
          message: "Internal error",
        },
      },
      timestamp: Date.now(),
    };

    expect(isValidRealtimeEvent(validEvent)).toBe(true);
  });

  it("should return false when data is an array", () => {
    const invalidEvent = {
      type: "test:event",
      data: ["array", "data"],
      timestamp: Date.now(),
    };

    expect(isValidRealtimeEvent(invalidEvent)).toBe(false);
  });
});

describe("isBrowserActionStartedData", () => {
  it("should return false for null", () => {
    expect(isBrowserActionStartedData(null)).toBe(false);
  });

  it("should return false for missing action", () => {
    expect(isBrowserActionStartedData({})).toBe(false);
  });

  it("should return false for non-string action", () => {
    expect(isBrowserActionStartedData({ action: 123 })).toBe(false);
  });

  it("should return true for valid minimal data", () => {
    expect(isBrowserActionStartedData({ action: "click" })).toBe(true);
  });

  it("should return true for valid data with optional ref and value", () => {
    expect(isBrowserActionStartedData({ action: "click", ref: "btn", value: "x" })).toBe(true);
  });

  it("should return false when ref is not a string", () => {
    expect(isBrowserActionStartedData({ action: "click", ref: 123 })).toBe(false);
  });

  it("should return false when value is not a string", () => {
    expect(isBrowserActionStartedData({ action: "click", value: 123 })).toBe(false);
  });

  it("should return true for typed BrowserActionStartedEventData", () => {
    const data: BrowserActionStartedEventData = {
      action: "click",
      ref: "Submit button",
    };
    expect(isBrowserActionStartedData(data)).toBe(true);
  });

  it("should return true when ref and value are explicitly undefined", () => {
    // This matches real event data from the core library
    const data = { action: "back", ref: undefined, value: undefined };
    expect(isBrowserActionStartedData(data)).toBe(true);
  });

  it("should return true for data with additional properties from WebAgentEventData", () => {
    // Real events include timestamp and iterationId from base interface
    const data = {
      action: "click",
      ref: "Submit",
      value: undefined,
      timestamp: 1234567890,
      iterationId: "iter-123",
    };
    expect(isBrowserActionStartedData(data)).toBe(true);
  });
});

describe("isAgentActionData", () => {
  it("should return true for valid agent action data with action property", () => {
    const data = { action: "extract" };
    expect(isAgentActionData(data)).toBe(true);
  });

  it("should return true for valid agent action data with action and value", () => {
    const data = { action: "extract", value: "some data" };
    expect(isAgentActionData(data)).toBe(true);
  });

  it("should return false for object without action property", () => {
    const data = { value: "some data" };
    expect(isAgentActionData(data)).toBe(false);
  });

  it("should return false for null", () => {
    expect(isAgentActionData(null)).toBe(false);
  });

  it("should return false for string", () => {
    expect(isAgentActionData("extract")).toBe(false);
  });
});

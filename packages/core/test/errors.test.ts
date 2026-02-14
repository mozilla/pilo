import { describe, it, expect } from "vitest";
import {
  RecoverableError,
  BrowserException,
  InvalidRefException,
  ElementNotFoundException,
  BrowserActionException,
  ToolExecutionError,
} from "../src/errors.js";

describe("Error Types", () => {
  describe("RecoverableError", () => {
    it("should create a recoverable error with message", () => {
      const error = new RecoverableError("Something went wrong");

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(RecoverableError);
      expect(error.message).toBe("Something went wrong");
      expect(error.name).toBe("RecoverableError");
      expect(error.isRecoverable).toBe(true);
      expect(error.context).toBeUndefined();
    });

    it("should create a recoverable error with context", () => {
      const context = { action: "click", ref: "btn1" };
      const error = new RecoverableError("Failed to click", context);

      expect(error.message).toBe("Failed to click");
      expect(error.context).toEqual(context);
      expect(error.isRecoverable).toBe(true);
    });
  });

  describe("BrowserException", () => {
    // BrowserException is abstract, so we test it through its subclasses
    it("should be a RecoverableError", () => {
      const error = new InvalidRefException("test");

      expect(error).toBeInstanceOf(RecoverableError);
      expect(error).toBeInstanceOf(BrowserException);
      expect(error.isRecoverable).toBe(true);
    });
  });

  describe("InvalidRefException", () => {
    it("should create an error with default message", () => {
      const error = new InvalidRefException("btn123");

      expect(error).toBeInstanceOf(InvalidRefException);
      expect(error).toBeInstanceOf(BrowserException);
      expect(error).toBeInstanceOf(RecoverableError);
      expect(error.message).toBe(
        "Invalid element reference 'btn123'. The element does not exist on the current page. Please check the page snapshot for valid element references.",
      );
      expect(error.name).toBe("InvalidRefException");
      expect(error.ref).toBe("btn123");
      expect(error.context).toEqual({ ref: "btn123" });
    });

    it("should create an error with custom message", () => {
      const error = new InvalidRefException("dup1", "Multiple elements found");

      expect(error.message).toBe("Multiple elements found");
      expect(error.ref).toBe("dup1");
      expect(error.context).toEqual({ ref: "dup1" });
    });

    it("should be recoverable", () => {
      const error = new InvalidRefException("test");
      expect(error.isRecoverable).toBe(true);
    });
  });

  describe("ElementNotFoundException", () => {
    it("should create an error with default message when no selector provided", () => {
      const error = new ElementNotFoundException();

      expect(error).toBeInstanceOf(ElementNotFoundException);
      expect(error).toBeInstanceOf(BrowserException);
      expect(error).toBeInstanceOf(RecoverableError);
      expect(error.message).toBe("Element not found on the page.");
      expect(error.name).toBe("ElementNotFoundException");
      expect(error.selector).toBeUndefined();
      expect(error.context).toEqual({ selector: undefined });
    });

    it("should create an error with selector-specific message", () => {
      const error = new ElementNotFoundException(".button");

      expect(error.message).toBe("Element with selector '.button' not found on the page.");
      expect(error.selector).toBe(".button");
      expect(error.context).toEqual({ selector: ".button" });
    });

    it("should create an error with custom message", () => {
      const error = new ElementNotFoundException("#submit", "Submit button is missing");

      expect(error.message).toBe("Submit button is missing");
      expect(error.selector).toBe("#submit");
    });

    it("should be recoverable", () => {
      const error = new ElementNotFoundException();
      expect(error.isRecoverable).toBe(true);
    });
  });

  describe("BrowserActionException", () => {
    it("should create an error with action and message", () => {
      const error = new BrowserActionException("click", "Click failed due to overlay");

      expect(error).toBeInstanceOf(BrowserActionException);
      expect(error).toBeInstanceOf(BrowserException);
      expect(error).toBeInstanceOf(RecoverableError);
      expect(error.message).toBe("Click failed due to overlay");
      expect(error.name).toBe("BrowserActionException");
      expect(error.action).toBe("click");
      expect(error.context).toEqual({ action: "click" });
    });

    it("should create an error with additional context", () => {
      const additionalContext = { element: "button", timeout: 5000 };
      const error = new BrowserActionException("fill", "Input is readonly", additionalContext);

      expect(error.message).toBe("Input is readonly");
      expect(error.action).toBe("fill");
      expect(error.context).toEqual({
        action: "fill",
        element: "button",
        timeout: 5000,
      });
    });

    it("should be recoverable", () => {
      const error = new BrowserActionException("hover", "Element not visible");
      expect(error.isRecoverable).toBe(true);
    });
  });

  describe("ToolExecutionError", () => {
    it("should create a tool execution error", () => {
      const error = new ToolExecutionError("Tool failed to execute");

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(RecoverableError);
      expect(error).toBeInstanceOf(ToolExecutionError);
      expect(error.message).toBe("Tool failed to execute");
      expect(error.name).toBe("ToolExecutionError");
      expect(error.isRecoverable).toBe(true);
      expect(error.isToolError).toBe(true);
      expect(error.toolName).toBeUndefined();
      expect(error.toolOutput).toBeUndefined();
    });

    it("should store tool context", () => {
      const context = {
        action: "click",
        ref: "btn1",
        output: { success: false, error: "Invalid ref" },
      };
      const error = new ToolExecutionError("Click failed", context);

      expect(error.message).toBe("Click failed");
      expect(error.context).toEqual(context);
      expect(error.toolName).toBe("click");
      expect(error.toolOutput).toEqual({ success: false, error: "Invalid ref" });
    });

    it("should be distinguishable from other RecoverableErrors", () => {
      const toolError = new ToolExecutionError("Tool error");
      const regularError = new RecoverableError("Regular error");

      expect(toolError).toBeInstanceOf(RecoverableError);
      expect(regularError).toBeInstanceOf(RecoverableError);

      // Only ToolExecutionError has isToolError flag
      expect((toolError as any).isToolError).toBe(true);
      expect((regularError as any).isToolError).toBeUndefined();
    });
  });

  describe("Error Hierarchy", () => {
    it("should maintain proper inheritance chain", () => {
      const invalidRef = new InvalidRefException("ref1");
      const notFound = new ElementNotFoundException(".selector");
      const actionError = new BrowserActionException("click", "Failed");
      const toolError = new ToolExecutionError("Tool failed");

      // All should be Error instances
      expect(invalidRef).toBeInstanceOf(Error);
      expect(notFound).toBeInstanceOf(Error);
      expect(actionError).toBeInstanceOf(Error);
      expect(toolError).toBeInstanceOf(Error);

      // All should be RecoverableError instances
      expect(invalidRef).toBeInstanceOf(RecoverableError);
      expect(notFound).toBeInstanceOf(RecoverableError);
      expect(actionError).toBeInstanceOf(RecoverableError);
      expect(toolError).toBeInstanceOf(RecoverableError);

      // Browser exceptions should be BrowserException instances
      expect(invalidRef).toBeInstanceOf(BrowserException);
      expect(notFound).toBeInstanceOf(BrowserException);
      expect(actionError).toBeInstanceOf(BrowserException);

      // ToolExecutionError is NOT a BrowserException
      expect(toolError).not.toBeInstanceOf(BrowserException);

      // Each should be its own type
      expect(invalidRef).toBeInstanceOf(InvalidRefException);
      expect(notFound).toBeInstanceOf(ElementNotFoundException);
      expect(actionError).toBeInstanceOf(BrowserActionException);
      expect(toolError).toBeInstanceOf(ToolExecutionError);
    });

    it("should have isRecoverable flag on all recoverable errors", () => {
      const errors = [
        new InvalidRefException("ref"),
        new ElementNotFoundException(),
        new BrowserActionException("action", "message"),
        new ToolExecutionError("tool error"),
      ];

      errors.forEach((error) => {
        expect(error.isRecoverable).toBe(true);
      });
    });
  });

  describe("Error Serialization", () => {
    it("should serialize to JSON properly", () => {
      const error = new InvalidRefException("btn1");
      const json = JSON.stringify(error);
      const parsed = JSON.parse(json);

      // Note: Error properties like message and stack are not enumerable by default
      // So we need to check what actually gets serialized
      expect(parsed).toHaveProperty("isRecoverable", true);
      expect(parsed).toHaveProperty("context", { ref: "btn1" });
      expect(parsed).toHaveProperty("ref", "btn1");
    });

    it("should have proper stack traces", () => {
      const error = new BrowserActionException("test", "Test error");

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain("BrowserActionException");
    });
  });
});

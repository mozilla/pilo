import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { tryJSONParse, parseToolCallArgs } from "../../src/utils/jsonParser.js";

describe("tryJSONParse", () => {
  // Store original console methods
  let originalWarn: typeof console.warn;

  beforeEach(() => {
    originalWarn = console.warn;
    console.warn = vi.fn();
  });

  afterEach(() => {
    console.warn = originalWarn;
  });

  it("should parse valid JSON directly", () => {
    const json = '{"key": "value", "number": 42}';
    const result = tryJSONParse(json);

    expect(result).toEqual({ key: "value", number: 42 });
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("should return null for null or undefined input", () => {
    expect(tryJSONParse(null as any)).toBeNull();
    expect(tryJSONParse(undefined as any)).toBeNull();
    expect(tryJSONParse("")).toBeNull();
  });

  it("should return null for non-string input", () => {
    expect(tryJSONParse(123 as any)).toBeNull();
    expect(tryJSONParse({} as any)).toBeNull();
    expect(tryJSONParse([] as any)).toBeNull();
  });

  it("should extract first JSON object from repeated JSON", () => {
    const repeatedJson = '{"action": "click"}{"action": "click"}{"action": "click"}';
    const result = tryJSONParse(repeatedJson);

    expect(result).toEqual({ action: "click" });
    expect(console.warn).toHaveBeenCalledWith(
      "Corrected malformed JSON response by extracting first valid object",
    );
  });

  it("should handle JSON with text before it", () => {
    const jsonWithPrefix = 'Some text before {"key": "value"} and after';
    const result = tryJSONParse(jsonWithPrefix);

    expect(result).toEqual({ key: "value" });
    expect(console.warn).toHaveBeenCalledWith(
      "Corrected malformed JSON response by extracting first valid object",
    );
  });

  it("should handle nested JSON objects correctly", () => {
    const nestedJson = '{"outer": {"inner": {"deep": "value"}, "count": 3}}';
    const result = tryJSONParse(nestedJson);

    expect(result).toEqual({
      outer: {
        inner: { deep: "value" },
        count: 3,
      },
    });
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("should handle JSON with escaped quotes", () => {
    const jsonWithEscapes = '{"message": "He said \\"hello\\" to me"}';
    const result = tryJSONParse(jsonWithEscapes);

    expect(result).toEqual({ message: 'He said "hello" to me' });
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("should handle JSON with arrays", () => {
    const jsonWithArray = '{"items": [1, 2, 3], "names": ["a", "b"]}';
    const result = tryJSONParse(jsonWithArray);

    expect(result).toEqual({ items: [1, 2, 3], names: ["a", "b"] });
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("should extract JSON from complex repeated pattern", () => {
    const complexRepeated = `
      {"completionQuality": "complete", "taskAssessment": "Done", "feedback": null}
      {"completionQuality": "complete", "taskAssessment": "Done", "feedback": null}
    `;
    const result = tryJSONParse(complexRepeated);

    expect(result).toEqual({
      completionQuality: "complete",
      taskAssessment: "Done",
      feedback: null,
    });
    expect(console.warn).toHaveBeenCalledWith(
      "Corrected malformed JSON response by extracting first valid object",
    );
  });

  it("should handle JSON with braces in string values", () => {
    const jsonWithBracesInString = '{"code": "function() { return {}; }"}';
    const result = tryJSONParse(jsonWithBracesInString);

    expect(result).toEqual({ code: "function() { return {}; }" });
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("should return null for completely invalid JSON", () => {
    const invalidJson = "This is not JSON at all";
    const result = tryJSONParse(invalidJson);

    expect(result).toBeNull();
  });

  it("should return null for incomplete JSON", () => {
    const incompleteJson = '{"key": "value"';
    const result = tryJSONParse(incompleteJson);

    expect(result).toBeNull();
  });

  it("should handle JSON starting with array bracket", () => {
    const arrayJson = "[1, 2, 3]";
    const result = tryJSONParse(arrayJson);

    expect(result).toEqual([1, 2, 3]);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("should extract object from mixed content", () => {
    const mixedContent = 'Error text: {"error": "Bad request"} Additional info';
    const result = tryJSONParse(mixedContent);

    expect(result).toEqual({ error: "Bad request" });
    expect(console.warn).toHaveBeenCalledWith(
      "Corrected malformed JSON response by extracting first valid object",
    );
  });
});

describe("parseToolCallArgs", () => {
  it("should return args if already an object", () => {
    const toolCall = {
      input: { ref: "btn1", value: "test" },
    };

    const result = parseToolCallArgs(toolCall);
    expect(result).toEqual({ ref: "btn1", value: "test" });
  });

  it("should parse args if it's a JSON string", () => {
    const toolCall = {
      input: '{"ref": "input1", "value": "hello"}',
    };

    const result = parseToolCallArgs(toolCall);
    expect(result).toEqual({ ref: "input1", value: "hello" });
  });

  it("should handle repeated JSON in args string", () => {
    const toolCall = {
      input: '{"action": "click"}{"action": "click"}',
    };

    const result = parseToolCallArgs(toolCall);
    expect(result).toEqual({ action: "click" });
  });

  it("should return empty object for invalid JSON string", () => {
    const toolCall = {
      input: "not valid json",
    };

    const result = parseToolCallArgs(toolCall);
    expect(result).toEqual({});
  });

  it("should use inputText if input is not present", () => {
    const toolCall = {
      inputText: '{"ref": "btn1"}',
    };

    const result = parseToolCallArgs(toolCall);
    expect(result).toEqual({ ref: "btn1" });
  });

  it("should return empty object if no args or argsText", () => {
    const toolCall = {};

    const result = parseToolCallArgs(toolCall);
    expect(result).toEqual({});
  });

  it("should handle null args", () => {
    const toolCall = {
      input: null,
    };

    const result = parseToolCallArgs(toolCall);
    expect(result).toEqual({});
  });

  it("should handle undefined args", () => {
    const toolCall = {
      input: undefined,
    };

    const result = parseToolCallArgs(toolCall);
    expect(result).toEqual({});
  });
});

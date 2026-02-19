import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getEnv } from "../../src/utils/env.js";

describe("utils/env", () => {
  describe("getEnv", () => {
    const originalEnv = process.env;

    beforeEach(() => {
      // Reset env for each test
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      // Restore original env
      process.env = originalEnv;
    });

    it("should return environment variable value when it exists", () => {
      process.env.TEST_VAR = "test_value";
      expect(getEnv("TEST_VAR")).toBe("test_value");
    });

    it("should return undefined when environment variable does not exist", () => {
      delete process.env.NON_EXISTENT_VAR;
      expect(getEnv("NON_EXISTENT_VAR")).toBeUndefined();
    });

    it("should handle empty string values", () => {
      process.env.EMPTY_VAR = "";
      expect(getEnv("EMPTY_VAR")).toBe("");
    });

    it("should handle special characters in values", () => {
      process.env.SPECIAL_VAR = "value!@#$%^&*()";
      expect(getEnv("SPECIAL_VAR")).toBe("value!@#$%^&*()");
    });
  });
});

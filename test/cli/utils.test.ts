import { describe, it, expect } from "vitest";
import {
  validateBrowser,
  getValidBrowsers,
  parseJsonData,
  parseResourcesList,
  parseConfigKeyValue,
  parseConfigValue,
  getPackageInfo,
} from "../../src/cli/utils.js";

describe("CLI Utils", () => {
  describe("validateBrowser", () => {
    it("should return true for valid browsers", () => {
      expect(validateBrowser("firefox")).toBe(true);
      expect(validateBrowser("chrome")).toBe(true);
      expect(validateBrowser("safari")).toBe(true);
      expect(validateBrowser("edge")).toBe(true);
    });

    it("should return false for invalid browsers", () => {
      expect(validateBrowser("invalid")).toBe(false);
      expect(validateBrowser("")).toBe(false);
      expect(validateBrowser("opera")).toBe(false);
    });
  });

  describe("getValidBrowsers", () => {
    it("should return array of valid browsers", () => {
      const browsers = getValidBrowsers();
      expect(browsers).toEqual(["firefox", "chrome", "chromium", "safari", "webkit", "edge"]);
      expect(browsers.length).toBe(6);
    });
  });

  describe("parseJsonData", () => {
    it("should parse valid JSON", () => {
      expect(parseJsonData('{"key": "value"}')).toEqual({ key: "value" });
      expect(parseJsonData("[1, 2, 3]")).toEqual([1, 2, 3]);
      expect(parseJsonData("true")).toBe(true);
      expect(parseJsonData("null")).toBe(null);
    });

    it("should throw error for invalid JSON", () => {
      expect(() => parseJsonData("{invalid}")).toThrow("Invalid JSON");
      expect(() => parseJsonData("")).toThrow("Invalid JSON");
      expect(() => parseJsonData("undefined")).toThrow("Invalid JSON");
    });
  });

  describe("parseResourcesList", () => {
    it("should parse comma-separated resources", () => {
      expect(parseResourcesList("image,stylesheet")).toEqual(["image", "stylesheet"]);
      expect(parseResourcesList("media, font, manifest")).toEqual(["media", "font", "manifest"]);
      expect(parseResourcesList("")).toEqual([]);
    });

    it("should handle whitespace and empty values", () => {
      expect(parseResourcesList("  image  ,  , stylesheet  ")).toEqual(["image", "stylesheet"]);
      expect(parseResourcesList(",,")).toEqual([]);
    });
  });

  describe("parseConfigKeyValue", () => {
    it("should parse valid key=value format", () => {
      expect(parseConfigKeyValue("key=value")).toEqual({ key: "key", value: "value" });
      expect(parseConfigKeyValue("browser=chrome")).toEqual({ key: "browser", value: "chrome" });
      expect(parseConfigKeyValue("headless=true")).toEqual({ key: "headless", value: "true" });
    });

    it("should handle values with equals signs", () => {
      expect(parseConfigKeyValue("api_key=sk-test=123")).toEqual({
        key: "api_key",
        value: "sk-test=123",
      });
    });

    it("should throw error for invalid format", () => {
      expect(() => parseConfigKeyValue("invalid")).toThrow("Invalid format. Use: key=value");
      expect(() => parseConfigKeyValue("")).toThrow("Invalid format. Use: key=value");
    });

    it("should throw error for empty key", () => {
      expect(() => parseConfigKeyValue("=value")).toThrow("Key cannot be empty");
      expect(() => parseConfigKeyValue("  =value")).toThrow("Key cannot be empty");
    });
  });

  describe("parseConfigValue", () => {
    it("should parse boolean values", () => {
      expect(parseConfigValue("true")).toBe(true);
      expect(parseConfigValue("false")).toBe(false);
    });

    it("should parse numeric values", () => {
      expect(parseConfigValue("123")).toBe(123);
      expect(parseConfigValue("0")).toBe(0);
      expect(parseConfigValue("-45")).toBe(-45);
      expect(parseConfigValue("3.14")).toBe(3.14);
    });

    it("should return strings for non-boolean, non-numeric values", () => {
      expect(parseConfigValue("chrome")).toBe("chrome");
      expect(parseConfigValue("sk-test123")).toBe("sk-test123");
      expect(parseConfigValue("")).toBe("");
    });
  });

  describe("getPackageInfo", () => {
    it("should return package information", () => {
      const info = getPackageInfo();
      expect(info).toHaveProperty("name");
      expect(info).toHaveProperty("version");
      expect(info).toHaveProperty("description");
      expect(typeof info.name).toBe("string");
      expect(typeof info.version).toBe("string");
      expect(typeof info.description).toBe("string");
    });
  });
});

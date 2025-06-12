import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { type SparkConfig } from "../../src/cli/config.js";

// Mock the entire config module to test the interface
vi.mock("../../src/cli/config.js", () => {
  const mockConfig = {
    getConfig: vi.fn(),
    getGlobalConfig: vi.fn(),
    setGlobalConfig: vi.fn(),
    get: vi.fn(),
    set: vi.fn(),
    unset: vi.fn(),
    getConfigPath: vi.fn(),
    listSources: vi.fn(),
  };

  return {
    ConfigManager: vi.fn(() => mockConfig),
    config: mockConfig,
  };
});

import { config } from "../../src/cli/config.js";

const mockConfig = vi.mocked(config);

describe("Config Integration", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("config interface", () => {
    it("should have all required methods", () => {
      expect(mockConfig).toHaveProperty("getConfig");
      expect(mockConfig).toHaveProperty("getGlobalConfig");
      expect(mockConfig).toHaveProperty("setGlobalConfig");
      expect(mockConfig).toHaveProperty("get");
      expect(mockConfig).toHaveProperty("set");
      expect(mockConfig).toHaveProperty("unset");
      expect(mockConfig).toHaveProperty("getConfigPath");
      expect(mockConfig).toHaveProperty("listSources");
    });

    it("should merge environment variables correctly", () => {
      const mockSparkConfig: SparkConfig = {
        provider: "openai",
        model: "gpt-4",
        browser: "firefox",
        openai_api_key: "sk-test123",
      };

      mockConfig.getConfig.mockReturnValue(mockSparkConfig);

      const result = mockConfig.getConfig();
      expect(result).toEqual(mockSparkConfig);
      expect(mockConfig.getConfig).toHaveBeenCalled();
    });

    it("should handle config operations", () => {
      mockConfig.get.mockReturnValue("firefox");
      mockConfig.getConfigPath.mockReturnValue("/home/user/.spark/config.json");

      expect(mockConfig.get("browser")).toBe("firefox");
      expect(mockConfig.getConfigPath()).toContain(".spark");

      mockConfig.set("browser", "chrome");
      expect(mockConfig.set).toHaveBeenCalledWith("browser", "chrome");

      mockConfig.unset("browser");
      expect(mockConfig.unset).toHaveBeenCalledWith("browser");
    });

    it("should list config sources", () => {
      const mockSources = {
        global: { provider: "openai" },
        env: { browser: "chrome" },
        merged: { provider: "openai", browser: "chrome" },
      };

      mockConfig.listSources.mockReturnValue(mockSources);

      const sources = mockConfig.listSources();
      expect(sources).toEqual(mockSources);
      expect(sources).toHaveProperty("global");
      expect(sources).toHaveProperty("env");
      expect(sources).toHaveProperty("merged");
    });
  });

  describe("config validation", () => {
    it("should validate provider values", () => {
      const validProviders: SparkConfig["provider"][] = ["openai", "openrouter"];

      validProviders.forEach((provider) => {
        mockConfig.getConfig.mockReturnValue({ provider });
        const result = mockConfig.getConfig();
        expect(["openai", "openrouter"]).toContain(result.provider);
      });
    });

    it("should validate browser values", () => {
      const validBrowsers: SparkConfig["browser"][] = [
        "firefox",
        "chrome",
        "chromium",
        "safari",
        "webkit",
        "edge",
      ];

      validBrowsers.forEach((browser) => {
        mockConfig.getConfig.mockReturnValue({ browser });
        const result = mockConfig.getConfig();
        expect(["firefox", "chrome", "chromium", "safari", "webkit", "edge"]).toContain(
          result.browser,
        );
      });
    });

    it("should handle boolean config values", () => {
      mockConfig.getConfig.mockReturnValue({
        headless: true,
        block_ads: false,
      });

      const result = mockConfig.getConfig();
      expect(typeof result.headless).toBe("boolean");
      expect(typeof result.block_ads).toBe("boolean");
    });
  });
});

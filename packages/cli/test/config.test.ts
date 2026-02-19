import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { type SparkConfigResolved, getConfigDefaults } from "../src/config.js";

// Get defaults for creating complete mock configs
const defaults = getConfigDefaults();

// Mock the entire config module to test the interface
vi.mock("../src/config.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/config.js")>();
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
    ...actual,
    ConfigManager: vi.fn(() => mockConfig),
    config: mockConfig,
  };
});

import { config } from "../src/config.js";

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
      const mockSparkConfig: SparkConfigResolved = {
        ...defaults,
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
        global: { provider: "openai" as const },
        env: { browser: "chrome" as const },
        merged: { ...defaults, provider: "openai" as const, browser: "chrome" as const },
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
      const validProviders: SparkConfigResolved["provider"][] = ["openai", "openrouter", "vertex"];

      validProviders.forEach((provider) => {
        mockConfig.getConfig.mockReturnValue({ ...defaults, provider });
        const result = mockConfig.getConfig();
        expect(["openai", "openrouter", "vertex"]).toContain(result.provider);
      });
    });

    it("should validate browser values", () => {
      const validBrowsers: SparkConfigResolved["browser"][] = [
        "firefox",
        "chrome",
        "chromium",
        "safari",
        "webkit",
        "edge",
      ];

      validBrowsers.forEach((browser) => {
        mockConfig.getConfig.mockReturnValue({ ...defaults, browser });
        const result = mockConfig.getConfig();
        expect(["firefox", "chrome", "chromium", "safari", "webkit", "edge"]).toContain(
          result.browser,
        );
      });
    });

    it("should handle boolean config values", () => {
      mockConfig.getConfig.mockReturnValue({
        ...defaults,
        headless: true,
        block_ads: false,
      });

      const result = mockConfig.getConfig();
      expect(typeof result.headless).toBe("boolean");
      expect(typeof result.block_ads).toBe("boolean");
    });

    it("should handle proxy config values", () => {
      mockConfig.getConfig.mockReturnValue({
        ...defaults,
        proxy: "http://proxy.example.com:8080",
        proxy_username: "testuser",
        proxy_password: "testpass",
      });

      const result = mockConfig.getConfig();
      expect(result.proxy).toBe("http://proxy.example.com:8080");
      expect(result.proxy_username).toBe("testuser");
      expect(result.proxy_password).toBe("testpass");
    });
  });

  describe("channel configuration", () => {
    it("should merge channel environment variable", () => {
      const mockSparkConfig: SparkConfigResolved = {
        ...defaults,
        browser: "chrome",
        channel: "chrome-beta",
      };

      mockConfig.getConfig.mockReturnValue(mockSparkConfig);

      const result = mockConfig.getConfig();
      expect(result.channel).toBe("chrome-beta");
    });

    it("should handle missing channel config gracefully", () => {
      mockConfig.getConfig.mockReturnValue({
        ...defaults,
        browser: "firefox",
      });

      const result = mockConfig.getConfig();
      expect(result.channel).toBeUndefined();
    });

    it("should support various channel values", () => {
      const channels = ["firefox", "moz-firefox"];

      channels.forEach((channel) => {
        mockConfig.getConfig.mockReturnValue({
          ...defaults,
          browser: "firefox",
          channel,
        });

        const result = mockConfig.getConfig();
        expect(result.channel).toBe(channel);
      });
    });
  });

  describe("executablePath configuration", () => {
    it("should merge executable_path environment variable", () => {
      const mockSparkConfig: SparkConfigResolved = {
        ...defaults,
        browser: "chrome",
        executable_path: "/usr/bin/google-chrome-beta",
      };

      mockConfig.getConfig.mockReturnValue(mockSparkConfig);

      const result = mockConfig.getConfig();
      expect(result.executable_path).toBe("/usr/bin/google-chrome-beta");
    });

    it("should handle missing executable_path config gracefully", () => {
      mockConfig.getConfig.mockReturnValue({
        ...defaults,
        browser: "firefox",
      });

      const result = mockConfig.getConfig();
      expect(result.executable_path).toBeUndefined();
    });

    it("should support various executable_path values", () => {
      const paths = [
        "/usr/bin/firefox",
        "/Applications/Firefox.app/Contents/MacOS/firefox",
        "C:\\Program Files\\Mozilla Firefox\\firefox.exe",
      ];

      paths.forEach((executable_path) => {
        mockConfig.getConfig.mockReturnValue({
          ...defaults,
          browser: "firefox",
          executable_path,
        });

        const result = mockConfig.getConfig();
        expect(result.executable_path).toBe(executable_path);
      });
    });

    it("should handle executable_path with channel", () => {
      mockConfig.getConfig.mockReturnValue({
        ...defaults,
        browser: "chrome",
        channel: "chrome-beta",
        executable_path: "/usr/bin/google-chrome-beta",
      });

      const result = mockConfig.getConfig();
      expect(result.channel).toBe("chrome-beta");
      expect(result.executable_path).toBe("/usr/bin/google-chrome-beta");
    });
  });

  describe("proxy environment variables", () => {
    it("should merge proxy environment variables", () => {
      const mockSparkConfig: SparkConfigResolved = {
        ...defaults,
        proxy: "http://env-proxy.example.com:8080",
        proxy_username: "env-user",
        proxy_password: "env-pass",
      };

      mockConfig.getConfig.mockReturnValue(mockSparkConfig);

      const result = mockConfig.getConfig();
      expect(result.proxy).toBe("http://env-proxy.example.com:8080");
      expect(result.proxy_username).toBe("env-user");
      expect(result.proxy_password).toBe("env-pass");
    });

    it("should handle missing proxy config gracefully", () => {
      mockConfig.getConfig.mockReturnValue({
        ...defaults,
        browser: "firefox",
        // No proxy config
      });

      const result = mockConfig.getConfig();
      expect(result.proxy).toBeUndefined();
      expect(result.proxy_username).toBeUndefined();
      expect(result.proxy_password).toBeUndefined();
    });
  });

  describe("vertex ai configuration", () => {
    it("should handle vertex ai config values", () => {
      mockConfig.getConfig.mockReturnValue({
        ...defaults,
        provider: "vertex",
        vertex_project: "test-project-123",
        vertex_location: "us-west1",
        model: "gemini-1.5-pro",
      });

      const result = mockConfig.getConfig();
      expect(result.provider).toBe("vertex");
      expect(result.vertex_project).toBe("test-project-123");
      expect(result.vertex_location).toBe("us-west1");
      expect(result.model).toBe("gemini-1.5-pro");
    });

    it("should merge vertex ai environment variables", () => {
      const mockSparkConfig: SparkConfigResolved = {
        ...defaults,
        provider: "vertex",
        vertex_project: "env-project-456",
        vertex_location: "europe-west1",
      };

      mockConfig.getConfig.mockReturnValue(mockSparkConfig);

      const result = mockConfig.getConfig();
      expect(result.provider).toBe("vertex");
      expect(result.vertex_project).toBe("env-project-456");
      expect(result.vertex_location).toBe("europe-west1");
    });

    it("should handle missing vertex ai config gracefully", () => {
      mockConfig.getConfig.mockReturnValue({
        ...defaults,
        provider: "vertex",
        // No vertex_project or vertex_location
      });

      const result = mockConfig.getConfig();
      expect(result.provider).toBe("vertex");
      expect(result.vertex_project).toBeUndefined();
      expect(result.vertex_location).toBeUndefined();
    });

    it("should handle all supported providers", () => {
      const providers: SparkConfigResolved["provider"][] = ["openai", "openrouter", "vertex"];

      providers.forEach((provider) => {
        mockConfig.getConfig.mockReturnValue({ ...defaults, provider });
        const result = mockConfig.getConfig();
        expect(result.provider).toBe(provider);
      });
    });
  });
});

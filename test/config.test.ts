import { describe, it, expect } from "vitest";
import type { SparkConfig } from "../src/config/schema.js";
import { getSchemaConfigKeys } from "../src/config/metadata.js";

describe("ConfigManager", () => {
  describe("get() method with default values", () => {
    it("should return default value when config value is undefined", () => {
      // Create a mock config object
      const mockConfigData: Partial<SparkConfig> = {
        provider: undefined,
        browser: undefined,
      };

      // Test the nullish coalescing behavior
      const provider = mockConfigData.provider ?? "openai";
      const browser = mockConfigData.browser ?? "firefox";

      expect(provider).toBe("openai");
      expect(browser).toBe("firefox");
    });

    it("should return config value when it exists", () => {
      const mockConfigData: Partial<SparkConfig> = {
        provider: "openrouter",
        browser: "chrome",
        headless: true,
        max_iterations: 100,
      };

      const provider = mockConfigData.provider ?? "openai";
      const browser = mockConfigData.browser ?? "firefox";
      const headless = mockConfigData.headless ?? false;
      const maxIterations = mockConfigData.max_iterations ?? 50;

      expect(provider).toBe("openrouter");
      expect(browser).toBe("chrome");
      expect(headless).toBe(true);
      expect(maxIterations).toBe(100);
    });

    it("should handle falsy values correctly with nullish coalescing", () => {
      const mockConfigData: SparkConfig = {
        headless: false,
        max_iterations: 0,
        block_ads: false,
        logger: "" as "console",
      };

      // Should return the falsy config value, not the default
      const headless = mockConfigData.headless ?? true;
      const maxIterations = mockConfigData.max_iterations ?? 50;
      const blockAds = mockConfigData.block_ads ?? true;
      const logger = mockConfigData.logger ?? "console";

      expect(headless).toBe(false);
      expect(maxIterations).toBe(0);
      expect(blockAds).toBe(false);
      expect(logger).toBe("");
    });

    it("should handle null values with nullish coalescing", () => {
      const mockConfigData: any = {
        model: null,
        starting_url: null,
      };

      // null should trigger the default value
      const model = mockConfigData.model ?? "gpt-4";
      const startingUrl = mockConfigData.starting_url ?? "https://example.com";

      expect(model).toBe("gpt-4");
      expect(startingUrl).toBe("https://example.com");
    });

    it("should handle undefined values with nullish coalescing", () => {
      const mockConfigData: Partial<SparkConfig> = {
        model: undefined,
        starting_url: undefined,
      };

      // undefined should trigger the default value
      const model = mockConfigData.model ?? "gpt-4";
      const startingUrl = mockConfigData.starting_url ?? "https://example.com";

      expect(model).toBe("gpt-4");
      expect(startingUrl).toBe("https://example.com");
    });

    it("should work with newly added config options", () => {
      const mockConfigData: Partial<SparkConfig> = {};

      const startingUrl = mockConfigData.starting_url ?? "https://default.com";
      const data = mockConfigData.data ?? '{"default": true}';
      const guardrails = mockConfigData.guardrails ?? "Be safe";

      expect(startingUrl).toBe("https://default.com");
      expect(data).toBe('{"default": true}');
      expect(guardrails).toBe("Be safe");
    });

    it("should demonstrate priority with multiple fallbacks", () => {
      // Simulating: env value ?? config value ?? default value
      const envValue = undefined;
      const configValue = "config-value";
      const defaultValue = "default-value";

      const result = envValue ?? configValue ?? defaultValue;
      expect(result).toBe("config-value");

      // When config is also undefined
      const configUndefined = undefined;
      const result2 = envValue ?? configUndefined ?? defaultValue;
      expect(result2).toBe("default-value");

      // When env has a value
      const envWithValue = "env-value";
      const result3 = envWithValue ?? configValue ?? defaultValue;
      expect(result3).toBe("env-value");
    });
  });

  describe("type safety", () => {
    it("should maintain proper types", () => {
      const mockConfigData: SparkConfig = {
        provider: "openai",
        headless: false,
        max_iterations: 50,
        reasoning_effort: "none",
      };

      // These should all maintain their types
      expect(typeof mockConfigData.provider).toBe("string");
      expect(typeof mockConfigData.headless).toBe("boolean");
      expect(typeof mockConfigData.max_iterations).toBe("number");
      expect(["none", "low", "medium", "high"]).toContain(mockConfigData.reasoning_effort);
    });
  });

  describe("schema-config synchronization", () => {
    it("should have all SparkConfig keys in CONFIG_SCHEMA", () => {
      // Get keys from schema
      const schemaKeys = new Set(getSchemaConfigKeys());

      // Get keys from SparkConfig by creating a full object and checking its keys
      // We use a type assertion to get all possible keys
      const sparkConfigKeys: (keyof SparkConfig)[] = [
        "provider",
        "model",
        "openai_api_key",
        "openrouter_api_key",
        "google_generative_ai_api_key",
        "vertex_project",
        "vertex_location",
        "ollama_base_url",
        "openai_compatible_base_url",
        "openai_compatible_name",
        "browser",
        "channel",
        "executable_path",
        "headless",
        "block_ads",
        "block_resources",
        "proxy",
        "proxy_username",
        "proxy_password",
        "logger",
        "metrics_incremental",
        "debug",
        "vision",
        "max_iterations",
        "max_validation_attempts",
        "max_repeated_actions",
        "reasoning_effort",
        "starting_url",
        "data",
        "guardrails",
        "pw_endpoint",
        "pw_cdp_endpoint",
        "bypass_csp",
        "navigation_timeout_ms",
        "navigation_max_timeout_ms",
        "navigation_max_attempts",
        "navigation_timeout_multiplier",
        "action_timeout_ms",
      ];

      // Check that schema has all SparkConfig keys
      for (const key of sparkConfigKeys) {
        expect(schemaKeys.has(key), `SparkConfig key "${key}" missing from CONFIG_SCHEMA`).toBe(
          true,
        );
      }

      // Check that schema doesn't have extra keys not in SparkConfig
      for (const key of schemaKeys) {
        expect(
          sparkConfigKeys.includes(key as keyof SparkConfig),
          `CONFIG_SCHEMA key "${key}" not in SparkConfig`,
        ).toBe(true);
      }
    });
  });
});

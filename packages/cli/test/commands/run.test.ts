import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Command } from "commander";
import { createRunCommand } from "../../src/commands/run.js";
import { getConfigDefaults } from "spark-core/config.js";

// Get defaults from schema (used for mocking config.getConfig)
const schemaDefaults = getConfigDefaults();

// Mock all the dependencies
vi.mock("spark-core/webAgent.js", () => ({
  WebAgent: vi.fn().mockImplementation(function () {
    return {
      execute: vi.fn().mockResolvedValue({
        success: true,
        finalAnswer: "Task completed",
      }),
      close: vi.fn().mockResolvedValue(undefined),
    };
  }),
}));

vi.mock("spark-core/browser/playwrightBrowser.js", () => ({
  PlaywrightBrowser: vi.fn().mockImplementation(function () {
    return {};
  }),
}));

// Mock the config module to avoid fs dependencies
vi.mock("spark-core/config.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("spark-core/config.js")>();
  // Return DEFAULTS from getConfig so run command gets proper default values
  return {
    ...actual,
    config: {
      get: vi.fn((key: string) => actual.DEFAULTS[key as keyof typeof actual.DEFAULTS]),
      getConfig: vi.fn(() => ({ ...actual.DEFAULTS })),
    },
  };
});

vi.mock("spark-core/provider.js", () => ({
  createAIProvider: vi.fn(() => ({})),
}));

vi.mock("spark-core/loggers/chalkConsole.js", () => ({
  ChalkConsoleLogger: vi.fn().mockImplementation(function () {
    return {};
  }),
}));

vi.mock("spark-core/loggers/json.js", () => ({
  JSONConsoleLogger: vi.fn().mockImplementation(function () {
    return {};
  }),
}));

vi.mock("../../src/utils.js", () => ({
  validateBrowser: vi.fn(() => true),
  getValidBrowsers: vi.fn(() => ["firefox", "chrome", "chromium"]),
  parseJsonData: vi.fn((data) => JSON.parse(data)),
  parseResourcesList: vi.fn((resources) => resources.split(",")),
}));

// Mock fs module - include all functions used by manager.ts
vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>();
  return {
    ...actual,
    default: actual,
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    // Type assertion needed for overloaded fs functions in test mocks
    readFileSync: vi.fn().mockReturnValue("{}") as typeof actual.readFileSync,
    existsSync: vi.fn().mockReturnValue(false) as typeof actual.existsSync,
  };
});

// Mock WebAgentEventEmitter
vi.mock("spark-core/events.js", () => ({
  WebAgentEventType: {
    AI_GENERATION: "ai:generation",
  },
  WebAgentEventEmitter: vi.fn().mockImplementation(function () {
    return {
      onEvent: vi.fn(),
      emit: vi.fn(),
    };
  }),
}));

// Mock browserSetup - browsers should be considered installed in tests
vi.mock("../../src/browserSetup.js", () => ({
  ensureBrowsersInstalled: vi.fn().mockResolvedValue(undefined),
}));

import { WebAgent } from "spark-core/webAgent.js";
import { PlaywrightBrowser } from "spark-core/browser/playwrightBrowser.js";
import { config } from "spark-core/config.js";
import { createAIProvider } from "spark-core/provider.js";
import { ChalkConsoleLogger } from "spark-core/loggers/chalkConsole.js";
import { JSONConsoleLogger } from "spark-core/loggers/json.js";
import { WebAgentEventEmitter } from "spark-core/events.js";
import * as fs from "fs";

const mockWebAgent = vi.mocked(WebAgent);
const mockPlaywrightBrowser = vi.mocked(PlaywrightBrowser);
const mockConfig = vi.mocked(config);
const mockCreateAIProvider = vi.mocked(createAIProvider);
const mockChalkConsoleLogger = vi.mocked(ChalkConsoleLogger);
const mockJSONConsoleLogger = vi.mocked(JSONConsoleLogger);

describe("CLI Run Command", () => {
  let command: Command;
  let originalExit: typeof process.exit;
  let mockExit: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Mock process.exit to prevent tests from actually exiting
    originalExit = process.exit;
    mockExit = vi.fn() as any;
    process.exit = mockExit as any;

    command = createRunCommand();
    vi.clearAllMocks();

    // Set up default config mock - use schema defaults
    mockConfig.get.mockImplementation((key: string) => {
      return schemaDefaults[key as keyof typeof schemaDefaults];
    });
  });

  afterEach(() => {
    process.exit = originalExit;
  });

  describe("Command Definition", () => {
    it("should have correct name and alias", () => {
      expect(command.name()).toBe("run");
      expect(command.alias()).toBe("r");
    });

    it("should have correct description", () => {
      expect(command.description()).toBe("Execute a web automation task");
    });

    it("should require task argument", () => {
      // The command should have a required argument for task
      const commandUsage = command.usage();
      expect(commandUsage).toContain("<task>");
    });
  });

  describe("Options Definition", () => {
    it("should have all core options", () => {
      const options = command.options;
      const optionFlags = options.map((opt) => opt.flags);

      // Core task options
      expect(optionFlags).toContain("-u, --url <url>");
      expect(optionFlags).toContain("-d, --data <json>");
      expect(optionFlags).toContain("-g, --guardrails <text>");

      // AI provider options
      expect(optionFlags).toContain("--provider <name>");
      expect(optionFlags).toContain("--model <name>");
      expect(optionFlags).toContain("--openai-api-key <key>");
      expect(optionFlags).toContain("--openrouter-api-key <key>");

      // Browser options
      expect(optionFlags).toContain("-b, --browser <name>");
      expect(optionFlags).toContain("--headless");
      expect(optionFlags).toContain("--debug");
      expect(optionFlags).toContain("--vision");
      expect(optionFlags).toContain("--block-ads");
      expect(optionFlags).toContain("--no-block-ads"); // Negation option
      expect(optionFlags).toContain("--block-resources <types>");
      expect(optionFlags).toContain("--pw-endpoint <url>");
      expect(optionFlags).toContain("--bypass-csp");

      // WebAgent options
      expect(optionFlags).toContain("--max-iterations <n>");
      expect(optionFlags).toContain("--max-validation-attempts <n>");

      // Proxy options
      expect(optionFlags).toContain("--proxy <url>");
      expect(optionFlags).toContain("--proxy-username <user>");
      expect(optionFlags).toContain("--proxy-password <pass>");

      // Logging options
      expect(optionFlags).toContain("--logger <type>");
    });

    it("should NOT have Commander defaults (defaults come from config)", () => {
      // Defaults should come from config.getConfig(), not Commander options
      // This prevents CLI options from overriding .env and config file values
      const options = command.options;

      const providerOption = options.find((opt) => opt.flags === "--provider <name>");
      expect(providerOption?.defaultValue).toBeUndefined();

      const browserOption = options.find((opt) => opt.flags === "-b, --browser <name>");
      expect(browserOption?.defaultValue).toBeUndefined();

      const maxIterationsOption = options.find((opt) => opt.flags === "--max-iterations <n>");
      expect(maxIterationsOption?.defaultValue).toBeUndefined();

      const maxValidationOption = options.find(
        (opt) => opt.flags === "--max-validation-attempts <n>",
      );
      expect(maxValidationOption?.defaultValue).toBeUndefined();
    });
  });

  describe("Command Execution", () => {
    beforeEach(() => {
      // Mock WebAgent instance
      const mockWebAgentInstance = {
        execute: vi.fn().mockResolvedValue({ success: true }),
        close: vi.fn().mockResolvedValue(undefined),
      };
      mockWebAgent.mockImplementation(function () {
        return mockWebAgentInstance as any;
      });
    });

    it("should execute with minimal options", async () => {
      const args = ["test task"];
      await command.parseAsync(args, { from: "user" });

      // Browser options come from config.getConfig() which returns DEFAULTS
      expect(mockPlaywrightBrowser).toHaveBeenCalledWith(
        expect.objectContaining({
          browser: "firefox",
          blockAds: true,
          blockResources: ["media", "manifest"],
          pwEndpoint: undefined,
          headless: false,
          bypassCSP: false, // Schema default
          proxyServer: undefined,
          proxyUsername: undefined,
          proxyPassword: undefined,
        }),
      );

      // createAIProvider is called with empty object when no CLI options specified
      // (defaults come from config.getConfig() inside createAIProvider)
      expect(mockCreateAIProvider).toHaveBeenCalledWith({});
      expect(mockWebAgent).toHaveBeenCalled();
    });

    it("should pass AI provider options correctly", async () => {
      const args = [
        "--provider",
        "openrouter",
        "--model",
        "anthropic/claude-3-sonnet",
        "--openai-api-key",
        "sk-test123",
        "--openrouter-api-key",
        "sk-or-test123",
        "test task",
      ];

      await command.parseAsync(args, { from: "user" });

      // Only explicitly set CLI options are passed as overrides
      // (reasoning_effort not specified, so not in overrides)
      expect(mockCreateAIProvider).toHaveBeenCalledWith({
        provider: "openrouter",
        model: "anthropic/claude-3-sonnet",
        openai_api_key: "sk-test123",
        openrouter_api_key: "sk-or-test123",
      });
    });

    it("should pass browser options correctly", async () => {
      const args = [
        "--browser",
        "chromium",
        "--headless",
        "--bypass-csp",
        "--pw-endpoint",
        "ws://localhost:9222",
        "--block-resources",
        "image,stylesheet",
        "test task",
      ];

      await command.parseAsync(args, { from: "user" });

      expect(mockPlaywrightBrowser).toHaveBeenCalledWith(
        expect.objectContaining({
          browser: "chromium",
          blockAds: true, // Default from --no-block-ads option
          blockResources: ["image", "stylesheet"],
          pwEndpoint: "ws://localhost:9222",
          headless: true,
          bypassCSP: true,
          proxyServer: undefined,
          proxyUsername: undefined,
          proxyPassword: undefined,
        }),
      );
    });

    it("should preserve boolean false from config when CLI option not specified", async () => {
      // Mock config returning headless=false (as if from .env SPARK_HEADLESS=false)
      // This ensures the ?? operator doesn't override explicit false values
      mockConfig.getConfig.mockReturnValueOnce({
        ...schemaDefaults,
        headless: false, // Explicitly false from .env
        block_ads: false, // Another boolean that's false
      });

      const args = ["test task"]; // Note: no --headless or --block-ads flags
      await command.parseAsync(args, { from: "user" });

      expect(mockPlaywrightBrowser).toHaveBeenCalledWith(
        expect.objectContaining({
          headless: false, // Should preserve the config value
          blockAds: false, // Should preserve the config value
        }),
      );
    });

    it("should pass navigation retry and action timeout options correctly", async () => {
      const args = [
        "--navigation-timeout-ms",
        "20000",
        "--navigation-max-attempts",
        "5",
        "--navigation-timeout-multiplier",
        "1.5",
        "--action-timeout-ms",
        "15000",
        "test task",
      ];

      await command.parseAsync(args, { from: "user" });

      expect(mockPlaywrightBrowser).toHaveBeenCalledWith(
        expect.objectContaining({
          actionTimeoutMs: 15000,
          navigationRetry: expect.objectContaining({
            baseTimeoutMs: 20000,
            maxAttempts: 5,
            timeoutMultiplier: 1.5,
          }),
        }),
      );
    });

    it("should pass WebAgent options correctly", async () => {
      const args = [
        "--debug",
        "--vision",
        "--max-iterations",
        "30",
        "--max-validation-attempts",
        "2",
        "--guardrails",
        "browse only",
        "test task",
      ];

      await command.parseAsync(args, { from: "user" });

      const webAgentCall = mockWebAgent.mock.calls[0];
      expect(webAgentCall[1]).toMatchObject({
        debug: true,
        vision: true,
        guardrails: "browse only",
        maxIterations: 30,
        maxValidationAttempts: 2,
      });
    });

    it("should set up generation logging when debug flag is enabled", async () => {
      const mockFs = vi.mocked(fs);
      const mockEventEmitter = vi.mocked(WebAgentEventEmitter);

      // Clear mocks before test
      mockFs.mkdirSync.mockClear();
      mockFs.writeFileSync.mockClear();
      mockEventEmitter.mockClear();

      const args = ["--debug", "test task"];
      await command.parseAsync(args, { from: "user" });

      // Should create debug/generations directory
      expect(mockFs.mkdirSync).toHaveBeenCalledWith(expect.stringContaining("debug/generations"), {
        recursive: true,
      });

      // Should create event emitter and set up listener
      expect(mockEventEmitter).toHaveBeenCalled();
      const emitterInstance = mockEventEmitter.mock.results[0].value;
      expect(emitterInstance.onEvent).toHaveBeenCalledWith("ai:generation", expect.any(Function));

      // Should pass the event emitter to WebAgent
      const webAgentCall = mockWebAgent.mock.calls[0];
      expect(webAgentCall[1]).toMatchObject({
        debug: true,
        eventEmitter: emitterInstance,
      });

      // Test that the listener writes to file when called
      const listener = emitterInstance.onEvent.mock.calls[0][1];
      const mockData = {
        messages: [{ role: "user", content: "test" }],
        usage: { totalTokens: 100 },
        finishReason: "stop",
        object: { type: "action", action: "click" },
      };

      listener(mockData);

      // Should write generation data to file
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        expect.stringMatching(/debug\/generations\/.*\.json$/),
        JSON.stringify(mockData, null, 2),
      );
    });

    it("should not set up generation logging when debug flag is not enabled", async () => {
      const mockFs = vi.mocked(fs);
      const mockEventEmitter = vi.mocked(WebAgentEventEmitter);

      // Clear mocks before test
      mockFs.mkdirSync.mockClear();
      mockEventEmitter.mockClear();

      const args = ["test task"];
      await command.parseAsync(args, { from: "user" });

      // Should not create debug directory
      expect(mockFs.mkdirSync).not.toHaveBeenCalled();

      // Event emitter should still be created but no AI_GENERATION listener
      expect(mockEventEmitter).toHaveBeenCalled();
      const emitterInstance = mockEventEmitter.mock.results[0].value;
      expect(emitterInstance.onEvent).not.toHaveBeenCalledWith(
        "ai:generation",
        expect.any(Function),
      );
    });

    it("should pass proxy options correctly", async () => {
      const args = [
        "--proxy",
        "http://proxy.company.com:8080",
        "--proxy-username",
        "user",
        "--proxy-password",
        "pass",
        "test task",
      ];

      await command.parseAsync(args, { from: "user" });

      expect(mockPlaywrightBrowser).toHaveBeenCalledWith(
        expect.objectContaining({
          browser: "firefox",
          blockAds: true,
          blockResources: ["media", "manifest"],
          pwEndpoint: undefined,
          headless: false,
          bypassCSP: false, // Schema default
          proxyServer: "http://proxy.company.com:8080",
          proxyUsername: "user",
          proxyPassword: "pass",
        }),
      );
    });

    it("should use JSON logger when specified", async () => {
      const args = ["--logger", "json", "test task"];
      await command.parseAsync(args, { from: "user" });

      expect(mockJSONConsoleLogger).toHaveBeenCalled();
      expect(mockChalkConsoleLogger).not.toHaveBeenCalled();
    });

    it("should use console logger by default", async () => {
      const args = ["test task"];
      await command.parseAsync(args, { from: "user" });

      expect(mockChalkConsoleLogger).toHaveBeenCalled();
      expect(mockJSONConsoleLogger).not.toHaveBeenCalled();
    });

    it("should handle URL and data options", async () => {
      const args = ["--url", "https://example.com", "--data", '{"key": "value"}', "test task"];

      await command.parseAsync(args, { from: "user" });

      const webAgentInstance = mockWebAgent.mock.results[0].value;
      expect(webAgentInstance.execute).toHaveBeenCalledWith("test task", {
        startingUrl: "https://example.com",
        data: {
          key: "value",
        },
      });
    });

    it("should handle no-block-ads option", async () => {
      const args = ["--no-block-ads", "test task"];
      await command.parseAsync(args, { from: "user" });

      expect(mockPlaywrightBrowser).toHaveBeenCalledWith(
        expect.objectContaining({
          blockAds: false,
        }),
      );
    });

    it("should close browser after execution", async () => {
      const args = ["test task"];
      await command.parseAsync(args, { from: "user" });

      const webAgentInstance = mockWebAgent.mock.results[0].value;
      expect(webAgentInstance.close).toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    it("should handle invalid JSON data", async () => {
      // Mock parseJsonData to throw an error
      const { parseJsonData } = await import("../../src/utils.js");
      vi.mocked(parseJsonData).mockImplementation(() => {
        throw new Error("Invalid JSON");
      });

      const args = ["--data", "invalid json", "test task"];
      await command.parseAsync(args, { from: "user" });

      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it("should handle invalid browser option", async () => {
      const args = ["--browser", "invalid", "test task"];

      // Commander's .choices() validation throws with "Allowed choices are" message
      await expect(command.parseAsync(args, { from: "user" })).rejects.toThrow(
        /Allowed choices are/i,
      );
    });

    it("should handle WebAgent execution errors", async () => {
      // Reset validateBrowser to return true so we get past browser validation
      const { validateBrowser } = await import("../../src/utils.js");
      vi.mocked(validateBrowser).mockReturnValue(true);

      const mockWebAgentInstance = {
        execute: vi.fn().mockRejectedValue(new Error("Execution failed")),
        close: vi.fn().mockResolvedValue(undefined),
      };

      // Clear previous mocks and set up new mock before command execution
      vi.clearAllMocks();
      mockWebAgent.mockImplementation(function () {
        return mockWebAgentInstance as any;
      });

      const args = ["test task"];
      await command.parseAsync(args, { from: "user" });

      // Just check that the process exited with error code
      expect(mockExit).toHaveBeenCalledWith(1);
    });
  });
});

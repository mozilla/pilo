import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Command } from "commander";
import { createRunCommand } from "../../../src/cli/commands/run.js";

// Mock all the dependencies
vi.mock("../../../src/webAgent.js", () => ({
  WebAgent: vi.fn().mockImplementation(() => ({
    execute: vi.fn().mockResolvedValue({
      success: true,
      finalAnswer: "Task completed",
    }),
    close: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock("../../../src/browser/playwrightBrowser.js", () => ({
  PlaywrightBrowser: vi.fn().mockImplementation(() => ({})),
}));

vi.mock("../../../src/config.js", () => ({
  config: {
    get: vi.fn(),
    getConfig: vi.fn(() => ({})),
  },
}));

vi.mock("../../../src/provider.js", () => ({
  createAIProvider: vi.fn(() => ({})),
}));

vi.mock("../../../src/loggers/chalkConsole.js", () => ({
  ChalkConsoleLogger: vi.fn().mockImplementation(() => ({})),
}));

vi.mock("../../../src/loggers/json.js", () => ({
  JSONConsoleLogger: vi.fn().mockImplementation(() => ({})),
}));

vi.mock("../../../src/cli/utils.js", () => ({
  validateBrowser: vi.fn(() => true),
  getValidBrowsers: vi.fn(() => ["firefox", "chrome", "chromium"]),
  parseJsonData: vi.fn((data) => JSON.parse(data)),
  parseResourcesList: vi.fn((resources) => resources.split(",")),
}));

// Mock fs module
vi.mock("fs", () => ({
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

// Mock WebAgentEventEmitter
vi.mock("../../../src/events.js", () => ({
  WebAgentEventType: {
    AI_GENERATION: "ai:generation",
  },
  WebAgentEventEmitter: vi.fn().mockImplementation(() => ({
    onEvent: vi.fn(),
    emit: vi.fn(),
  })),
}));

import { WebAgent } from "../../../src/webAgent.js";
import { PlaywrightBrowser } from "../../../src/browser/playwrightBrowser.js";
import { config } from "../../../src/config.js";
import { createAIProvider } from "../../../src/provider.js";
import { ChalkConsoleLogger } from "../../../src/loggers/chalkConsole.js";
import { JSONConsoleLogger } from "../../../src/loggers/json.js";
import { WebAgentEventEmitter } from "../../../src/events.js";
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
    mockExit = vi.fn<Parameters<typeof process.exit>, never>() as any;
    process.exit = mockExit as any;

    command = createRunCommand();
    vi.clearAllMocks();

    // Set up default config mock
    mockConfig.get.mockImplementation((key: string, defaultValue?: any) => {
      const defaults: Record<string, any> = {
        browser: "firefox",
        headless: false,
        block_resources: "media,manifest",
        max_iterations: 50,
        max_validation_attempts: 3,
        bypass_csp: false,
        logger: "console",
      };
      return defaults[key] ?? defaultValue;
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
      expect(optionFlags).toContain("--provider <provider>");
      expect(optionFlags).toContain("--model <model>");
      expect(optionFlags).toContain("--openai-api-key <key>");
      expect(optionFlags).toContain("--openrouter-api-key <key>");

      // Browser options
      expect(optionFlags).toContain("-b, --browser <browser>");
      expect(optionFlags).toContain("--headless");
      expect(optionFlags).toContain("--debug");
      expect(optionFlags).toContain("--vision");
      expect(optionFlags).toContain("--no-block-ads");
      expect(optionFlags).toContain("--block-resources <resources>");
      expect(optionFlags).toContain("--pw-endpoint <endpoint>");
      expect(optionFlags).toContain("--bypass-csp");

      // WebAgent options
      expect(optionFlags).toContain("--max-iterations <number>");
      expect(optionFlags).toContain("--max-validation-attempts <number>");

      // Proxy options
      expect(optionFlags).toContain("--proxy <url>");
      expect(optionFlags).toContain("--proxy-username <username>");
      expect(optionFlags).toContain("--proxy-password <password>");

      // Logging options
      expect(optionFlags).toContain("--logger <logger>");
    });

    it("should have correct default values", () => {
      const options = command.options;

      const providerOption = options.find((opt) => opt.flags === "--provider <provider>");
      expect(providerOption?.defaultValue).toBe("openai");

      const browserOption = options.find((opt) => opt.flags === "-b, --browser <browser>");
      expect(browserOption?.defaultValue).toBe("firefox");

      const maxIterationsOption = options.find((opt) => opt.flags === "--max-iterations <number>");
      expect(maxIterationsOption?.defaultValue).toBe("50");

      const maxValidationOption = options.find(
        (opt) => opt.flags === "--max-validation-attempts <number>",
      );
      expect(maxValidationOption?.defaultValue).toBe("3");
    });
  });

  describe("Command Execution", () => {
    beforeEach(() => {
      // Mock WebAgent instance
      const mockWebAgentInstance = {
        execute: vi.fn().mockResolvedValue({ success: true }),
        close: vi.fn().mockResolvedValue(undefined),
      };
      mockWebAgent.mockImplementation(() => mockWebAgentInstance as any);
    });

    it("should execute with minimal options", async () => {
      const args = ["test task"];
      await command.parseAsync(args, { from: "user" });

      expect(mockPlaywrightBrowser).toHaveBeenCalledWith({
        browser: "firefox",
        blockAds: true, // Default from --no-block-ads option
        blockResources: ["media", "manifest"], // Default from config
        pwEndpoint: undefined,
        headless: false,
        bypassCSP: false, // Default from config
        proxyServer: undefined,
        proxyUsername: undefined,
        proxyPassword: undefined,
      });

      expect(mockCreateAIProvider).toHaveBeenCalledWith({
        provider: "openai",
        reasoning_effort: "none",
      });
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

      expect(mockCreateAIProvider).toHaveBeenCalledWith({
        provider: "openrouter",
        model: "anthropic/claude-3-sonnet",
        openai_api_key: "sk-test123",
        openrouter_api_key: "sk-or-test123",
        reasoning_effort: "none",
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

      expect(mockPlaywrightBrowser).toHaveBeenCalledWith({
        browser: "chromium",
        blockAds: true, // Default from --no-block-ads option
        blockResources: ["image", "stylesheet"],
        pwEndpoint: "ws://localhost:9222",
        headless: true,
        bypassCSP: true,
        proxyServer: undefined,
        proxyUsername: undefined,
        proxyPassword: undefined,
      });
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

      expect(mockPlaywrightBrowser).toHaveBeenCalledWith({
        browser: "firefox",
        blockAds: true, // Default from --no-block-ads option
        blockResources: ["media", "manifest"], // Default from config
        pwEndpoint: undefined,
        headless: false,
        bypassCSP: false, // Default from config
        proxyServer: "http://proxy.company.com:8080",
        proxyUsername: "user",
        proxyPassword: "pass",
      });
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
      const { parseJsonData } = await import("../../../src/cli/utils.js");
      vi.mocked(parseJsonData).mockImplementation(() => {
        throw new Error("Invalid JSON");
      });

      const args = ["--data", "invalid json", "test task"];
      await command.parseAsync(args, { from: "user" });

      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it("should handle invalid browser option", async () => {
      // Mock validateBrowser to return false
      const { validateBrowser } = await import("../../../src/cli/utils.js");
      vi.mocked(validateBrowser).mockReturnValue(false);

      const args = ["--browser", "invalid", "test task"];
      await command.parseAsync(args, { from: "user" });

      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it("should handle WebAgent execution errors", async () => {
      // Reset validateBrowser to return true so we get past browser validation
      const { validateBrowser } = await import("../../../src/cli/utils.js");
      vi.mocked(validateBrowser).mockReturnValue(true);

      const mockWebAgentInstance = {
        execute: vi.fn().mockRejectedValue(new Error("Execution failed")),
        close: vi.fn().mockResolvedValue(undefined),
      };

      // Clear previous mocks and set up new mock before command execution
      vi.clearAllMocks();
      mockWebAgent.mockImplementation(() => mockWebAgentInstance as any);

      const args = ["test task"];
      await command.parseAsync(args, { from: "user" });

      // Just check that the process exited with error code
      expect(mockExit).toHaveBeenCalledWith(1);
    });
  });
});

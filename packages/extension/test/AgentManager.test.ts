import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AgentManager } from "../src/background/AgentManager";

vi.mock("@ai-sdk/openai");
vi.mock("@openrouter/ai-sdk-provider");
vi.mock("pilo-core/core");
vi.mock("../src/background/ExtensionBrowser");

import { createOpenAI, type OpenAIProvider } from "@ai-sdk/openai";
import { createOpenRouter, type OpenRouterProvider } from "@openrouter/ai-sdk-provider";
import { WebAgent } from "pilo-core/core";
import { ExtensionBrowser } from "../src/background/ExtensionBrowser";

describe("AgentManager", () => {
  let mockOpenAI: OpenAIProvider;
  let mockOpenRouter: OpenRouterProvider;
  let mockModel: unknown;
  let mockWebAgent: { execute: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockModel = vi.fn();

    mockOpenAI = vi.fn(() => mockModel) as unknown as OpenAIProvider;
    vi.mocked(createOpenAI).mockReturnValue(mockOpenAI);

    mockOpenRouter = vi.fn(() => mockModel) as unknown as OpenRouterProvider;
    vi.mocked(createOpenRouter).mockReturnValue(mockOpenRouter);

    mockWebAgent = {
      execute: vi.fn().mockResolvedValue({ finalAnswer: "test result" }),
      close: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(WebAgent).mockImplementation(function () {
      return mockWebAgent as unknown as WebAgent;
    });

    vi.mocked(ExtensionBrowser).mockImplementation(function () {
      // Return a minimal mock that satisfies the AriaBrowser interface
      return {
        browserName: "extension:chrome",
        navigateTo: vi.fn(),
        getCurrentUrl: vi.fn(),
        getSimplifiedDom: vi.fn(),
        performAction: vi.fn(),
        close: vi.fn(),
      } as unknown as ExtensionBrowser;
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Default Provider Behavior", () => {
    it("should use OpenAI provider by default", async () => {
      await AgentManager.runTask("test task", {
        apiKey: "test-key",
      });

      expect(createOpenAI).toHaveBeenCalled();
      expect(createOpenRouter).not.toHaveBeenCalled();
    });
  });

  describe("Accept Provider Parameter", () => {
    it("should accept provider option in runTask", async () => {
      await AgentManager.runTask("test task", {
        apiKey: "test-key",
        provider: "openai",
      });

      expect(createOpenAI).toHaveBeenCalled();
    });
  });

  describe("Create OpenRouter Provider", () => {
    it("should create OpenRouter provider when specified", async () => {
      await AgentManager.runTask("test task", {
        apiKey: "test-openrouter-key",
        provider: "openrouter",
      });

      expect(createOpenRouter).toHaveBeenCalled();
      expect(createOpenAI).not.toHaveBeenCalled();
    });
  });

  describe("OpenRouter Headers", () => {
    it("should include required headers for OpenRouter", async () => {
      await AgentManager.runTask("test task", {
        apiKey: "test-openrouter-key",
        provider: "openrouter",
      });

      expect(createOpenRouter).toHaveBeenCalledWith({
        apiKey: "test-openrouter-key",
        headers: {
          "HTTP-Referer": "https://github.com/mozilla/pilo",
          "X-Title": "Pilo Web Automation Tool",
        },
      });
    });
  });

  describe("OpenRouter Default Model", () => {
    it("should use google/gemini-2.5-flash as default for OpenRouter", async () => {
      await AgentManager.runTask("test task", {
        apiKey: "test-openrouter-key",
        provider: "openrouter",
      });

      expect(mockOpenRouter).toHaveBeenCalledWith("google/gemini-2.5-flash");
    });

    it("should use gpt-4.1-mini as default for OpenAI", async () => {
      await AgentManager.runTask("test task", {
        apiKey: "test-openai-key",
        provider: "openai",
      });

      expect(mockOpenAI).toHaveBeenCalledWith("gpt-4.1-mini");
    });
  });

  describe("OpenRouter Ignores apiEndpoint", () => {
    it("should ignore apiEndpoint for OpenRouter", async () => {
      await AgentManager.runTask("test task", {
        apiKey: "test-openrouter-key",
        provider: "openrouter",
        apiEndpoint: "https://custom-endpoint.com/v1",
      });

      expect(createOpenRouter).toHaveBeenCalledWith({
        apiKey: "test-openrouter-key",
        headers: {
          "HTTP-Referer": "https://github.com/mozilla/pilo",
          "X-Title": "Pilo Web Automation Tool",
        },
      });
    });

    it("should respect apiEndpoint for OpenAI", async () => {
      await AgentManager.runTask("test task", {
        apiKey: "test-openai-key",
        provider: "openai",
        apiEndpoint: "https://custom-endpoint.com/v1",
      });

      expect(createOpenAI).toHaveBeenCalledWith({
        apiKey: "test-openai-key",
        baseURL: "https://custom-endpoint.com/v1",
      });
    });
  });

  describe("Backward Compatibility", () => {
    it("should maintain backward compatibility with no provider param", async () => {
      await AgentManager.runTask("test task", {
        apiKey: "test-key",
        apiEndpoint: "https://custom.com/v1",
        model: "gpt-4o",
      });

      expect(createOpenAI).toHaveBeenCalledWith({
        apiKey: "test-key",
        baseURL: "https://custom.com/v1",
      });
      expect(mockOpenAI).toHaveBeenCalledWith("gpt-4o");
    });

    it("should use default OpenAI endpoint when none specified", async () => {
      await AgentManager.runTask("test task", {
        apiKey: "test-key",
      });

      expect(createOpenAI).toHaveBeenCalledWith({
        apiKey: "test-key",
        baseURL: "https://api.openai.com/v1",
      });
    });
  });
});

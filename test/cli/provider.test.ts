import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createAIProvider, getAIProviderInfo } from "../../src/cli/provider.js";
import { LanguageModel } from "ai";

// Mock the config module
vi.mock("../../src/cli/config.js", () => ({
  config: {
    getConfig: vi.fn(),
  },
}));

// Mock AI SDK modules
vi.mock("ai", () => ({
  LanguageModel: vi.fn(),
}));

vi.mock("@ai-sdk/openai", () => ({
  openai: vi.fn((model) => ({ model, provider: "openai" })),
  createOpenAI: vi.fn((options) => (model: string) => ({
    model,
    provider: "openai",
    apiKey: options.apiKey,
  })),
}));

vi.mock("@openrouter/ai-sdk-provider", () => ({
  createOpenRouter: vi.fn((options) => (model: string) => ({
    model,
    provider: "openrouter",
    apiKey: options.apiKey,
  })),
}));

import { config } from "../../src/cli/config.js";
import { openai, createOpenAI } from "@ai-sdk/openai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

const mockConfig = vi.mocked(config);
const mockOpenai = vi.mocked(openai);
const mockCreateOpenAI = vi.mocked(createOpenAI);
const mockCreateOpenRouter = vi.mocked(createOpenRouter);

describe("Provider", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("createAIProvider", () => {
    it("should create OpenAI provider with default model", () => {
      mockConfig.getConfig.mockReturnValue({
        provider: "openai",
        openai_api_key: "sk-test123",
      });

      process.env.OPENAI_API_KEY = "sk-env-key";

      createAIProvider();

      expect(mockCreateOpenAI).toHaveBeenCalledWith({
        apiKey: "sk-test123",
      });
    });

    it("should use default openai instance when env key matches", () => {
      process.env.OPENAI_API_KEY = "sk-test123";

      mockConfig.getConfig.mockReturnValue({
        provider: "openai",
        openai_api_key: "sk-test123",
      });

      createAIProvider();

      expect(mockOpenai).toHaveBeenCalledWith("gpt-4.1");
      expect(mockCreateOpenAI).not.toHaveBeenCalled();
    });

    it("should create OpenRouter provider", () => {
      mockConfig.getConfig.mockReturnValue({
        provider: "openrouter",
        model: "openai/gpt-4.1",
        openrouter_api_key: "sk-or-test123",
      });

      createAIProvider();

      expect(mockCreateOpenRouter).toHaveBeenCalledWith({
        apiKey: "sk-or-test123",
        headers: {
          "HTTP-Referer": "https://github.com/your-org/spark",
          "X-Title": "Spark Web Automation Tool",
        },
      });
    });

    it("should use custom model when specified", () => {
      mockConfig.getConfig.mockReturnValue({
        provider: "openai",
        model: "gpt-4-turbo",
        openai_api_key: "sk-test123",
      });

      createAIProvider();

      expect(mockCreateOpenAI).toHaveBeenCalledWith({
        apiKey: "sk-test123",
      });
    });

    it("should throw error when OpenAI API key is missing", () => {
      mockConfig.getConfig.mockReturnValue({
        provider: "openai",
      });

      expect(() => createAIProvider()).toThrow("No OpenAI API key found. To get started:");
    });

    it("should throw error when OpenRouter API key is missing", () => {
      mockConfig.getConfig.mockReturnValue({
        provider: "openrouter",
      });

      expect(() => createAIProvider()).toThrow("No OpenRouter API key found. To get started:");
    });

    it("should throw error for unsupported provider", () => {
      mockConfig.getConfig.mockReturnValue({
        provider: "unsupported" as any,
        openai_api_key: "sk-test123",
      });

      expect(() => createAIProvider()).toThrow("Unsupported AI provider: unsupported");
    });

    it("should default to openai provider when none specified", () => {
      mockConfig.getConfig.mockReturnValue({
        openai_api_key: "sk-test123",
      });

      createAIProvider();

      expect(mockCreateOpenAI).toHaveBeenCalledWith({
        apiKey: "sk-test123",
      });
    });
  });

  describe("getAIProviderInfo", () => {
    it("should return OpenAI provider info with env key", () => {
      process.env.OPENAI_API_KEY = "sk-test123";

      mockConfig.getConfig.mockReturnValue({
        provider: "openai",
        model: "gpt-4-turbo",
      });

      const info = getAIProviderInfo();

      expect(info).toEqual({
        provider: "openai",
        model: "gpt-4-turbo",
        hasApiKey: true,
        keySource: "env",
      });
    });

    it("should return OpenRouter provider info with global key", () => {
      mockConfig.getConfig.mockReturnValue({
        provider: "openrouter",
        openrouter_api_key: "sk-or-test123",
      });

      const info = getAIProviderInfo();

      expect(info).toEqual({
        provider: "openrouter",
        model: "openai/gpt-4.1",
        hasApiKey: true,
        keySource: "global",
      });
    });

    it("should return info with no API key", () => {
      mockConfig.getConfig.mockReturnValue({
        provider: "openai",
      });

      const info = getAIProviderInfo();

      expect(info).toEqual({
        provider: "openai",
        model: "gpt-4.1",
        hasApiKey: false,
        keySource: "not_set",
      });
    });

    it("should use default values when not configured", () => {
      mockConfig.getConfig.mockReturnValue({});

      const info = getAIProviderInfo();

      expect(info).toEqual({
        provider: "openai",
        model: "gpt-4.1",
        hasApiKey: false,
        keySource: "not_set",
      });
    });

    it("should prioritize env key over global key", () => {
      process.env.OPENROUTER_API_KEY = "sk-or-env123";

      mockConfig.getConfig.mockReturnValue({
        provider: "openrouter",
        openrouter_api_key: "sk-or-global123",
      });

      const info = getAIProviderInfo();

      expect(info).toEqual({
        provider: "openrouter",
        model: "openai/gpt-4.1",
        hasApiKey: true,
        keySource: "env",
      });
    });
  });
});

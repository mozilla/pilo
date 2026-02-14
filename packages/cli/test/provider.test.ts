import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createAIProvider, getAIProviderInfo } from "../src/provider.js";

// Mock the config module using @core alias for consistency
vi.mock("@core/config.js", () => ({
  config: {
    getConfig: vi.fn(),
  },
  getConfigDefaults: vi.fn(() => ({
    provider: "openai",
    browser: "firefox",
    headless: false,
    block_ads: true,
    block_resources: "media,manifest",
    logger: "console",
    metrics_incremental: false,
    debug: false,
    vision: false,
    max_iterations: 50,
    max_validation_attempts: 3,
    max_repeated_actions: 2,
    bypass_csp: true,
    navigation_timeout_ms: 30000,
    navigation_max_timeout_ms: 120000,
    navigation_max_attempts: 3,
    navigation_timeout_multiplier: 2,
    action_timeout_ms: 30000,
    reasoning_effort: "none",
  })),
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

vi.mock("@ai-sdk/google", () => ({
  createGoogleGenerativeAI: vi.fn((options) => (model: string) => ({
    model,
    provider: "google",
    apiKey: options.apiKey,
  })),
}));

vi.mock("@ai-sdk/google-vertex", () => ({
  createVertex: vi.fn((options) => (model: string) => ({
    model,
    provider: "vertex",
    project: options.project,
    location: options.location,
  })),
}));

vi.mock("ollama-ai-provider-v2", () => ({
  ollama: vi.fn((model) => ({ model, provider: "ollama" })),
  createOllama: vi.fn((options) => (model: string) => ({
    model,
    provider: "ollama",
    baseURL: options.baseURL,
  })),
}));

vi.mock("@ai-sdk/openai-compatible", () => ({
  createOpenAICompatible: vi.fn((options) => (model: string) => ({
    model,
    provider: options.name || "openai-compatible",
    baseURL: options.baseURL,
  })),
}));

import { config, getConfigDefaults } from "@core/config.js";
import { openai, createOpenAI } from "@ai-sdk/openai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createVertex } from "@ai-sdk/google-vertex";
import { createOllama } from "ollama-ai-provider-v2";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

const mockConfig = vi.mocked(config);
const mockOpenai = vi.mocked(openai);
const mockCreateOpenAI = vi.mocked(createOpenAI);
const mockCreateOpenRouter = vi.mocked(createOpenRouter);
const mockCreateGoogleGenerativeAI = vi.mocked(createGoogleGenerativeAI);
const mockCreateVertex = vi.mocked(createVertex);
const mockCreateOllama = vi.mocked(createOllama);
const mockCreateOpenAICompatible = vi.mocked(createOpenAICompatible);

const defaults = getConfigDefaults();

describe("Provider", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    // Clear only Spark-related environment variables that could interfere with tests
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.SPARK_PROVIDER;
    delete process.env.SPARK_MODEL;
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("createAIProvider", () => {
    it("should create OpenAI provider with default model", () => {
      mockConfig.getConfig.mockReturnValue({
        ...defaults,
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
        ...defaults,
        provider: "openai",
        openai_api_key: "sk-test123",
      });

      createAIProvider();

      expect(mockOpenai).toHaveBeenCalledWith("gpt-4.1-mini");
      expect(mockCreateOpenAI).not.toHaveBeenCalled();
    });

    it("should create OpenRouter provider", () => {
      mockConfig.getConfig.mockReturnValue({
        ...defaults,
        provider: "openrouter",
        model: "openai/gpt-4.1",
        openrouter_api_key: "sk-or-test123",
      });

      createAIProvider();

      expect(mockCreateOpenRouter).toHaveBeenCalledWith({
        apiKey: "sk-or-test123",
        headers: {
          "HTTP-Referer": "https://github.com/Mozilla-Ocho/spark",
          "X-Title": "Spark Web Automation Tool",
        },
      });
    });

    it("should create Google provider with API key", () => {
      mockConfig.getConfig.mockReturnValue({
        ...defaults,
        provider: "google",
        model: "gemini-2.5-flash",
        google_generative_ai_api_key: "test-google-key",
      });

      createAIProvider();

      expect(mockCreateGoogleGenerativeAI).toHaveBeenCalledWith({
        apiKey: "test-google-key",
      });
    });

    it("should create Google provider with default model", () => {
      mockConfig.getConfig.mockReturnValue({
        ...defaults,
        provider: "google",
        google_generative_ai_api_key: "test-google-key",
      });

      createAIProvider();

      expect(mockCreateGoogleGenerativeAI).toHaveBeenCalledWith({
        apiKey: "test-google-key",
      });
    });

    it("should throw error when Google API key is missing", () => {
      mockConfig.getConfig.mockReturnValue({ ...defaults, provider: "google" });

      expect(() => createAIProvider()).toThrow(
        "No Google Generative AI API key found. To get started:",
      );
    });

    it("should use custom model when specified", () => {
      mockConfig.getConfig.mockReturnValue({
        ...defaults,
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
      mockConfig.getConfig.mockReturnValue({ ...defaults, provider: "openai" });

      expect(() => createAIProvider()).toThrow("No OpenAI API key found. To get started:");
    });

    it("should throw error when OpenRouter API key is missing", () => {
      mockConfig.getConfig.mockReturnValue({ ...defaults, provider: "openrouter" });

      expect(() => createAIProvider()).toThrow("No OpenRouter API key found. To get started:");
    });

    it("should create Vertex AI provider with project and location", () => {
      mockConfig.getConfig.mockReturnValue({
        ...defaults,
        provider: "vertex",
        vertex_project: "test-project",
        vertex_location: "us-west1",
        model: "gemini-1.5-pro",
      });

      createAIProvider();

      expect(mockCreateVertex).toHaveBeenCalledWith({
        project: "test-project",
        location: "us-west1",
      });
    });

    it("should create Vertex AI provider with default location", () => {
      mockConfig.getConfig.mockReturnValue({
        ...defaults,
        provider: "vertex",
        vertex_project: "test-project",
      });

      createAIProvider();

      expect(mockCreateVertex).toHaveBeenCalledWith({
        project: "test-project",
        location: "us-central1",
      });
    });

    it("should create Vertex AI provider using env vars", () => {
      process.env.GOOGLE_CLOUD_PROJECT = "env-project";
      process.env.GOOGLE_CLOUD_REGION = "europe-west1";

      mockConfig.getConfig.mockReturnValue({ ...defaults, provider: "vertex" });

      createAIProvider();

      expect(mockCreateVertex).toHaveBeenCalledWith({
        project: "env-project",
        location: "europe-west1",
      });
    });

    it("should prioritize GOOGLE_VERTEX_PROJECT over GOOGLE_CLOUD_PROJECT", () => {
      process.env.GOOGLE_VERTEX_PROJECT = "vertex-project";
      process.env.GOOGLE_CLOUD_PROJECT = "cloud-project";

      mockConfig.getConfig.mockReturnValue({ ...defaults, provider: "vertex" });

      createAIProvider();

      expect(mockCreateVertex).toHaveBeenCalledWith({
        project: "vertex-project",
        location: "us-central1",
      });
    });

    it("should use GCP_PROJECT as fallback", () => {
      process.env.GCP_PROJECT = "gcp-project";

      mockConfig.getConfig.mockReturnValue({ ...defaults, provider: "vertex" });

      createAIProvider();

      expect(mockCreateVertex).toHaveBeenCalledWith({
        project: "gcp-project",
        location: "us-central1",
      });
    });

    it("should throw error when Vertex AI project is missing", () => {
      mockConfig.getConfig.mockReturnValue({ ...defaults, provider: "vertex" });

      expect(() => createAIProvider()).toThrow("No Google Cloud project ID found. To get started:");
    });

    it("should use default gemini model for Vertex AI", () => {
      mockConfig.getConfig.mockReturnValue({
        ...defaults,
        provider: "vertex",
        vertex_project: "test-project",
      });

      createAIProvider();

      expect(mockCreateVertex).toHaveBeenCalledWith({
        project: "test-project",
        location: "us-central1",
      });
    });

    it("should throw error for unsupported provider", () => {
      mockConfig.getConfig.mockReturnValue({
        ...defaults,
        provider: "unsupported" as any,
        openai_api_key: "sk-test123",
      });

      expect(() => createAIProvider()).toThrow("Unsupported AI provider: unsupported");
    });

    it("should default to openai provider when none specified", () => {
      mockConfig.getConfig.mockReturnValue({ ...defaults, openai_api_key: "sk-test123" });

      createAIProvider();

      expect(mockCreateOpenAI).toHaveBeenCalledWith({
        apiKey: "sk-test123",
      });
    });

    it("should accept provider override", () => {
      mockConfig.getConfig.mockReturnValue({
        ...defaults,
        provider: "openai",
        openai_api_key: "sk-test123",
        openrouter_api_key: "sk-or-test123",
      });

      createAIProvider({ provider: "openrouter" });

      expect(mockCreateOpenRouter).toHaveBeenCalledWith({
        apiKey: "sk-or-test123",
        headers: {
          "HTTP-Referer": "https://github.com/Mozilla-Ocho/spark",
          "X-Title": "Spark Web Automation Tool",
        },
      });
    });

    it("should accept model override", () => {
      mockConfig.getConfig.mockReturnValue({
        ...defaults,
        provider: "openai",
        model: "gpt-4.1",
        openai_api_key: "sk-test123",
      });

      createAIProvider({ model: "gpt-4-turbo" });

      expect(mockCreateOpenAI).toHaveBeenCalledWith({
        apiKey: "sk-test123",
      });
    });

    it("should accept API key overrides", () => {
      mockConfig.getConfig.mockReturnValue({ ...defaults, provider: "openai" });

      createAIProvider({ openai_api_key: "sk-override123" });

      expect(mockCreateOpenAI).toHaveBeenCalledWith({
        apiKey: "sk-override123",
      });
    });

    it("should accept OpenRouter API key override", () => {
      mockConfig.getConfig.mockReturnValue({ ...defaults, provider: "openrouter" });

      createAIProvider({ openrouter_api_key: "sk-or-override123" });

      expect(mockCreateOpenRouter).toHaveBeenCalledWith({
        apiKey: "sk-or-override123",
        headers: {
          "HTTP-Referer": "https://github.com/Mozilla-Ocho/spark",
          "X-Title": "Spark Web Automation Tool",
        },
      });
    });

    it("should combine multiple overrides", () => {
      mockConfig.getConfig.mockReturnValue({
        ...defaults,
        provider: "openai",
        model: "gpt-4.1",
        openai_api_key: "sk-config123",
      });

      createAIProvider({
        provider: "openrouter",
        model: "anthropic/claude-3-sonnet",
        openrouter_api_key: "sk-or-override123",
      });

      expect(mockCreateOpenRouter).toHaveBeenCalledWith({
        apiKey: "sk-or-override123",
        headers: {
          "HTTP-Referer": "https://github.com/Mozilla-Ocho/spark",
          "X-Title": "Spark Web Automation Tool",
        },
      });
    });

    it("should create Ollama provider with default settings", () => {
      mockConfig.getConfig.mockReturnValue({ ...defaults, provider: "ollama" });

      createAIProvider();

      expect(mockCreateOllama).toHaveBeenCalledWith({
        baseURL: "http://localhost:11434/api",
      });
    });

    it("should create Ollama provider with custom model", () => {
      mockConfig.getConfig.mockReturnValue({ ...defaults, provider: "ollama", model: "phi3" });

      createAIProvider();

      expect(mockCreateOllama).toHaveBeenCalledWith({
        baseURL: "http://localhost:11434/api",
      });
    });

    it("should create Ollama provider with custom base URL", () => {
      mockConfig.getConfig.mockReturnValue({
        ...defaults,
        provider: "ollama",
        model: "llama3.2",
        ollama_base_url: "http://localhost:8080/api",
      });

      createAIProvider();

      expect(mockCreateOllama).toHaveBeenCalledWith({
        baseURL: "http://localhost:8080/api",
      });
    });

    it("should create LMStudio provider", () => {
      mockConfig.getConfig.mockReturnValue({ ...defaults, provider: "lmstudio" });

      createAIProvider();

      expect(mockCreateOpenAICompatible).toHaveBeenCalledWith({
        name: "lmstudio",
        baseURL: "http://localhost:1234/v1",
      });
    });

    it("should create LMStudio provider with custom model", () => {
      mockConfig.getConfig.mockReturnValue({
        ...defaults,
        provider: "lmstudio",
        model: "my-local-model",
      });

      createAIProvider();

      expect(mockCreateOpenAICompatible).toHaveBeenCalledWith({
        name: "lmstudio",
        baseURL: "http://localhost:1234/v1",
      });
    });

    it("should create OpenAI-compatible provider with base URL", () => {
      mockConfig.getConfig.mockReturnValue({
        ...defaults,
        provider: "openai-compatible",
        openai_compatible_base_url: "http://localhost:8080/v1",
      });

      createAIProvider();

      expect(mockCreateOpenAICompatible).toHaveBeenCalledWith({
        name: "openai-compatible",
        baseURL: "http://localhost:8080/v1",
      });
    });

    it("should create OpenAI-compatible provider with custom name", () => {
      mockConfig.getConfig.mockReturnValue({
        ...defaults,
        provider: "openai-compatible",
        openai_compatible_base_url: "http://localhost:8080/v1",
        openai_compatible_name: "my-provider",
      });

      createAIProvider();

      expect(mockCreateOpenAICompatible).toHaveBeenCalledWith({
        name: "my-provider",
        baseURL: "http://localhost:8080/v1",
      });
    });

    it("should throw error when OpenAI-compatible provider lacks base URL", () => {
      mockConfig.getConfig.mockReturnValue({ ...defaults, provider: "openai-compatible" });

      expect(() => createAIProvider()).toThrow("OpenAI-compatible provider requires a base URL");
    });

    it("should use Ollama base URL from override", () => {
      mockConfig.getConfig.mockReturnValue({ ...defaults, provider: "ollama" });

      createAIProvider({
        ollama_base_url: "http://remote-ollama:11434/api",
      });

      expect(mockCreateOllama).toHaveBeenCalledWith({
        baseURL: "http://remote-ollama:11434/api",
      });
    });

    it("should use OpenAI-compatible base URL from override", () => {
      mockConfig.getConfig.mockReturnValue({ ...defaults, provider: "openai-compatible" });

      createAIProvider({
        openai_compatible_base_url: "http://my-server:8080/v1",
      });

      expect(mockCreateOpenAICompatible).toHaveBeenCalledWith({
        name: "openai-compatible",
        baseURL: "http://my-server:8080/v1",
      });
    });
  });

  describe("getAIProviderInfo", () => {
    it("should return OpenAI provider info with env key", () => {
      process.env.OPENAI_API_KEY = "sk-test123";

      mockConfig.getConfig.mockReturnValue({
        ...defaults,
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
        ...defaults,
        provider: "openrouter",
        openrouter_api_key: "sk-or-test123",
      });

      const info = getAIProviderInfo();

      expect(info).toEqual({
        provider: "openrouter",
        model: "openai/gpt-4.1-mini",
        hasApiKey: true,
        keySource: "global",
      });
    });

    it("should return Google provider info with env key", () => {
      process.env.GOOGLE_GENERATIVE_AI_API_KEY = "test-google-key";

      mockConfig.getConfig.mockReturnValue({
        ...defaults,
        provider: "google",
        model: "gemini-2.5-flash",
      });

      const info = getAIProviderInfo();

      expect(info).toEqual({
        provider: "google",
        model: "gemini-2.5-flash",
        hasApiKey: true,
        keySource: "env",
      });
    });

    it("should return Google provider info with global key", () => {
      mockConfig.getConfig.mockReturnValue({
        ...defaults,
        provider: "google",
        google_generative_ai_api_key: "test-google-key",
      });

      const info = getAIProviderInfo();

      expect(info).toEqual({
        provider: "google",
        model: "gemini-2.5-flash",
        hasApiKey: true,
        keySource: "global",
      });
    });

    it("should return Google provider info without API key", () => {
      mockConfig.getConfig.mockReturnValue({ ...defaults, provider: "google" });

      const info = getAIProviderInfo();

      expect(info).toEqual({
        provider: "google",
        model: "gemini-2.5-flash",
        hasApiKey: false,
        keySource: "not_set",
      });
    });

    it("should return info with no API key", () => {
      mockConfig.getConfig.mockReturnValue({ ...defaults, provider: "openai" });

      const info = getAIProviderInfo();

      expect(info).toEqual({
        provider: "openai",
        model: "gpt-4.1-mini",
        hasApiKey: false,
        keySource: "not_set",
      });
    });

    it("should use default values when not configured", () => {
      mockConfig.getConfig.mockReturnValue({ ...defaults });

      const info = getAIProviderInfo();

      expect(info).toEqual({
        provider: "openai",
        model: "gpt-4.1-mini",
        hasApiKey: false,
        keySource: "not_set",
      });
    });

    it("should prioritize env key over global key", () => {
      process.env.OPENROUTER_API_KEY = "sk-or-env123";

      mockConfig.getConfig.mockReturnValue({
        ...defaults,
        provider: "openrouter",
        openrouter_api_key: "fake-global-key-123",
      });

      const info = getAIProviderInfo();

      expect(info).toEqual({
        provider: "openrouter",
        model: "openai/gpt-4.1-mini",
        hasApiKey: true,
        keySource: "env",
      });
    });

    it("should return Vertex AI provider info with project configured", () => {
      mockConfig.getConfig.mockReturnValue({
        ...defaults,
        provider: "vertex",
        vertex_project: "test-project",
        vertex_location: "us-west1",
        model: "gemini-1.5-pro",
      });

      const info = getAIProviderInfo();

      expect(info).toEqual({
        provider: "vertex",
        model: "gemini-1.5-pro",
        hasApiKey: true,
        keySource: "adc",
      });
    });

    it("should return Vertex AI provider info with env project", () => {
      process.env.GOOGLE_CLOUD_PROJECT = "env-project";

      mockConfig.getConfig.mockReturnValue({ ...defaults, provider: "vertex" });

      const info = getAIProviderInfo();

      expect(info).toEqual({
        provider: "vertex",
        model: "gemini-2.5-flash",
        hasApiKey: true,
        keySource: "adc",
      });
    });

    it("should return Vertex AI provider info with GOOGLE_VERTEX_PROJECT", () => {
      process.env.GOOGLE_VERTEX_PROJECT = "vertex-project";

      mockConfig.getConfig.mockReturnValue({ ...defaults, provider: "vertex" });

      const info = getAIProviderInfo();

      expect(info).toEqual({
        provider: "vertex",
        model: "gemini-2.5-flash",
        hasApiKey: true,
        keySource: "adc",
      });
    });

    it("should return Vertex AI provider info with GCP_PROJECT fallback", () => {
      process.env.GCP_PROJECT = "gcp-project";

      mockConfig.getConfig.mockReturnValue({ ...defaults, provider: "vertex" });

      const info = getAIProviderInfo();

      expect(info).toEqual({
        provider: "vertex",
        model: "gemini-2.5-flash",
        hasApiKey: true,
        keySource: "adc",
      });
    });

    it("should return Vertex AI provider info without project", () => {
      mockConfig.getConfig.mockReturnValue({ ...defaults, provider: "vertex" });

      const info = getAIProviderInfo();

      expect(info).toEqual({
        provider: "vertex",
        model: "gemini-2.5-flash",
        hasApiKey: false,
        keySource: "not_set",
      });
    });

    it("should prioritize GOOGLE_VERTEX_PROJECT in provider info", () => {
      process.env.GOOGLE_VERTEX_PROJECT = "vertex-project";
      process.env.GOOGLE_CLOUD_PROJECT = "cloud-project";
      process.env.GCP_PROJECT = "gcp-project";

      mockConfig.getConfig.mockReturnValue({ ...defaults, provider: "vertex" });

      const info = getAIProviderInfo();

      expect(info).toEqual({
        provider: "vertex",
        model: "gemini-2.5-flash",
        hasApiKey: true,
        keySource: "adc",
      });
    });

    it("should return Ollama provider info", () => {
      mockConfig.getConfig.mockReturnValue({ ...defaults, provider: "ollama", model: "llama3.2" });

      const info = getAIProviderInfo();

      expect(info).toEqual({
        provider: "ollama",
        model: "llama3.2",
        hasApiKey: true,
        keySource: "global",
      });
    });

    it("should return Ollama provider info with default model", () => {
      mockConfig.getConfig.mockReturnValue({ ...defaults, provider: "ollama" });

      const info = getAIProviderInfo();

      expect(info).toEqual({
        provider: "ollama",
        model: "llama3.2",
        hasApiKey: true,
        keySource: "global",
      });
    });

    it("should return LMStudio provider info", () => {
      mockConfig.getConfig.mockReturnValue({
        ...defaults,
        provider: "lmstudio",
        model: "my-model",
      });

      const info = getAIProviderInfo();

      expect(info).toEqual({
        provider: "lmstudio",
        model: "my-model",
        hasApiKey: true,
        keySource: "global",
      });
    });

    it("should return LMStudio provider info with default model", () => {
      mockConfig.getConfig.mockReturnValue({ ...defaults, provider: "lmstudio" });

      const info = getAIProviderInfo();

      expect(info).toEqual({
        provider: "lmstudio",
        model: "local-model",
        hasApiKey: true,
        keySource: "global",
      });
    });

    it("should return OpenAI-compatible provider info with base URL configured", () => {
      mockConfig.getConfig.mockReturnValue({
        ...defaults,
        provider: "openai-compatible",
        openai_compatible_base_url: "http://localhost:8080/v1",
        model: "custom-model",
      });

      const info = getAIProviderInfo();

      expect(info).toEqual({
        provider: "openai-compatible",
        model: "custom-model",
        hasApiKey: true,
        keySource: "global",
      });
    });

    it("should return OpenAI-compatible provider info with env base URL", () => {
      process.env.SPARK_OPENAI_COMPATIBLE_BASE_URL = "http://localhost:8080/v1";

      mockConfig.getConfig.mockReturnValue({ ...defaults, provider: "openai-compatible" });

      const info = getAIProviderInfo();

      expect(info).toEqual({
        provider: "openai-compatible",
        model: "gpt-4",
        hasApiKey: true,
        keySource: "env",
      });
    });

    it("should return OpenAI-compatible provider info without base URL", () => {
      mockConfig.getConfig.mockReturnValue({ ...defaults, provider: "openai-compatible" });

      const info = getAIProviderInfo();

      expect(info).toEqual({
        provider: "openai-compatible",
        model: "gpt-4",
        hasApiKey: false,
        keySource: "not_set",
      });
    });
  });
});

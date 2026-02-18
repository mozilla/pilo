import { LanguageModel } from "ai";
import { openai, createOpenAI } from "@ai-sdk/openai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createVertex } from "@ai-sdk/google-vertex";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createOllama } from "ollama-ai-provider-v2";
import { config } from "./config/configManager.js";
import { getEnv } from "./utils/env.js";

export interface ProviderConfig {
  model: LanguageModel;
  providerOptions?: any;
}

/**
 * Creates and configures an AI language model based on the current configuration
 * Can be used by both CLI and server with optional overrides
 */
export function createAIProvider(overrides?: {
  provider?: string;
  model?: string;
  openai_api_key?: string;
  openrouter_api_key?: string;
  google_generative_ai_api_key?: string;
  vertex_project?: string;
  vertex_location?: string;
  ollama_base_url?: string;
  openai_compatible_base_url?: string;
  openai_compatible_name?: string;
  reasoning_effort?: "none" | "low" | "medium" | "high";
}): ProviderConfig {
  const currentConfig = config.getConfig();
  // currentConfig is SparkConfigResolved, so provider and reasoning_effort are guaranteed
  const provider = overrides?.provider ?? currentConfig.provider;
  const reasoningEffort = overrides?.reasoning_effort ?? currentConfig.reasoning_effort;

  // Create temporary config with overrides
  const configWithOverrides = {
    ...currentConfig,
    ...(overrides?.openai_api_key && { openai_api_key: overrides.openai_api_key }),
    ...(overrides?.openrouter_api_key && { openrouter_api_key: overrides.openrouter_api_key }),
    ...(overrides?.google_generative_ai_api_key && {
      google_generative_ai_api_key: overrides.google_generative_ai_api_key,
    }),
    ...(overrides?.vertex_project && { vertex_project: overrides.vertex_project }),
    ...(overrides?.vertex_location && { vertex_location: overrides.vertex_location }),
    ...(overrides?.ollama_base_url && { ollama_base_url: overrides.ollama_base_url }),
    ...(overrides?.openai_compatible_base_url && {
      openai_compatible_base_url: overrides.openai_compatible_base_url,
    }),
    ...(overrides?.openai_compatible_name && {
      openai_compatible_name: overrides.openai_compatible_name,
    }),
  };

  // Get API key and model
  const { apiKey, model } = getProviderConfig(provider, configWithOverrides, overrides?.model);

  const languageModel = createProviderFromConfig(provider, { apiKey, model, configWithOverrides });
  const providerOptions = buildProviderOptions(provider, reasoningEffort);

  return {
    model: languageModel,
    providerOptions,
  };
}

/**
 * Creates a provider instance from explicit configuration
 * Can be used by extension and other contexts that don't have file system config
 */
export function createProviderFromConfig(
  provider: string,
  config: {
    apiKey?: string;
    model: string;
    configWithOverrides?: any;
  },
): LanguageModel {
  const { apiKey, model, configWithOverrides } = config;

  switch (provider) {
    case "openai":
      return apiKey !== getEnv("OPENAI_API_KEY") ? createOpenAI({ apiKey })(model) : openai(model);

    case "openrouter":
      return createOpenRouter({
        apiKey,
        headers: {
          "HTTP-Referer": "https://github.com/Mozilla-Ocho/spark",
          "X-Title": "Spark Web Automation Tool",
        },
      })(model);

    case "google":
      return createGoogleGenerativeAI({
        apiKey,
      })(model);

    case "vertex":
      const { project, location } = getVertexConfig(configWithOverrides || {});
      return createVertex({
        project,
        location,
      })(model);

    case "ollama":
      const ollamaBaseUrl = configWithOverrides?.ollama_base_url || "http://localhost:11434/api";
      return createOllama({
        baseURL: ollamaBaseUrl,
      })(model);

    case "lmstudio":
      // LM Studio is a preconfigured openai-compatible provider
      return createOpenAICompatible({
        name: "lmstudio",
        baseURL: "http://localhost:1234/v1",
      })(model);

    case "openai-compatible":
      const baseUrl = configWithOverrides?.openai_compatible_base_url;
      if (!baseUrl) {
        throw new Error(
          `OpenAI-compatible provider requires a base URL. To get started:
          
1. Set the base URL with: spark config --set openai_compatible_base_url=http://localhost:8080/v1
2. Or set environment variable: export SPARK_OPENAI_COMPATIBLE_BASE_URL=http://localhost:8080/v1

Run 'spark config --show' to check your current configuration.`,
        );
      }
      return createOpenAICompatible({
        name: configWithOverrides?.openai_compatible_name || "openai-compatible",
        baseURL: baseUrl,
      })(model);

    default:
      throw new Error(`Unsupported AI provider: ${provider}`);
  }
}

/**
 * Get API key and model for a provider
 */
function getProviderConfig(provider: string, currentConfig: any, modelOverride?: string) {
  const defaultModels = {
    openai: "gpt-4.1-mini",
    openrouter: "openai/gpt-4.1-mini",
    google: "gemini-2.5-flash",
    vertex: "gemini-2.5-flash",
    ollama: "llama3.2",
    lmstudio: "local-model",
    "openai-compatible": "gpt-4",
  };

  const model =
    modelOverride || currentConfig.model || defaultModels[provider as keyof typeof defaultModels];

  let apiKey: string | undefined;
  if (provider === "openrouter") {
    apiKey = currentConfig.openrouter_api_key;
    if (!apiKey) {
      throw new Error(
        `No OpenRouter API key found. To get started:

1. Get an API key from https://openrouter.ai/keys
2. Set it with: spark config --set openrouter_api_key=your-key
3. Or use OpenAI instead: spark config --set provider=openai

Run 'spark config --show' to check your current configuration.`,
      );
    }
  } else if (provider === "google") {
    apiKey = currentConfig.google_generative_ai_api_key;
    if (!apiKey) {
      throw new Error(
        `No Google Generative AI API key found. To get started:

1. Get an API key from https://aistudio.google.com/apikey
2. Set it with: spark config --set google_generative_ai_api_key=your-key
3. Or use OpenAI instead: spark config --set provider=openai

Run 'spark config --show' to check your current configuration.`,
      );
    }
  } else if (provider === "vertex") {
    // Vertex AI uses Application Default Credentials, no API key needed
    apiKey = undefined;
  } else if (provider === "ollama" || provider === "lmstudio" || provider === "openai-compatible") {
    // Local providers don't need API keys
    apiKey = undefined;
  } else {
    apiKey = currentConfig.openai_api_key;
    if (!apiKey) {
      throw new Error(
        `No OpenAI API key found. To get started:

1. Get an API key from https://platform.openai.com/api-keys
2. Set it with: spark config --set openai_api_key=your-key
3. Or use OpenRouter instead: spark config --set provider=openrouter

Run 'spark config --show' to check your current configuration.`,
      );
    }
  }

  return { apiKey, model };
}

/**
 * Get Vertex AI configuration (project and location)
 */
function getVertexConfig(currentConfig: any) {
  // Try to get project from various sources in order of preference:
  // 1. Explicit configuration
  // 2. Environment variables (GOOGLE_VERTEX_PROJECT or GOOGLE_CLOUD_PROJECT)
  // 3. Google Cloud metadata service (if running in GCP)
  const project =
    currentConfig.vertex_project ||
    getEnv("GOOGLE_VERTEX_PROJECT") ||
    getEnv("GOOGLE_CLOUD_PROJECT") ||
    getEnv("GCP_PROJECT");

  // Try to get location from various sources:
  // 1. Explicit configuration
  // 2. Environment variables
  // 3. Google Cloud metadata service (if running in GCP)
  // 4. Default to us-central1
  const location =
    currentConfig.vertex_location ||
    getEnv("GOOGLE_VERTEX_LOCATION") ||
    getEnv("GOOGLE_CLOUD_REGION") ||
    "us-central1";

  if (!project) {
    throw new Error(
      `No Google Cloud project ID found. To get started:

1. Set your project ID with: spark config --set vertex_project=your-project-id
2. Or set environment variable: export GOOGLE_VERTEX_PROJECT=your-project-id
3. When running in Google Cloud (Cloud Run, Compute Engine, etc.), the project should be auto-detected
4. Ensure Application Default Credentials are set up: gcloud auth application-default login

Run 'spark config --show' to check your current configuration.`,
    );
  }

  return { project, location };
}

/**
 * Convert effort level to token count for providers that need it
 */
function effortToTokens(effort: "low" | "medium" | "high"): number {
  const tokenMapping = {
    low: 1024, // 1K tokens for low effort
    medium: 2048, // 2K tokens for medium effort
    high: 4096, // 4K tokens for high effort
  } as const;

  return tokenMapping[effort];
}

/**
 * Build provider-specific options based on reasoning effort
 */
function buildProviderOptions(
  provider: string,
  reasoningEffort: "none" | "low" | "medium" | "high",
): any {
  if (reasoningEffort === "none") {
    return undefined;
  }

  switch (provider) {
    case "openai":
      return {
        openai: {
          reasoningEffort,
        },
      };

    case "openrouter":
      return {
        openrouter: {
          reasoning: {
            max_tokens: effortToTokens(reasoningEffort as "low" | "medium" | "high"),
          },
        },
      };

    case "vertex":
      return {
        google: {
          thinkingConfig: {
            includeThoughts: true,
            thinkingBudget: effortToTokens(reasoningEffort as "low" | "medium" | "high"),
          },
        },
      };

    default:
      return undefined;
  }
}

/**
 * Get the current AI provider configuration details
 */
export function getAIProviderInfo() {
  const currentConfig = config.getConfig();
  const provider = currentConfig.provider || "openai";
  const defaultModels = {
    openai: "gpt-4.1-mini",
    openrouter: "openai/gpt-4.1-mini",
    google: "gemini-2.5-flash",
    vertex: "gemini-2.5-flash",
    ollama: "llama3.2",
    lmstudio: "local-model",
    "openai-compatible": "gpt-4",
  };
  const model = currentConfig.model || defaultModels[provider as keyof typeof defaultModels];

  // Check API key availability
  let hasApiKey = false;
  let keySource: "global" | "env" | "not_set" | "adc" = "not_set";

  if (provider === "openrouter") {
    if (getEnv("OPENROUTER_API_KEY")) {
      hasApiKey = true;
      keySource = "env";
    } else if (currentConfig.openrouter_api_key) {
      hasApiKey = true;
      keySource = "global";
    }
  } else if (provider === "google") {
    if (getEnv("GOOGLE_GENERATIVE_AI_API_KEY")) {
      hasApiKey = true;
      keySource = "env";
    } else if (currentConfig.google_generative_ai_api_key) {
      hasApiKey = true;
      keySource = "global";
    }
  } else if (provider === "vertex") {
    // For Vertex AI, check if project is configured (ADC is assumed)
    const hasProject = !!(
      currentConfig.vertex_project ||
      getEnv("GOOGLE_VERTEX_PROJECT") ||
      getEnv("GOOGLE_CLOUD_PROJECT") ||
      getEnv("GCP_PROJECT")
    );
    if (hasProject) {
      hasApiKey = true;
      keySource = "adc";
    }
  } else if (provider === "ollama" || provider === "lmstudio") {
    // Local providers are always considered available
    hasApiKey = true;
    keySource = "global";
  } else if (provider === "openai-compatible") {
    // Check if base URL is configured
    if (currentConfig.openai_compatible_base_url || getEnv("SPARK_OPENAI_COMPATIBLE_BASE_URL")) {
      hasApiKey = true;
      keySource = currentConfig.openai_compatible_base_url ? "global" : "env";
    }
  } else {
    if (getEnv("OPENAI_API_KEY")) {
      hasApiKey = true;
      keySource = "env";
    } else if (currentConfig.openai_api_key) {
      hasApiKey = true;
      keySource = "global";
    }
  }

  return { provider, model, hasApiKey, keySource };
}

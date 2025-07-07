import { LanguageModel } from "ai";
import { openai, createOpenAI } from "@ai-sdk/openai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { config } from "./config.js";

/**
 * Creates and configures an AI language model based on the current configuration
 * Can be used by both CLI and server with optional overrides
 */
export function createAIProvider(overrides?: {
  provider?: string;
  model?: string;
  openai_api_key?: string;
  openrouter_api_key?: string;
}): LanguageModel {
  const currentConfig = config.getConfig();
  const provider = overrides?.provider || currentConfig.provider || "openai";

  // Create temporary config with overrides
  const configWithOverrides = {
    ...currentConfig,
    ...(overrides?.openai_api_key && { openai_api_key: overrides.openai_api_key }),
    ...(overrides?.openrouter_api_key && { openrouter_api_key: overrides.openrouter_api_key }),
  };

  // Get API key and model
  const { apiKey, model } = getProviderConfig(provider, configWithOverrides, overrides?.model);

  // Create provider instance
  switch (provider) {
    case "openai":
      return apiKey !== process.env.OPENAI_API_KEY
        ? createOpenAI({ apiKey })(model)
        : openai(model);

    case "openrouter":
      return createOpenRouter({
        apiKey,
        headers: {
          "HTTP-Referer": "https://github.com/Mozilla-Ocho/spark",
          "X-Title": "Spark Web Automation Tool",
        },
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
    openai: "gpt-4.1",
    openrouter: "openai/gpt-4.1",
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
 * Get the current AI provider configuration details
 */
export function getAIProviderInfo() {
  const currentConfig = config.getConfig();
  const provider = currentConfig.provider || "openai";
  const defaultModels = {
    openai: "gpt-4.1",
    openrouter: "openai/gpt-4.1",
  };
  const model = currentConfig.model || defaultModels[provider as keyof typeof defaultModels];

  // Check API key availability
  let hasApiKey = false;
  let keySource: "global" | "env" | "not_set" = "not_set";

  if (provider === "openrouter") {
    if (process.env.OPENROUTER_API_KEY) {
      hasApiKey = true;
      keySource = "env";
    } else if (currentConfig.openrouter_api_key) {
      hasApiKey = true;
      keySource = "global";
    }
  } else {
    if (process.env.OPENAI_API_KEY) {
      hasApiKey = true;
      keySource = "env";
    } else if (currentConfig.openai_api_key) {
      hasApiKey = true;
      keySource = "global";
    }
  }

  return { provider, model, hasApiKey, keySource };
}

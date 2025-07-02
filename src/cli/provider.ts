import { LanguageModel } from "ai";
import { openai, createOpenAI } from "@ai-sdk/openai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createVertex } from "@ai-sdk/google-vertex";
import { config } from "./config.js";

/**
 * Creates and configures an AI language model based on the current configuration
 */
export function createAIProvider(): LanguageModel {
  const currentConfig = config.getConfig();
  const provider = currentConfig.provider || "openai";

  // Get API key and model
  const { apiKey, model } = getProviderConfig(provider, currentConfig);

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
          "HTTP-Referer": "https://github.com/your-org/spark",
          "X-Title": "Spark Web Automation Tool",
        },
      })(model);

    case "vertex":
      const { project, location } = getVertexConfig(currentConfig);
      return createVertex({
        project,
        location,
      })(model);

    default:
      throw new Error(`Unsupported AI provider: ${provider}`);
  }
}

/**
 * Get API key and model for a provider
 */
function getProviderConfig(provider: string, currentConfig: any) {
  const defaultModels = {
    openai: "gpt-4.1",
    openrouter: "openai/gpt-4.1",
    vertex: "gemini-2.5-flash",
  };

  const model = currentConfig.model || defaultModels[provider as keyof typeof defaultModels];

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
  } else if (provider === "vertex") {
    // Vertex AI uses Application Default Credentials, no API key needed
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
    process.env.GOOGLE_VERTEX_PROJECT ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCP_PROJECT;

  // Try to get location from various sources:
  // 1. Explicit configuration
  // 2. Environment variables
  // 3. Google Cloud metadata service (if running in GCP)
  // 4. Default to us-central1
  const location =
    currentConfig.vertex_location ||
    process.env.GOOGLE_VERTEX_LOCATION ||
    process.env.GOOGLE_CLOUD_REGION ||
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
 * Get the current AI provider configuration details
 */
export function getAIProviderInfo() {
  const currentConfig = config.getConfig();
  const provider = currentConfig.provider || "openai";
  const defaultModels = {
    openai: "gpt-4.1",
    openrouter: "openai/gpt-4.1",
    vertex: "gemini-2.5-flash",
  };
  const model = currentConfig.model || defaultModels[provider as keyof typeof defaultModels];

  // Check API key availability
  let hasApiKey = false;
  let keySource: "global" | "env" | "not_set" | "adc" = "not_set";

  if (provider === "openrouter") {
    if (process.env.OPENROUTER_API_KEY) {
      hasApiKey = true;
      keySource = "env";
    } else if (currentConfig.openrouter_api_key) {
      hasApiKey = true;
      keySource = "global";
    }
  } else if (provider === "vertex") {
    // For Vertex AI, check if project is configured (ADC is assumed)
    const hasProject = !!(
      currentConfig.vertex_project ||
      process.env.GOOGLE_VERTEX_PROJECT ||
      process.env.GOOGLE_CLOUD_PROJECT ||
      process.env.GCP_PROJECT
    );
    if (hasProject) {
      hasApiKey = true;
      keySource = "adc";
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

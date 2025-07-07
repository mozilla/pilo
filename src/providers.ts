import { LanguageModel } from "ai";
import { openai, createOpenAI } from "@ai-sdk/openai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createVertex } from "@ai-sdk/google-vertex";
import { getEnv } from "./env.js";

/**
 * Provider configuration for creating AI providers
 */
export interface ProviderConfig {
  /** Provider name */
  provider: "openai" | "openrouter" | "vertex";
  /** Model name */
  model: string;
  /** API key (not needed for Vertex with ADC) */
  apiKey?: string;
  /** Vertex project ID (for Vertex AI) */
  vertexProject?: string;
  /** Vertex location (for Vertex AI) */
  vertexLocation?: string;
}

/**
 * Creates a provider instance from explicit configuration
 * Browser-compatible version that doesn't depend on file system config
 */
export function createProvider(config: ProviderConfig): LanguageModel {
  const { provider, model, apiKey, vertexProject, vertexLocation } = config;

  switch (provider) {
    case "openai":
      if (!apiKey) {
        throw new Error("OpenAI API key is required");
      }
      // In browser environments, always use the provided apiKey
      // In Node.js environments, check against environment variable
      const shouldUseCustomKey = apiKey !== getEnv("OPENAI_API_KEY");
      return shouldUseCustomKey ? createOpenAI({ apiKey })(model) : openai(model);

    case "openrouter":
      if (!apiKey) {
        throw new Error("OpenRouter API key is required");
      }
      return createOpenRouter({
        apiKey,
        headers: {
          "HTTP-Referer": "https://github.com/Mozilla-Ocho/spark",
          "X-Title": "Spark Web Automation Tool",
        },
      })(model);

    case "vertex":
      if (!vertexProject) {
        throw new Error("Vertex project ID is required");
      }
      return createVertex({
        project: vertexProject,
        location: vertexLocation || "us-central1",
      })(model);

    default:
      throw new Error(`Unsupported AI provider: ${provider}`);
  }
}

/**
 * Default models for each provider
 */
export const DEFAULT_MODELS = {
  openai: "gpt-4.1",
  openrouter: "openai/gpt-4.1",
  vertex: "gemini-2.5-flash",
} as const;

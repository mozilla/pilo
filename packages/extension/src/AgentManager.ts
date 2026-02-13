import { ExtensionBrowser } from "./ExtensionBrowser";
import { EventStoreLogger } from "./EventStoreLogger";

// Import shared code - browser-safe imports only
import { WebAgent, Logger } from "@core";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOllama } from "ollama-ai-provider-v2";

/**
 * OpenRouter attribution headers
 */
const OPENROUTER_HEADERS = {
  "HTTP-Referer": "https://github.com/Mozilla-Ocho/spark",
  "X-Title": "Spark Web Automation Tool",
};

/**
 * AgentManager - Main entry point for running Spark tasks in the extension
 * Uses the same shared provider system as CLI and server
 */
export class AgentManager {
  /**
   * Run a web automation task using Spark
   *
   * @param task - The task description in natural language
   * @param options - Configuration options
   * @param options.apiKey - API key for the provider (optional for Ollama)
   * @param options.provider - AI provider to use (defaults to "openai")
   * @param options.model - Model name (uses provider-specific defaults if not specified)
   * @param options.apiEndpoint - Custom API endpoint (used by OpenAI and Ollama)
   * @param options.logger - Custom logger implementation
   * @param options.tabId - Browser tab ID to operate on
   * @param options.data - Additional context data
   * @param options.abortSignal - Signal to abort the task
   * @returns The final answer from the agent
   */
  static async runTask(
    task: string,
    options: {
      apiKey: string;
      apiEndpoint?: string;
      model?: string;
      provider?: "openai" | "openrouter" | "google" | "ollama";
      logger?: Logger;
      tabId?: number;
      data?: any;
      abortSignal?: AbortSignal;
    },
  ): Promise<string> {
    const browser = new ExtensionBrowser(options.tabId);

    // Create provider-specific model
    const provider = options.provider || "openai";
    const modelName = options.model || this.getDefaultModel(provider);
    const model = this.createProviderModel(
      provider,
      options.apiKey,
      options.apiEndpoint,
      modelName,
    );

    // Create WebAgent - same as CLI and server
    const agent = new WebAgent(browser, {
      providerConfig: {
        model,
        providerOptions: undefined, // No reasoning support in extension yet
      },
      logger: options.logger,
      debug: false,
    });

    try {
      const result = await agent.execute(task, {
        data: options.data,
        abortSignal: options.abortSignal,
      });
      return result.finalAnswer || "Task completed successfully";
    } finally {
      await agent.close();
    }
  }

  /**
   * Get the default model for a provider
   */
  private static getDefaultModel(provider: "openai" | "openrouter" | "google" | "ollama"): string {
    switch (provider) {
      case "openrouter":
        return "google/gemini-2.5-flash";
      case "google":
        return "gemini-2.5-flash";
      case "ollama":
        return "llama3.2";
      default:
        return "gpt-4.1-mini";
    }
  }

  /**
   * Create a provider-specific model instance
   *
   * Note: apiEndpoint is used by OpenAI and Ollama providers.
   * Other providers use their own fixed endpoints and ignore this parameter.
   */
  private static createProviderModel(
    provider: "openai" | "openrouter" | "google" | "ollama",
    apiKey: string,
    apiEndpoint: string | undefined,
    modelName: string,
  ) {
    switch (provider) {
      case "openrouter": {
        // OpenRouter has its own endpoint, apiEndpoint parameter is ignored
        const openrouter = createOpenRouter({
          apiKey,
          headers: OPENROUTER_HEADERS,
        });
        return openrouter(modelName);
      }

      case "google": {
        const google = createGoogleGenerativeAI({
          apiKey,
        });
        return google(modelName);
      }

      case "ollama": {
        const baseURL = apiEndpoint || "http://localhost:11434/api";
        const ollama = createOllama({
          baseURL,
        });
        return ollama(modelName);
      }

      default: {
        // OpenAI
        const endpoint = apiEndpoint || "https://api.openai.com/v1";
        const openai = createOpenAI({
          apiKey,
          baseURL: endpoint,
        });
        return openai(modelName);
      }
    }
  }
}

// Export for use in other parts of the extension
export { ExtensionBrowser, EventStoreLogger };

import { ExtensionBrowser } from "./ExtensionBrowser";
import { EventStoreLogger } from "./EventStoreLogger";

// Import shared code - browser-safe imports only
import { WebAgent, Logger } from "spark/core";
import { createOpenAI } from "@ai-sdk/openai";

/**
 * AgentManager - Main entry point for running Spark tasks in the extension
 * Uses the same shared provider system as CLI and server
 */
export class AgentManager {
  /**
   * Run a web automation task using Spark
   */
  static async runTask(
    task: string,
    options: {
      apiKey: string;
      apiEndpoint?: string;
      model?: string;
      logger?: Logger;
      tabId?: number;
      data?: any;
      abortSignal?: AbortSignal;
    },
  ): Promise<string> {
    const browser = new ExtensionBrowser(options.tabId);

    // Create OpenAI provider directly for browser extension
    const apiEndpoint = options.apiEndpoint || "https://api.openai.com/v1";
    const modelName = options.model || "gpt-4.1-mini";

    const openai = createOpenAI({
      apiKey: options.apiKey,
      baseURL: apiEndpoint,
    });
    const model = openai(modelName);

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
}

// Export for use in other parts of the extension
export { ExtensionBrowser, EventStoreLogger };

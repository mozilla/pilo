import { ExtensionBrowser } from "./ExtensionBrowser";
import { ExtensionLogger } from "./ExtensionLogger";

// Import shared code - same as CLI and server use
import { WebAgent, createProvider, DEFAULT_MODELS } from "spark/core";

/**
 * AgentAPI - Main entry point for running Spark tasks in the extension
 * Uses the same shared provider system as CLI and server
 */
export class AgentAPI {
  /**
   * Run a web automation task using Spark
   */
  static async runTask(
    task: string,
    options: {
      provider?: "openai" | "openrouter" | "vertex";
      apiKey: string;
      apiEndpoint?: string;
      model?: string;
      logger?: ExtensionLogger;
    },
  ): Promise<string> {
    const browser = new ExtensionBrowser();

    // Use the same provider creation system as CLI/server
    const providerType = options.provider || "openai";
    const model = options.model || DEFAULT_MODELS[providerType];

    const provider = createProvider({
      provider: providerType,
      model,
      apiKey: options.apiKey,
    });

    // Create WebAgent - same as CLI and server
    const agent = new WebAgent(browser, {
      provider,
      logger: options.logger,
      debug: true,
    });

    try {
      const result = await agent.execute(task);
      return result.finalAnswer || "Task completed successfully";
    } finally {
      await agent.close();
    }
  }
}

// Export for use in other parts of the extension
export { ExtensionBrowser, ExtensionLogger };

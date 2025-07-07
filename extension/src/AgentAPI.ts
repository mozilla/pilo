import { ExtensionBrowser } from "./ExtensionBrowser";
import { EventStoreLogger } from "./EventStoreLogger";

// Import shared code - browser-safe imports only
import { WebAgent, Logger } from "spark/core";
import { createOpenAI } from "@ai-sdk/openai";

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
      apiKey: string;
      model?: string;
      logger?: Logger;
      tabId?: number;
      startUrl?: string;
    },
  ): Promise<string> {
    const browser = new ExtensionBrowser(options.tabId);

    // Create OpenAI provider directly for browser extension
    const openai = createOpenAI({
      apiKey: options.apiKey,
    });
    const provider = openai(options.model || "gpt-4.1");

    // Create WebAgent - same as CLI and server
    const agent = new WebAgent(browser, {
      provider,
      logger: options.logger,
      debug: false,
    });

    try {
      const result = await agent.execute(task, options.startUrl);
      return result.finalAnswer || "Task completed successfully";
    } finally {
      await agent.close();
    }
  }
}

// Export for use in other parts of the extension
export { ExtensionBrowser, EventStoreLogger };

import { createOpenAI } from '@ai-sdk/openai';
import { WebAgent } from '../webAgent.js';
import { ExtensionBrowser } from './extensionBrowser.js';
import { SidebarLogger } from '../loggers.js';

// Expose a function to run a task with the WebAgent and ExtensionBrowser
async function initWebAgent(
  apiKey: string,
  apiEndpoint: string,
  model: string,
  logger: any
) {
  const browser = new ExtensionBrowser();
  const agent = new WebAgent(browser, {
    debug: true,
    logger,
    provider: createOpenAI({
      apiKey: apiKey,
      baseURL: apiEndpoint,
    })(model),
  });
  return agent;
}

// Expose to window for use in sidebar.js
// @ts-ignore
window.AgentAPI = { initWebAgent, SidebarLogger };

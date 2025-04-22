import { createOpenAI } from "@ai-sdk/openai";
import { WebAgent } from "../webAgent.js";
import { ExtensionBrowser } from "./extensionBrowser.js";

// Expose a function to run a task with the WebAgent and ExtensionBrowser
// Accepts: task (string), apiKey (string), apiEndpoint (string), model (string)
async function runWebAgentTask(task: string, apiKey: string, apiEndpoint: string, model: string) {
  const browser = new ExtensionBrowser();
  const agent = new WebAgent(browser, {
    debug: true,
    provider: createOpenAI({
      apiKey: apiKey,
      baseURL: apiEndpoint,
    })(model),
  });
  const result = await agent.execute(task);
  await agent.close();
  return result;
}

// Expose to window for use in sidebar.js
// @ts-ignore
window.AgentAPI = { runWebAgentTask };

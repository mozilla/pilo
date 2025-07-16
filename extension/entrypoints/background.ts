import browser from "webextension-polyfill";
import { AgentAPI, EventStoreLogger } from "../src/AgentAPI";
import type {
  ChromeBrowser,
  ExtensionMessage,
  ExecuteTaskMessage,
  ExecuteTaskResponse,
} from "../src/types/browser";

interface StorageSettings {
  apiKey?: string;
  apiEndpoint?: string;
  model?: string;
}

export default defineBackground(() => {
  console.log("Background script loaded");

  // Handle extension button clicks to open panel
  // Polyfill should normalize but doesn't seem to work properly
  const browserAction = browser.action || browser.browserAction;
  if (browserAction) {
    browserAction.onClicked.addListener(async (tab) => {
      console.log("Extension button clicked for tab:", tab.id);

      // Chrome: Use sidePanel API
      const chromeBrowser = browser as ChromeBrowser;
      if (chromeBrowser.sidePanel) {
        try {
          await chromeBrowser.sidePanel.open({ windowId: tab.windowId });
          console.log("SidePanel opened successfully");
        } catch (error) {
          console.error("Failed to open sidePanel:", error);
        }
      }
      // Firefox: Use sidebarAction API
      else if (browser.sidebarAction) {
        try {
          await browser.sidebarAction.toggle();
          console.log("Sidebar toggled successfully");
        } catch (error) {
          console.error("Failed to toggle sidebar:", error);
        }
      }
      // Fallback: Firefox sidebar should open automatically via manifest
      else {
        console.log("No panel API available - Firefox sidebar should open automatically");
      }
    });
  }

  // Handle messages from sidebar and other parts of the extension
  browser.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    // Type guard to validate message structure
    if (!message || typeof message !== "object" || !("type" in message)) {
      sendResponse({ success: false, message: "Invalid message format" });
      return true;
    }

    const typedMessage = message as ExtensionMessage;
    console.log("Background received message:", typedMessage.type);

    (async () => {
      try {
        let response: ExecuteTaskResponse;

        switch (typedMessage.type) {
          case "executeTask":
            const executeMessage = typedMessage as ExecuteTaskMessage;
            console.log("Executing task:", executeMessage.task);

            // Get settings from storage
            const settings = (await browser.storage.local.get([
              "apiKey",
              "apiEndpoint",
              "model",
            ])) as StorageSettings;

            if (!settings.apiKey) {
              response = {
                success: false,
                message: "API key not configured. Please set up your credentials first.",
              };
              break;
            }

            // Create event store logger to capture events for React
            const logger = new EventStoreLogger();

            try {
              console.log(
                `Starting task execution for tab ${executeMessage.tabId} with data:`,
                executeMessage.data,
              );

              // Use AgentAPI to run the task
              const result = await AgentAPI.runTask(executeMessage.task, {
                apiKey: settings.apiKey,
                model: settings.model || "gpt-4.1",
                logger,
                tabId: executeMessage.tabId,
                data: executeMessage.data,
              });

              console.log(`Task completed successfully:`, result);

              response = {
                success: true,
                result: result,
                events: logger.getEvents(), // Include events for React UI
              };
            } catch (error) {
              console.error("Task execution error:", error);

              response = {
                success: false,
                message: `Task execution failed: ${error instanceof Error ? error.message : String(error)}`,
                events: logger.getEvents(), // Include events even on error
              };
            }
            break;

          default:
            response = {
              success: false,
              message: "Unknown message type",
            };
        }

        console.log("Sending response:", response);
        sendResponse(response);
      } catch (error) {
        console.error("Error in message handler:", error);
        sendResponse({
          success: false,
          message: error instanceof Error ? error.message : "Unknown error occurred",
        });
      }
    })();

    return true; // Required for async response
  });
});

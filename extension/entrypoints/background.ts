import { AgentAPI } from "../src/AgentAPI";
import { ConsoleLogger } from "spark/core";

export default defineBackground(() => {
  console.log("Background script loaded");

  // Explicitly handle action clicks to open sidePanel
  browser.action.onClicked.addListener(async (tab) => {
    console.log("Extension button clicked for tab:", tab.id);

    if (browser.sidePanel && browser.sidePanel.open) {
      try {
        await browser.sidePanel.open({ tabId: tab.id });
        console.log("SidePanel opened successfully");
      } catch (error) {
        console.error("Failed to open sidePanel:", error);
      }
    } else {
      console.error("sidePanel API not available");
    }
  });

  // Handle messages from sidebar and other parts of the extension
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("Background received message:", message.type);

    (async () => {
      try {
        let response;

        switch (message.type) {
          case "executeTask":
            console.log("Executing task:", message.task);

            // Get settings from storage
            const settings = await browser.storage.local.get(["apiKey", "apiEndpoint", "model"]);

            if (!settings.apiKey) {
              response = {
                success: false,
                message: "API key not configured. Please set up your credentials first.",
              };
              break;
            }

            try {
              // Create console logger for debugging
              const logger = new ConsoleLogger();

              console.log(
                `Starting task execution for tab ${message.tabId} with URL: ${message.startUrl}`,
              );

              // Use AgentAPI to run the task
              const result = await AgentAPI.runTask(message.task, {
                apiKey: settings.apiKey,
                model: settings.model || "gpt-4o",
                logger: logger,
                tabId: message.tabId,
                startUrl: message.startUrl,
              });

              console.log(`Task completed successfully:`, result);

              response = {
                success: true,
                result: result,
              };
            } catch (error) {
              console.error("Task execution error:", error);
              response = {
                success: false,
                message: `Task execution failed: ${error.message}`,
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
          message: error.message || "Unknown error occurred",
        });
      }
    })();

    return true; // Required for async response
  });
});
